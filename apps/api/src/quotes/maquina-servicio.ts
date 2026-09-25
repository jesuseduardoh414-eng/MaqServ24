import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { UNIDADES, type BloqueCondiciones, type CalculoCotizacion, type CatalogoCotizador, type CotizadorTipo, type RenglonCotizacion } from '@maqserv/config';
import { QuoterService } from '../quoter/quoter.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { correoAcuseSolicitud, correoSolicitudInterna } from '../notifications/email-templates';
import { ServiceService } from './service.service';
import { newQuoteNumber } from './quotes.service';
import { estadoInicial } from './service-flow';
import { VIGENCIA_DEFAULT_DIAS } from './quote-validity';
import { resolverClienteYObra } from './client-resolver';
import { reservar } from './reservas';
import { textoPedido, type EntradaRecomendacion, type MaquinaRecomendada } from './recomendador.service';
import type { DatosCuenta } from '../common/cuenta';

/**
 * DE LA(S) MÁQUINA(S) ELEGIDA(S) AL SERVICIO (2026-09-25).
 *
 * El cliente ya vio las máquinas, el precio y el flete. Esto emite UN
 * documento (la cotización de siempre: folio, empresa, partidas, condiciones,
 * firma) y abre UN SERVICIO POR MÁQUINA: cada uno con su precio congelado,
 * apartado en sus fechas y ofrecido al dueño de esa máquina. Una cotización
 * con excavadora y pipa son dos trabajos de dos aliados; el papel es uno.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** De qué tabulador salen empresa, firma y condiciones del documento de esa línea. */
export function tipoDocumentoDe(linea: string): CotizadorTipo {
  return linea === 'triturados' ? 'triturados' : 'maquinaria';
}

/** Una máquina elegida con lo que el cliente pidió de ella. */
export interface PartidaMaquina {
  entrada: EntradaRecomendacion;
  maquina: MaquinaRecomendada;
  lineaNombre: string;
  /** Último día que ocupa (para la reserva). */
  fin: string;
}

export interface SolicitudAbierta {
  /** Folio del documento (uno para todas las máquinas), si se pudo emitir. */
  folio: string | null;
  documentUrl: string | null;
  total: number;
  solicitudes: Array<{ quoteId: number; quoteNumber: string; url: string; name: string }>;
  /** La primera, para quien solo espera una. */
  quoteId: number;
  quoteNumber: string;
  url: string;
}

@Injectable()
export class MaquinaServicio {
  private readonly log = new Logger('MaquinaServicio');

  constructor(
    private readonly services: ServiceService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
    private readonly quoter: QuoterService,
  ) {}

  async abrir(d: {
    partidas: PartidaMaquina[];
    zona: string | null;
    cuenta: DatosCuenta;
    userId: number;
    cliente: string;
    telefono: string | null;
    notas: string | null;
  }): Promise<SolicitudAbierta> {
    if (d.partidas.length === 0) throw new BadRequestException('Elige al menos una máquina.');
    for (const p of d.partidas) {
      const m = p.maquina;
      if (m.total === null || m.subtotal === null || m.precioUnitario === null) {
        throw new BadRequestException(`${m.name} no tiene precio para esa unidad. Pídela a la medida y te cotizamos.`);
      }
    }
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + VIGENCIA_DEFAULT_DIAS * 86400000);
    const primera = d.partidas[0].entrada;
    const direccion = [primera.obra.direccion, primera.obra.municipio].filter((x) => x && x.trim()).join(', ') || d.zona;
    const cliente = d.cliente || d.cuenta.name;

    /**
     * EL DOCUMENTO DE SIEMPRE, uno para toda la solicitud. Si falla, las
     * solicitudes siguen: el documento es un papel, no la operación.
     */
    const doc = await this.armarDocumento(d.partidas);
    let folio: string | null = null;
    let quoterId: number | null = null;
    try {
      const emitido = await this.quoter.documentoDeMaquina({
        tipo: doc.tipo,
        calc: doc.calc,
        cliente,
        obra: primera.obra.direccion ?? null,
        municipio: primera.obra.municipio ?? d.zona,
        correo: d.cuenta.email,
        telefono: d.telefono,
        notas: d.notas,
        items: d.partidas.map((p) => ({
          productoId: p.maquina.id, fecha: p.entrada.fecha, hora: p.entrada.hora ?? null,
          unidad: p.maquina.unidad, unidades: p.maquina.unidadesCobradas, equipos: p.maquina.equipos,
        })),
        userId: d.userId,
      });
      folio = emitido.folio;
      quoterId = emitido.id;
    } catch (err) {
      this.log.warn(`No se pudo emitir el documento de la solicitud: ${(err as Error).message}`);
    }

    const solicitudes: SolicitudAbierta['solicitudes'] = [];
    const conceptos: string[] = [];
    for (const p of d.partidas) {
      const { entrada: e, maquina: m } = p;
      const u = UNIDADES[m.unidad];
      const pedido = textoPedido(m.unidad, m.unidadesCobradas);
      conceptos.push(`${m.name} · ${pedido} · ${e.fecha}${e.hora ? ` ${e.hora}` : ''}`);
      const incluye = [
        `${m.name}${m.brand ? ` (${m.brand})` : ''} · ${pedido}${m.equipos > 1 ? ` × ${m.equipos} unidades` : ''} × ${dinero(m.precioUnitario!)}/${u?.singular ?? m.unidad} = ${dinero(m.subtotal!)}`,
        m.flete ? `Traslado desde el patio del aliado${m.km !== null ? ` (${m.km} km)` : ''} = ${dinero(m.flete)}` : `Traslado: ${m.fleteTexto}`,
        ...(m.notaMinimo ? [m.notaMinimo] : []),
        // Lo que define quien la ofrece (operador, combustible, capacidad…) va en lo que incluye.
        ...(m.specs.length ? [`Ficha: ${m.specs.map((s) => `${s.label}: ${s.valor}`).join(' · ')}`] : []),
      ].join('\n');
      const condiciones = [
        'Precio y traslado congelados al solicitar; vigencia de la cotización según su fecha de vencimiento.',
        'La máquina queda apartada para las fechas indicadas en cuanto el aliado acepta.',
        'Cualquier cambio de fechas, horario o lugar puede modificar el traslado.',
      ].map((x) => `- ${x}`).join('\n');
      const requisitos = Object.fromEntries(
        Object.entries(e.requisitos ?? {}).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 500)]),
      );

      const q = await prisma.quotes.create({
        data: {
          user_id: d.userId,
          name: cliente,
          email: d.cuenta.email,
          phone: d.telefono || d.cuenta.phone || '',
          region: e.obra.municipio?.trim() || d.zona,
          address: direccion,
          product_interested: `${m.name} · ${p.lineaNombre}`.slice(0, 250),
          acquisition_option: m.renta ? 'renta' : 'compra',
          comments: [
            `Solicitud de máquina desde el catálogo: ${m.name}.`,
            `Para el ${e.fecha}${e.hora ? ` a las ${e.hora}` : ''}, ${pedido}${m.equipos > 1 ? ` (${m.equipos} unidades)` : ''}.`,
            d.partidas.length > 1 ? `Parte de una cotización con ${d.partidas.length} servicios${folio ? ` (${folio})` : ''}.` : '',
            d.notas ? `Notas del cliente: ${d.notas}` : '',
          ].filter(Boolean).join('\n'),
          cart_data: '{}',
          subtotal: new Prisma.Decimal(r2(m.subtotal!)),
          freight_cost: new Prisma.Decimal(r2(m.flete ?? 0)),
          tax: new Prisma.Decimal(r2(m.iva)),
          total: new Prisma.Decimal(r2(m.total!)),
          status: 'completed',
          responded_at: ahora,
          responded_by: 'Cotizador de máquinas',
          valid_until: vence,
          included: incluye,
          conditions: condiciones,
          accepted_at: ahora,
          service_state: estadoInicial(),
          service_category: e.linea,
          requirements: {
            origen: 'maquina',
            productId: m.id,
            // El documento imprimible: es lo que abre "Ver documento" en Mi cuenta.
            ...(folio ? { folio, quoterId, cotizador: doc.tipo } : {}),
            fecha_inicio: e.fecha,
            fecha_fin: p.fin,
            ...(e.hora ? { hora: e.hora } : {}),
            unidad: m.unidad,
            unidades: m.unidadesCobradas,
            equipos: m.equipos,
            ...(direccion ? { obra_ubicacion: direccion } : {}),
            ...requisitos,
          } as Prisma.InputJsonValue,
          quote_number: newQuoteNumber(),
          created_at: ahora,
          updated_at: ahora,
        },
      });
      const quoteId = Number(q.id);

      await prisma.service_events.create({
        data: {
          quote_id: q.id,
          to_state: estadoInicial(),
          note: `El cliente eligió ${m.name} en el catálogo para el ${e.fecha}${e.hora ? ` ${e.hora}` : ''} (${pedido}) por ${dinero(m.total!)}`,
          created_at: ahora,
        },
      });

      // A qué cliente y obra pertenece. Nunca lanza.
      const ligada = await resolverClienteYObra({
        contactName: cliente,
        email: d.cuenta.email,
        phone: d.telefono,
        address: direccion,
        region: e.obra.municipio ?? d.zona,
        userId: d.userId,
        siteId: e.obra.siteId ?? null,
      });
      if (ligada.clientId) {
        await prisma.quotes.update({ where: { id: q.id }, data: { client_id: ligada.clientId, site_id: ligada.siteId } });
      }

      // Apartar la máquina y ofrecérsela a su dueño.
      try {
        await reservar({ productId: m.id, folio: q.quote_number, desde: e.fecha, hasta: p.fin });
      } catch (err) {
        this.log.warn(`No se pudo apartar la máquina ${m.id} para ${q.quote_number}: ${(err as Error).message}`);
      }
      try {
        await this.services.ofrecer(quoteId, m.providerId, {
          scope: `${m.name} · ${pedido} · ${e.fecha}${e.hora ? ` ${e.hora}` : ''}`,
          adminId: null,
          total: m.total,
        });
      } catch (err) {
        this.log.error(`No se pudo ofrecer ${q.quote_number} al aliado ${m.providerId}: ${(err as Error).message}`);
      }

      solicitudes.push({ quoteId, quoteNumber: q.quote_number, url: `/cuenta/cotizaciones/${q.quote_number}`, name: m.name });
    }

    const principal = solicitudes[0];
    const total = r2(d.partidas.reduce((s, p) => s + (p.maquina.total ?? 0), 0));
    const documentUrl = folio ? `${principal.url}/documento` : null;
    await this.notifications.push({
      userId: d.userId,
      type: 'service_status',
      title: folio ? `Recibimos tu cotización ${folio}` : `Recibimos tu solicitud ${principal.quoteNumber}`,
      body: solicitudes.length > 1
        ? `${solicitudes.length} servicios: ${solicitudes.map((s) => s.name).join(', ')}. Estamos confirmando con los aliados; te avisamos en cuanto acepten.`
        : `${principal.name} para el ${primera.fecha}. Estamos confirmando con el aliado; en cuanto acepte te avisamos.`,
      link: documentUrl ?? principal.url,
    });
    void this.avisar({
      folio: folio ?? principal.quoteNumber, total, conceptos, aliados: [...new Set(d.partidas.map((p) => p.maquina.providerName))],
      cliente, correo: d.cuenta.email, telefono: d.telefono, zona: d.zona, obra: primera.obra.direccion ?? null,
      url: documentUrl ?? principal.url, quoteId: principal.quoteId,
    });

    return { folio, documentUrl, total, solicitudes, quoteId: principal.quoteId, quoteNumber: principal.quoteNumber, url: principal.url };
  }

  /**
   * El documento de una o varias máquinas: una partida por máquina (más su
   * traslado), y las condiciones del tabulador de su línea, sin repetir. Lo
   * usan la vista previa (antes de solicitar) y el documento emitido.
   */
  async armarDocumento(partidas: PartidaMaquina[]): Promise<{
    tipo: CotizadorTipo;
    calc: CalculoCotizacion;
    empresa: CatalogoCotizador['empresa'];
    firma: CatalogoCotizador['firma'];
    saludo: string;
  }> {
    const tipo = tipoDocumentoDe(partidas[0].entrada.linea);
    const catalogos = new Map<CotizadorTipo, CatalogoCotizador>();
    const catalogoDe = async (t: CotizadorTipo) => {
      const c = catalogos.get(t) ?? (await this.quoter.catalogo(t));
      catalogos.set(t, c);
      return c;
    };
    const renglones: RenglonCotizacion[] = [];
    const condiciones: BloqueCondiciones[] = [];
    const titulos = new Set<string>();
    const desglose = { renta: 0, servicios: 0, fletes: 0, materiales: 0 };
    let subtotal = 0;
    let iva = 0;
    let total = 0;
    for (const { entrada: e, maquina: m } of partidas) {
      const u = UNIDADES[m.unidad];
      const flete = r2(m.flete ?? 0);
      const importe = r2(m.subtotal ?? 0);
      renglones.push({
        clase: m.renta ? 'equipo' : 'servicio',
        id: String(m.id),
        nombre: m.name,
        concepto: `${m.name}${m.brand ? ` (${m.brand})` : ''}${m.equipos > 1 ? ` × ${m.equipos}` : ''}`,
        unidad: u?.singular ?? m.unidad,
        cantidad: m.unidadesCobradas * m.equipos,
        pu: m.precioUnitario ?? 0,
        importe,
        detalle: `A partir del ${e.fecha}${e.hora ? ` ${e.hora}` : ''}`,
      });
      if (flete > 0) {
        renglones.push({ clase: 'flete', concepto: `Traslado de ${m.name} a obra${m.km !== null ? ` (${m.km} km)` : ''}`, unidad: 'viaje', cantidad: 1, pu: flete, importe: flete });
      }
      if (m.renta) desglose.renta = r2(desglose.renta + importe); else desglose.servicios = r2(desglose.servicios + importe);
      desglose.fletes = r2(desglose.fletes + flete);
      subtotal = r2(subtotal + importe + flete);
      iva = r2(iva + m.iva);
      total = r2(total + (m.total ?? importe + flete + m.iva));

      // Condiciones de su línea (pipa/retiro solo si el servicio es de transporte), sin repetir bloques.
      const cat = await catalogoDe(tipoDocumentoDe(e.linea));
      const esTransporte = e.linea === 'transporte-y-servicios-de-obra';
      for (const [k, b] of Object.entries(cat.condiciones)) {
        if (!esTransporte && ['pipa', 'retiro'].includes(k)) continue;
        if (titulos.has(b.titulo)) continue;
        titulos.add(b.titulo);
        condiciones.push(b);
      }
    }
    const cat = await catalogoDe(tipo);
    const calc: CalculoCotizacion = {
      renglones,
      desglose,
      subtotal,
      iva,
      iva_tasa: subtotal > 0 && iva > 0 ? Math.round((iva / subtotal) * 100) : 0,
      con_iva: iva > 0,
      total,
      condiciones,
    };
    return { tipo, calc, empresa: cat.empresa, firma: cat.firma, saludo: cat.saludo };
  }

  /**
   * VISTA PREVIA (2026-09-25): el cliente ve la cotización tal como se
   * imprime ANTES de solicitar, igual que en el cotizador original. Sin folio
   * todavía: se asigna al solicitar.
   */
  async vistaPrevia(d: { partidas: PartidaMaquina[]; cliente: string; zona: string | null; notas: string | null }) {
    const doc = await this.armarDocumento(d.partidas);
    const primera = d.partidas[0].entrada;
    return {
      titulo: 'Cotización de servicio',
      folio: 'Vista previa',
      fecha: new Date().toISOString(),
      cliente: d.cliente,
      obra: primera.obra.direccion ?? '',
      atencion: '',
      municipio: primera.obra.municipio ?? d.zona ?? '',
      notas: d.notas ?? '',
      empresa: doc.empresa,
      firma: doc.firma,
      saludo: doc.saludo,
      calc: doc.calc,
      mostrarPrecios: true,
    };
  }

  /** Correos: al equipo (entró una solicitud) y al cliente (acuse). Nunca lanza. */
  private async avisar(d: {
    folio: string;
    total: number;
    conceptos: string[];
    aliados: string[];
    cliente: string;
    correo: string;
    telefono: string | null;
    zona: string | null;
    obra: string | null;
    url: string;
    quoteId: number;
  }): Promise<void> {
    try {
      const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
      if (interno) {
        const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
        await this.mailer.enviar({
          kind: 'quoter_request_internal',
          to: interno,
          quoteId: d.quoteId,
          ...correoSolicitudInterna({
            folio: d.folio,
            cotizador: 'máquinas del catálogo',
            cliente: d.cliente,
            correo: d.correo,
            telefono: d.telefono,
            municipio: d.zona,
            obra: d.obra,
            total: d.total,
            conceptos: d.conceptos,
            proveedoresAvisados: d.aliados,
            url: `${panel}/servicios`,
          }),
        });
      }
      const sitio = (process.env.SITE_URL ?? 'https://maqserv24.com').replace(/\/+$/, '');
      await this.mailer.enviar({
        kind: 'quoter_request_ack',
        to: d.correo,
        toName: d.cliente,
        quoteId: d.quoteId,
        ...correoAcuseSolicitud({
          nombre: d.cliente,
          folio: d.folio,
          cotizador: 'máquinas',
          total: d.total,
          // El cliente no ve al aliado: MAQSER24 confirma con él.
          proveedores: [],
          url: `${sitio}${d.url}`,
        }),
      });
    } catch (err) {
      this.log.error(`Avisos de ${d.folio}: ${(err as Error).message}`);
    }
  }
}
