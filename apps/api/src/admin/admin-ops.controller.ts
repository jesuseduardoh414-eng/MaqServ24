import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Query, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { estadoCotizacion, diasParaVencer, vigenciaPorDefecto } from '../quotes/quote-validity';
import { prisma } from '@maqserv/db';
import { toFulfillment } from '@maqserv/types';
import { AdminGuard, type AdminRequest } from './admin-auth';
import { NotificationsService } from '../notifications/notifications.service';
import { FulfillmentService, toShipping } from '../orders/fulfillment.service';
import { DIAS_AVISO } from '../catalog/provider-trust';

const PAID_STATES = new Set(['approved', 'completed', 'paid']);

/** Operación diaria: órdenes, cotizaciones, vendedores y retiros. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminOpsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  /**
   * Resumen del panel. Responde dos preguntas: **qué necesita atención ahora** y
   * **cómo va el negocio**.
   *
   * Los pendientes de órdenes salen de `fulfillment`, NO del `status` legacy: esa
   * columna es una sombra donde `pendiente` (sin pagar) y `pagado` (por preparar)
   * caen los dos en 'pending', así que mezclaba "el cliente no ha pagado" con
   * "tengo que preparar esto" — dos cosas que se atienden distinto.
   */
  @Get('dashboard')
  async dashboard() {
    /**
     * "Clientes" contaba los 75 registrados, pero 70 son basura de pruebas del sistema
     * viejo que nunca compró: el número que dice algo es cuántos han comprado. Son dos
     * consultas encadenadas (`users` no declara relación con `orders` — el esquema viene
     * del Laravel viejo, sin llaves foráneas), pero la cadena viaja DENTRO del
     * `Promise.all` de abajo para que corra a la vez que las otras 13 en vez de esperar
     * a que terminen: cada viaje a Supabase cuesta ~100 ms.
     */
    const customersP = prisma.orders.groupBy({ by: ['user_id'] }).then((buyers) => {
      const ids = buyers.map((b) => b.user_id);
      return ids.length ? prisma.users.count({ where: { id: { in: ids } } }) : 0;
    });

    const [
      products, orders, unpaid, toPrepare, shipped, quotes, pendingQuotes,
      vendorsPending, withdrawsPending, withdrawsAmount, unansweredQuestions,
      pendingReviews, sold, customers, docsExpired, docsExpiring,
    ] = await Promise.all([
      prisma.products.count({ where: { status: 1 } }),
      prisma.orders.count(),
      prisma.orders.count({ where: { fulfillment: 'pendiente' } }),
      prisma.orders.count({ where: { fulfillment: 'pagado' } }),
      prisma.orders.count({ where: { fulfillment: 'enviado' } }),
      prisma.quotes.count(),
      prisma.quotes.count({ where: { status: 'pending' } }),
      prisma.users.count({ where: { is_vendor: 1 } }),
      prisma.withdraws.count({ where: { status: 'pending' } }),
      prisma.withdraws.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      prisma.product_questions.count({ where: { answer: null, status: 1 } }),
      prisma.site_reviews.count({ where: { status: 0 } }),
      // Vendido = lo pedido sin las canceladas (mismo criterio que la ficha del cliente).
      prisma.orders.aggregate({ where: { status: { not: 'declined' } }, _sum: { pay_amount: true } }),
      customersP,
      // Expedientes que piden atención (documento institucional, 23). Se cuentan
      // ALIADOS, no documentos: a quien hay que llamarle es al aliado, y tres
      // papeles vencidos del mismo son una sola llamada.
      prisma.providers.count({
        where: { status: 1, provider_documents: { some: { expires_at: { not: null, lt: new Date() } } } },
      }),
      prisma.providers.count({
        where: {
          status: 1,
          provider_documents: {
            some: {
              expires_at: {
                gte: new Date(),
                lte: new Date(Date.now() + DIAS_AVISO * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      }),
    ]);

    return {
      // Por atender
      toPrepare, shipped, unpaid, pendingQuotes, vendorsPending,
      docsExpired, docsExpiring,
      withdrawsPending, withdrawsAmount: withdrawsAmount._sum.amount ?? 0,
      unansweredQuestions, pendingReviews,
      // Negocio
      sold: sold._sum.pay_amount ?? 0,
      orders, quotes, products, customers,
    };
  }

  // ---- Órdenes ----

  /**
   * Lista de órdenes. El eje principal es `fulfillment` (módulo de envíos); el `status`
   * legacy solo viaja para las órdenes viejas que aún no tienen envío.
   */
  @Get('orders')
  async orders(
    @Query('page') page?: string,
    @Query('state') state?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    const where: Record<string, unknown> = {};
    if (state) where.fulfillment = state;
    // `mode: 'insensitive'` obligatorio: en Postgres `contains` distingue mayúsculas.
    const term = search?.trim();
    if (term) {
      where.OR = [
        { order_number: { contains: term, mode: 'insensitive' } },
        { customer_name: { contains: term, mode: 'insensitive' } },
        { customer_email: { contains: term, mode: 'insensitive' } },
        // El folio de la paquetería: el cliente llama citando la guía, no el pedido.
        { tracking: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [total, rows, byState] = await Promise.all([
      prisma.orders.count({ where }),
      prisma.orders.findMany({ where, orderBy: { id: 'desc' }, skip: (p - 1) * 20, take: 20 }),
      // Contadores GLOBALES (sin filtro): alimentan las pestañas y las tarjetas.
      prisma.orders.groupBy({ by: ['fulfillment'], _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = {};
    let all = 0;
    for (const r of byState) {
      if (r.fulfillment) counts[r.fulfillment] = r._count._all;
      all += r._count._all;
    }
    counts.all = all;
    return {
      total, page: p, pages: Math.max(1, Math.ceil(total / 20)), counts,
      items: rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customer: o.customer_name,
        email: o.customer_email,
        method: o.method,
        total: o.pay_amount,
        status: o.status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at ? o.created_at.toISOString() : null,
        shipping: toShipping(o),
      })),
    };
  }

  /**
   * Estado del PAGO. El estado del ENVÍO se mueve en `admin/orders/:id/state`
   * (AdminFulfillmentController): tener dos caminos para moverlo desincronizaría el
   * historial y el `status` legacy.
   */
  @Patch('orders/:id')
  async updateOrder(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const schema = z.object({ paymentStatus: z.string().max(50) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const o = await prisma.orders.findUnique({ where: { id } });
    if (!o) throw new NotFoundException();
    await prisma.orders.update({
      where: { id },
      data: { payment_status: parsed.data.paymentStatus, updated_at: new Date() },
    });

    const nowPaid = PAID_STATES.has(parsed.data.paymentStatus.toLowerCase());
    const wasPaid = PAID_STATES.has((o.payment_status ?? '').toLowerCase());
    if (nowPaid && !wasPaid) {
      await this.notifications.push({
        userId: o.user_id, type: 'payment_confirmed',
        title: `Confirmamos el pago de tu pedido ${o.order_number}`,
        body: 'Ya podemos programar el traslado de tu equipo.',
        link: `/pedido/${o.order_number}`, orderId: o.id,
      });
      // Confirmar el pago adelanta el envío a "Pagado" (en silencio: el aviso ya salió
      // arriba). Solo desde `pendiente`: no regresar una orden que ya va en camino.
      if (toFulfillment(o.fulfillment) === 'pendiente') {
        await this.fulfillment.setState(o, 'pagado', {
          adminId: req.adminId, note: 'Pago confirmado desde el panel', silent: true,
        });
      }
    }
    return { ok: true };
  }

  // ---- Cotizaciones ----

  @Get('quotes')
  async quotes(@Query('page') page?: string, @Query('status') status?: string) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const [total, rows] = await Promise.all([
      prisma.quotes.count({ where }),
      prisma.quotes.findMany({ where, orderBy: { id: 'desc' }, skip: (p - 1) * 20, take: 20 }),
    ]);
    return {
      total, page: p, pages: Math.max(1, Math.ceil(total / 20)),
      items: rows.map((q) => ({
        id: Number(q.id),
        quoteNumber: q.quote_number,
        name: q.name,
        email: q.email,
        phone: q.phone,
        company: q.company_name,
        subtotal: Number(q.subtotal),
        freightCost: Number(q.freight_cost),
        total: Number(q.total),
        status: q.status,
        // Estado REAL, no el de la columna: una cotizacion respondida a la que
        // se le paso la fecha ya no vale, aunque siga marcada como completada.
        state: estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
        validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
        daysToExpire: diasParaVencer(q.valid_until),
        included: q.included,
        excluded: q.excluded,
        respondedBy: q.responded_by,
        acceptedAt: q.accepted_at ? q.accepted_at.toISOString() : null,
        serviceCategory: q.service_category,
        requirements: q.requirements ?? null,
        conditions: q.conditions,
        comments: q.comments,
        createdAt: q.created_at ? q.created_at.toISOString() : null,
      })),
    };
  }

  /** Responder cotización: ajustar montos/condiciones y marcar completed. */
  @Patch('quotes/:id')
  async updateQuote(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const schema = z.object({
      status: z.enum(['pending', 'completed', 'rejected']).optional(),
      conditions: z.string().max(5000).optional(),
      /** Hasta cuando vale el precio. Vacio = se usa el plazo por defecto. */
      validUntil: z.string().optional().nullable(),
      included: z.string().max(4000).optional(),
      excluded: z.string().max(4000).optional(),
      freightCost: z.coerce.number().min(0).optional(),
      tax: z.coerce.number().min(0).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const q = await prisma.quotes.findUnique({ where: { id } });
    if (!q) throw new NotFoundException();

    // Respondiendo = pasa a completada ahora; solo entonces se sella vigencia
    // y autor. Editar despues una cotizacion ya respondida no reinicia su reloj.
    const respondiendo = parsed.data.status === 'completed' && q.status !== 'completed';
    const freight = parsed.data.freightCost ?? Number(q.freight_cost);
    const tax = parsed.data.tax ?? Number(q.tax);
    const total = Math.round((Number(q.subtotal) + freight + tax) * 100) / 100;

    await prisma.quotes.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.conditions !== undefined ? { conditions: parsed.data.conditions } : {}),
        ...(parsed.data.included !== undefined ? { included: parsed.data.included } : {}),
        ...(parsed.data.excluded !== undefined ? { excluded: parsed.data.excluded } : {}),
        // Al responder se fija la vigencia. Si no la escribieron se pone el plazo
        // por defecto: una cotizacion sin fecha se queda pareciendo valida para
        // siempre, que es justo lo que el documento pide evitar.
        ...(respondiendo
          ? {
              valid_until: new Date(`${parsed.data.validUntil || vigenciaPorDefecto()}T00:00:00Z`),
              responded_at: new Date(),
              // Quien autorizo el precio. El documento lo pide por escrito: cuando
              // despues hay una diferencia comercial, hace falta saber de quien
              // salio la cifra.
              responded_by: (await prisma.admins.findUnique({ where: { id: req.adminId }, select: { name: true } }))?.name ?? null,
            }
          : parsed.data.validUntil
            ? { valid_until: new Date(`${parsed.data.validUntil}T00:00:00Z`) }
            : {}),
        freight_cost: freight,
        tax,
        total,
        updated_at: new Date(),
      },
    });

    // Aviso al cliente cuando la cotización pasa a respondida.
    if (parsed.data.status === 'completed' && q.status !== 'completed') {
      await this.notifications.push({
        userId: q.user_id ? Number(q.user_id) : null,
        type: 'quote_answered',
        title: `Ya respondimos tu cotización ${q.quote_number}`,
        body: `Total cotizado: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}. Revísala en tu cuenta.`,
        link: '/cuenta/cotizaciones',
      });
    }
    return { ok: true, total };
  }

  // Vendedores: ver `admin-vendors.controller.ts` (lista con señales + detalle de la
  // solicitud). Vivían aquí, pero la lista no alcanzaba para decidir a quién aprobar.

  // Retiros: ver `admin-withdraws.controller.ts` (mueven dinero real, así que el
  // cobro/reembolso va en una transacción con candado; aquí era leer-y-escribir).
}
