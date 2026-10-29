import { lista } from '../common/json-list';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@maqserv/db';
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
import { conCandado } from '../common/candado';
import { sinContacto, zonaAproximada } from '../providers/pedido';
import { ultimaVersionOperador } from '../providers/operador';
import { MatchingService } from './matching.service';
import { parteDelDocumento, partidasParaAliado } from '../quoter/parte-del-documento';
import { firmarResena, rutaResena } from '../reviews/resena-link';
import { cancelarDocumentoSiNadaSigue } from '../quoter/documento-estado';
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
      // Si ya nada de su folio sigue, su documento pasa a Cancelada (2026-10-26).
      await cancelarDocumentoSiNadaSigue(q.requirements);
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
      const plantilla = await correoServicioAvanzo({
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
   * MANDAR A TODOS (2026-10-23; antes "oferta automática", 2026-10-15).
   *
   * Ya no sale sola cuando el cliente acepta: MAQSER24 decide a quién se la da
   * (puede que con alguno ya no trabajen) y este es su botón "Mandar a todos"
   * de Servicios › Buscar aliado. Se le ofrece a todos los que LLEGAN a la obra
   * (los mismos candidatos y en el mismo orden que la lista; primero los que
   * tienen registrado ese tipo) y el primero que acepta se la queda: a los
   * demás se les retira (ver `responder`).
   *
   * No repite a nadie: quien ya tiene la oferta viva o ya dijo que no se salta.
   * Si ya hay un aliado que aceptó, no hace nada. No lanza: lo que no se pudo
   * hacer vuelve en `motivo` para que la pantalla lo diga. Con `soloVer`
   * devuelve a quiénes les llegaría, sin mandar nada (la pantalla lo enseña
   * antes de confirmar, con la MISMA regla).
   */
  async ofrecerATodos(quoteId: number, opts: { max?: number; adminId?: number | null; soloVer?: boolean } = {}): Promise<{ ofrecidos: string[]; motivo: string | null }> {
    const max = opts.max ?? Infinity;
    try {
      const asignaciones = await prisma.service_assignments.findMany({ where: { quote_id: quoteId }, select: { provider_id: true, state: true } });
      if (asignaciones.some((x) => x.state === 'aceptado')) return { ofrecidos: [], motivo: 'Ya hay un aliado que aceptó este servicio.' };
      // Los que ya la tienen viva o ya dijeron que no (fallback.ts, decisión 3).
      const yaPasaron = new Set(asignaciones.filter((x) => x.state === 'propuesto' || x.state === 'rechazado').map((x) => x.provider_id));
      const r = await this.matching.paraCotizacion(quoteId);
      const cubren = r.coincidencias.filter((c) => c.cubre);
      const elegidos = primeroLosDelTipo(cubren.filter((c) => !yaPasaron.has(c.proveedor.id)), r.conTipo).slice(0, max);
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, total: true } });
      if (elegidos.length === 0) {
        return {
          ofrecidos: [],
          motivo: cubren.length
            ? 'Ya se le ofreció a todos los que llegan a la obra (o ya dijeron que no).'
            : r.motivo ?? `Nadie de la red cubre ${r.zona ?? 'esa zona'} en esa línea.`,
        };
      }
      if (opts.soloVer) return { ofrecidos: elegidos.map((c) => c.proveedor.name), motivo: null };
      const ofrecidos: string[] = [];
      for (const c of elegidos) {
        try {
          // "El primero que acepte se la queda" solo tiene sentido en el correo si son varios.
          await this.ofrecer(quoteId, c.proveedor.id, { total: q ? Number(q.total) : null, automatica: elegidos.length > 1, adminId: opts.adminId ?? null });
          ofrecidos.push(c.proveedor.name);
        } catch (e) {
          this.log.warn(`No se pudo ofrecer ${q?.quote_number} a ${c.proveedor.name}: ${(e as Error).message}`);
        }
      }
      if (ofrecidos.length) {
        await prisma.service_events.create({
          data: {
            quote_id: quoteId,
            admin_id: opts.adminId ?? null,
            to_state: 'propuesto',
            note: `${NOTA_A_TODOS} (${ofrecidos.length} aliado${ofrecidos.length === 1 ? '' : 's'}): ${ofrecidos.join(', ')}. El primero que acepte se la queda`,
          },
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
      return { ofrecidos, motivo: ofrecidos.length ? null : 'No se pudo mandar a ninguno. Inténtalo de nuevo.' };
    } catch (e) {
      this.log.warn(`Mandar a todos #${quoteId}: ${(e as Error).message}`);
      return { ofrecidos: [], motivo: 'No se pudo consultar la red. Inténtalo de nuevo.' };
    }
  }

  /**
   * NADIE CONTESTÓ A TIEMPO (2026-10-23; antes "los siguientes", 2026-10-21).
   *
   * Cuando a todas las ofertas vivas de un servicio se les acabó el plazo
   * (quotes/seguimiento-ofertas.service.ts), YA NO se le ofrece sola a los
   * siguientes: MAQSER24 elige a quién se la da. Aquí solo se deja la nota en
   * el historial y suena la campana, UNA vez por tanda de ofertas (si después
   * se le ofrece a otro y también calla, vuelve a sonar). Las ofertas no se
   * retiran: si uno de ellos acepta tarde, se la queda.
   *
   * Vale para cualquier oferta, la haya hecho una persona uno por uno o con
   * "Mandar a todos": ahora todas son de una persona, y la campana solo avisa,
   * no enmienda la decisión. El rechazo tiene su propia campana en `responder`.
   * Nunca lanza.
   */
  async avisarSinRespuesta(quoteId: number): Promise<{ avisado: boolean }> {
    try {
      const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, product_interested: true, service_state: true } });
      // Explícito y no `estadoDe`: una cotización que aún espera al cliente
      // tiene el estado vacío y no tiene ofertas que vigilar.
      if (!q || q.service_state !== 'por_asignar') return { avisado: false };
      const asignaciones = await prisma.service_assignments.findMany({
        where: { quote_id: quoteId },
        select: { state: true, offered_at: true, providers: { select: { name: true } } },
      });
      if (asignaciones.some((a) => a.state === 'aceptado')) return { avisado: false };
      const vivas = asignaciones.filter((a) => a.state === 'propuesto');
      if (vivas.length === 0) return { avisado: false };

      // Una vez por tanda: si ya se avisó después de la última oferta, no se repite.
      const ultima = vivas.reduce<Date | null>((m, a) => (a.offered_at && (!m || a.offered_at > m) ? a.offered_at : m), null);
      const avisado = await prisma.service_events.findFirst({
        where: { quote_id: quoteId, note: { startsWith: NOTA_SIN_RESPUESTA }, ...(ultima ? { created_at: { gte: ultima } } : {}) },
        select: { id: true },
      });
      if (avisado) return { avisado: false };

      const nombres = vivas.map((a) => a.providers.name);
      await prisma.service_events.create({
        data: { quote_id: quoteId, to_state: 'por_asignar', note: `${NOTA_SIN_RESPUESTA}: ${nombres.join(', ')}. Las ofertas siguen vivas; MAQSER24 elige si espera o se la da a otro` },
      });
      void avisarPanel({
        modulo: 'servicios',
        evento: 'respuesta_aliado',
        titulo: `${q.quote_number}: nadie contestó a tiempo — elige a otro aliado`,
        cuerpo: `${q.product_interested ?? 'Servicio'} · sin respuesta de ${nombres.join(', ')}. En Servicios › Buscar aliado, ofrécelo a otro o mándalo a todos.`,
        link: '/servicios',
      });
      return { avisado: true };
    } catch (e) {
      this.log.warn(`Aviso de ofertas sin respuesta de #${quoteId}: ${(e as Error).message}`);
      return { avisado: false };
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
      /** Se le ofreció a varios a la vez ("Mandar a todos"): el correo le dice que el primero que acepte se la queda. */
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
        client_sites: { select: { address: true, municipality: true } },
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
      const plantilla = await correoOfertaAAliado({
        aliado: p.name,
        contacto: contacto.contact_name,
        categoria: linea?.cat_name ?? datos.service_category,
        // Solo la zona y sin datos de contacto ni enlaces: la oferta va a varios
        // aliados y aún no es de nadie (ver "antes de aceptar" en providers/pedido.ts).
        zona: zonaAproximada(datos.client_sites?.address ?? datos.address, datos.client_sites?.municipality),
        folio: datos.quote_number,
        detalle: opts.scope?.trim() || sinContacto(datos.comments),
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
  /**
   * EL ALIADO SE BAJÓ A MEDIO SERVICIO (2026-10-26). Antes "El aliado se bajó"
   * cancelaba el servicio entero y el cliente se quedaba sin máquina. Decisión
   * del dueño: el servicio sigue; vuelve a "Por asignar" para buscar otro
   * aliado (es el único caso en que se busca otro con uno ya asignado). Al que
   * se bajó le queda en su historial; su máquina se suelta y el enlace del
   * operador deja de servir.
   */
  async seBajoElAliado(quoteId: number, opts: { adminId?: number | null; note?: string | null } = {}) {
    const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { service_state: true, requirements: true } });
    if (!q) throw new NotFoundException('Servicio no encontrado');
    if (!['asignado', 'en_traslado', 'en_sitio', 'en_curso'].includes(q.service_state ?? '')) {
      throw new BadRequestException('Solo se puede cuando ya hay un aliado trabajándolo y no ha terminado.');
    }
    const aceptados = await prisma.service_assignments.findMany({
      where: { quote_id: quoteId, state: 'aceptado' },
      include: { providers: { select: { name: true } } },
    });
    if (aceptados.length === 0) throw new BadRequestException('Este servicio no tiene un aliado que lo haya aceptado.');

    await conCandado([`servicio:${quoteId}`], async () => {
      await prisma.service_assignments.updateMany({
        where: { quote_id: quoteId, state: 'aceptado' },
        data: { state: 'retirado', reason: MOTIVO_SE_BAJO },
      });
      // Sin operador: el enlace que tenía ya no abre este servicio. La versión
      // se guarda para que el próximo operador nunca reciba una repetida.
      const { operadorAsignado: _fuera, ...resto } = (q.requirements ?? {}) as Record<string, unknown>;
      void _fuera;
      const req = { ...resto, operadorVersion: ultimaVersionOperador(q.requirements) };
      await prisma.quotes.update({
        where: { id: quoteId },
        data: { service_state: 'por_asignar', requirements: req as Prisma.InputJsonValue, updated_at: new Date() },
      });
    });
    await prisma.service_events.create({
      data: {
        quote_id: quoteId,
        admin_id: opts.adminId ?? null,
        to_state: 'por_asignar',
        note: `${aceptados.map((a) => a.providers.name).join(', ')} se bajó del servicio${opts.note?.trim() ? `: ${opts.note.trim()}` : ''}. Se busca otro aliado.`,
      },
    });
    // Su máquina vuelve a estar libre.
    await sincronizarReserva(quoteId);
    return { ok: true };
  }

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

    const quoteId = Number(a.quote_id);

    /**
     * Contestar y retirar a los demás van JUNTOS y de uno en uno por servicio
     * (auditoría 2026-10-23). Antes se leía el estado y luego se escribía sin
     * condición: dos aliados que aceptaban en el mismo instante quedaban los dos
     * "aceptado", con los datos del cliente y el operador de cada uno.
     */
    await conCandado([`servicio:${quoteId}`], async () => {
      const r = await prisma.service_assignments.updateMany({
        where: { id: assignmentId, state: 'propuesto' },
        data: {
          state: estado,
          reason: opts.reason?.trim() || null,
          responded_at: new Date(),
          ...(estado === 'aceptado' && opts.committedAt ? { committed_at: opts.committedAt } : {}),
        },
      });
      if (r.count !== 1) {
        const ahora = await prisma.service_assignments.findUnique({ where: { id: assignmentId }, select: { state: true } });
        throw new BadRequestException(
          ahora?.state === 'tomado' ? 'Este servicio ya lo tomó otro aliado.' : 'Esta propuesta ya tenía respuesta.',
        );
      }

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
    });

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

      /*
       * Campana del rechazo (2026-10-22). Desde el 2026-10-23 ya no se le
       * ofrece sola a los siguientes: MAQSER24 elige a quién se la da. Si otros
       * aliados aún la revisan, no hay nada que hacer; cuando ya nadie la tiene
       * viva, suena siempre para que la ofrezcan a otro.
       */
      if (!opts.adminId && estado === 'rechazado' && vivas === 0) {
        const cot = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true, product_interested: true } });
        void avisarPanel({
          modulo: 'servicios',
          evento: 'respuesta_aliado',
          titulo: `${a.providers.name} dijo que no a ${cot?.quote_number ?? 'una solicitud'} — elige a otro aliado`,
          cuerpo: `${cot?.product_interested ?? 'Servicio'}${opts.reason ? ` · "${opts.reason.trim()}"` : ''} · En Servicios › Buscar aliado, ofrécelo a otro o mándalo a todos.`,
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
          body: `${q.product_interested ?? 'El servicio'}: los proveedores que la revisaron no pudieron atenderla. MAQSER24 está buscando otra opción para ti.`,
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
        const plantilla = await correoAsignacionAAliado({
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

/** Prefijo de la nota que deja "Mandar a todos" en el historial (2026-10-23). */
const NOTA_A_TODOS = 'Se mandó a todos los que llegan a la obra';
/** Prefijo de la nota "nadie contestó a tiempo": evita repetir la campana en la misma tanda (2026-10-23). */
const NOTA_SIN_RESPUESTA = 'Sin respuesta a tiempo';

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
