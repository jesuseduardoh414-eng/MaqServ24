import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { avisarPanel } from '../notifications/panel';
import { prisma } from '@maqserv/db';
import { kmRestantes, obraDe, ultimaUbicacion } from './rastreo';
import type { QuoteDetail, QuoteItem, QuoteRequestInput, QuoteSummary } from '@maqserv/types';
import { CATALOGOS_DEFAULT, centroDeMunicipio, formatearCantidad, requestAnswersToText, requestFormFor } from '@maqserv/config';
import { imageUrl } from '../catalog/images';
import { FreightService } from '../freight/freight.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { correoAcuseSolicitudAMedida, correoSolicitudAMedidaInterna } from '../notifications/email-templates';
import { estadoCotizacion, sePuedeAceptar, diasParaVencer } from './quote-validity';
import { PASOS, avance, esEstado, estadoInicial, type EstadoServicio } from './service-flow';
import { resolverClienteYObra } from './client-resolver';
import { completarTelefono, datosDeCuenta } from '../common/cuenta';
import { estadoSolicitud } from './estado-solicitud';
import { sincronizarReserva } from './reservas';
import { ServiceService } from './service.service';
import { operadorDe } from '../providers/operador';
import { pedidoDe } from '../providers/pedido';
import { cantidadDelFormulario, estimarDelTabulador } from './estimado-formulario';

/**
 * EL PRECIO EN PREPARACIÓN NO SE ENSEÑA (2026-10-15). Mientras MAQSER24 no
 * responde, lo que haya en importes o en el documento ligado es un borrador:
 * el cliente ve su solicitud sin precios. Desde el 2026-10-23 sin excepción:
 * el cotizador del sitio ya no enseña el precio, así que el suyo también es un
 * estimado que alguien tiene que revisar antes de que lo vea.
 */
const precioOculto = (q: { status: string; requirements?: unknown }) => q.status === 'pending';

/**
 * Claves de `requirements` que escribe SOLO el servidor (auditoría 2026-10-23).
 * El formulario de /cotizar manda sus respuestas en ese mismo objeto, y antes
 * se guardaba tal cual: con `folio` de otro documento (son consecutivos, se
 * adivinan) el cliente leía el documento ajeno con precios y datos, y con
 * `origen: 'cotizador'` veía el precio en preparación. Se quitan al entrar.
 */
const CLAVES_DEL_SERVIDOR = new Set([
  'origen', 'cotizador', 'folio', 'quoterId', 'obra', 'productos', 'productId',
  'precioAjustado', 'operadorAsignado', 'operadorVersion', 'renglones', 'sin_reserva',
]);

function soloRespuestasDelCliente(r: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!r) return undefined;
  const limpias = Object.fromEntries(Object.entries(r).filter(([k]) => !CLAVES_DEL_SERVIDOR.has(k)));
  return Object.keys(limpias).length ? limpias : undefined;
}

/** Folio del documento del cotizador guardado en `requirements` (cotizador por tipo o por máquina). */
function folioDocumento(requirements: unknown): string | null {
  const f = (requirements as Record<string, unknown> | null)?.folio;
  return typeof f === 'string' && f.trim() ? f : null;
}

/**
 * EL DOCUMENTO DE UNA SOLICITUD SIN PRECIO (2026-10-15; compartido 2026-10-19).
 *
 * El formato de siempre (empresa, folio, partidas, firma) sin importes. Lo
 * usan la vista previa antes de enviarla y Mis cotizaciones después: UNA sola
 * función para que lo que el cliente revisó sea exactamente lo que recibe.
 */
async function documentoDeSolicitud(d: {
  folio: string;
  quoteNumber: string | null;
  categoria: string | null;
  requirements: Record<string, unknown>;
  comments: string | null;
  partidas: Array<{ productId: number; nombre: string; renta: boolean; qty: number; days: number }>;
  /** Lo que se pidió cuando no hay equipo del catálogo (pipas, triturados…). */
  servicio: string | null;
  cliente: string;
  atencion: string | null;
  obra: string | null;
  municipio: string | null;
  emitida: Date;
  saludo: string;
}) {
  const tipo = (d.categoria ?? '').includes('tritur') ? 'triturados' : 'maquinaria';
  const fila = await prisma.quoter_catalogs.findUnique({ where: { kind: tipo } });
  const cat = (fila?.data ?? CATALOGOS_DEFAULT[tipo]) as { empresa: unknown; firma: unknown; version: string };
  // Lo que contestó del formulario va en su propio bloque, renglón por
  // renglón. La ubicación de la obra también: `pedidoDe` la salta porque el
  // aliado la recibe aparte, pero en el documento es justo lo que hay que leer.
  const form = requestFormFor(d.categoria);

  // Si la línea pregunta su propia cantidad (2000 piezas de block), esa es la
  // del renglón: el sitio ya no pide además la del paso 1 (2026-10-22).
  const campoCantidad = form?.fields.find((f) => f.key === 'cantidad');
  const cantidadPedida = Number(d.requirements.cantidad);
  const usarCantidad = d.partidas.length === 1 && !d.partidas[0].renta && campoCantidad && cantidadPedida > 0;
  const renglones = d.partidas.length
    ? d.partidas.map((i) => ({
        clase: 'equipo', id: String(i.productId), nombre: i.nombre, concepto: i.nombre,
        unidad: i.renta ? 'DÍAS' : 'PZA', cantidad: usarCantidad ? cantidadPedida : i.renta ? i.days * i.qty : i.qty, pu: 0, importe: 0,
      }))
    : [{ clase: 'equipo', id: 'solicitud', nombre: d.servicio ?? 'Servicio', concepto: d.servicio ?? 'Servicio', unidad: 'SERV', cantidad: 1, pu: 0, importe: 0 }];
  const detalle = pedidoDe(d.categoria, d.requirements, d.comments);
  const ubicacion = typeof d.requirements.obra_ubicacion === 'string' ? d.requirements.obra_ubicacion.trim() : '';
  if (ubicacion) {
    const fila = { label: form?.fields.find((f) => f.key === 'obra_ubicacion')?.label ?? 'Ubicación de la obra', valor: ubicacion };
    const fecha = form?.fields.find((f) => f.key === 'fecha_inicio')?.label;
    const i = fecha ? detalle.findIndex((r) => r.label === fecha) : -1;
    if (i >= 0) detalle.splice(i, 0, fila);
    else detalle.unshift(fila);
  }
  // "Municipio" es el municipio, no la dirección completa: se busca pieza por
  // pieza ("Av. Miguel Alemán 1500, Apodaca" → Apodaca), como el cotizador.
  const municipio = [d.municipio, ubicacion, d.obra]
    .flatMap((t) => (t ?? '').split(',').map((p) => p.trim()).filter(Boolean).reverse())
    .map((p) => centroDeMunicipio(p)?.nombre)
    .find(Boolean) ?? d.municipio;

  return {
    folio: d.folio,
    tipo: 'solicitud',
    quoteNumber: d.quoteNumber,
    cliente: d.cliente,
    obra: d.obra,
    atencion: d.atencion,
    municipio,
    detalle,
    notas: comentarioLibre(d.categoria, d.requirements, d.comments),
    sinPrecios: true,
    documento: {
      calc: {
        renglones,
        desglose: { renta: 0, servicios: 0, fletes: 0, materiales: 0 },
        subtotal: 0, iva: 0, iva_tasa: 0.16, con_iva: true, total: 0, condiciones: [],
      },
      empresa: cat.empresa,
      firma: cat.firma,
      saludo: d.saludo,
      version: cat.version,
      emitida: d.emitida.toISOString(),
    },
  };
}

/**
 * Lo que el cliente escribió aparte del formulario. El comentario guardado
 * lleva primero las respuestas en texto (ver QuoteForm): esas ya van en el
 * bloque de detalle y repetirlas en las notas sería decir todo dos veces.
 */
function comentarioLibre(categoria: string | null, requirements: Record<string, unknown>, comments: string | null): string | null {
  const c = (comments ?? '').trim();
  const form = requestFormFor(categoria);
  if (!c || !form) return c || null;
  const respuestas = Object.fromEntries(Object.entries(requirements).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const texto = requestAnswersToText(form, respuestas);
  return (texto && c.startsWith(texto) ? c.slice(texto.length) : c).trim() || null;
}

/** Formato legacy: COT- + 8 alfanuméricos mayúsculas. Lo usa también el puente del cotizador. */
export function newQuoteNumber(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `COT-${s}`;
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly freight: FreightService,
    private readonly notifications: NotificationsService,
    private readonly services: ServiceService,
    private readonly mailer: MailerService,
  ) {}

  private readonly log = new Logger(QuotesService.name);

  /**
   * LOS CORREOS DE UNA SOLICITUD A LA MEDIDA (2026-10-21).
   *
   * Antes solo sonaban las campanas: el cliente que no volvía a entrar no sabía
   * si había llegado, y en MAQSER24 nadie se enteraba fuera del panel. Igual
   * que en el cotizador: acuse al cliente y aviso al buzón de la plataforma.
   * Nunca lanza; si falla, queda en el registro de correos.
   */
  private async avisarSolicitudPorCorreo(q: {
    id: bigint; quote_number: string; product_interested: string | null; address: string | null; comments: string | null; requirements: unknown;
  }, customer: { name: string; email: string; phone: string; company?: string }): Promise<void> {
    try {
      const sitio = (process.env.SITE_URL ?? 'https://maqser24.com').replace(/\/+$/, '');
      const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
      const pidio = q.product_interested?.trim() || null;
      await this.mailer.enviar({
        kind: 'quote_request_ack',
        to: customer.email,
        toName: customer.name,
        quoteId: Number(q.id),
        ...correoAcuseSolicitudAMedida({
          nombre: customer.name,
          folio: q.quote_number,
          pidio,
          url: `${sitio}/cuenta/cotizaciones/${encodeURIComponent(q.quote_number)}`,
        }),
      });

      // Al buzón desde el que sale el correo, como el aviso del cotizador.
      const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
      if (!interno) return;
      const fecha = (q.requirements as Record<string, unknown> | null)?.fecha_inicio;
      await this.mailer.enviar({
        kind: 'quote_request_internal',
        to: interno,
        replyTo: customer.email,
        quoteId: Number(q.id),
        ...correoSolicitudAMedidaInterna({
          folio: q.quote_number,
          cliente: customer.name,
          empresa: customer.company?.trim() || null,
          correo: customer.email,
          telefono: customer.phone || null,
          pidio,
          direccion: q.address,
          fecha: typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ? new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
            : null,
          comentarios: q.comments,
          url: `${panel}/cotizaciones?ver=${q.id}`,
        }),
      });
    } catch (e) {
      this.log.error(`No se pudieron mandar los correos de la solicitud ${q.quote_number}: ${(e as Error).message}`);
    }
  }

  private toSummary(q: {
    id: bigint; quote_number: string; status: string;
    subtotal: unknown; freight_cost: unknown; freight_distance: string | null;
    tax: unknown; total: unknown; created_at: Date | null;
    valid_until?: Date | null; accepted_at?: Date | null; service_state?: string | null;
    requirements?: unknown;
  }, asignaciones: Array<{ state: string }> = []): QuoteSummary {
    const oculto = precioOculto(q);
    return {
      serviceState: q.service_state ?? null,
      request: estadoSolicitud(q.service_state, asignaciones),
      id: Number(q.id),
      quoteNumber: q.quote_number,
      status: q.status,
      subtotal: oculto ? 0 : Number(q.subtotal),
      freightCost: oculto ? 0 : Number(q.freight_cost),
      freightDistance: q.freight_distance,
      tax: oculto ? 0 : Number(q.tax),
      total: oculto ? 0 : Number(q.total),
      createdAt: q.created_at ? q.created_at.toISOString() : null,
      state: estadoCotizacion({ status: q.status, validUntil: q.valid_until ?? null, acceptedAt: q.accepted_at ?? null }),
      validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
      daysToExpire: diasParaVencer(q.valid_until ?? null),
    };
  }

  async create(input: QuoteRequestInput, userId: number): Promise<QuoteDetail> {
    /**
     * Pedir cotización exige cuenta (2026-09-23). El correo de la solicitud es
     * SIEMPRE el de la cuenta: es con el que va a entrar a verla y aceptarla,
     * y a donde salen los avisos. El nombre y el teléfono los manda el
     * formulario, ya prellenados desde el perfil; si el nombre viniera vacío,
     * se usa el de la cuenta.
     */
    const cuenta = await datosDeCuenta(userId);
    if (!cuenta) throw new NotFoundException('La cuenta ya no existe');
    const customer = {
      ...input.customer,
      name: input.customer.name?.trim() || cuenta.name,
      email: cuenta.email,
    };

    // Una cotización necesita equipos O una categoría de servicio. Lo segundo
    // es para transporte, triturados, materiales y asfalto: ahí no hay SKU que elegir — lo que
    // define el precio es volumen, origen, destino y fechas, y eso viene en el
    // texto de la solicitud. Todo lo de abajo ya tolera `items` vacío: los
    // totales dan cero y `cart_data` sale como un objeto vacío.
    if (input.items.length === 0 && !input.service) {
      throw new BadRequestException('La solicitud no tiene productos');
    }

    // La fecha de inicio o entrega no puede ser pasada (2026-10-05): antes se
    // aceptaba y la solicitud llegaba vencida al panel. Se compara contra el
    // día de hoy en Monterrey, no en UTC (a las 19:00 de aquí UTC ya es mañana).
    const fecha = (input.requirements as Record<string, unknown> | null | undefined)?.fecha_inicio;
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
      if (fecha < hoy) throw new BadRequestException('La fecha ya pasó. Elige hoy o una fecha posterior.');
    }

    const ids = input.items.map((i) => i.productId);
    const products = await prisma.products.findMany({
      where: { id: { in: ids }, status: 1 },
      select: { id: true, name: true, cprice: true, photo: true, is_rental: true, rental_freight: true, stock: true, price_unit: true, provider_id: true, tipo_id: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // La ficha del tipo: el producto mismo si es ficha, o el tipo del equipo del aliado.
    const fichaDe = (p: (typeof products)[number]) => (p.provider_id === null ? p.id : p.tipo_id ?? null);
    // Si la línea pregunta su propia cantidad (3 viajes, 2000 piezas) y se pidió
    // un solo producto, esa es la que se cobra, igual que en el documento.
    const pedida = input.items.length === 1
      ? cantidadDelFormulario(input.serviceCategory, input.requirements as Record<string, unknown> | undefined)
      : null;

    const base = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new BadRequestException(`Producto ${i.productId} no disponible`);
      const qty = Math.max(1, Math.min(999, Math.floor(i.qty)));
      // La unidad del precio manda. Sin ella, la renta vieja era mensual.
      const unit = p.price_unit ?? (p.is_rental ? 'mes' : null);
      // Las toneladas y los metros cubicos SI son fraccionarios: redondear a
      // entero convertiria 12.5 toneladas en 12 y la cotizacion saldria corta.
      const fraccionable = unit === 'tonelada' || unit === 'm3' || unit === 'hora';
      const bruto = i.days ?? 1;
      const days = p.is_rental
        ? Math.max(fraccionable ? 0.01 : 1, Math.min(365, fraccionable ? Math.round(bruto * 100) / 100 : Math.floor(bruto)))
        : 1;
      // Lo que se cobra: en renta, equipos × días; si no, lo que pidió en el formulario o las piezas.
      const cantidad = !p.is_rental && pedida ? pedida : qty;
      return { p, qty, unit, days, cantidad };
    });

    /**
     * PRECIO ESTIMADO (2026-10-23, ver estimado-formulario.ts): si la ficha del
     * tipo tiene renglón en un tabulador, sale del mismo motor que los
     * cotizadores; si no, del precio de la ficha. El cliente no lo ve (la
     * solicitud está pendiente): es lo que el panel revisa antes de mandárselo.
     */
    const estimados = await estimarDelTabulador(
      base.map((b) => ({ productId: b.p.id, fichaId: fichaDe(b.p), cantidad: b.cantidad, tiempo: b.days, unidad: b.unit })),
    );

    // Distancia para flete (solo si dieron dirección; degrada a null sin API key).
    // Y solo si algún equipo la cobra (2026-10-05): sin eso el cliente esperaba
    // 4-5 s a dos geocodificaciones cuyo resultado no se usaba —en una
    // solicitud de servicio (pipas, triturados) el flete siempre sale en cero.
    // Lo estimado con el tabulador ya trae su flete.
    const cobraFlete = base.some(({ p }) => !estimados.has(p.id) && p.is_rental && Number(p.rental_freight ?? 0) > 0);
    const dist = input.address && cobraFlete ? await this.freight.distanceTo(input.address) : null;
    const distanceKm = dist?.km ?? 0;

    const lineas = base.map(({ p, qty, unit, days, cantidad }) => {
      const comun = { productId: p.id, name: p.name, qty, days, unit, isRental: p.is_rental, image: imageUrl(p.photo) };
      const est = estimados.get(p.id);
      if (est) {
        return {
          item: { ...comun, price: est.precioUnitario, freight: r2(est.flete / qty), lineTotal: r2(est.subtotal + est.flete) } as QuoteItem,
          sub: est.subtotal, fle: est.flete, iva: est.iva, cantidad,
          fuente: 'tabulador' as const, fichaId: fichaDe(p), renglon: est.renglon,
        };
      }
      // Fórmula legacy: renta → cprice×días + flete (tarifa base × km, o base sin distancia)
      const baseFreight = p.rental_freight ? Number(p.rental_freight) : 0;
      const freightUnit = p.is_rental ? (distanceKm > 0 ? baseFreight * distanceKm : baseFreight) : 0;
      const sub = p.is_rental ? p.cprice * days * qty : p.cprice * cantidad;
      const fle = freightUnit * qty;
      return {
        item: { ...comun, price: p.cprice, freight: r2(freightUnit), lineTotal: r2(sub + fle) } as QuoteItem,
        sub, fle, iva: 0, cantidad,
        // Sin precio en ningún lado: la ficha del tipo es a donde hay que ir a ponérselo.
        fuente: p.cprice > 0 ? ('ficha' as const) : null, fichaId: p.cprice > 0 ? p.id : fichaDe(p), renglon: null,
      };
    });
    const items: QuoteItem[] = lineas.map((l) => l.item);

    const subtotal = r2(lineas.reduce((s, l) => s + l.sub, 0));
    const freightCost = r2(lineas.reduce((s, l) => s + l.fle, 0));
    const tax = r2(lineas.reduce((s, l) => s + l.iva, 0));
    const total = r2(subtotal + freightCost + tax);

    // cart_data en el formato keyed-map del legacy (el admin viejo lo puede leer)
    const cartData: Record<string, unknown> = {};
    for (const l of lineas) {
      const it = l.item;
      cartData[String(it.productId)] = {
        qty: it.qty,
        days: it.days,
        // Sin guardarla, al releer la cotizacion se perderia y volveria a
        // decir "dias" para lo que se cotizo por viaje o por tonelada.
        unit: it.unit,
        price: it.lineTotal,
        item: { id: it.productId, name: it.name, cprice: it.price, photo: it.image },
        // De dónde salió el precio (2026-10-23), para el desglose del panel:
        // 'tabulador' (el renglón `renglon` del cotizador), 'ficha' (su precio)
        // o null (falta tarifa). `fichaId`: la ficha donde se corrige.
        // `cantidad`: lo que se cobró (viajes o piezas del formulario, si las dijo).
        cantidad: l.cantidad,
        fuente: l.fuente,
        fichaId: l.fichaId,
        renglon: l.renglon,
        // Los importes de la partida por separado: el lápiz del desglose
        // cambia el precio y vuelve a sumar sin adivinar qué era flete o IVA.
        subtotal: r2(l.sub),
        flete: r2(l.fle),
        iva: r2(l.iva),
        // La maquinaria del tabulador va por hora (2026-10-29): el desglose lo dice y la corrige en esa unidad.
        ...(l.renglon?.clase === 'equipo' ? { porHora: true } : {}),
      };
    }

    const q = await prisma.quotes.create({
      data: {
        user_id: userId ?? null,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        company_name: customer.company ?? null,
        region: customer.region ?? null,
        industry: customer.industry ?? null,
        // Sin equipos, lo que el admin necesita ver en el listado es qué
        // servicio se pidió; si no, la fila sale en blanco.
        product_interested: (items.length ? items.map((i) => i.name).join(', ') : (input.service ?? '')).slice(0, 250),
        acquisition_option: input.acquisitionOption ?? null,
        comments: input.comments ?? null,
        service_category: input.serviceCategory ?? null,
        requirements: (soloRespuestasDelCliente(input.requirements) as never) ?? undefined,
        address: input.address ?? null,
        cart_data: JSON.stringify(cartData),
        subtotal,
        freight_cost: freightCost,
        freight_distance: dist ? String(dist.km) : null,
        tax,
        total,
        status: 'pending',
        quote_number: newQuoteNumber(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    /**
     * A que cliente y obra pertenece. Va DESPUES de crearla y nunca lanza: el
     * respaldo ya se agrupo una vez, pero si las solicitudes nuevas siguen
     * entrando sueltas, en tres meses el modulo de clientes vuelve a estar
     * vacio y hay que reagrupar a mano.
     */
    const ligada = await resolverClienteYObra({
      companyName: customer.company,
      contactName: customer.name,
      email: customer.email,
      phone: customer.phone,
      industry: customer.industry,
      address: input.address,
      region: customer.region,
      userId,
      siteId: input.siteId ?? null,
      clientId: input.clientId ?? null,
      siteName: input.siteName ?? null,
    });
    if (ligada.clientId) {
      await prisma.quotes.update({
        where: { id: q.id },
        data: { client_id: ligada.clientId, site_id: ligada.siteId },
      });
    }

    // El registro no pide teléfono: la primera solicitud es donde se conoce,
    // y se guarda en la cuenta para no volver a preguntarlo.
    void completarTelefono(userId, customer.phone);

    // Campana del panel: una cotización "a la medida" espera respuesta.
    void avisarPanel({
      modulo: 'cotizaciones',
      evento: 'cotizacion',
      titulo: `Cotización a la medida ${q.quote_number} de ${customer.name}`,
      cuerpo: `${q.product_interested || 'Sin equipo elegido'}${customer.company ? ` · ${customer.company}` : ''}`,
      link: '/cotizaciones',
    });

    // Y al cliente, en su campana (2026-10-05): antes no recibía nada y no
    // sabía si la solicitud había llegado. El enlace abre su detalle.
    void this.notifications.push({
      userId,
      type: 'quote_answered',
      title: `Recibimos tu solicitud ${q.quote_number}`,
      body: 'Un asesor de MAQSER24 la revisa y te enviamos la cotización con precio y vigencia.',
      link: `/cuenta/cotizaciones/${q.quote_number}`,
    });

    // Y por correo, a los dos (2026-10-21). Sin esperar: el SMTP tarda y la
    // solicitud ya está guardada.
    void this.avisarSolicitudPorCorreo(q, customer);

    return {
      ...this.toSummary(q),
      // Recién creada está pendiente: el estimado no viaja al navegador (2026-10-23).
      items: items.map((i) => ({ ...i, price: 0, freight: 0, lineTotal: 0 })),
      customer: {
        name: q.name,
        email: q.email,
        phone: q.phone,
        company: q.company_name,
        region: q.region,
        industry: q.industry,
      },
      address: q.address,
      comments: q.comments,
      conditions: q.conditions,
      state: estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
      daysToExpire: diasParaVencer(q.valid_until),
      included: q.included,
      excluded: q.excluded,
      respondedBy: q.responded_by,
      acceptedAt: q.accepted_at ? q.accepted_at.toISOString() : null,
      canAccept: sePuedeAceptar({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      documentFolio: folioDocumento(q.requirements),
      siblings: [],
      // Recién creada no hay servicio que seguir: falta que la respondan y
      // que el cliente la acepte.
      service: null,
    };
  }

  /**
   * El cliente acepta la cotizacion.
   *
   * Se comprueba la vigencia AQUI y no solo en la pantalla: el boton se puede
   * dejar abierto en una pestana y darle dias despues, cuando el precio ya no
   * se sostiene. Aceptar una vencida seria comprometer una cifra que nadie
   * respalda, que es justo la diferencia comercial que el documento pide evitar.
   */
  async accept(userId: number, quoteNumber: string): Promise<QuoteDetail> {
    const q = await prisma.quotes.findFirst({ where: { quote_number: quoteNumber, user_id: userId } });
    if (!q) throw new NotFoundException('Cotizacion no encontrada');

    if (q.accepted_at) return this.byNumber(userId, quoteNumber); // ya aceptada: no se duplica
    const estado = estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at });
    if (estado === 'pendiente') throw new BadRequestException('Esta cotizacion todavia no tiene respuesta');
    if (estado === 'vencida') throw new BadRequestException('Esta cotizacion ya vencio. Pide una actualizacion.');
    if (estado === 'rechazada') throw new BadRequestException('Esta cotizacion fue descartada');

    const ahora = new Date();
    const req = (q.requirements ?? {}) as { quoterId?: unknown; origen?: unknown; folio?: unknown };

    /**
     * Las demás partes del MISMO documento (2026-10-15). El cotizador del sitio
     * parte una cotización por línea (la excavadora por un lado, la pipa por
     * otro); el cliente aceptó UN documento, así que se aceptan juntas las que
     * ya tienen precio y siguen vigentes.
     */
    const hermanas = typeof req.folio === 'string' && req.folio
      ? (await prisma.quotes.findMany({
          where: { user_id: userId, id: { not: q.id }, accepted_at: null, requirements: { path: '$.folio', equals: req.folio } },
        })).filter((h) => estadoCotizacion({ status: h.status, validUntil: h.valid_until, acceptedAt: h.accepted_at }) === 'vigente')
      : [];
    const aceptadas = [q, ...hermanas];

    for (const a of aceptadas) {
      await prisma.quotes.update({
        where: { id: a.id },
        data: {
          accepted_at: ahora,
          updated_at: ahora,
          // Aceptar es lo que mete la operación al tablero. Antes el rastro
          // terminaba aquí: lo que pasaba después vivía en llamadas.
          service_state: estadoInicial(),
        },
      });
      await prisma.service_events.create({
        data: { quote_id: a.id, to_state: estadoInicial(), note: 'El cliente aceptó la cotización' },
      });
      // Ya venía apartado desde la autorización; esto lo ata al servicio para
      // que de aquí en adelante siga sus etapas.
      await sincronizarReserva(Number(a.id));
    }

    // Su documento pasa a "Aceptada" en el historial del cotizador.
    if (typeof req.quoterId === 'number' && req.origen !== 'maquina') {
      await prisma.quoter_quotes.updateMany({
        where: { id: req.quoterId, state: { in: ['borrador', 'solicitada', 'enviada'] } },
        data: { state: 'aceptada', updated_at: ahora },
      });
    }

    /**
     * YA NO SE OFRECE SOLA (2026-10-23). Antes, al aceptar, salía de una vez a
     * los mejores aliados que llegan a la obra. Ahora MAQSER24 elige a quién se
     * la da —puede que con alguno ya no trabajen—: queda en Servicios › Por
     * asignar y suena la campana. Desde "Buscar aliado" se le ofrece a uno, a
     * varios o "Mandar a todos". El cliente no recibe nada hasta que un aliado
     * la toma: ese es el correo de "te atiende…".
     */
    void avisarPanel({
      modulo: 'servicios',
      evento: 'solicitud',
      titulo: `${q.company_name?.trim() || q.name} aceptó la cotización ${q.quote_number}: elige a quién dárselo`,
      cuerpo: `${aceptadas.length > 1 ? `Son ${aceptadas.length} servicios. ` : ''}Están en Servicios › Por asignar: ofrécelo a un aliado o mándalo a todos los que llegan a la obra.`,
      link: '/servicios',
    });
    return this.byNumber(userId, quoteNumber);
  }

  /**
   * Obras del cliente ligado a esta cuenta.
   *
   * Devuelve vacio —no error— cuando la cuenta no tiene cliente todavia: es el
   * caso de quien se acaba de registrar, y el cotizador simplemente pide la
   * direccion como siempre.
   */
  async sitesOfUser(userId: number) {
    // Una cuenta puede tener varias empresas, y cada una sus obras (2026-10-23).
    const empresas = await prisma.clients.findMany({
      where: { user_id: userId, status: 1 },
      orderBy: { id: 'asc' },
      select: {
        id: true, name: true,
        client_sites: {
          where: { status: 1 },
          orderBy: { name: 'asc' },
          select: {
            id: true, name: true, address: true, municipality: true,
            contact_name: true, contact_phone: true, requirements: true,
          },
        },
      },
    });
    const lista = empresas.map((c) => ({
      id: c.id,
      name: c.name,
      sites: c.client_sites.map((s) => ({
        id: s.id,
        clientId: c.id,
        clientName: c.name,
        name: s.name,
        address: s.address,
        municipality: s.municipality,
        contactName: s.contact_name,
        contactPhone: s.contact_phone,
        requirements: s.requirements,
      })),
    }));
    return {
      empresas: lista,
      // Lo de antes (una sola empresa): la primera, y todas las obras juntas.
      client: lista[0] ? { id: lista[0].id, name: lista[0].name } : null,
      sites: lista.flatMap((c) => c.sites),
    };
  }

  async listByUser(userId: number): Promise<QuoteSummary[]> {
    const rows = await prisma.quotes.findMany({
      where: { user_id: userId },
      orderBy: { id: 'desc' },
      take: 50,
    });
    // Propuestas a aliados de todas en UNA consulta: deciden enviada/en revisión/aprobada/rechazada.
    const asign = rows.length
      ? await prisma.service_assignments.findMany({ where: { quote_id: { in: rows.map((r) => r.id) } }, select: { quote_id: true, state: true } })
      : [];
    return rows.map((q) => this.toSummary(q, asign.filter((a) => a.quote_id === q.id)));
  }

  async byNumber(userId: number, quoteNumber: string): Promise<QuoteDetail> {
    const q = await prisma.quotes.findFirst({
      where: { quote_number: quoteNumber, user_id: userId },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    const asignaciones = await prisma.service_assignments.findMany({ where: { quote_id: q.id }, select: { state: true } });

    let items: QuoteItem[] = [];
    try {
      const cart = JSON.parse(q.cart_data) as Record<string, { qty: number; days?: number; unit?: string | null; price: number; item: { id: number; name: string; cprice: number; photo: string | null } }>;
      items = Object.values(cart).map((c) => ({
        productId: c.item.id,
        name: c.item.name,
        unit: c.unit ?? null,
        price: precioOculto(q) ? 0 : c.item.cprice,
        qty: c.qty,
        days: c.days ?? 1,
        isRental: (c.days ?? 1) > 1,
        freight: 0,
        lineTotal: precioOculto(q) ? 0 : c.price,
        image: c.item.photo,
      }));
    } catch {
      items = [];
    }

    return {
      ...this.toSummary(q, asignaciones),
      items,
      customer: {
        name: q.name,
        email: q.email,
        phone: q.phone,
        company: q.company_name,
        region: q.region,
        industry: q.industry,
      },
      address: q.address,
      comments: q.comments,
      // En preparación, lo de una respuesta anterior (vigencia, incluye, condiciones) ya no vale: no se enseña.
      conditions: precioOculto(q) ? null : q.conditions,
      state: estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      validUntil: !precioOculto(q) && q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
      daysToExpire: precioOculto(q) ? null : diasParaVencer(q.valid_until),
      included: precioOculto(q) ? null : q.included,
      excluded: precioOculto(q) ? null : q.excluded,
      respondedBy: precioOculto(q) ? null : q.responded_by,
      acceptedAt: q.accepted_at ? q.accepted_at.toISOString() : null,
      canAccept: sePuedeAceptar({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      documentFolio: precioOculto(q) ? null : folioDocumento(q.requirements),
      siblings: await this.hermanos(userId, q.id, folioDocumento(q.requirements)),
      service: await this.servicioDe(q),
      tracking: await this.rastreoDe(q),
    };
  }

  /**
   * Su obra en el mapa, y la unidad mientras va en camino (ver quotes/rastreo.ts).
   *
   * Desde que hay aliado hasta que la máquina está en la obra (2026-10-15):
   * antes de salir, el cliente ve dónde la espera; en traslado, por dónde va y
   * cuánto le falta. La ubicación del teléfono del aliado solo se enseña
   * durante el traslado, y su patio nunca.
   */
  private async rastreoDe(q: { id: bigint; service_state: string | null; address: string | null; region: string | null; requirements: unknown; site_id: number | null }) {
    const conMapa = ['asignado', 'en_traslado', 'en_sitio', 'en_curso'];
    if (!conMapa.includes(q.service_state ?? '')) return null;
    const enCamino = q.service_state === 'en_traslado';
    const [ultima, sitio, puntos] = await Promise.all([
      enCamino ? ultimaUbicacion(q.id) : null,
      q.site_id ? prisma.client_sites.findUnique({ where: { id: q.site_id }, select: { id: true, name: true, address: true, municipality: true, state: true, lat: true, lng: true } }) : null,
      enCamino
        ? prisma.service_locations.findMany({ where: { quote_id: q.id }, orderBy: { id: 'desc' }, take: 60, select: { lat: true, lng: true } })
        : [],
    ]);
    // La obra sin coordenadas se ubica con su dirección, una vez y sin esperar:
    // esta carga enseña el centro del municipio y las siguientes, la obra.
    if (sitio && (sitio.lat == null || sitio.lng == null)) void this.ubicarObra(sitio);
    const obra = obraDe({ ...q, client_sites: sitio });
    return {
      km: enCamino ? kmRestantes(ultima, obra) : null,
      updatedAt: ultima?.at ?? null,
      approximate: obra?.aproximada ?? true,
      site: obra ? { lat: obra.lat, lng: obra.lng, name: obra.nombre } : null,
      unit: ultima ? { lat: ultima.lat, lng: ultima.lng, at: ultima.at } : null,
      route: [...puntos].reverse().map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
      moving: enCamino,
    };
  }

  /** Obras que ya se intentaron ubicar en este proceso: Nominatim pide no repetir. */
  private readonly obrasIntentadas = new Set<number>();

  /**
   * UBICAR LA OBRA CON SU DIRECCIÓN (2026-10-15). "No sale la ubicación": las
   * obras que se crean solas desde una solicitud solo traen la dirección, y el
   * mapa caía al centro del municipio. Se geocodifica con el mismo servicio que
   * el cotizador de traslado y se guarda solo si quedó a nivel de calle o
   * colonia: un punto de municipio no es "la obra".
   */
  private async ubicarObra(s: { id: number; address: string | null; municipality: string | null; state: string | null }) {
    if (this.obrasIntentadas.has(s.id) || !s.address?.trim()) return;
    this.obrasIntentadas.add(s.id);
    try {
      // El municipio solo si es uno de verdad (hay obras guardadas con el estado).
      const municipio = s.municipality ? centroDeMunicipio(s.municipality)?.nombre ?? null : null;
      const consulta = [s.address, municipio, s.state || 'Nuevo León'].filter(Boolean).join(', ');
      const punto = await this.freight.geocode(consulta);
      if (!punto || punto.precision === 'municipio') return;
      await prisma.client_sites.update({ where: { id: s.id }, data: { lat: punto.lat, lng: punto.lon, updated_at: new Date() } });
    } catch {
      // Sin red o sin respuesta: el mapa sigue con el centro del municipio.
    }
  }

  /** Los otros servicios del mismo documento, con su estado para el cliente. */
  private async hermanos(userId: number, id: bigint, folio: string | null) {
    if (!folio) return [];
    const rows = await prisma.quotes.findMany({
      where: { user_id: userId, id: { not: id } },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, quote_number: true, product_interested: true, requirements: true, service_state: true },
    });
    const mios = rows.filter((r) => folioDocumento(r.requirements) === folio);
    if (!mios.length) return [];
    const asign = await prisma.service_assignments.findMany({ where: { quote_id: { in: mios.map((r) => r.id) } }, select: { quote_id: true, state: true } });
    return mios.map((r) => ({
      quoteNumber: r.quote_number,
      name: (r.product_interested ?? r.quote_number).split(' · ')[0],
      request: estadoSolicitud(r.service_state, asign.filter((a) => a.quote_id === r.id)),
    }));
  }

  /**
   * EL DOCUMENTO DE LA COTIZACIÓN (2026-09-25). Es el mismo documento de
   * siempre (folio, empresa, partidas, condiciones, firma) que se guarda en
   * `quoter_quotes` cuando la cotización nace del cotizador: por tipo o por
   * máquina. Solo lo ve su dueño.
   */
  async documento(userId: number, quoteNumber: string) {
    const q = await prisma.quotes.findFirst({
      where: { quote_number: quoteNumber, user_id: userId },
      select: { quote_number: true, requirements: true, status: true },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    // Precio en preparación: también aquí se enseña la solicitud, no el borrador.
    const folio = precioOculto(q) ? null : folioDocumento(q.requirements);
    // Sin documento del cotizador todavía (2026-10-15): la SOLICITUD, con el
    // mismo formato y sin importes, para que el cliente la vea e imprima.
    if (!folio) return this.solicitudComoDocumento(userId, quoteNumber);
    // El folio Y el id que ligó el servidor: un folio solo, escrito en la
    // solicitud de otra forma, no abre ningún documento.
    const quoterId = (q.requirements as { quoterId?: unknown } | null)?.quoterId;
    if (typeof quoterId !== 'number') return this.solicitudComoDocumento(userId, quoteNumber);
    const d = await prisma.quoter_quotes.findFirst({ where: { folio, id: quoterId } });
    if (!d) throw new NotFoundException('Documento no encontrado');
    return {
      folio: d.folio,
      tipo: d.kind,
      quoteNumber: q.quote_number,
      cliente: d.client_name,
      obra: d.work,
      atencion: d.attention,
      municipio: d.municipality,
      notas: d.notes,
      documento: d.snapshot,
    };
  }

  /**
   * LA SOLICITUD COMO DOCUMENTO (2026-10-15). "Aquí también debería ver el
   * documento, solo que sin costo." Mientras no tiene precio, el cliente ve lo
   * que pidió con el formato de siempre (empresa, folio, partidas, lo que
   * respondió) y la nota de que un asesor le enviará los precios.
   */
  private async solicitudComoDocumento(userId: number, quoteNumber: string) {
    const det = await this.byNumber(userId, quoteNumber);
    const q = await prisma.quotes.findFirst({
      where: { quote_number: quoteNumber, user_id: userId },
      select: { service_category: true, requirements: true, created_at: true, product_interested: true, client_sites: { select: { name: true, municipality: true } } },
    });
    const req = (q?.requirements ?? {}) as Record<string, unknown>;
    return documentoDeSolicitud({
      folio: quoteNumber,
      quoteNumber,
      categoria: q?.service_category ?? null,
      requirements: req,
      comments: det.comments,
      partidas: det.items.map((i) => ({ productId: i.productId, nombre: i.name, renta: i.isRental, qty: i.qty, days: i.days })),
      servicio: q?.product_interested ?? null,
      cliente: det.customer.company || det.customer.name,
      atencion: det.customer.company ? det.customer.name : null,
      obra: q?.client_sites?.name ?? det.address,
      municipio: q?.client_sites?.municipality ?? (typeof req.obra_ubicacion === 'string' ? req.obra_ubicacion : det.customer.region),
      emitida: q?.created_at ?? new Date(),
      saludo: 'Recibimos su solicitud con los siguientes datos. La estamos revisando y le enviaremos la cotización con precios y vigencia.',
    });
  }

  /**
   * LA SOLICITUD COMO DOCUMENTO, ANTES DE ENVIARLA (2026-10-19). "Al cotizar
   * desde el botón Cotizar de un servicio, en lugar de ese resumen debe
   * aparecer el resumen en el documento; ya después en el admin se agrega lo
   * demás." Es el MISMO documento que verá en Mis cotizaciones al enviarla
   * (`documentoDeSolicitud`), con "Vista previa" en lugar del folio. No guarda
   * nada.
   */
  async vistaPrevia(input: QuoteRequestInput, userId: number) {
    const cuenta = await datosDeCuenta(userId);
    if (!cuenta) throw new NotFoundException('La cuenta ya no existe');
    if (input.items.length === 0 && !input.service) throw new BadRequestException('La solicitud no tiene productos');

    const productos = input.items.length
      ? await prisma.products.findMany({
          where: { id: { in: input.items.map((i) => i.productId) }, status: 1 },
          select: { id: true, name: true, is_rental: true },
        })
      : [];
    const porId = new Map(productos.map((p) => [p.id, p]));
    // La obra solo si es de SU cliente: el id viene del navegador.
    const obra = input.siteId ? (await this.sitesOfUser(userId)).sites.find((s) => s.id === input.siteId) ?? null : null;
    const nombre = input.customer.name?.trim() || cuenta.name;
    const empresa = input.customer.company?.trim() || obra?.clientName || null;
    const req = input.requirements ?? {};
    // Obra nueva (2026-10-23): su municipio sale de la dirección que escribió.
    const municipioDeDireccion = (input.address ?? '').split(',').map((p) => p.trim()).filter(Boolean).reverse()
      .map((p) => centroDeMunicipio(p)?.nombre).find(Boolean) ?? null;

    return documentoDeSolicitud({
      folio: 'Vista previa',
      quoteNumber: null,
      categoria: input.serviceCategory ?? null,
      requirements: req,
      comments: input.comments ?? null,
      partidas: input.items.flatMap((i) => {
        const p = porId.get(i.productId);
        return p ? [{ productId: p.id, nombre: p.name, renta: p.is_rental, qty: i.qty, days: i.days ?? 1 }] : [];
      }),
      servicio: input.service ?? null,
      cliente: empresa || nombre,
      atencion: empresa ? nombre : null,
      // Con obra nueva, el nombre que le puso (antes salía la dirección como obra).
      obra: obra?.name ?? (input.siteName?.trim() || input.address) ?? null,
      municipio: obra?.municipality ?? municipioDeDireccion ?? (req.obra_ubicacion?.trim() || input.customer.region || null),
      emitida: new Date(),
      saludo: 'Esta es la solicitud que nos va a enviar. La revisaremos y le enviaremos la cotización con precios y vigencia.',
    });
  }

  /**
   * En qué va el servicio, contado para el cliente.
   *
   * Se muestran SOLO los aliados que aceptaron. A quién más se le ofreció y
   * quién dijo que no es información de operaciones: al cliente le importa
   * quién lo va a atender, y enseñarle los rechazos lo haría dudar de una
   * decisión que ya se resolvió.
   */
  private async servicioDe(q: {
    id: bigint; service_state: string | null; service_unit: string | null; requirements: unknown;
    service_quantity: unknown; service_started_at: Date | null; service_closed_at: Date | null;
  }): Promise<QuoteDetail['service']> {
    if (!esEstado(q.service_state)) return null;
    const estado = q.service_state;

    const [asignaciones, eventos] = await Promise.all([
      prisma.service_assignments.findMany({
        where: { quote_id: q.id, state: 'aceptado' },
        include: { providers: { select: { name: true } } },
        orderBy: { id: 'asc' },
      }),
      prisma.service_events.findMany({
        where: { quote_id: q.id },
        orderBy: { id: 'asc' },
        select: { to_state: true, created_at: true },
      }),
    ]);

    const cantidad = q.service_quantity ? Number(q.service_quantity) : null;

    return {
      state: estado,
      label: PASOS[estado].label,
      message: PASOS[estado].cliente,
      progress: avance(estado),
      providers: asignaciones.map((a) => a.providers.name),
      arrival: asignaciones.find((a) => a.committed_at)?.committed_at?.toISOString() ?? null,
      operator: operadorDe(q.requirements)?.nombre ?? null,
      startedAt: q.service_started_at ? q.service_started_at.toISOString() : null,
      closedAt: q.service_closed_at ? q.service_closed_at.toISOString() : null,
      closed: cantidad ? formatearCantidad(cantidad, q.service_unit) : null,
      // Solo los pasos del servicio: las respuestas de los aliados
      // (`propuesto`, `rechazado`) son de operaciones, no del cliente.
      history: eventos
        .filter((e) => esEstado(e.to_state))
        .map((e) => ({
          label: PASOS[e.to_state as EstadoServicio].label,
          note: null,
          at: e.created_at ? e.created_at.toISOString() : null,
        })),
    };
  }
}
