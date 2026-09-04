import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { toShipMethod, type ShipMethod } from '@maqserv/types';
import { AdminGuard, type AdminRequest } from './admin-auth';
import { etiquetaMetodoPago } from '../orders/orders.service';
import { FulfillmentService, toShipping } from '../orders/fulfillment.service';
import { hasRentalItems, parseCart } from '../orders/cart.util';

/**
 * Módulo de ENVÍOS del panel: detalle de la orden + gestión del envío.
 *
 * Hasta ahora Órdenes solo tenía lista y un selector de estado: registraba un estado
 * pero no gestionaba el envío (ni guía, ni unidad, ni sucursal, ni historial).
 *
 * Va aparte de `admin-ops` a propósito: el estado del envío SOLO se mueve por
 * `FulfillmentService.setState()`, que sincroniza el `status` legacy, sella fechas,
 * registra el evento y avisa al cliente.
 */
@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminFulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  /** Detalle completo: productos, desglose congelado, envío e historial. */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const o = await prisma.orders.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Orden no encontrada');

    const { items, totals } = parseCart(o.cart);
    const events = await this.fulfillment.events(o.id);
    return {
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      paymentStatus: o.payment_status,
      method: etiquetaMetodoPago(o.method),
      total: o.pay_amount,
      totalQty: Number(o.totalQty) || 0,
      createdAt: o.created_at ? o.created_at.toISOString() : null,
      items,
      totals,
      hasRental: hasRentalItems(items),
      shipping: toShipping(o),
      events,
      customer: {
        name: o.customer_name,
        email: o.customer_email,
        phone: o.customer_phone,
        address: o.customer_address,
        city: o.customer_city,
        zip: o.customer_zip,
      },
      note: o.order_note,
      couponCode: o.coupon_code,
    };
  }

  /**
   * Datos del envío (método, guía, unidad, sucursal, fecha, notas). NO mueve el estado:
   * para eso está `PATCH :id/state`, que es lo único que avisa al cliente.
   * `null` borra el campo; ausente no lo toca.
   */
  @Patch(':id/shipping')
  async updateShipping(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const nullable = (max: number) => z.string().trim().max(max).nullable().optional();
    const schema = z.object({
      method: z.enum(['paqueteria', 'traslado', 'sucursal']).nullable().optional(),
      carrier: nullable(60),
      tracking: nullable(80),
      unit: nullable(80),
      branch: nullable(120),
      scheduledAt: z.string().datetime().nullable().optional(),
      notes: nullable(2000),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const o = await prisma.orders.findUnique({ where: { id }, select: { id: true } });
    if (!o) throw new NotFoundException('Orden no encontrada');

    const d = parsed.data;
    // Vacío ("") = borrar: un input que el admin limpió no debe guardar cadena vacía.
    // `undefined` = el campo no vino ⇒ Prisma no lo toca.
    const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    // Solo sobreviven los datos del método activo. Sin esto, pasar de paquetería a
    // sucursal dejaría la guía vieja en la fila: seguiría apareciendo en la búsqueda
    // por guía y reaparecería sola si el admin regresa al método anterior.
    const own = (m: ShipMethod, v: string | null | undefined) =>
      (d.method !== undefined && d.method !== m ? null : text(v));

    await prisma.orders.update({
      where: { id },
      data: {
        ...(d.method !== undefined ? { ship_method: d.method } : {}),
        carrier: own('paqueteria', d.carrier),
        tracking: own('paqueteria', d.tracking),
        ship_unit: own('traslado', d.unit),
        branch: own('sucursal', d.branch),
        ...(d.scheduledAt !== undefined ? { scheduled_at: d.scheduledAt ? new Date(d.scheduledAt) : null } : {}),
        ...(d.notes !== undefined ? { ship_notes: text(d.notes) } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  /** Mover el envío. Aquí es donde el cliente recibe el aviso y se escribe el historial. */
  @Patch(':id/state')
  async updateState(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    const schema = z.object({
      state: z.enum(['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'en_renta', 'recolectado', 'cerrado', 'cancelado']),
      note: z.string().trim().max(500).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Estado inválido');

    const o = await prisma.orders.findUnique({
      where: { id },
      select: { id: true, order_number: true, user_id: true, fulfillment: true, ship_method: true },
    });
    if (!o) throw new NotFoundException('Orden no encontrada');

    // Un envío no puede salir sin decir CÓMO sale: el cliente no podría rastrearlo.
    if (parsed.data.state === 'enviado' && !toShipMethod(o.ship_method)) {
      throw new BadRequestException('Primero elige el método de envío (paquetería, traslado o sucursal).');
    }
    const changed = await this.fulfillment.setState(o, parsed.data.state, {
      adminId: req.adminId,
      note: parsed.data.note,
    });
    return { ok: true, changed };
  }
}
