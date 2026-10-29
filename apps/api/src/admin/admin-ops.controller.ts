import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { estadoCotizacion, diasParaVencer, vigenciaPorDefecto } from '../quotes/quote-validity';
import { prisma } from '@maqserv/db';
import { AdminGuard, type AdminRequest, Modulo } from './admin-auth';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { correoCotizacionRespondida } from '../notifications/email-templates';
import { DIAS_AVISO } from '../catalog/provider-trust';
import { ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { PASOS, esEstado } from '../quotes/service-flow';
import { ServiceService } from '../quotes/service.service';
import { registrarAccion } from './audit';
import { sincronizarReserva } from '../quotes/reservas';
import { cancelarDocumentoSiNadaSigue } from '../quoter/documento-estado';

/**
 * De dónde llegó una solicitud (rediseño de Solicitudes, 2026-10-08). El
 * cotizador y el de máquinas lo dejan escrito en `requirements.origen`; lo que
 * entra por el formulario "Cotizar" no lo trae y llega sin precio.
 */
function origenDe(req: unknown, respondedBy: string | null): 'cotizador' | 'maquina' | 'formulario' | 'panel' {
  const o = req && typeof req === 'object' ? (req as { origen?: unknown }).origen : undefined;
  if (o === 'cotizador') return 'cotizador';
  // La armó MAQSER24 en su cotizador y el cliente la aceptó por fuera (2026-10-15).
  if (o === 'panel') return 'panel';
  if (o === 'maquina' || respondedBy === 'Cotizador de máquinas') return 'maquina';
  if (respondedBy?.startsWith('Cotizador de')) return 'cotizador';
  return 'formulario';
}

/**
 * Operación diaria: cotizaciones y el tablero de Inicio.
 *
 * Las órdenes del carrito se retiraron (2026-10-08): en MAQSER24 todo se
 * cotiza y se paga fuera del sitio. Los pedidos viejos siguen en la tabla.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminOpsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
    private readonly services: ServiceService,
  ) {}

  /**
   * Resumen del panel. Responde dos preguntas: **qué necesita atención ahora** y
   * **cómo va el negocio**.
   */
  // El tablero es la portada del panel: lo ve cualquier rol, con lo suyo.
  @Modulo('inicio')
  @Get('dashboard')
  async dashboard() {
    const [
      products, quotes, pendingQuotes,
      unansweredQuestions,
      pendingReviews, docsExpired, docsExpiring, pendingMessages,
      pendingQuoterRequests, pendingOffers,
    ] = await Promise.all([
      prisma.products.count({ where: { status: 1 } }),
      prisma.quotes.count(),
      prisma.quotes.count({ where: { status: 'pending' } }),
      prisma.product_questions.count({ where: { answer: null, status: 1 } }),
      prisma.site_reviews.count({ where: { status: 0 } }),
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
      // Mensajes sin contestar (2026-10-14: una sola bandeja): lo de Contacto y
      // las preguntas. Va en "por atender" porque es alguien esperando respuesta.
      Promise.all([
        prisma.contact_messages.count({ where: { state: 'nuevo' } }),
        prisma.product_questions.count({ where: { answer: null, status: 1, source: { not: 'contacto' } } }),
      ]).then(([a, b]) => a + b),
      // Cotizaciones que un visitante pidio desde el sitio y nadie ha tocado.
      // Mismo criterio que los mensajes de contacto: alguien esperando.
      prisma.quoter_quotes.count({ where: { state: 'solicitada' } }),
      // Equipos que un aliado ofreció desde su portal y esperan revisión.
      // Solo de aliados de la red: lo que declara una solicitud se ve al revisarla (2026-10-26).
      prisma.providers.findMany({ where: { status: 1 }, select: { id: true } }).then((red) => prisma.products.count({ where: { status: ESTADO_POR_REVISAR, provider_id: { in: red.map((p) => p.id) } } })),
    ]);

    return {
      // Por atender
      pendingQuotes,
      docsExpired, docsExpiring, pendingMessages, pendingQuoterRequests, pendingOffers,
      unansweredQuestions, pendingReviews,
      // Negocio
      quotes, products,
    };
  }

  // ---- Cotizaciones ----

  @Modulo('cotizaciones')
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
        // Lo que hace falta para seguir la solicitud de punta a punta en una
        // sola pantalla: de dónde llegó, qué pidió y en qué va el servicio.
        origen: origenDe(q.requirements, q.responded_by),
        productInterested: q.product_interested,
        address: q.address,
        region: q.region,
        tax: Number(q.tax),
        respondedAt: q.responded_at ? q.responded_at.toISOString() : null,
        serviceState: q.service_state,
        serviceLabel: esEstado(q.service_state) ? PASOS[q.service_state].label : null,
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
  @Modulo('cotizaciones')
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

  /**
   * Responder cotización: ajustar montos/condiciones y marcar completed.
   *
   * Su @Modulo se había quedado arriba del de "Aprobar" cuando se insertó esa
   * ruta (2026-10-15), y sin módulo el guard la deja solo a Dirección:
   * Operaciones no podía responder. Corregido el 2026-10-22.
   */
  @Modulo('cotizaciones')
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
      /**
       * Precio de lo pedido, para las solicitudes que no se cotizan con el
       * tabulador (2026-10-15): antes solo se capturaban flete e impuesto y un
       * equipo sin precio en el catálogo llegaba al cliente en $0.
       */
      subtotal: z.coerce.number().min(0).max(100_000_000).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const q = await prisma.quotes.findUnique({ where: { id } });
    if (!q) throw new NotFoundException();

    // Respondiendo = pasa a completada ahora; solo entonces se sella vigencia
    // y autor. Editar despues una cotizacion ya respondida no reinicia su reloj.
    const respondiendo = parsed.data.status === 'completed' && q.status !== 'completed';
    // Cotizada con el tabulador (2026-10-15): los importes son los del documento
    // y aquí no se tocan; lo que se responde es vigencia y condiciones.
    const reqDoc = (q.requirements ?? {}) as { quoterId?: unknown; folio?: unknown };
    const documentoId = typeof reqDoc.quoterId === 'number' ? reqDoc.quoterId : null;
    const documentoFolio = documentoId && typeof reqDoc.folio === 'string' ? reqDoc.folio : null;
    const subtotal = documentoId ? Number(q.subtotal) : (parsed.data.subtotal ?? Number(q.subtotal));
    const freight = documentoId ? Number(q.freight_cost) : (parsed.data.freightCost ?? Number(q.freight_cost));
    const tax = documentoId ? Number(q.tax) : (parsed.data.tax ?? Number(q.tax));
    const total = Math.round((subtotal + freight + tax) * 100) / 100;

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
        subtotal,
        freight_cost: freight,
        tax,
        total,
        updated_at: new Date(),
      },
    });

    // Descartada (2026-10-26): si ya nada de su folio sigue, el documento pasa a Cancelada.
    if (parsed.data.status === 'rejected' && q.status !== 'rejected') {
      await cancelarDocumentoSiNadaSigue(q.requirements);
    }

    // El documento sale con la respuesta: en el historial del cotizador pasa a "Enviada".
    if (respondiendo && documentoId) {
      await prisma.quoter_quotes.updateMany({ where: { id: documentoId, state: { in: ['borrador', 'solicitada'] } }, data: { state: 'enviada', updated_at: new Date() } });
    }

    /**
     * Las demás partes del MISMO documento se responden con esta (2026-10-15).
     * El cotizador del sitio parte la cotización por línea (la excavadora por
     * un lado, la pipa por otro) y el cliente acepta UN documento: se le
     * manda un solo correo con el total del documento. Cada parte conserva lo
     * que incluye; la vigencia y las condiciones son las de esta respuesta.
     */
    let totalDocumento = total;
    if (respondiendo && documentoFolio) {
      const hermanas = await prisma.quotes.findMany({
        where: { id: { not: q.id }, status: 'pending', accepted_at: null, requirements: { path: '$.folio', equals: documentoFolio } },
        select: { id: true, total: true },
      });
      if (hermanas.length) {
        const sello = await prisma.quotes.findUnique({ where: { id }, select: { valid_until: true, responded_at: true, responded_by: true } });
        for (const h of hermanas) {
          await prisma.quotes.update({
            where: { id: h.id },
            data: {
              status: 'completed',
              valid_until: sello?.valid_until ?? null,
              responded_at: sello?.responded_at ?? new Date(),
              responded_by: sello?.responded_by ?? null,
              ...(parsed.data.conditions !== undefined ? { conditions: parsed.data.conditions } : {}),
              ...(parsed.data.excluded !== undefined ? { excluded: parsed.data.excluded } : {}),
              updated_at: new Date(),
            },
          });
          await sincronizarReserva(Number(h.id));
          totalDocumento += Number(h.total);
        }
        totalDocumento = Math.round(totalDocumento * 100) / 100;
      }
    }

    /**
     * Autorizar aparta los equipos del carrito por las fechas de la solicitud;
     * rechazarla los suelta, y cambiar la vigencia mueve hasta cuándo se
     * sostienen si el cliente no acepta. Todo solo (ver quotes/reservas.ts).
     */
    await sincronizarReserva(id);

    // Aviso al cliente cuando la cotización pasa a respondida.
    if (parsed.data.status === 'completed' && q.status !== 'completed') {
      await this.notifications.push({
        userId: q.user_id ? Number(q.user_id) : null,
        type: 'quote_answered',
        title: `Ya respondimos tu cotización ${q.quote_number}`,
        body: `Total cotizado: ${totalDocumento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}. Revísala en tu cuenta.`,
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
      const plantilla = await correoCotizacionRespondida({
        nombre: q.name,
        folio: q.quote_number,
        total: totalDocumento,
        validUntil: parsed.data.validUntil ?? (q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null),
        included: parsed.data.included ?? q.included,
        excluded: parsed.data.excluded ?? q.excluded,
        documento: documentoFolio,
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
}
