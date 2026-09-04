import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { OrderItem } from '@maqserv/types';
import { parseCart } from './cart.util';

/** Lo que se descuenta/devuelve: producto + cuántas piezas. */
export interface StockLine {
  productId: number;
  qty: number;
}

/** Cliente de Prisma dentro de una `$transaction` (o el global fuera de ella). */
type Db = Pick<typeof prisma, 'products' | 'orders'>;

/**
 * Inventario de las órdenes.
 *
 * Modelo (heredado del Laravel viejo y confirmado contra su código):
 * - `products.stock = null` significa SIN CONTROL de inventario: nunca bloquea ni se
 *   toca. Hoy los 27 productos activos tienen stock, pero el legacy permitía null y el
 *   panel también, así que la regla se respeta.
 * - La orden RETIENE el stock desde que se crea (igual que el legacy, que descontaba al
 *   guardar la orden, no al pagar): una transferencia sin pagar ya aparta el equipo.
 * - La retención se devuelve UNA sola vez, vía `release()`:
 *     · `cancelado`   → vuelve todo (no se consumió nada).
 *     · `recolectado` → vuelve SOLO lo rentado (el equipo regresó del cliente).
 *   La venta entregada no vuelve nunca: se vendió.
 *
 * Toda escritura es un `updateMany` CONDICIONAL: la condición viaja en el WHERE y
 * Postgres la evalúa bajo su propio candado de fila, así que dos checkouts simultáneos
 * no pueden pasar los dos. Es el mismo patrón con el que se arregló `/retiros`.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  /** Solo las líneas de productos que llevan control de inventario (`stock != null`). */
  private tracked(lines: StockLine[], stockById: Map<number, number | null>): StockLine[] {
    return lines.filter((l) => stockById.get(l.productId) !== null && stockById.has(l.productId));
  }

  /**
   * Aviso temprano y con nombre ANTES de cobrar y de llamar al cotizador de flete.
   * No es la defensa real —entre esto y el descuento cabe otra compra—: la autoridad
   * es `hold()`, que es atómico. Esto solo evita el error feo al final del checkout.
   */
  assertAvailable(
    lines: StockLine[],
    products: { id: number; name: string; stock: number | null }[],
  ): void {
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const l of lines) {
      const p = byId.get(l.productId);
      if (!p || p.stock === null) continue;
      if (p.stock < l.qty) {
        throw new BadRequestException(
          p.stock <= 0
            ? `"${p.name}" está agotado.`
            : `Solo quedan ${p.stock} de "${p.name}" y pediste ${l.qty}.`,
        );
      }
    }
  }

  /**
   * Descuenta el stock. Va DENTRO de la transacción que crea la orden: si algo falla
   * después, Postgres deshace el descuento y el equipo no queda apartado por una orden
   * que no existe.
   *
   * `stock: { gte: qty }` no matchea filas con stock NULL (semántica SQL), por eso las
   * de `stock = null` se excluyen antes en vez de dejarlas fallar como "sin stock".
   */
  async hold(db: Db, lines: StockLine[], stockById: Map<number, number | null>): Promise<void> {
    for (const l of this.tracked(lines, stockById)) {
      const r = await db.products.updateMany({
        where: { id: l.productId, stock: { gte: l.qty } },
        data: { stock: { decrement: l.qty } },
      });
      // Aquí ya no hay nombre que mostrar sin otra query: alguien se adelantó entre la
      // validación y este punto. El mensaje es genérico a propósito.
      if (r.count === 0) {
        throw new BadRequestException(
          'Alguien acaba de llevarse las últimas piezas de un equipo de tu carrito. Revísalo e intenta de nuevo.',
        );
      }
    }
  }

  /**
   * Devuelve al inventario lo que la orden retenía. Idempotente: el flag `stock_released`
   * se reclama con un `updateMany` condicional, así que dos llamadas simultáneas (o un
   * `recolectado` seguido de `cancelado`) solo devuelven una vez.
   *
   * @param scope `rental` devuelve solo el equipo rentado; `all`, todo.
   * @returns si esta llamada fue la que devolvió el stock.
   */
  async release(orderId: number, scope: 'all' | 'rental'): Promise<boolean> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: { id: true, cart: true, stock_released: true },
    });
    if (!order || order.stock_released) return false;

    // Las órdenes del Laravel viejo traen el cart en bzip2 → `items` vacío → no hay nada
    // que devolver. No se marcan como liberadas: nunca retuvieron stock en este sistema.
    const items = parseCart(order.cart).items;
    const lines = this.linesFor(items, scope);
    if (lines.length === 0) return false;

    // Candado + devoluciones en UNA transacción. Antes el flag se marcaba en
    // una escritura suelta y los increment iban después: un corte del proceso
    // entre ambas (Render free reiniciándose es rutina) dejaba el flag en
    // "devuelto" con el stock sin devolver — y como el flag ES el candado,
    // ninguna reintentada lo tocaría jamás. Con la transacción, o pasa todo o
    // no pasa nada y el siguiente intento vuelve a encontrar el flag en false.
    const devuelto = await prisma.$transaction(async (tx) => {
      const claim = await tx.orders.updateMany({
        where: { id: orderId, stock_released: false },
        data: { stock_released: true },
      });
      if (claim.count === 0) return false; // otro proceso se adelantó

      for (const l of lines) {
        // `stock: { not: null }` respeta a los productos sin control de inventario y, de
        // paso, ignora los que ya no existen.
        await tx.products.updateMany({
          where: { id: l.productId, stock: { not: null } },
          data: { stock: { increment: l.qty } },
        });
      }
      return true;
    });
    if (!devuelto) return false;
    this.logger.log(`Orden ${orderId}: stock devuelto (${scope}), ${lines.length} línea(s)`);
    return true;
  }

  /** Agrupa por producto: un carrito puede repetir el mismo id en varias líneas. */
  linesFor(items: OrderItem[], scope: 'all' | 'rental'): StockLine[] {
    const byProduct = new Map<number, number>();
    for (const i of items) {
      // Solo los items de renta traen `period` (mismo criterio que `hasRentalItems`).
      if (scope === 'rental' && !i.period) continue;
      const qty = Math.max(0, Math.floor(i.qty));
      if (qty === 0) continue;
      byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + qty);
    }
    // ORDEN FIJO por producto: dos checkouts con los mismos equipos en orden
    // inverso tomaban los candados de fila cruzados y Postgres abortaba uno
    // por deadlock. Con todos bloqueando en el mismo orden, no hay ciclo.
    return [...byProduct]
      .map(([productId, qty]) => ({ productId, qty }))
      .sort((a, b) => a.productId - b.productId);
  }
}
