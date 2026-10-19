import { lista } from '../common/json-list';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { formatearCantidad, unidadPorDefectoDe } from '@maqserv/config';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { avisarPanel } from '../notifications/panel';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { correoServicioAvanzo, correoOfertaAAliado, correoAsignacionAAliado } from '../notifications/email-templates';
import { confirmarEquipos, sincronizarReserva } from './reservas';
import { MatchingService } from './matching.service';
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
  async ofrecerATodos(quoteId: number, opts: { max?: number } = {}): Promise<{ ofrecidos: string[] }> {
    const max = opts.max ?? OFERTA_AUTOMATICA_MAX;
    try {
      const vivas = await prisma.service_assignments.count({ where: { quote_id: quoteId, state: { in: ['propuesto', 'aceptado'] } } });
      if (vivas > 0) return { ofrecidos: [] };
      const r = await this.matching.paraCotizacion(quoteId);
      const elegidos = r.coincidencias.filter((c) => c.cubre).slice(0, max);
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
          data: { quote_id: quoteId, to_state: 'propuesto', note: `Oferta automática a ${ofrecidos.length} aliado(s): el primero que acepte se la queda` },
        });
      }
      return { ofrecidos };
    } catch (e) {
      this.log.warn(`Oferta automática de #${quoteId}: ${(e as Error).message}`);
      return { ofrecidos: [] };
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
      select: { quote_number: true, service_category: true, address: true, comments: true, total: true, requirements: true },
    });
    // La cotización completa (2026-10-15): el aliado ve las partidas y el
    // importe del documento, igual que el cliente.
    const partidas = datos ? await partidasDelDocumento(datos.requirements) : [];
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
      const plantilla = correoOfertaAAliado({
        aliado: p.name,
        contacto: contacto.contact_name,
        categoria: datos.service_category,
        zona: datos.address,
        folio: datos.quote_number,
        detalle: opts.scope?.trim() || datos.comments,
        total: opts.total ?? (Number(datos.total) > 0 ? Number(datos.total) : null),
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
    if (!opts.adminId) {
      const cot = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, product_interested: true } });
      void avisarPanel({
        modulo: 'servicios',
        evento: 'respuesta_aliado',
        titulo: estado === 'aceptado'
          ? `${a.providers.name} aceptó ${cot?.quote_number ?? 'una solicitud'}`
          : `${a.providers.name} ${estado === 'rechazado' ? 'rechazó' : 'se retiró de'} ${cot?.quote_number ?? 'una solicitud'}`,
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
      /**
       * El cliente se entera también de la negativa (2026-09-25): antes solo
       * veía "esperando al aliado" para siempre. El mensaje dice que no es el
       * final: MAQSER24 busca otra opción.
       */
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { user_id: true, quote_number: true, product_interested: true } });
      if (q?.user_id) {
        await this.notifications.push({
          userId: Number(q.user_id),
          type: 'service_status',
          title: `Tu solicitud ${q.quote_number} fue rechazada por el aliado`,
          body: `${q.product_interested ?? 'El servicio'}: el aliado no pudo atenderla. MAQSER24 está buscando otra opción para ti.`,
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

const FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey',
});

const folioDe = (requirements: unknown): string | null => {
  const f = (requirements as { folio?: unknown } | null)?.folio;
  return typeof f === 'string' && f.trim() ? f : null;
};

/** Las partidas del documento del cotizador ligado, para enseñárselas al aliado. */
async function partidasDelDocumento(requirements: unknown): Promise<Array<{ concepto: string; cantidad: string; importe: number }>> {
  const id = (requirements as { quoterId?: unknown } | null)?.quoterId;
  if (typeof id !== 'number') return [];
  const doc = await prisma.quoter_quotes.findUnique({ where: { id }, select: { snapshot: true } });
  const renglones = (doc?.snapshot as { calc?: { renglones?: Array<{ concepto?: string; cantidad?: number; unidad?: string; importe?: number }> } } | null)?.calc?.renglones ?? [];
  return renglones
    .filter((r) => r.concepto)
    .map((r) => ({ concepto: String(r.concepto), cantidad: `${r.cantidad ?? ''} ${r.unidad ?? ''}`.trim(), importe: Number(r.importe ?? 0) }));
}
