import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Query, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { estadoCotizacion, diasParaVencer, vigenciaPorDefecto } from '../quotes/quote-validity';
import { prisma } from '@maqserv/db';
import { toFulfillment } from '@maqserv/types';
import { etiquetaMetodoPago } from '../orders/orders.service';
import { AdminGuard, type AdminRequest } from './admin-auth';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { correoCotizacionRespondida } from '../notifications/email-templates';
import { FulfillmentService, toShipping } from '../orders/fulfillment.service';
import { DIAS_AVISO } from '../catalog/provider-trust';

const PAID_STATES = new Set(['approved', 'completed', 'paid']);

/** Operación diaria: órdenes, cotizaciones, vendedores y retiros. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminOpsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
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
      pendingReviews, sold, customers, docsExpired, docsExpiring, pendingMessages,
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
      // Mensajes de contacto que nadie ha contestado. Va en "por atender"
      // porque es alguien esperando respuesta, igual que una cotización.
      prisma.contact_messages.count({ where: { state: 'nuevo' } }),
    ]);

    return {
      // Por atender
      toPrepare, shipped, unpaid, pendingQuotes, vendorsPending,
      docsExpired, docsExpiring, pendingMessages,
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
      // `select` explícito SIN `cart`: es un bytea con el carrito completo y el
      // listado no lo usa — 20 filas × blob por página era puro peso muerto.
      prisma.orders.findMany({
        where, orderBy: { id: 'desc' }, skip: (p - 1) * 20, take: 20,
        select: {
          id: true, order_number: true, customer_name: true, customer_email: true,
          method: true, pay_amount: true, status: true, payment_status: true,
          created_at: true, fulfillment: true, ship_method: true, carrier: true,
          tracking: true, ship_unit: true, branch: true, scheduled_at: true,
          shipped_at: true, delivered_at: true, returned_at: true, ship_notes: true,
        },
      }),
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
        method: etiquetaMetodoPago(o.method),
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
        // Para que la pantalla sepa si ya hay que ofrecer el botón de "ya le
        // hablé" o mostrar cuándo y por dónde se le habló.
        firstContactAt: q.first_contact_at ? q.first_contact_at.toISOString() : null,
        firstContactVia: q.first_contact_via,
        firstContactBy: q.first_contact_by,
      })),
    };
  }

  /**
   * "Ya le hablé al cliente." Sella el primer contacto sin tener que cotizar.
   *
   * Es el dato que faltaba para separar dos cosas que no son lo mismo: cuánto
   * tarda la operación en DAR SEÑALES DE VIDA y cuánto tarda en PONER PRECIO.
   * Una llamada de veinte minutos diciendo "lo estamos viendo" sostiene a un
   * cliente que si no se va con otro; una cotización impecable a los dos días
   * llega cuando ya se fue.
   *
   * Solo se sella la PRIMERA vez: registrar la tercera llamada no puede
   * reescribir cuándo fue la primera.
   */
  @Patch('quotes/:id/contacto')
  async marcarContacto(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const p = z
      .object({ via: z.enum(['llamada', 'whatsapp', 'correo', 'visita']).optional() })
      .safeParse(body ?? {});
    if (!p.success) throw new BadRequestException('Medio de contacto no válido');

    const q = await prisma.quotes.findUnique({
      where: { id },
      select: { id: true, first_contact_at: true, first_contact_via: true },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    if (q.first_contact_at) {
      return { ok: true, yaEstaba: true, at: q.first_contact_at.toISOString(), via: q.first_contact_via };
    }

    const quien = await prisma.admins.findUnique({ where: { id: req.adminId }, select: { name: true } });
    const at = new Date();
    await prisma.quotes.update({
      where: { id },
      data: { first_contact_at: at, first_contact_by: quien?.name ?? null, first_contact_via: p.data.via ?? 'llamada' },
    });
    return { ok: true, yaEstaba: false, at: at.toISOString(), via: p.data.via ?? 'llamada' };
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
              // Si nadie registró un contacto antes, el primer contacto real
              // FUE esta cotización. Sellarlo aquí no infla el indicador: lo
              // dice tal cual es —al cliente no le habló nadie hasta ahora— y
              // `via` deja ver qué parte del número es atención temprana.
              ...(q.first_contact_at ? {} : { first_contact_at: new Date(), first_contact_via: 'cotizacion' }),
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
        body: `Total cotizado: ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}. Revísala en tu cuenta.`,
        link: '/cuenta/cotizaciones',
      });

      /**
       * Y por correo. La campana solo la ve quien vuelve al sitio; el correo
       * llega a quien cotizó y cerró la pestaña, que son casi todos: de las
       * cotizaciones que hay, la gran mayoría son de invitados sin cuenta.
       *
       * No se envuelve en try/catch porque `enviar` nunca lanza: si el correo
       * falla, queda registrado y la cotización se responde igual.
       */
      const plantilla = correoCotizacionRespondida({
        nombre: q.name,
        folio: q.quote_number,
        total,
        validUntil: parsed.data.validUntil ?? (q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null),
        included: parsed.data.included ?? q.included,
        excluded: parsed.data.excluded ?? q.excluded,
      });
      await this.mailer.enviar({
        kind: 'quote_answered',
        to: q.email,
        toName: q.name,
        quoteId: Number(q.id),
        ...plantilla,
      });
    }
    return { ok: true, total };
  }

  // Vendedores: ver `admin-vendors.controller.ts` (lista con señales + detalle de la
  // solicitud). Vivían aquí, pero la lista no alcanzaba para decidir a quién aprobar.

  // Retiros: ver `admin-withdraws.controller.ts` (mueven dinero real, así que el
  // cobro/reembolso va en una transacción con candado; aquí era leer-y-escribir).
}
