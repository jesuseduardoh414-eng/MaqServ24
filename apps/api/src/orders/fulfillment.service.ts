import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import {
  LEGACY_STATUS, fulfillmentStep, toFulfillment, toShipMethod,
  type Fulfillment, type OrderEvent, type OrderShipping,
} from '@maqserv/types';
import { NotificationsService } from '../notifications/notifications.service';
import { StockService } from './stock.service';

/** Lo mínimo que hace falta para mover una orden. Cualquier `prisma.orders` lo cumple. */
export interface FulfillableOrder {
  id: number;
  order_number: string;
  user_id: number;
  fulfillment: string | null;
  ship_method: string | null;
}

/** Encabezado del aviso al cliente. El cuerpo sale del `hint` del paso (texto compartido). */
const TITLE: Record<Fulfillment, (n: string) => string> = {
  pendiente: (n) => `Tu pedido ${n} está pendiente de pago`,
  pagado: (n) => `Confirmamos el pago de tu pedido ${n}`,
  preparando: (n) => `Ya estamos preparando tu pedido ${n}`,
  enviado: (n) => `Tu pedido ${n} va en camino`,
  entregado: (n) => `Entregamos tu pedido ${n}`,
  en_renta: (n) => `El equipo de tu pedido ${n} ya está en tu obra`,
  recolectado: (n) => `Recolectamos el equipo de tu pedido ${n}`,
  cerrado: (n) => `Cerramos tu pedido ${n}`,
  cancelado: (n) => `Tu pedido ${n} fue cancelado`,
};

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stock: StockService,
  ) {}

  /**
   * ÚNICO punto que cambia el estado del envío: escribe `fulfillment`, sincroniza el
   * `status` legacy, sella la fecha del paso, deja el evento en el historial y avisa al
   * cliente. Si alguien actualiza `fulfillment` por fuera, el historial miente.
   *
   * @returns si hubo cambio (repetir el mismo estado no avisa ni registra nada).
   */
  async setState(
    order: FulfillableOrder,
    next: Fulfillment,
    opts: { adminId?: number | null; note?: string | null; silent?: boolean } = {},
  ): Promise<boolean> {
    const from = toFulfillment(order.fulfillment);
    if (from === next) return false;

    /**
     * ESTADOS TERMINALES: una orden cancelada o cerrada no se reactiva. La
     * cancelación ya DEVOLVIÓ el stock (y el candado `stock_released` impide
     * volver a retenerlo): moverla a preparando/enviado entregaría equipo cuyo
     * inventario ya volvió a la tienda — sobreventa silenciosa. Si de verdad
     * hay que revivir una compra, se crea una orden nueva.
     */
    if (from === 'cancelado' || from === 'cerrado') {
      throw new BadRequestException(
        `Una orden ${from === 'cancelado' ? 'cancelada' : 'cerrada'} no puede reactivarse: su inventario ya se liquidó. Crea una orden nueva si hace falta.`,
      );
    }

    const now = new Date();
    // Cada paso sella SU fecha; las demás no se tocan (reabrir un paso no borra el pasado).
    const stamp =
      next === 'enviado' ? { shipped_at: now }
        : next === 'entregado' ? { delivered_at: now }
          : next === 'recolectado' ? { returned_at: now }
            : {};

    // Estado + evento en UNA transacción, con candado optimista en el WHERE:
    // dos admins simultáneos no pueden grabar la misma transición dos veces, y
    // un corte a media escritura ya no deja historial que mienta por omisión.
    const cambio = await prisma.$transaction(async (tx) => {
      const r = await tx.orders.updateMany({
        where: { id: order.id, fulfillment: order.fulfillment },
        data: { fulfillment: next, status: LEGACY_STATUS[next], ...stamp, updated_at: now },
      });
      if (r.count === 0) return false; // otro proceso movió la orden primero
      await tx.order_events.create({
        data: {
          order_id: order.id,
          admin_id: opts.adminId ?? null,
          from_state: from,
          to_state: next,
          note: opts.note?.trim() || null,
          created_at: now,
        },
      });
      return true;
    });
    if (!cambio) return false;

    /**
     * Inventario: la orden retiene stock desde que se crea, y aquí es donde lo suelta.
     * Va en `setState` porque es el ÚNICO camino que mueve el estado — colgarlo del
     * panel dejaría fuera cualquier otro origen.
     *   · cancelado   → vuelve todo: no se entregó nada.
     *   · recolectado → vuelve SOLO lo rentado; lo vendido en esa misma orden ya salió.
     * `release()` es idempotente, así que saltar de `recolectado` a `cancelado` (el panel
     * lo permite) no suma el stock dos veces.
     */
    if (next === 'cancelado' || next === 'recolectado') {
      await this.stock.release(order.id, next === 'cancelado' ? 'all' : 'rental');
    }

    // `silent`: el pago ya manda su propio aviso (`payment_confirmed`), no duplicar.
    if (!opts.silent) {
      const step = fulfillmentStep(next, toShipMethod(order.ship_method));
      await this.notifications.push({
        userId: order.user_id,
        type: 'order_status',
        // "Listo para recoger" no es "va en camino": el título sigue al método.
        title: next === 'enviado' ? `Tu pedido ${order.order_number}: ${step.label.toLowerCase()}` : TITLE[next](order.order_number),
        body: step.hint,
        link: `/pedido/${order.order_number}`,
        orderId: order.id,
      });
    }
    return true;
  }

  /** Historial de la orden, del más viejo al más nuevo. Resuelve el nombre del admin. */
  async events(orderId: number): Promise<OrderEvent[]> {
    const rows = await prisma.order_events.findMany({ where: { order_id: orderId }, orderBy: { id: 'asc' } });
    const ids = [...new Set(rows.map((r) => r.admin_id).filter((v): v is number => v !== null))];
    const admins = ids.length
      ? await prisma.admins.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const names = new Map(admins.map((a) => [a.id, a.name]));
    return rows.map((r) => ({
      id: r.id,
      from: toFulfillment(r.from_state),
      // Un estado desconocido en BD no debe tumbar la vista: degrada a `pendiente`.
      to: toFulfillment(r.to_state) ?? 'pendiente',
      note: r.note,
      by: r.admin_id ? names.get(r.admin_id) ?? `Admin #${r.admin_id}` : null,
      at: r.created_at.toISOString(),
    }));
  }
}

/** Fila de `orders` → DTO de envío. null si la orden nunca pasó por el módulo. */
export function toShipping(o: {
  fulfillment: string | null; ship_method: string | null; carrier: string | null;
  tracking: string | null; ship_unit: string | null; branch: string | null;
  scheduled_at: Date | null; shipped_at: Date | null; delivered_at: Date | null;
  returned_at: Date | null; ship_notes: string | null;
}): OrderShipping | null {
  const state = toFulfillment(o.fulfillment);
  if (!state) return null;
  return {
    state,
    method: toShipMethod(o.ship_method),
    carrier: o.carrier,
    tracking: o.tracking,
    unit: o.ship_unit,
    branch: o.branch,
    scheduledAt: o.scheduled_at?.toISOString() ?? null,
    shippedAt: o.shipped_at?.toISOString() ?? null,
    deliveredAt: o.delivered_at?.toISOString() ?? null,
    returnedAt: o.returned_at?.toISOString() ?? null,
    notes: o.ship_notes,
  };
}
