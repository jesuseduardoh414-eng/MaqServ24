import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { UNIDADES, type CalculoCotizacion, type CotizadorTipo } from '@maqserv/config';
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
 * DE LA MÁQUINA ELEGIDA AL SERVICIO (2026-09-25).
 *
 * El cliente ya vio la máquina, el precio y el flete. Esto crea la cotización
 * YA RESPONDIDA Y ACEPTADA (precio congelado, vigencia, incluye), abre el
 * servicio en "por asignar", aparta la máquina esas fechas y se la OFRECE al
 * dueño, que acepta o rechaza en su portal. Es el mismo destino que la
 * solicitud del cotizador por tipo (`QuoterServicio`), con una diferencia
 * que lo cambia todo: aquí SIEMPRE se sabe a quién.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ServicioDeMaquina {
  quoteId: number;
  quoteNumber: string;
  url: string;
  total: number;
  /** El documento imprimible (folio del cotizador), si se pudo emitir. */
  documentUrl: string | null;
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
    entrada: EntradaRecomendacion;
    maquina: MaquinaRecomendada;
    lineaNombre: string;
    fin: string;
    zona: string | null;
    cuenta: DatosCuenta;
    userId: number;
    cliente: string;
    telefono: string | null;
    notas: string | null;
  }): Promise<ServicioDeMaquina> {
    const { entrada: e, maquina: m } = d;
    if (m.total === null || m.subtotal === null || m.precioUnitario === null) {
      throw new BadRequestException('Esta máquina no tiene precio para esa unidad. Pídela a la medida y te cotizamos.');
    }
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + VIGENCIA_DEFAULT_DIAS * 86400000);
    const u = UNIDADES[m.unidad];
    const pedido = textoPedido(m.unidad, m.unidadesCobradas);
    const direccion = [e.obra.direccion, e.obra.municipio].filter((x) => x && x.trim()).join(', ') || d.zona;

    const incluye = [
      `${m.name}${m.brand ? ` (${m.brand})` : ''} · ${pedido}${m.equipos > 1 ? ` × ${m.equipos} unidades` : ''} × ${dinero(m.precioUnitario)}/${u?.singular ?? m.unidad} = ${dinero(m.subtotal)}`,
      m.flete ? `Traslado desde el patio del aliado${m.km !== null ? ` (${m.km} km)` : ''} = ${dinero(m.flete)}` : `Traslado: ${m.fleteTexto}`,
      ...(m.notaMinimo ? [m.notaMinimo] : []),
      // Lo que define quien la ofrece (operador, combustible, capacidad…) va en lo que incluye.
      ...(m.specs.length ? [`Ficha: ${m.specs.map((s) => `${s.label}: ${s.valor}`).join(' · ')}`] : []),
    ].join('\n');
    const condiciones = [
      'Precio y traslado congelados al solicitar; vigencia de la cotización según su fecha de vencimiento.',
      'La máquina queda apartada para las fechas indicadas en cuanto el aliado acepta.',
      'Cualquier cambio de fechas, horario o lugar puede modificar el traslado.',
    ].map((p) => `- ${p}`).join('\n');
    const requisitos = Object.fromEntries(
      Object.entries(e.requisitos ?? {}).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 500)]),
    );

    /**
     * EL DOCUMENTO DE SIEMPRE (2026-09-25). El cliente quiere la cotización
     * como la de PUCSA: folio, empresa, partidas, condiciones y firma, para
     * imprimir o guardar en PDF. Se emite con el precio de la máquina y las
     * condiciones del tabulador de su línea. Si falla, la solicitud sigue:
     * el documento es un papel, no la operación.
     */
    const tipoDoc: CotizadorTipo = e.linea === 'triturados' ? 'triturados' : 'maquinaria';
    let folio: string | null = null;
    let quoterId: number | null = null;
    try {
      const catDoc = await this.quoter.catalogo(tipoDoc);
      const esTransporte = e.linea === 'transporte-y-servicios-de-obra';
      const condicionesDoc = Object.entries(catDoc.condiciones)
        .filter(([k]) => esTransporte || !['pipa', 'retiro'].includes(k))
        .map(([, b]) => b);
      const flete = r2(m.flete ?? 0);
      const baseDoc = r2(m.subtotal + flete);
      const calcDoc: CalculoCotizacion = {
        renglones: [
          {
            clase: m.renta ? 'equipo' : 'servicio',
            id: String(m.id),
            nombre: m.name,
            concepto: `${m.name}${m.brand ? ` (${m.brand})` : ''}${m.equipos > 1 ? ` × ${m.equipos}` : ''}`,
            unidad: u?.singular ?? m.unidad,
            cantidad: m.unidadesCobradas * m.equipos,
            pu: m.precioUnitario,
            importe: r2(m.subtotal),
            detalle: `A partir del ${e.fecha}${e.hora ? ` ${e.hora}` : ''}`,
          },
          ...(flete > 0
            ? [{ clase: 'flete', concepto: `Traslado a obra${m.km !== null ? ` (${m.km} km)` : ''}`, unidad: 'viaje', cantidad: 1, pu: flete, importe: flete }]
            : []),
        ],
        desglose: { renta: m.renta ? r2(m.subtotal) : 0, servicios: m.renta ? 0 : r2(m.subtotal), fletes: flete, materiales: 0 },
        subtotal: baseDoc,
        iva: r2(m.iva),
        iva_tasa: baseDoc > 0 && m.iva > 0 ? Math.round((m.iva / baseDoc) * 100) : 0,
        con_iva: m.iva > 0,
        total: r2(m.total),
        condiciones: condicionesDoc,
      };
      const doc = await this.quoter.documentoDeMaquina({
        tipo: tipoDoc,
        calc: calcDoc,
        cliente: d.cliente || d.cuenta.name,
        obra: e.obra.direccion ?? null,
        municipio: e.obra.municipio ?? d.zona,
        correo: d.cuenta.email,
        telefono: d.telefono,
        notas: d.notas,
        items: { productoId: m.id, fecha: e.fecha, hora: e.hora ?? null, unidad: m.unidad, unidades: m.unidadesCobradas, equipos: m.equipos },
        userId: d.userId,
      });
      folio = doc.folio;
      quoterId = doc.id;
    } catch (err) {
      this.log.warn(`No se pudo emitir el documento de la solicitud de ${m.name}: ${(err as Error).message}`);
    }

    const q = await prisma.quotes.create({
      data: {
        user_id: d.userId,
        name: d.cliente || d.cuenta.name,
        email: d.cuenta.email,
        phone: d.telefono || d.cuenta.phone || '',
        region: e.obra.municipio?.trim() || d.zona,
        address: direccion,
        product_interested: `${m.name} · ${d.lineaNombre}`.slice(0, 250),
        acquisition_option: m.renta ? 'renta' : 'compra',
        comments: [
          `Solicitud de máquina desde el catálogo: ${m.name}.`,
          `Para el ${e.fecha}${e.hora ? ` a las ${e.hora}` : ''}, ${pedido}${m.equipos > 1 ? ` (${m.equipos} unidades)` : ''}.`,
          d.notas ? `Notas del cliente: ${d.notas}` : '',
        ].filter(Boolean).join('\n'),
        cart_data: '{}',
        subtotal: new Prisma.Decimal(r2(m.subtotal)),
        freight_cost: new Prisma.Decimal(r2(m.flete ?? 0)),
        tax: new Prisma.Decimal(r2(m.iva)),
        total: new Prisma.Decimal(r2(m.total)),
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
          ...(folio ? { folio, quoterId, cotizador: tipoDoc } : {}),
          fecha_inicio: e.fecha,
          fecha_fin: d.fin,
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
        note: `El cliente eligió ${m.name} en el catálogo para el ${e.fecha}${e.hora ? ` ${e.hora}` : ''} (${pedido}) por ${dinero(m.total)}`,
        created_at: ahora,
      },
    });

    // A qué cliente y obra pertenece. Nunca lanza.
    const ligada = await resolverClienteYObra({
      contactName: d.cliente || d.cuenta.name,
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
      await reservar({ productId: m.id, folio: q.quote_number, desde: e.fecha, hasta: d.fin });
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

    const url = `/cuenta/cotizaciones/${q.quote_number}`;
    await this.notifications.push({
      userId: d.userId,
      type: 'service_status',
      title: `Recibimos tu solicitud ${q.quote_number}`,
      body: `${m.name} para el ${e.fecha}. Estamos confirmando con el aliado; en cuanto acepte te avisamos.`,
      link: url,
    });
    void this.avisar({ q: { id: quoteId, number: q.quote_number, total: m.total }, m, e, cliente: d.cliente || d.cuenta.name, correo: d.cuenta.email, telefono: d.telefono, zona: d.zona, url });

    return { quoteId, quoteNumber: q.quote_number, url, total: m.total, documentUrl: folio ? `${url}/documento` : null };
  }

  /** Correos: al equipo (entró una solicitud) y al cliente (acuse). Nunca lanza. */
  private async avisar(d: {
    q: { id: number; number: string; total: number };
    m: MaquinaRecomendada;
    e: EntradaRecomendacion;
    cliente: string;
    correo: string;
    telefono: string | null;
    zona: string | null;
    url: string;
  }): Promise<void> {
    try {
      const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
      if (interno) {
        const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
        await this.mailer.enviar({
          kind: 'quoter_request_internal',
          to: interno,
          quoteId: d.q.id,
          ...correoSolicitudInterna({
            folio: d.q.number,
            cotizador: 'máquinas del catálogo',
            cliente: d.cliente,
            correo: d.correo,
            telefono: d.telefono,
            municipio: d.zona,
            obra: d.e.obra.direccion ?? null,
            total: d.q.total,
            conceptos: [`${d.m.name} · ${textoPedido(d.m.unidad, d.m.unidadesCobradas)} · ${d.e.fecha}${d.e.hora ? ` ${d.e.hora}` : ''}`],
            proveedoresAvisados: [d.m.providerName],
            url: `${panel}/servicios`,
          }),
        });
      }
      const sitio = (process.env.SITE_URL ?? 'https://maqserv24.com').replace(/\/+$/, '');
      await this.mailer.enviar({
        kind: 'quoter_request_ack',
        to: d.correo,
        toName: d.cliente,
        quoteId: d.q.id,
        ...correoAcuseSolicitud({
          nombre: d.cliente,
          folio: d.q.number,
          cotizador: 'máquinas',
          total: d.q.total,
          // El cliente no ve al aliado: MAQSER24 confirma con él.
          proveedores: [],
          url: `${sitio}${d.url}`,
        }),
      });
    } catch (err) {
      this.log.error(`Avisos de ${d.q.number}: ${(err as Error).message}`);
    }
  }
}
