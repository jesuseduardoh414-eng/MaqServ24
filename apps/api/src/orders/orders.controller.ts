import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { CheckoutResult } from '@maqserv/types';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    qty: z.number().int().min(1).max(999),
    // Renta: periodo/unidad elegida. El servidor convierte el precio desde
    // `products.price_unit` (fuente única en @maqserv/config); las unidades no
    // temporales ('viaje', 'tonelada'…) solo se cobran en su propia unidad.
    // Antes solo aceptaba dia/sem/mes y una pipa por viaje daba 400 sin remedio.
    period: z.enum(['dia', 'sem', 'semana', 'mes', 'hora', 'jornada', 'viaje', 'tonelada', 'm3', 'litro'])
      .transform((p) => (p === 'semana' ? 'sem' as const : p))
      .optional(),
  })).min(1),
  method: z.enum(['transferencia', 'mercadopago']),
  /** Clave por intento de compra: reintentos con la misma clave no duplican la orden. */
  idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
  couponCode: z.string().max(50).optional(),
  /** Agregar operador certificado (monto configurable en Panel → Pagos). */
  operator: z.boolean().optional(),
  customer: z.object({
    name: z.string().min(2).max(190),
    email: z.string().email().max(190),
    phone: z.string().min(7).max(30),
    address: z.string().min(4).max(250),
    city: z.string().min(2).max(100),
    zip: z.string().min(3).max(12),
  }),
  note: z.string().max(1000).optional(),
});

@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  @Post()
  async checkout(@Req() req: AuthedRequest, @Body() body: unknown): Promise<CheckoutResult> {
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    }

    const { order } = await this.orders.create(req.userId, parsed.data);

    if (parsed.data.method === 'mercadopago') {
      const redirectUrl = await this.payments.createMercadoPagoRedirect(order);
      return { order, redirectUrl, instructions: null };
    }

    const methods = await this.payments.methods();
    const transferencia = methods.find((m) => m.id === 'transferencia');
    return { order, redirectUrl: null, instructions: transferencia?.instructions ?? null };
  }

  /** Previsualiza un cupón contra un subtotal (el checkout lo usa en vivo). */
  @Post('coupon/check')
  checkCoupon(@Body() body: { code?: string; subtotal?: number }) {
    const code = String(body?.code ?? '').trim();
    const subtotal = Number(body?.subtotal ?? 0);
    if (!code || !(subtotal > 0)) throw new BadRequestException('Cupón o subtotal inválido');
    return this.orders.checkCoupon(code, subtotal);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.orders.listByUser(req.userId);
  }

  @Get(':orderNumber')
  byNumber(@Req() req: AuthedRequest, @Param('orderNumber') orderNumber: string) {
    return this.orders.byNumber(req.userId, orderNumber);
  }
}
