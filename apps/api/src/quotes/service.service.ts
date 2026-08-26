import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { formatearCantidad, unidadPorDefectoDe } from '@maqserv/config';
import { NotificationsService } from '../notifications/notifications.service';
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
  constructor(private readonly notifications: NotificationsService) {}

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
    if (q.user_id) {
      const cierre =
        hacia === 'cerrado' && cantidad
          ? ` Se registraron ${formatearCantidad(cantidad, unidad)}.`
          : '';
      await this.notifications.push({
        userId: Number(q.user_id),
        type: 'service_status',
        title: `Tu servicio ${q.quote_number}: ${PASOS[hacia].label.toLowerCase()}`,
        body: PASOS[hacia].cliente + cierre,
        link: `/cuenta/cotizaciones/${q.quote_number}`,
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
    opts: { reason?: string | null; adminId?: number | null } = {},
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
      data: { state: estado, reason: opts.reason?.trim() || null, responded_at: new Date() },
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
