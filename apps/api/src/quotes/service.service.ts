import { lista } from '../common/json-list';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { formatearCantidad, unidadPorDefectoDe } from '@maqserv/config';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { avisarPanel } from '../notifications/panel';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { correoServicioAvanzo, correoOfertaAAliado, correoAsignacionAAliado, correoServicioCanceladoAliado } from '../notifications/email-templates';
import { confirmarEquipos, sincronizarReserva } from './reservas';
import { abrirCuenta, parteDelAliado } from '../money/cuentas';
import { reglasDinero } from '../money/reglas';
import { MOTIVO_SE_BAJO } from '../catalog/provider-history';
import { MatchingService } from './matching.service';
import { normalizarZona } from './matching';
import { vigenciaPorDefecto } from './quote-validity';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { leerZonas, municipiosDe } from '../common/zonas';
import { parteDelDocumento, partidasParaAliado } from '../quoter/parte-del-documento';
import { firmarResena, rutaResena } from '../reviews/resena-link';
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
  private readonly log = new Logger(ServiceService.name);
  /** Sin dependencias propias: se instancia aquí y no hace falta declararlo en cada módulo que usa este servicio. */
  private readonly matching = new MatchingService();

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
      /** Nombre del aliado cuando lo reporta él desde su portal: avisa al panel. */
      porAliado?: string | null;
      /** Al cancelar: quién lo canceló (2026-10-22). */
      causa?: 'cliente' | 'aliado' | 'plataforma' | null;
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

    /**
     * La disponibilidad sigue al servicio sola (ver reservas.ts): en traslado
     * o en obra el equipo cambia de etapa; terminado, cerrado o cancelado lo
     * suelta. Que la máquina vuelva es además la mejor confirmación de que
     * sigue existiendo y está bien: cuenta como confirmada hoy.
     */
    const reserva = await sincronizarReserva(quoteId);
    if (hacia === 'terminado' || hacia === 'cerrado') await confirmarEquipos(reserva.antes);
    // Cerrar abre la cuenta: lo que debe el cliente y lo que se le paga al aliado (2026-10-22).
    if (hacia === 'cerrado') await abrirCuenta(quoteId);
    if (hacia === 'cancelado') {
      // Se bajó el aliado: le queda en su historial. Si fue el cliente o
      // MAQSER24, no; y a él se le avisa que no salga.
      if (opts.causa === 'aliado') {
        await prisma.service_assignments.updateMany({ where: { quote_id: quoteId, state: 'aceptado' }, data: { reason: MOTIVO_SE_BAJO } });
      } else {
        await this.avisarCancelacionAAliados(quoteId, opts.note ?? null);
      }
    }

    // Lo reportó el aliado: MAQSER24 se entera en la campana del panel.
    if (opts.porAliado) {
      void avisarPanel({
        modulo: 'servicios',
        evento: 'avance',
        titulo: `${opts.porAliado}: ${PASOS[hacia].label.toLowerCase()} · ${q.quote_number}`,
        cuerpo: `${q.product_interested ?? 'Servicio'}${q.address ? ` · ${q.address}` : ''}`,
        link: '/servicios',
      });
    }

    // Avisar al cliente. El texto es el suyo, no el de operaciones: son dos
    // personas distintas haciéndose preguntas distintas.
    const cierre =
      hacia === 'cerrado' && cantidad ? ` Se registraron ${formatearCantidad(cantidad, unidad)}.` : '';

    /**
     * Al cerrar se le pide la reseña (2026-10-12), con un enlace que no pide
     * iniciar sesión: la mayoría cotizó sin cuenta. Si no se puede firmar (falta
     * la llave), el cierre sigue: la reseña es un extra, el cierre no.
     */
    let resena: string | null = null;
    if (hacia === 'cerrado') {
      try { resena = rutaResena(await firmarResena(quoteId)); } catch (e) { this.log.warn(`Sin enlace de reseña para ${q.quote_number}: ${(e as Error).message}`); }
    }

    if (q.user_id) {
      const detalle = `/cuenta/cotizaciones/${q.quote_number}`;
      await this.notifications.push({
        userId: Number(q.user_id),
        type: 'service_status',
        title: `Tu servicio ${q.quote_number}: ${PASOS[hacia].label.toLowerCase()}`,
        body: PASOS[hacia].cliente + cierre + (resena ? ' Toca aquí para calificarlo.' : ''),
        // El enlace del aviso guarda 200 caracteres: si el de la reseña no cabe, va al detalle.
        link: resena && resena.length <= 200 ? resena : detalle,
      });
    }

    /**
     * Y por correo, tenga cuenta o no.
     *
     * La campana solo la ve quien vuelve al sitio, y la mayoría cotizó sin
     * registrarse: sin esto, "tu unidad va en camino" no le llega a nadie.
     *
     * `asignado` también se avisa, siempre (2026-10-15): con la oferta
     * automática, el cliente acepta y no sabe nada hasta que un aliado toma el
     * servicio. Ese correo es la confirmación que espera: quién lo atiende y
     * cuándo llega. (Antes solo salía si venía del cotizador.)
     */
    {
      const aliados = await prisma.service_assignments.findMany({
        where: { quote_id: quoteId, state: 'aceptado' },
        include: { providers: { select: { name: true } } },
        orderBy: { id: 'asc' },
      });
      const llega = hacia === 'asignado' ? aliados.find((a) => a.committed_at)?.committed_at ?? null : null;
      const plantilla = correoServicioAvanzo({
        nombre: q.name,
        folio: q.quote_number,
        etapa: PASOS[hacia].label,
        mensaje: PASOS[hacia].cliente,
        aliados: aliados.map((a) => a.providers.name),
        cierre: hacia === 'cerrado' && cantidad ? formatearCantidad(cantidad, unidad) : null,
        resena,
        llegada: llega ? FECHA_HORA.format(llega) : null,
        confirmacion: hacia === 'asignado',
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
   * Se canceló: el aliado que lo tenía se entera por correo, y las ofertas que
   * nadie había contestado se retiran (2026-10-22). Nunca lanza.
   */
  private async avisarCancelacionAAliados(quoteId: number, motivo: string | null) {
    try {
      await prisma.service_assignments.updateMany({
        where: { quote_id: quoteId, state: 'propuesto' },
        data: { state: 'tomado', reason: 'Se canceló el servicio' },
      });
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, address: true, service_category: true } });
      const suyos = await prisma.service_assignments.findMany({
        where: { quote_id: quoteId, state: 'aceptado' },
        select: { provider_id: true, providers: { select: { email: true, contact_name: true } } },
      });
      if (!q) return;
      const linea = q.service_category ? await prisma.categories.findUnique({ where: { cat_slug: q.service_category }, select: { cat_name: true } }) : null;
      for (const a of suyos) {
        if (!a.providers.email) continue;
        await this.mailer.enviar({
          kind: 'provider_cancelled',
          to: a.providers.email,
          toName: a.providers.contact_name,
          quoteId,
          providerId: a.provider_id,
          ...correoServicioCanceladoAliado({
            contacto: a.providers.contact_name,
            folio: q.quote_number,
            categoria: linea?.cat_name ?? q.service_category,
            direccion: q.address,
            motivo: motivo?.trim() || null,
          }),
        });
      }
    } catch (e) {
      this.log.warn(`Aviso de cancelación a los aliados de #${quoteId}: ${(e as Error).message}`);
    }
  }

  /**
   * OFERTA AUTOMÁTICA (2026-10-15).
   *
   * "Cuando el cliente la acepta se le debe mandar la cotización a los
   * proveedores, y el primero que conteste que sí puede, aparece en la
   * cotización." Al aceptar el cliente, se le ofrece sola a los mejores
   * aliados que LLEGAN a la obra (los mismos candidatos de "Buscar aliado",
   * en el mismo orden) y el primero que acepta se la queda: a los demás se
   * les retira (ver `responder`).
   *
   * Si ya tiene aliado o ya se le ofreció a alguien, no hace nada: lo que
   * Operaciones haya movido a mano manda. Si nadie llega a la obra, suena la
   * campana para buscarlo a mano. Nunca lanza: aceptar no puede fallar por esto.
   */
  /**
   * APROBAR UNA SOLICITUD DEL COTIZADOR DEL SITIO (movido aquí el 2026-10-22
   * desde admin-ops para que lo usen igual el botón y la aprobación
   * automática). El cliente ya vio el precio: queda en servicio y se le ofrece
   * sola a los aliados. `por` null = la aprobó el sistema.
   */
  async aprobarDelCotizador(quoteId: number, por: { adminId: number | null; adminNombre: string | null } | null) {
    const q = await prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!q) throw new NotFoundException();
    const r = (q.requirements ?? {}) as { origen?: unknown; folio?: unknown; precioAjustado?: unknown };
    if (r.origen !== 'cotizador') throw new BadRequestException('Solo las del cotizador del sitio se aprueban así; las demás se responden.');
    if (r.precioAjustado) throw new BadRequestException('Le cambiaste el precio: respóndele para que el cliente la acepte.');
    if (q.accepted_at || q.status !== 'pending') throw new BadRequestException('Esta cotización ya se había aprobado o respondido.');

    // Todas las partes del mismo documento (el cotizador parte por línea).
    const folio = typeof r.folio === 'string' && r.folio ? r.folio : null;
    const partes = folio
      ? await prisma.quotes.findMany({ where: { status: 'pending', accepted_at: null, requirements: { path: '$.folio', equals: folio } } })
      : [q];
    const ahora = new Date();
    const vence = new Date(`${vigenciaPorDefecto()}T00:00:00Z`);
    for (const p of partes) {
      await prisma.quotes.update({
        where: { id: p.id },
        data: {
          status: 'completed',
          responded_at: ahora,
          responded_by: por ? por.adminNombre : 'Aprobación automática',
          valid_until: vence,
          accepted_at: ahora,
          service_state: estadoInicial(),
          ...(p.first_contact_at ? {} : { first_contact_at: ahora, first_contact_via: 'cotizacion' }),
          updated_at: ahora,
        },
      });
      await prisma.service_events.create({
        data: {
          quote_id: p.id,
          admin_id: por?.adminId ?? null,
          to_state: estadoInicial(),
          note: por
            ? `MAQSER24 revisó la cotización${folio ? ` ${folio}` : ''} y la mandó a los aliados`
            : `Se aprobó sola${folio ? ` (${folio})` : ''}: precio del tabulador, zona con servicio y aliados que llegan a la obra`,
        },
      });
      await sincronizarReserva(Number(p.id));
    }

    const ofrecidos: string[] = [];
    for (const p of partes) ofrecidos.push(...(await this.ofrecerATodos(Number(p.id))).ofrecidos);
    // Aprobada sola, segundos después del "Recibimos…": otro aviso diría lo mismo.
    if (q.user_id && por) {
      await this.notifications.push({
        userId: Number(q.user_id),
        type: 'service_status',
        title: `Revisamos tu cotización ${folio ?? q.quote_number}`,
        body: 'Todo en orden: ya la estamos asignando a un proveedor. Te avisamos en cuanto quede autorizada.',
        link: `/cuenta/cotizaciones/${q.quote_number}`,
      });
    }
    return { partes: partes.length, ofrecidos: [...new Set(ofrecidos)], quoteNumber: q.quote_number, folio };
  }

  /**
   * APROBACIÓN AUTOMÁTICA (2026-10-22, Fase C). Lo que llega del cotizador del
   * sitio se aprueba solo si todo está en orden; si algo no, se queda en "Por
   * cotizar" y la campana dice qué revisar. Nunca lanza.
   *
   * En orden = aprobación automática encendida, total hasta el tope, la obra en
   * una zona que se anuncia, el cliente sin pagos vencidos de más de 15 días y
   * al menos un aliado que llega a la obra.
   */
  async aprobarSiTodoEnOrden(quoteIds: number[]): Promise<void> {
    try {
      if (!quoteIds.length) return;
      const ajuste = await reglaAprobacion();
      const quotes = await prisma.quotes.findMany({
        where: { id: { in: quoteIds.map((id) => BigInt(id)) } },
        select: { id: true, quote_number: true, total: true, region: true, client_id: true, requirements: true },
        orderBy: { id: 'asc' },
      });
      const principal = quotes[0];
      if (!principal) return;
      const folio = ((principal.requirements ?? {}) as { folio?: string }).folio ?? principal.quote_number;
      const motivos: string[] = [];
      if (!ajuste.activa) motivos.push('la aprobación automática está apagada');
      const total = quotes.reduce((a, q) => a + Number(q.total ?? 0), 0);
      if (ajuste.montoMaximo > 0 && total > ajuste.montoMaximo) {
        motivos.push(`el total pasa de ${ajuste.montoMaximo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}`);
      }
      const anunciados = municipiosDe(await leerZonas(), ['sitio']).map((m) => normalizarZona(m.replace(/,\s*(Coah|Chih)\.?$/i, '')));
      const muni = normalizarZona(principal.region ?? '');
      if (anunciados.length && muni && !anunciados.some((a) => a === muni || muni.includes(a) || a.includes(muni))) {
        motivos.push(`${principal.region} no está en una zona que se anuncia`);
      }
      if (principal.client_id) {
        const vencidos = await prisma.service_money.count({
          where: { client_id: principal.client_id, cobrado_at: null, vence: { lt: new Date(Date.now() - 15 * 86_400_000) } },
        });
        if (vencidos) motivos.push('el cliente tiene pagos vencidos de más de 15 días');
      }
      if (!motivos.length) {
        for (const q of quotes) {
          const r = await this.matching.paraCotizacion(Number(q.id));
          if (!r.coincidencias.some((c) => c.cubre)) { motivos.push('ningún aliado llega a la obra'); break; }
        }
      }
      if (motivos.length) {
        void avisarPanel({
          modulo: 'cotizaciones',
          evento: 'cotizacion',
          titulo: `Revisa ${folio}: ${motivos[0]}`,
          cuerpo: `${motivos.join(' · ').replace(/^./, (c) => c.toUpperCase())}. Apruébala o respóndela en Solicitudes.`,
          link: '/cotizaciones',
        });
        return;
      }
      const r = await this.aprobarDelCotizador(Number(principal.id), null);
      void avisarPanel({
        modulo: 'servicios',
        evento: 'solicitud',
        titulo: `${folio} se aprobó sola`,
        cuerpo: r.ofrecidos.length ? `Se ofreció a ${r.ofrecidos.join(', ')}: el primero que acepte se la queda.` : 'Ya está en Servicios por asignar.',
        link: '/servicios',
      });
    } catch (e) {
      this.log.warn(`Aprobación automática: ${(e as Error).message}`);
    }
  }

  async ofrecerATodos(quoteId: number, opts: { max?: number } = {}): Promise<{ ofrecidos: string[] }> {
    const max = opts.max ?? OFERTA_AUTOMATICA_MAX;
    try {
      const vivas = await prisma.service_assignments.count({ where: { quote_id: quoteId, state: { in: ['propuesto', 'aceptado'] } } });
      if (vivas > 0) return { ofrecidos: [] };
      const r = await this.matching.paraCotizacion(quoteId);
      const elegidos = primeroLosDelTipo(r.coincidencias.filter((c) => c.cubre), r.conTipo).slice(0, max);
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, total: true } });
      if (elegidos.length === 0) {
        void avisarPanel({
          modulo: 'servicios',
          evento: 'solicitud',
          titulo: `Ningún aliado llega a la obra de ${q?.quote_number ?? 'un servicio'}: búscale uno`,
          cuerpo: r.motivo ?? `Nadie de la red cubre ${r.zona ?? 'esa zona'} en esa línea.`,
          link: '/servicios',
        });
        return { ofrecidos: [] };
      }
      const ofrecidos: string[] = [];
      for (const c of elegidos) {
        try {
          await this.ofrecer(quoteId, c.proveedor.id, { total: q ? Number(q.total) : null, automatica: true });
          ofrecidos.push(c.proveedor.name);
        } catch (e) {
          this.log.warn(`No se pudo ofrecer ${q?.quote_number} a ${c.proveedor.name}: ${(e as Error).message}`);
        }
      }
      if (ofrecidos.length) {
        await prisma.service_events.create({
          data: { quote_id: quoteId, to_state: 'propuesto', note: `${NOTA_OFERTA_AUTOMATICA} ${ofrecidos.length} aliado(s): el primero que acepte se la queda` },
        });
      }
      // El hueco de la red (2026-10-22): se pidió un tipo que nadie tiene registrado.
      if (r.tiposSinAliado.length) {
        void avisarPanel({
          modulo: 'proveedores',
          evento: 'solicitud',
          titulo: `Nadie de la red tiene registrado: ${r.tiposSinAliado.join(', ')}`,
          cuerpo: `${q?.quote_number ?? 'Una solicitud'} lo pidió y se ofreció a toda la línea. Clasifica los equipos de los aliados o recluta a quien lo tenga.`,
          link: '/proveedores',
          unoCadaMinutos: 60,
        });
      }
      return { ofrecidos };
    } catch (e) {
      this.log.warn(`Oferta automática de #${quoteId}: ${(e as Error).message}`);
      return { ofrecidos: [] };
    }
  }

  /**
   * LOS SIGUIENTES (2026-10-21).
   *
   * Cuando los aliados a los que se les ofreció no contestan a tiempo
   * (quotes/seguimiento-ofertas.ts) o todos dicen que no (`responder`), se le
   * ofrece sola a los siguientes mejores que llegan a la obra, sin repetir a
   * nadie. Las ofertas que siguen sin contestar no se retiran: el primero que
   * acepte, de cualquiera de las tandas, se la queda.
   *
   * Solo en servicios que ya entraron a la oferta automática: si Operaciones
   * se lo ofreció a mano a alguien, esa decisión manda y aquí no se toca. Si
   * ya no queda nadie en la red, suena la campana una sola vez. Nunca lanza.
   */
  async ofrecerALosSiguientes(quoteId: number, porque: 'silencio' | 'rechazo'): Promise<{ ofrecidos: string[]; resuelta: boolean }> {
    try {
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, total: true, service_state: true } });
      // Explícito y no `estadoDe`: una cotización que aún espera al cliente
      // tiene el estado vacío y no se le ofrece a nadie.
      if (!q || q.service_state !== 'por_asignar') return { ofrecidos: [], resuelta: true };
      const asignaciones = await prisma.service_assignments.findMany({ where: { quote_id: quoteId }, select: { provider_id: true, state: true } });
      if (asignaciones.some((a) => a.state === 'aceptado')) return { ofrecidos: [], resuelta: true };
      const automatica = await prisma.service_events.findFirst({
        where: { quote_id: quoteId, note: { startsWith: NOTA_OFERTA_AUTOMATICA } },
        select: { id: true },
      });
      if (!automatica) return { ofrecidos: [], resuelta: false };

      const yaPasaron = new Set(asignaciones.map((a) => a.provider_id));
      const r = await this.matching.paraCotizacion(quoteId);
      const elegidos = primeroLosDelTipo(r.coincidencias.filter((c) => c.cubre && !yaPasaron.has(c.proveedor.id)), r.conTipo).slice(0, OFERTA_AUTOMATICA_MAX);
      const motivo = porque === 'silencio' ? 'nadie contestó a tiempo' : 'los anteriores dijeron que no';

      if (elegidos.length === 0) {
        const avisado = await prisma.service_events.findFirst({
          where: { quote_id: quoteId, note: { startsWith: NOTA_SIN_MAS_ALIADOS } },
          select: { id: true },
        });
        if (!avisado) {
          await prisma.service_events.create({
            data: { quote_id: quoteId, to_state: 'por_asignar', note: `${NOTA_SIN_MAS_ALIADOS}: ${motivo} y ya se le ofreció a todos los que llegan a la obra` },
          });
          void avisarPanel({
            modulo: 'servicios',
            evento: 'solicitud',
            titulo: `${q.quote_number}: ${motivo} y no queda nadie más en la red`,
            cuerpo: r.motivo ?? 'Búscale un aliado a mano.',
            link: '/servicios',
          });
        }
        return { ofrecidos: [], resuelta: true };
      }

      const ofrecidos: string[] = [];
      for (const c of elegidos) {
        try {
          await this.ofrecer(quoteId, c.proveedor.id, { total: Number(q.total) || null, automatica: true });
          ofrecidos.push(c.proveedor.name);
        } catch (e) {
          this.log.warn(`No se pudo ofrecer ${q.quote_number} a ${c.proveedor.name}: ${(e as Error).message}`);
        }
      }
      if (ofrecidos.length) {
        await prisma.service_events.create({
          data: { quote_id: quoteId, to_state: 'propuesto', note: `${NOTA_OFERTA_AUTOMATICA} ${ofrecidos.length} aliado(s) más porque ${motivo}: el primero que acepte se la queda` },
        });
        void avisarPanel({
          modulo: 'servicios',
          evento: 'solicitud',
          titulo: `${q.quote_number}: ${motivo}, se le ofreció a ${ofrecidos.length} aliado(s) más`,
          cuerpo: ofrecidos.join(', '),
          link: '/servicios',
        });
      }
      return { ofrecidos, resuelta: true };
    } catch (e) {
      this.log.warn(`Oferta a los siguientes de #${quoteId}: ${(e as Error).message}`);
      return { ofrecidos: [], resuelta: false };
    }
  }

  /**
   * Ofrecer la solicitud a un aliado.
   *
   * Ofrecer NO es asignar: queda `propuesto` hasta que el aliado contesta. El
   * documento distingue las dos cosas, y confundirlas hace que el tablero diga
   * que algo está resuelto cuando nadie ha dicho que sí.
   */
  async ofrecer(
    quoteId: number,
    providerId: number,
    opts: {
      scope?: string | null;
      adminId?: number | null;
      /** Importe cotizado, cuando el cliente ya lo vio (cotizador). Va en el correo. */
      total?: number | null;
      /** Parte de la oferta automática: el correo le dice que el primero que acepte se la queda. */
      automatica?: boolean;
    } = {},
  ) {
    const [q, p] = await Promise.all([
      prisma.quotes.findUnique({ where: { id: quoteId }, select: { id: true, service_state: true } }),
      prisma.providers.findUnique({ where: { id: providerId }, select: { id: true, name: true, status: true } }),
    ]);
    if (!q) throw new NotFoundException('Cotización no encontrada');
    if (!p) throw new NotFoundException('Aliado no encontrado');
    // Un aliado dado de baja no puede entrar a su portal a contestar, y un
    // servicio cerrado o cancelado ya no se ofrece (QA 2026-09-28).
    if (p.status !== 1) throw new BadRequestException('Ese aliado está dado de baja: no podría contestar la solicitud.');
    if (q.service_state === 'cerrado' || q.service_state === 'cancelado') throw new BadRequestException('Este servicio ya está cerrado o cancelado.');

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
      select: {
        quote_number: true, service_category: true, address: true, comments: true, requirements: true,
        subtotal: true, freight_cost: true, tax: true, total: true, conditions: true,
      },
    });
    // Las partidas del documento (2026-10-15), pero solo las SUYAS
    // (2026-10-19): el documento completo es del cliente y de MAQSER24.
    const parte = datos ? await parteDelDocumento(datos) : null;
    const partidas = parte ? partidasParaAliado(parte.snapshot.calc) : [];
    const contacto = await prisma.providers.findUnique({
      where: { id: providerId },
      select: { email: true, contact_name: true, access_version: true },
    });
    if (contacto?.email && datos) {
      // El correo trae su ENLACE al portal, no una instrucción: "contesta este
      // correo" era una tarea; un botón que abre directo su solicitud es un clic.
      // Si no se puede firmar (falta PROVIDER_LINK_SECRET), el correo sale igual
      // sin botón: la propuesta ya existe y el aliado tiene que enterarse.
      let url: string | null = null;
      try {
        url = urlDeAcceso(await firmarAcceso(providerId, contacto.access_version ?? 1));
      } catch (e) {
        this.log.warn(`Oferta ${datos.quote_number} sin enlace al portal: ${(e as Error).message}`);
      }
      // El nombre de la línea, no su clave ("maquinaria-pesada"), 2026-10-21.
      const linea = datos.service_category
        ? await prisma.categories.findUnique({ where: { cat_slug: datos.service_category }, select: { cat_name: true } })
        : null;
      const plantilla = correoOfertaAAliado({
        aliado: p.name,
        contacto: contacto.contact_name,
        categoria: linea?.cat_name ?? datos.service_category,
        zona: datos.address,
        folio: datos.quote_number,
        detalle: opts.scope?.trim() || datos.comments,
        total: opts.total ?? (Number(datos.total) > 0 ? Number(datos.total) : null),
        pago: parteDelAliado(datos, await reglasDinero()),
        partidas,
        documento: folioDe(datos.requirements),
        automatica: !!opts.automatica,
        url,
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
      throw new BadRequestException(
        a.state === 'tomado' ? 'Este servicio ya lo tomó otro aliado.' : 'Esta propuesta ya tenía respuesta.',
      );
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

    /**
     * EL PRIMERO QUE ACEPTA SE LA QUEDA (2026-10-15). A los demás aliados a
     * los que se les ofreció y no han contestado se les retira la oferta
     * ("tomado"): no es un rechazo suyo ni cuenta en su contra.
     */
    if (estado === 'aceptado') {
      const otros = await prisma.service_assignments.findMany({
        where: { quote_id: a.quote_id, state: 'propuesto', id: { not: assignmentId } },
        select: { id: true },
      });
      if (otros.length) {
        await prisma.service_assignments.updateMany({
          where: { id: { in: otros.map((o) => o.id) }, state: 'propuesto' },
          // Sin responded_at: no contestó él, y contarlo como respuesta movería sus tiempos.
          // Sin nombre: el motivo se ve en el portal de cada aliado, y no tiene por qué saber quién fue.
          data: { state: 'tomado', reason: 'Lo tomó otro aliado' },
        });
        await prisma.service_events.create({
          data: { quote_id: quoteId, to_state: 'tomado', note: `Se les retiró la oferta a ${otros.length} aliado(s): ya la tomó ${a.providers.name}` },
        });
      }
    }

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

    // Campana del panel: solo cuando contesta el aliado (si fue un admin, ya lo sabe).
    // El rechazo suena más abajo, y solo si alguien tiene que hacer algo.
    if (!opts.adminId && estado !== 'rechazado') {
      const cot = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, product_interested: true } });
      void avisarPanel({
        modulo: 'servicios',
        evento: 'respuesta_aliado',
        titulo: estado === 'aceptado'
          ? `${a.providers.name} aceptó ${cot?.quote_number ?? 'una solicitud'}`
          : `${a.providers.name} se retiró de ${cot?.quote_number ?? 'una solicitud'}`,
        cuerpo: estado === 'aceptado'
          ? `${cot?.product_interested ?? 'Servicio'} · ya quedó asignado.`
          : `${cot?.product_interested ?? 'Servicio'}${opts.reason ? ` · ${opts.reason.trim()}` : ''} · busca otro aliado.`,
        link: '/servicios',
      });
    }

    /**
     * Si no la toma, su máquina vuelve a estar libre para otros. Si la toma,
     * queda apartado lo SUYO —aunque el cliente hubiera elegido la de otro
     * aliado— y decir "sí, la llevo" cuenta como confirmar que la tiene.
     */
    const reserva = await sincronizarReserva(quoteId);
    if (estado === 'aceptado') await confirmarEquipos(reserva.productos, a.provider_id);

    if (estado !== 'aceptado') {
      const vivas = await prisma.service_assignments.count({ where: { quote_id: a.quote_id, state: { in: ['propuesto', 'aceptado'] } } });

      // Si ya nadie tiene la oferta viva, se le ofrece sola a los siguientes
      // (2026-10-21). Solo cuando rechaza el aliado: retirar es una decisión
      // de Operaciones y no se le enmienda.
      const siguientes = estado === 'rechazado' && vivas === 0
        ? await this.ofrecerALosSiguientes(quoteId, 'rechazo')
        : { ofrecidos: [], resuelta: false };

      /*
       * Campana del rechazo (2026-10-22): si otros aliados aún la revisan, no
       * hay nada que hacer; si la oferta automática ya se la mandó a los
       * siguientes (o avisó que no queda nadie), su campana ya lo dijo. Solo
       * suena cuando hay que buscarle aliado a mano.
       */
      if (!opts.adminId && estado === 'rechazado' && vivas === 0 && !siguientes.resuelta) {
        const cot = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, product_interested: true } });
        void avisarPanel({
          modulo: 'servicios',
          evento: 'respuesta_aliado',
          titulo: `${a.providers.name} rechazó ${cot?.quote_number ?? 'una solicitud'}`,
          cuerpo: `${cot?.product_interested ?? 'Servicio'}${opts.reason ? ` · ${opts.reason.trim()}` : ''} · busca otro aliado.`,
          link: '/servicios',
        });
      }

      /**
       * El cliente se entera también de la negativa (2026-09-25): antes solo
       * veía "esperando al aliado" para siempre. Desde la oferta a varios
       * (2026-10-22) solo cuando ya nadie la está revisando: con cinco
       * aliados, cinco avisos de "rechazada" asustaban por algo que no había
       * pasado todavía.
       */
      const q = vivas === 0
        ? await prisma.quotes.findUnique({ where: { id: quoteId }, select: { user_id: true, quote_number: true, product_interested: true } })
        : null;
      if (q?.user_id) {
        await this.notifications.push({
          userId: Number(q.user_id),
          type: 'service_status',
          title: `Seguimos buscando proveedor para ${q.quote_number}`,
          body: siguientes.ofrecidos.length
            ? `${q.product_interested ?? 'El servicio'}: los proveedores que la revisaron no pudieron atenderla. Ya se la ofrecimos a otros; te avisamos en cuanto uno la tome.`
            : `${q.product_interested ?? 'El servicio'}: los proveedores que la revisaron no pudieron atenderla. MAQSER24 está buscando otra opción para ti.`,
          link: `/cuenta/cotizaciones/${q.quote_number}`,
        });
      }
    }

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
          requisitos: lista(obra?.requirements),
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
      await this.documentoAceptadoSiTodos(quoteId);
    }
    return { ok: true };
  }

  /**
   * El documento del cotizador (MQ-/TR-) nace `solicitada` y pasa a
   * `aceptada` cuando TODOS los servicios de su folio tienen aliado que
   * aceptó (2026-09-25). Nunca lanza: es un reflejo, no el dato principal.
   */
  private async documentoAceptadoSiTodos(quoteId: number) {
    try {
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { requirements: true } });
      const req = (q?.requirements ?? {}) as { folio?: string; quoterId?: number };
      if (!req.folio || !req.quoterId) return;
      const hermanos = await prisma.quotes.findMany({
        where: { requirements: { path: '$.folio', equals: req.folio } },
        select: { id: true },
      });
      if (hermanos.length === 0) return;
      const aceptados = await prisma.service_assignments.findMany({
        where: { quote_id: { in: hermanos.map((h) => h.id) }, state: 'aceptado' },
        select: { quote_id: true },
      });
      const conAliado = new Set(aceptados.map((a) => String(a.quote_id)));
      if (hermanos.every((h) => conAliado.has(String(h.id)))) {
        await prisma.quoter_quotes.updateMany({
          where: { id: Number(req.quoterId), state: 'solicitada' },
          data: { state: 'aceptada', updated_at: new Date() },
        });
      }
    } catch (err) {
      this.log.warn(`No se pudo actualizar el documento del folio: ${(err as Error).message}`);
    }
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

/** A cuántos aliados se les ofrece a la vez cuando el cliente acepta. */
const OFERTA_AUTOMATICA_MAX = 5;

/**
 * Prefijo de la nota que deja la oferta automática en el historial. Es la
 * marca de que el servicio entró al flujo automático (ver `ofrecerALosSiguientes`).
 */
export const NOTA_OFERTA_AUTOMATICA = 'Oferta automática a';
/** Prefijo de la nota "ya no queda nadie": evita repetir la campana. */
const NOTA_SIN_MAS_ALIADOS = 'Sin más aliados';

/** La regla de la aprobación automática (platform_settings, 2026-10-22). Encendida por defecto. */
export interface ReglaAprobacion { activa: boolean; montoMaximo: number }
const REGLA_APROBACION_DEFAULT: ReglaAprobacion = { activa: true, montoMaximo: 300_000 };
export async function reglaAprobacion(): Promise<ReglaAprobacion> {
  const r = await leerAjuste<Partial<ReglaAprobacion>>('aprobacion_automatica', REGLA_APROBACION_DEFAULT);
  return {
    activa: r.activa !== false,
    montoMaximo: Number.isFinite(Number(r.montoMaximo)) && Number(r.montoMaximo) >= 0 ? Number(r.montoMaximo) : REGLA_APROBACION_DEFAULT.montoMaximo,
  };
}
export async function guardarReglaAprobacion(r: ReglaAprobacion, por: string): Promise<void> {
  await guardarAjuste('aprobacion_automatica', r, por);
}

/**
 * Si alguno de los que llegan tiene registrado el TIPO pedido, la oferta va
 * solo a ellos (2026-10-22); si ninguno, a todos los que llegan, como antes.
 * Así una solicitud de excavadora no le llega a quien solo tiene retros,
 * pero tampoco se queda sin ofrecer mientras los equipos no tengan tipo.
 */
function primeroLosDelTipo<T extends { proveedor: { id: number } }>(cubren: T[], conTipo: Set<number> | null): T[] {
  if (!conTipo?.size) return cubren;
  const delTipo = cubren.filter((c) => conTipo.has(c.proveedor.id));
  return delTipo.length ? delTipo : cubren;
}

const FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey',
});

const folioDe = (requirements: unknown): string | null => {
  const f = (requirements as { folio?: unknown } | null)?.folio;
  return typeof f === 'string' && f.trim() ? f : null;
};
