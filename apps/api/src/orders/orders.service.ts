import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { CheckoutInput, CouponCheck, OrderDetail, OrderItem, OrderSummary, OrderTotals, RentalPeriod } from '@maqserv/types';
import { toFulfillment } from '@maqserv/types';
import { checkoutSchema, claveDeCarrito, precioPeriodoCarrito, unidadDeCobro, UNIDADES } from '@maqserv/config';
import { imageUrl } from '../catalog/images';
import { FreightService } from '../freight/freight.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FulfillmentService, toShipping } from './fulfillment.service';
import { StockService } from './stock.service';
import { hasRentalItems, parseCart, type CartV2 } from './cart.util';

/** Réplica del formato legacy: 4 chars alfanuméricos + unix timestamp. */
function newOrderNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `${rand}${Math.floor(Date.now() / 1000)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const METHOD_LABEL: Record<string, string> = {
  transferencia: 'Depósito bancario',
  mercadopago: 'MercadoPago',
};

/**
 * EL METODO DE PAGO SE GUARDA COMO TEXTO DENTRO DE CADA PEDIDO, no como clave.
 *
 * Asi que corregir `METHOD_LABEL` solo arregla los pedidos NUEVOS: los que ya
 * estan en la base conservan la cadena con la que se crearon, y ahi hay dos
 * heredadas del Laravel viejo que se le muestran al cliente con faltas:
 * "Deposito bancario" (sin acento) y "Targeta de credito,debito o prepaga".
 *
 * Se normaliza AL LEER —y no con un UPDATE— por dos razones: reescribir el
 * historico de pedidos para arreglar una tilde es desproporcionado, y hacerlo
 * aqui deja una sola fuente para las tres pantallas que lo pintan (mis pedidos,
 * el detalle del pedido y el panel).
 */
const METODOS_HEREDADOS: Record<string, string> = {
  'deposito bancario': 'Depósito bancario',
  'targeta de credito,debito o prepaga': 'Tarjeta de crédito, débito o prepaga',
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function etiquetaMetodoPago(raw: string | null | undefined): string {
  if (!raw) return '';
  return METODOS_HEREDADOS[sinAcentos(raw)] ?? raw;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly freight: FreightService,
    private readonly notifications: NotificationsService,
    private readonly fulfillment: FulfillmentService,
    private readonly stock: StockService,
  ) {}

  private toSummary(o: {
    id: number; order_number: string; status: string; payment_status: string;
    method: string | null; pay_amount: number; totalQty: string; created_at: Date | null;
  }): OrderSummary {
    return {
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      paymentStatus: o.payment_status,
      method: etiquetaMetodoPago(o.method),
      total: o.pay_amount,
      totalQty: Number(o.totalQty) || 0,
      createdAt: o.created_at ? o.created_at.toISOString() : null,
    };
  }

  /**
   * Tope de usos del cupón. `times` es texto en la BD legacy: vacío, null o basura
   * significan SIN LÍMITE. Fuente única para la vista previa y para el cobro.
   */
  private couponLimit(times: string | null): number | null {
    if (!times) return null;
    const n = parseInt(times, 10);
    return Number.isNaN(n) ? null : n;
  }

  /**
   * Gasta un uso del cupón, dentro de la transacción del checkout.
   *
   * El tope viaja en el WHERE (`used < límite`) en vez de comprobarse antes: si dos
   * checkouts entran a la vez con el último uso, los dos pasarían la comprobación previa
   * y el cupón se gastaría de más. Postgres evalúa el WHERE con la fila bloqueada, así
   * que solo uno lo consigue. Mismo patrón que el stock y que `/retiros`.
   */
  private async consumeCoupon(tx: Pick<typeof prisma, 'coupons'>, code: string): Promise<void> {
    const c = await tx.coupons.findFirst({ where: { code, status: 1 } });
    if (!c) throw new BadRequestException('El cupón no es válido o expiró');
    const limit = this.couponLimit(c.times);

    const r = await tx.coupons.updateMany({
      // Sin límite → no hay condición que poner: siempre se puede gastar.
      where: { code, status: 1, ...(limit !== null ? { used: { lt: limit } } : {}) },
      data: { used: { increment: 1 } },
    });
    if (r.count === 0) throw new BadRequestException('El cupón ya alcanzó su límite de usos');
  }

  /**
   * Valida un cupón contra el subtotal (type 0 = %, type 1 = monto fijo).
   * Nota: el legacy comparaba solo el día del mes (bug) — aquí fechas completas.
   *
   * La vigencia se evalúa en día calendario de CDMX (UTC-6 fijo): el proceso
   * corre en UTC y con `setHours(23,59,…)` un cupón "válido hasta el 15" moría
   * a las ~6 pm del 15 en México y arrancaba la tarde del día anterior.
   */
  async checkCoupon(code: string, subtotal: number): Promise<CouponCheck> {
    const base: CouponCheck = { valid: false, reason: 'not_found', code, discount: 0, label: null };
    const c = await prisma.coupons.findFirst({ where: { code, status: 1 } });
    if (!c) return base;

    const CDMX_OFFSET_MS = 6 * 3_600_000; // sin horario de verano desde 2022
    const s = new Date(c.start_date);
    const e = new Date(c.end_date);
    // Medianoche CDMX del día de inicio, y medianoche CDMX del día SIGUIENTE
    // al de fin (fin inclusivo, límite exclusivo).
    const inicio = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) + CDMX_OFFSET_MS);
    const fin = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()) + 86_400_000 + CDMX_OFFSET_MS);
    const now = new Date();
    if (now < inicio || now >= fin) return { ...base, reason: 'expired' };

    const times = this.couponLimit(c.times);
    if (times !== null && c.used >= times) {
      return { ...base, reason: 'exhausted' };
    }

    const discount = c.type === 0
      ? Math.round(subtotal * c.price) / 100
      : Math.min(c.price, subtotal);
    return {
      valid: true,
      reason: null,
      code,
      discount: Math.round(discount * 100) / 100,
      label: c.type === 0 ? `${c.price}%` : null,
    };
  }

  /** Ajustes de cobro (IVA/operador/traslado) del tema activo — Panel → Pagos y Traslado. */
  private async checkoutConfig() {
    const row = await prisma.theme.findFirst({ where: { active: true }, select: { tokens: true } });
    const tokens = (row?.tokens ?? {}) as { checkout?: unknown };
    return checkoutSchema.parse(tokens.checkout ?? {});
  }

  async create(userId: number, input: CheckoutInput): Promise<{ order: OrderSummary; total: number }> {
    if (input.items.length === 0) throw new BadRequestException('El carrito está vacío');

    // Idempotencia: si este INTENTO ya creó una orden (el proxy agotó su tiempo
    // pero la petición llegó, o el usuario reintentó tras un error), se devuelve
    // esa orden en vez de volver a retener stock y gastar cupón.
    if (input.idempotencyKey) {
      const previa = await prisma.orders.findFirst({
        where: { idempotency_key: input.idempotencyKey, user_id: userId },
      });
      if (previa) return { order: this.toSummary(previa), total: previa.pay_amount };
    }

    // Precios desde la BD — jamás del cliente. Productos, config del tema y
    // cotización de flete son independientes entre sí: en paralelo se ahorran
    // ~2 RTT y el viaje a internet del geocodificador corre traslapado.
    const ids = input.items.map((i) => i.productId);
    const [products, cfg, freightQuote] = await Promise.all([
      prisma.products.findMany({
        where: { id: { in: ids }, status: 1 },
        select: {
          id: true, name: true, cprice: true, photo: true, stock: true, user_id: true,
          is_rental: true, rental_freight: true, price_unit: true,
        },
      }),
      this.checkoutConfig(),
      // Traslado (Panel → Traslado): se recalcula aquí con la dirección de la
      // orden. Nunca se toma el monto del navegador. Si no se puede calcular,
      // cobra 0 y se cotiza aparte.
      this.freight.quote({
        address: [input.customer.address, input.customer.city, input.customer.zip ? `CP ${input.customer.zip}` : '']
          .filter(Boolean)
          .join(', '),
        items: input.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));

    // Renta: el precio se convierte desde la UNIDAD CAPTURADA (`price_unit`) al
    // periodo elegido, con la MISMA función que usa la ficha de producto
    // (`precioPeriodoCarrito`). Antes el server asumía `cprice` mensual: un
    // equipo capturado por hora se cobraba ÷20 — hasta en $0.
    const items: OrderItem[] = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new BadRequestException(`Producto ${i.productId} no disponible`);
      const qty = Math.max(1, Math.min(999, Math.floor(i.qty)));
      if (p.is_rental) {
        const unidadBase = p.price_unit ?? 'mes'; // la renta vieja era mensual
        const unidad = unidadDeCobro(unidadBase, i.period ?? null);
        const period = claveDeCarrito(unidad) as RentalPeriod;
        return {
          productId: p.id, name: p.name, qty, image: imageUrl(p.photo),
          price: precioPeriodoCarrito(p.cprice, unidadBase, period),
          period,
          unitLabel: (UNIDADES[unidad]?.singular ?? unidad).toUpperCase(),
        };
      }
      return { productId: p.id, name: p.name, price: p.cprice, qty, image: imageUrl(p.photo) };
    });

    // Inventario: avisar AQUÍ, con el nombre del equipo y antes de cobrar.
    // El descuento real y atómico va abajo, en la transacción.
    const stockLines = this.stock.linesFor(items, 'all');
    this.stock.assertAvailable(stockLines, products);

    const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    // Cupón: validar server-side. El `used++` NO va aquí: vive en la transacción de
    // abajo, porque si la orden no llega a crearse (p. ej. sin stock) el cupón no
    // debe gastarse.
    let couponDiscount = 0;
    let couponCode: string | null = null;
    if (input.couponCode) {
      const check = await this.checkCoupon(input.couponCode, subtotal);
      if (!check.valid) throw new BadRequestException('El cupón no es válido o expiró');
      couponDiscount = check.discount;
      couponCode = check.code;
    }

    // Cobro configurable (Panel → Pagos): operador + IVA. El servidor manda.
    const operatorCost = input.operator && cfg.operator.enabled ? round2(totalQty * cfg.operator.amount) : 0;
    const freightCost = freightQuote.status === 'ok' ? freightQuote.cost : 0;

    const taxable = round2(Math.max(0, subtotal - couponDiscount) + operatorCost + freightCost);
    // Si el precio YA incluye impuesto, no se suma nada (solo se desglosa en la vista).
    const tax = cfg.tax.enabled && !cfg.tax.included ? round2(taxable * (cfg.tax.rate / 100)) : 0;
    const total = round2(taxable + tax);

    const cart: CartV2 = {
      v: 2,
      items,
      totals: {
        subtotal, discount: couponDiscount, operator: operatorCost,
        freight: freightCost,
        freightKm: freightQuote.km,
        freightLabel: freightQuote.label,
        freightNote: freightQuote.status === 'ok' ? '' : freightQuote.message,
        tax, taxRate: cfg.tax.rate, taxLabel: cfg.tax.label,
        taxIncluded: cfg.tax.enabled && cfg.tax.included,
        total,
      },
    };

    /**
     * Todo lo que escribe va junto: descontar stock, gastar el cupón, crear la orden y
     * generar los vendor_orders. Si cualquiera falla, Postgres deshace el resto — antes,
     * un error después del `used++` dejaba el cupón gastado sin orden, y el stock se
     * habría apartado igual.
     *
     * El cotizador de flete se llamó ARRIBA a propósito: es una petición a internet y
     * no puede vivir dentro de la transacción reteniendo candados de fila.
     */
    const o = await prisma.$transaction(async (tx) => {
      // Carrera de idempotencia: si dos peticiones del MISMO intento entran a la
      // vez, el unique de `idempotency_key` deja pasar solo a una; la otra
      // revienta con P2002 y el catch de abajo devuelve la orden ganadora.
      await this.stock.hold(tx, stockLines, new Map(products.map((p) => [p.id, p.stock])));

      if (couponCode) await this.consumeCoupon(tx, couponCode);

      const created = await tx.orders.create({
      data: {
        user_id: userId,
        cart: Buffer.from(JSON.stringify(cart), 'utf8'),
        method: METHOD_LABEL[input.method] ?? input.method,
        totalQty: String(totalQty),
        pay_amount: total,
        coupon_code: couponCode,
        coupon_discount: couponDiscount > 0 ? String(couponDiscount) : null,
        order_number: newOrderNumber(),
        idempotency_key: input.idempotencyKey ?? null,
        payment_status: 'Pending',
        status: 'pending',
        // El envío arranca esperando el pago; lo adelanta `markPaid` o el panel.
        fulfillment: 'pendiente',
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
        customer_address: input.customer.address,
        customer_city: input.customer.city,
        customer_zip: input.customer.zip,
        order_note: input.note ?? null,
        currency_sign: '$',
        currency_value: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      });

      // NOTA: ya no se crean `rental_periods` — el modelo de renta es por PERIODO
      // (día/semana/mes) × cantidad, sin ventana de fechas. El periodo cobrado queda
      // en el cart de la orden (items[].period). Si algún día se vuelve a rentar por
      // fechas, aquí se reactiva el registro del periodo.

      // Marketplace: los items de productos de vendedor generan su vendor_order.
      // El precio acreditado es el REALMENTE COBRADO (periodo elegido incluido),
      // no el `cprice` mensual — antes una renta por día acreditaba el mes entero.
      // El descuento del cupón no se prorratea (igual que el legacy).
      const vendorItems = items
        .map((it) => ({ item: it, product: byId.get(it.productId) }))
        .filter((x) => x.product && x.product.user_id > 0);
      if (vendorItems.length > 0) {
        await tx.vendor_orders.createMany({
          data: vendorItems.map(({ item: it, product: p }) => ({
            user_id: p!.user_id,
            order_id: created.id,
            qty: it.qty,
            price: Math.round(it.price * it.qty),
            order_number: created.order_number,
            status: 'pending',
          })),
        });
      }

      return created;
    }).catch(async (err: unknown) => {
      // P2002 en idempotency_key = otro proceso del MISMO intento ganó la
      // carrera. La orden ya existe: devolverla, no duplicarla.
      const e = err as { code?: string; meta?: { target?: string[] } };
      if (e?.code === 'P2002' && input.idempotencyKey && (e.meta?.target ?? []).includes('idempotency_key')) {
        const previa = await prisma.orders.findFirst({
          where: { idempotency_key: input.idempotencyKey, user_id: userId },
        });
        if (previa) return previa;
      }
      throw err;
    });

    return { order: this.toSummary(o), total: o.pay_amount };
  }

  async listByUser(userId: number): Promise<OrderSummary[]> {
    // Sin `cart`: es un bytea con el carrito completo y el resumen usa 8 campos.
    const rows = await prisma.orders.findMany({
      where: { user_id: userId },
      orderBy: { id: 'desc' },
      take: 50,
      select: {
        id: true, order_number: true, status: true, payment_status: true,
        method: true, pay_amount: true, totalQty: true, created_at: true,
      },
    });
    return rows.map((o) => this.toSummary(o));
  }

  async byNumber(userId: number, orderNumber: string): Promise<OrderDetail> {
    const o = await prisma.orders.findFirst({
      where: { order_number: orderNumber, user_id: userId },
    });
    if (!o) throw new NotFoundException('Orden no encontrada');
    const { items, totals } = parseCart(o.cart);
    return {
      ...this.toSummary(o),
      items,
      totals,
      shipping: toShipping(o),
      hasRental: hasRentalItems(items),
      customer: {
        name: o.customer_name,
        email: o.customer_email,
        phone: o.customer_phone,
        address: o.customer_address,
        city: o.customer_city,
        zip: o.customer_zip,
      },
      note: o.order_note,
    };
  }

  /**
   * Cancela órdenes IMPAGAS viejas y devuelve su stock (vía `setState`, el
   * único camino). La dispara el cron externo (/tareas/ordenes-vencidas).
   *
   * Sin esto no existía NADA que caducara abandonos: un checkout de MP cerrado
   * sin pagar o una transferencia que nunca llegó apartaban inventario para
   * siempre — con ~27 productos de pocas piezas, unas cuantas órdenes fantasma
   * agotaban la disponibilidad visible hasta que un admin cancelara a mano.
   *
   * Plazos (configurables por entorno): MercadoPago paga al instante — sin
   * pago en 24 h el intento está abandonado; la transferencia da 72 h para
   * depositar. Solo toca órdenes que siguen en fulfillment `pendiente`: si el
   * panel ya la movió, la decisión es del panel.
   */
  async expireUnpaid(): Promise<{ canceladas: number; revisadas: number }> {
    const mpHours = Number(process.env.ORDER_EXPIRY_MP_HOURS ?? 24) || 24;
    const trHours = Number(process.env.ORDER_EXPIRY_TRANSFER_HOURS ?? 72) || 72;
    const now = Date.now();
    const rows = await prisma.orders.findMany({
      where: {
        payment_status: 'Pending',
        fulfillment: 'pendiente',
        created_at: { lt: new Date(now - Math.min(mpHours, trHours) * 3_600_000) },
      },
      select: {
        id: true, order_number: true, user_id: true, fulfillment: true,
        ship_method: true, method: true, created_at: true,
      },
      orderBy: { id: 'asc' },
      take: 200, // lote acotado: el cron corre a diario, lo que no alcance hoy sale mañana
    });

    let canceladas = 0;
    for (const o of rows) {
      const esMp = (o.method ?? '').toLowerCase().includes('mercado');
      const limiteH = esMp ? mpHours : trHours;
      if (!o.created_at || now - o.created_at.getTime() < limiteH * 3_600_000) continue;
      await this.fulfillment.setState(o, 'cancelado', {
        note: `Cancelada automáticamente: sin pago en ${limiteH} h`,
      });
      canceladas++;
    }
    if (canceladas > 0) this.logger.log(`Órdenes vencidas: ${canceladas} cancelada(s) de ${rows.length} revisadas`);
    return { canceladas, revisadas: rows.length };
  }

  /**
   * La usa el webhook de pagos para marcar la orden pagada.
   *
   * Idempotente: MP reenvía notificaciones en ráfagas — un reenvío no repite
   * la campana del cliente ni el avance de envío. `amount` (si el proveedor lo
   * reporta) debe cubrir el total de la orden: es la última línea de defensa
   * del cobro. Un monto corto o una orden cancelada NO lanzan (la condición es
   * permanente, reintentar no la arregla): se registra y se deja rastro en logs
   * para conciliación manual.
   */
  async markPaid(orderNumber: string, txnid: string, amount?: number | null): Promise<void> {
    const o = await prisma.orders.findUnique({
      where: { order_number: orderNumber },
      select: {
        id: true, order_number: true, user_id: true, fulfillment: true,
        ship_method: true, payment_status: true, pay_amount: true,
      },
    });
    if (!o) {
      this.logger.error(`Pago ${txnid}: la orden ${orderNumber} no existe — conciliar manualmente`);
      return;
    }
    if (amount != null && amount + 0.01 < o.pay_amount) {
      this.logger.error(
        `Pago ${txnid} de la orden ${orderNumber} NO cubre el total ($${amount} < $${o.pay_amount}) — NO se marca pagada; conciliar manualmente`,
      );
      return;
    }
    if (o.payment_status === 'Completed') return; // reenvío de MP: ya se procesó

    if (toFulfillment(o.fulfillment) === 'cancelado') {
      // El dinero llegó pero la orden ya se canceló (y su stock ya se devolvió):
      // se guarda el txnid como rastro, sin marcarla pagada ni avanzarla, y se
      // grita en logs — esto requiere reembolso manual.
      await prisma.orders.update({ where: { id: o.id }, data: { txnid, updated_at: new Date() } });
      this.logger.error(
        `Pago ${txnid} recibido para la orden ${orderNumber} que está CANCELADA — requiere reembolso/conciliación manual`,
      );
      return;
    }

    // El WHERE condicional cierra la carrera de dos webhooks simultáneos:
    // solo uno gana y solo ese manda la notificación.
    const r = await prisma.orders.updateMany({
      where: { id: o.id, payment_status: { not: 'Completed' } },
      data: { payment_status: 'Completed', txnid, updated_at: new Date() },
    });
    if (r.count === 0) return;

    // Aviso al cliente: el webhook llega cuando ya no está en el sitio.
    await this.notifications.push({
      userId: o.user_id,
      type: 'payment_confirmed',
      title: `Confirmamos el pago de tu pedido ${orderNumber}`,
      body: 'Ya podemos programar el traslado de tu equipo.',
      link: `/pedido/${orderNumber}`,
      orderId: o.id,
    });
    // El pago adelanta el envío a "Pagado" — en silencio, porque el aviso ya se mandó
    // arriba con el tipo `payment_confirmed` (el ícono de la campana depende del tipo).
    // Solo desde `pendiente`: un webhook que llega tarde no debe regresar una orden
    // que el panel ya movió a preparando/enviado.
    if (toFulfillment(o.fulfillment) === 'pendiente') {
      await this.fulfillment.setState(o, 'pagado', { note: 'Pago confirmado automáticamente', silent: true });
    }
  }
}
