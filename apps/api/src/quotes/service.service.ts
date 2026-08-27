import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { formatearCantidad, unidadPorDefectoDe } from '@maqserv/config';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { correoServicioAvanzo, correoOfertaAAliado, correoAsignacionAAliado } from '../notifications/email-templates';
import {
  PASOS, esEstado, estadoInicial, puedeCerrar, sePuedeMover,
  type EstadoServicio,
} from './service-flow';

/**
 * EL SERVICIO, DE PUNTA A PUNTA.
 *
 * Mismo criterio que `FulfillmentService` para las órdenes: este es el ÚNICO
 * lugar que mueve el estatus. Si alguien actualiza `service_state` por fuera,
 * el historial miente y el cliente no se entera — y el historial es
 * precisamente lo que el documento pide ("capacidad de reconstruir qué
 * ocurrió, cuándo, con quién y bajo qué condiciones").
 */
@Injectable()
export class ServiceService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

  /** Estatus actual, tratando "aún no entra al flujo" como el primer paso. */
  private estadoDe(q: { service_state: string | null }): EstadoServicio {
    return esEstado(q.service_state) ? q.service_state : estadoInicial();
  }

  /**
   * Mueve el servicio. Devuelve si hubo cambio.
   *
   * Cerrar exige cantidad y unidad: es el dato del que dependen la factura, el
   * historial del aliado y las métricas. Dejarlo opcional equivale a no tenerlo.
   */
  async mover(
    quoteId: number,
    hacia: EstadoServicio,
    opts: {
      adminId?: number | null;
      note?: string | null;
      /** Solo al cerrar. */
      quantity?: number | null;
      unit?: string | null;
    } = {},
  ) {
    const q = await prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!q) throw new NotFoundException('Cotización no encontrada');

    const desde = this.estadoDe(q);
    if (!sePuedeMover(desde, hacia)) {
      throw new BadRequestException(
        `No se puede pasar de "${PASOS[desde].label}" a "${PASOS[hacia].label}".`,
      );
    }

    const cantidad = opts.quantity ?? (q.service_quantity ? Number(q.service_quantity) : null);
    const unidad = opts.unit ?? q.service_unit ?? unidadPorDefectoDe(q.service_category);

    if (hacia === 'cerrado' && !puedeCerrar(cantidad, unidad)) {
      throw new BadRequestException(
        'Para cerrar hay que registrar cuánto se usó y en qué unidad (horas, viajes, toneladas…).',
      );
    }

    const ahora = new Date();

    /**
     * Llegar a la obra sella la hora REAL de llegada en la asignación del
     * aliado que la está atendiendo. Es la otra mitad de la puntualidad: sin
     * esto habría compromiso pero nada contra qué compararlo.
     *
     * Sólo la primera vez: reabrir "en sitio" no reescribe cuándo llegó.
     */
    if (hacia === 'en_sitio') {
      await prisma.service_assignments.updateMany({
        where: { quote_id: quoteId, state: 'aceptado', arrived_at: null },
        data: { arrived_at: ahora },
      });
    }

    // Cada paso sella SU fecha; las demás no se tocan.
    const sello =
      hacia === 'en_curso' && !q.service_started_at ? { service_started_at: ahora }
        : hacia === 'cerrado' ? { service_closed_at: ahora }
          : {};

    await prisma.quotes.update({
      where: { id: quoteId },
      data: {
        service_state: hacia,
        ...(hacia === 'cerrado' ? { service_quantity: cantidad, service_unit: unidad } : {}),
        ...(opts.note?.trim() ? { service_notes: opts.note.trim() } : {}),
        ...sello,
        updated_at: ahora,
      },
    });

    await prisma.service_events.create({
      data: {
        quote_id: quoteId,
        admin_id: opts.adminId ?? null,
        from_state: desde,
        to_state: hacia,
        note: opts.note?.trim() || null,
        created_at: ahora,
      },
    });

    // Avisar al cliente. El texto es el suyo, no el de operaciones: son dos
    // personas distintas haciéndose preguntas distintas.
    const cierre =
      hacia === 'cerrado' && cantidad ? ` Se registraron ${formatearCantidad(cantidad, unidad)}.` : '';

    if (q.user_id) {
      await this.notifications.push({
        userId: Number(q.user_id),
        type: 'service_status',
        title: `Tu servicio ${q.quote_number}: ${PASOS[hacia].label.toLowerCase()}`,
        body: PASOS[hacia].cliente + cierre,
        link: `/cuenta/cotizaciones/${q.quote_number}`,
      });
    }

    /**
     * Y por correo, tenga cuenta o no.
     *
     * La campana solo la ve quien vuelve al sitio, y la mayoría cotizó sin
     * registrarse: sin esto, "tu unidad va en camino" no le llega a nadie.
     *
     * NO se avisa de `asignado`: al cliente no le importa que internamente ya
     * haya aliado, le importa cuándo sale la unidad. Un correo por cada paso
     * interno entrena a la gente a ignorar los correos.
     */
    if (hacia !== 'asignado') {
      const aliados = await prisma.service_assignments.findMany({
        where: { quote_id: quoteId, state: 'aceptado' },
        include: { providers: { select: { name: true } } },
      });
      const plantilla = correoServicioAvanzo({
        nombre: q.name,
        folio: q.quote_number,
        etapa: PASOS[hacia].label,
        mensaje: PASOS[hacia].cliente,
        aliados: aliados.map((a) => a.providers.name),
        cierre: hacia === 'cerrado' && cantidad ? formatearCantidad(cantidad, unidad) : null,
      });
      await this.mailer.enviar({
        kind: 'service_status',
        to: q.email,
        toName: q.name,
        quoteId,
        ...plantilla,
      });
    }

    return { from: desde, to: hacia };
  }

  /**
   * Ofrecer la solicitud a un aliado.
   *
   * Ofrecer NO es asignar: queda `propuesto` hasta que el aliado contesta. El
   * documento distingue las dos cosas, y confundirlas hace que el tablero diga
   * que algo está resuelto cuando nadie ha dicho que sí.
   */
  async ofrecer(quoteId: number, providerId: number, opts: { scope?: string | null; adminId?: number | null } = {}) {
    const [q, p] = await Promise.all([
      prisma.quotes.findUnique({ where: { id: quoteId }, select: { id: true } }),
      prisma.providers.findUnique({ where: { id: providerId }, select: { id: true, name: true } }),
    ]);
    if (!q) throw new NotFoundException('Cotización no encontrada');
    if (!p) throw new NotFoundException('Aliado no encontrado');

    // Volver a ofrecerle a quien ya tiene una propuesta viva no crea otra:
    // duplicar la fila haría que el tablero cuente dos veces al mismo aliado.
    const viva = await prisma.service_assignments.findFirst({
      where: { quote_id: quoteId, provider_id: providerId, state: { in: ['propuesto', 'aceptado'] } },
    });
    if (viva) return viva;

    const a = await prisma.service_assignments.create({
      data: {
        quote_id: quoteId,
        provider_id: providerId,
        state: 'propuesto',
        scope: opts.scope?.trim() || null,
        created_by: opts.adminId ?? null,
      },
    });

    await prisma.service_events.create({
      data: {
        quote_id: quoteId,
        admin_id: opts.adminId ?? null,
        to_state: 'propuesto',
        note: `Se le ofreció a ${p.name}`,
      },
    });

    /**
     * Avisarle. Sin esto, "ofrecer" era una fila en la base y una llamada que
     * alguien tenía que acordarse de hacer — y el proveedor alterno, que mide
     * el silencio, contaba un silencio que nadie había roto todavía.
     */
    const datos = await prisma.quotes.findUnique({
      where: { id: quoteId },
      select: { quote_number: true, service_category: true, address: true, comments: true },
    });
    const contacto = await prisma.providers.findUnique({
      where: { id: providerId },
      select: { email: true, contact_name: true },
    });
    if (contacto?.email && datos) {
      const plantilla = correoOfertaAAliado({
        aliado: p.name,
        contacto: contacto.contact_name,
        categoria: datos.service_category,
        zona: datos.address,
        folio: datos.quote_number,
        detalle: opts.scope?.trim() || datos.comments,
      });
      await this.mailer.enviar({
        kind: 'provider_offer',
        to: contacto.email,
        toName: contacto.contact_name,
        quoteId,
        providerId,
        ...plantilla,
      });
    }
    return a;
  }

  /**
   * Lo que contestó el aliado.
   *
   * Si acepta, el servicio pasa a "asignado" solo. Si rechaza, se guarda el
   * PORQUÉ: es el dato que dice si la red alcanza para esa zona o esa categoría
   * —el documento lo pide para dirigir el reclutamiento— y la base de la
   * activity de proveedor alterno.
   */
  async responder(
    assignmentId: number,
    estado: 'aceptado' | 'rechazado' | 'retirado',
    opts: {
      reason?: string | null;
      adminId?: number | null;
      /**
       * Cuándo se compromete a llegar. Es lo que hace medible la puntualidad:
       * la solicitud trae una fecha que el CLIENTE quiere; esto es lo que el
       * ALIADO promete. Medir contra el deseo culparía al aliado de no cumplir
       * algo que nunca prometió.
       */
      committedAt?: Date | null;
    } = {},
  ) {
    const a = await prisma.service_assignments.findUnique({
      where: { id: assignmentId },
      include: { providers: { select: { name: true } } },
    });
    if (!a) throw new NotFoundException('Asignación no encontrada');
    if (a.state !== 'propuesto') {
      throw new BadRequestException('Esta propuesta ya tenía respuesta.');
    }

    await prisma.service_assignments.update({
      where: { id: assignmentId },
      data: {
        state: estado,
        reason: opts.reason?.trim() || null,
        responded_at: new Date(),
        ...(estado === 'aceptado' && opts.committedAt ? { committed_at: opts.committedAt } : {}),
      },
    });

    const quoteId = Number(a.quote_id);
    await prisma.service_events.create({
      data: {
        quote_id: quoteId,
        admin_id: opts.adminId ?? null,
        to_state: estado,
        note:
          estado === 'aceptado'
            ? `${a.providers.name} aceptó`
            : `${a.providers.name} ${estado === 'rechazado' ? 'rechazó' : 'se retiró'}${opts.reason ? `: ${opts.reason.trim()}` : ''}`,
      },
    });

    if (estado === 'aceptado') {
      /**
       * Confirmarle al aliado, con los datos de la obra y —sobre todo— lo que
       * esa obra EXIGE para dejar entrar. Es la información que hoy se da por
       * teléfono y se olvida, y la que evita que la unidad llegue y la regresen
       * por no traer inducción.
       */
      const datos = await prisma.quotes.findUnique({
        where: { id: quoteId },
        select: {
          quote_number: true, service_category: true, address: true,
          client_sites: {
            select: { address: true, municipality: true, contact_name: true, contact_phone: true, requirements: true },
          },
        },
      });
      const contacto = await prisma.providers.findUnique({
        where: { id: a.provider_id },
        select: { email: true, contact_name: true },
      });
      if (contacto?.email && datos) {
        const obra = datos.client_sites;
        const plantilla = correoAsignacionAAliado({
          aliado: a.providers.name,
          contacto: contacto.contact_name,
          folio: datos.quote_number,
          categoria: datos.service_category,
          zona: obra?.municipality ?? null,
          // La dirección de la obra manda sobre la escrita en la solicitud: la
          // de la obra es la que alguien ya revisó.
          direccion: obra?.address ?? datos.address,
          contactoObra: obra?.contact_name ?? null,
          telefonoObra: obra?.contact_phone ?? null,
          requisitos: obra?.requirements ?? [],
        });
        await this.mailer.enviar({
          kind: 'provider_assigned',
          to: contacto.email,
          toName: contacto.contact_name,
          quoteId,
          providerId: a.provider_id,
          ...plantilla,
        });
      }

      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { service_state: true } });
      // Solo si sigue por asignar: si la operación ya avanzó, sumar un segundo
      // aliado no debe regresarla al principio.
      if (q && this.estadoDe(q) === 'por_asignar') {
        await this.mover(quoteId, 'asignado', { adminId: opts.adminId ?? null });
      }
    }
    return { ok: true };
  }

  /** Historial del servicio, del más viejo al más nuevo, con el nombre de quien lo movió. */
  async historial(quoteId: number) {
    const rows = await prisma.service_events.findMany({
      where: { quote_id: quoteId },
      orderBy: { id: 'asc' },
    });
    const ids = [...new Set(rows.map((r) => r.admin_id).filter((v): v is number => v !== null))];
    const admins = ids.length
      ? await prisma.admins.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const porId = new Map(admins.map((a) => [a.id, a.name]));

    return rows.map((r) => ({
      id: r.id,
      from: r.from_state,
      to: r.to_state,
      label: esEstado(r.to_state) ? PASOS[r.to_state].label : r.to_state,
      note: r.note,
      by: r.admin_id ? porId.get(r.admin_id) ?? 'Administrador' : null,
      at: r.created_at,
    }));
  }
}
