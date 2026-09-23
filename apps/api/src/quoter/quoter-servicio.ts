import { Injectable, Logger } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import {
  COTIZADORES_META,
  partidasPorProveedor,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CotizadorTipo,
  type PartidaCotizador,
} from '@maqserv/config';
import { NotificationsService } from '../notifications/notifications.service';
import { ServiceService } from '../quotes/service.service';
import { newQuoteNumber } from '../quotes/quotes.service';
import { estadoInicial } from '../quotes/service-flow';
import { VIGENCIA_DEFAULT_DIAS } from '../quotes/quote-validity';
import { resolverClienteYObra } from '../quotes/client-resolver';
import type { DatosCuenta } from '../common/cuenta';

/**
 * DEL COTIZADOR AL SERVICIO (decisión del cliente, 2026-09-23).
 *
 * Lo que sale del cotizador público no es "una solicitud de cotización": el
 * cliente YA vio el precio. Es la SOLICITUD DEL SERVICIO con esa cotización.
 * Antes la solicitud se quedaba en el historial del cotizador esperando a que
 * alguien la atendiera, y al proveedor solo le llegaba un correo que decía
 * "te contactarán"; no tenía dónde decir que sí ni que no.
 *
 * Esto la mete al mismo flujo que ya existe para todo lo demás: se crea la
 * cotización YA RESPONDIDA (precio congelado, vigencia, qué incluye y las
 * condiciones) y YA ACEPTADA por el cliente, arranca el servicio en "por
 * asignar" y se le OFRECE a cada proveedor dueño de lo que se pidió, que la ve
 * en su portal y la acepta o la rechaza. Si acepta, el servicio pasa a
 * "asignado" y el cliente se entera. Operaciones lo ve en su tablero como
 * cualquier otro servicio.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. NO se inventó otra tabla ni otro portal. La cotización, el servicio, la
 *    propuesta al aliado y su respuesta ya existían; el cotizador solo tenía
 *    que entrar por esa puerta. Un segundo flujo "para el cotizador" habría
 *    duplicado el historial, el tablero y la campana.
 *
 * 2. Las partidas SIN dueño no se le ofrecen a nadie: el servicio queda "por
 *    asignar" y Operaciones lo resuelve con el emparejamiento, como siempre.
 *    Inventarle un proveedor sería prometer algo que nadie aceptó.
 *
 * 3. Si esto falla, la solicitud del cotizador se queda en `solicitada`, que es
 *    lo que cuenta el contador del panel: alguien la ve y la atiende a mano.
 *    Un error aquí no puede dejar al cliente sin folio ni sin nadie que se
 *    entere.
 */

/** A qué línea de servicio corresponde cada cotizador (slugs de `categories`). */
const CATEGORIA_DE: Record<CotizadorTipo, string> = {
  maquinaria: 'maquinaria-pesada',
  triturados: 'triturados',
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ServicioAbierto {
  quoteId: number;
  quoteNumber: string;
  /** Aliados a los que se les ofreció, por nombre. Vacío si nada tenía dueño. */
  proveedores: string[];
  /** A dónde lo sigue el cliente. */
  url: string;
}

@Injectable()
export class QuoterServicio {
  private readonly log = new Logger('QuoterServicio');

  constructor(
    private readonly services: ServiceService,
    private readonly notifications: NotificationsService,
  ) {}

  async abrir(entrada: {
    cotizacion: { id: number; folio: string; kind: string; work: string | null; attention: string | null; municipality: string | null; phone: string | null; notes: string | null; snapshot: unknown };
    catalogo: CatalogoCotizador;
    partidas: PartidaCotizador[];
    cuenta: DatosCuenta;
    /** Nombre con el que firmó la solicitud (puede ser la empresa). */
    cliente: string;
    userId: number;
  }): Promise<ServicioAbierto> {
    const { cotizacion: cot, catalogo, partidas, cuenta, userId } = entrada;
    const tipo = cot.kind as CotizadorTipo;
    const calc = (cot.snapshot as { calc?: CalculoCotizacion } | null)?.calc;
    if (!calc) throw new Error(`La cotización ${cot.folio} no trae cálculo congelado`);

    const ahora = new Date();
    const vence = new Date(ahora.getTime() + VIGENCIA_DEFAULT_DIAS * 86400000);

    /**
     * Los importes, repartidos como los pinta la cuenta del cliente: subtotal,
     * traslado, impuesto, total. El cotizador ya trae los fletes DENTRO del
     * subtotal; se sacan para que las cuatro cifras cuadren y el traslado no se
     * cobre dos veces en la lectura.
     */
    const fletes = r2(calc.desglose.fletes);
    const subtotal = r2(calc.subtotal - fletes);

    const incluye = calc.renglones
      .map((r) => `${r.concepto} · ${r.cantidad} ${r.unidad} × ${dinero(r.pu)} = ${dinero(r.importe)}`)
      .join('\n');
    const condiciones = calc.condiciones
      .map((b) => [b.titulo, ...b.puntos.map((p) => `- ${p}`)].join('\n'))
      .join('\n\n');
    const nombreCotizador = COTIZADORES_META[tipo].titulo.toLowerCase();
    const conceptos = calc.renglones.filter((r) => r.clase !== 'flete').map((r) => r.concepto);

    const q = await prisma.quotes.create({
      data: {
        user_id: userId,
        name: entrada.cliente || cuenta.name,
        email: cuenta.email,
        phone: cot.phone || cuenta.phone || '',
        region: cot.municipality,
        // La obra y a quién va dirigida son datos de la solicitud, no del cliente.
        address: [cot.work, cot.municipality].filter(Boolean).join(', ') || null,
        product_interested: `Cotizador de ${nombreCotizador} · ${cot.folio}`.slice(0, 250),
        acquisition_option: tipo === 'maquinaria' ? 'renta' : 'compra',
        comments: [
          `Solicitud del cotizador de ${nombreCotizador}, folio ${cot.folio}.`,
          conceptos.length ? `Conceptos: ${conceptos.join(' · ')}` : '',
          cot.attention ? `Atención: ${cot.attention}` : '',
          cot.notes ? `Notas del cliente: ${cot.notes}` : '',
        ].filter(Boolean).join('\n'),
        cart_data: '{}',
        subtotal: new Prisma.Decimal(subtotal),
        freight_cost: new Prisma.Decimal(fletes),
        tax: new Prisma.Decimal(r2(calc.iva)),
        total: new Prisma.Decimal(r2(calc.total)),
        // Nace RESPONDIDA: el precio lo puso el tabulador, no hay nada que
        // contestar. Y ACEPTADA: pedir el servicio con ese precio es aceptarlo.
        status: 'completed',
        responded_at: ahora,
        responded_by: `Cotizador de ${nombreCotizador}`,
        valid_until: vence,
        included: incluye,
        conditions: condiciones || null,
        accepted_at: ahora,
        service_state: estadoInicial(),
        service_category: CATEGORIA_DE[tipo],
        // Cómo saber después de dónde vino: es lo que lee `mover` para avisar
        // por correo también cuando el proveedor acepta.
        requirements: {
          origen: 'cotizador',
          cotizador: tipo,
          folio: cot.folio,
          quoterId: cot.id,
          ...(cot.work ? { obra: cot.work } : {}),
          ...(cot.municipality ? { obra_ubicacion: cot.municipality } : {}),
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
        note: `El cliente solicitó el servicio desde el cotizador de ${nombreCotizador} (${cot.folio}) por ${dinero(calc.total)}`,
        created_at: ahora,
      },
    });

    // A qué cliente y obra pertenece. Nunca lanza.
    const ligada = await resolverClienteYObra({
      contactName: entrada.cliente || cuenta.name,
      email: cuenta.email,
      phone: cot.phone,
      address: cot.work,
      region: cot.municipality,
      userId,
    });
    if (ligada.clientId) {
      await prisma.quotes.update({
        where: { id: q.id },
        data: { client_id: ligada.clientId, site_id: ligada.siteId },
      });
    }

    /**
     * Ofrecérselo a cada dueño de lo que se pidió. Pasa por `ofrecer`, que es
     * el mismo camino que usa Operaciones: deja la propuesta, el evento y el
     * correo con el enlace del portal. Un proveedor que falle no detiene a los
     * demás ni a la solicitud.
     */
    const proveedores: string[] = [];
    for (const { proveedorId, conceptos: suyos } of partidasPorProveedor(catalogo, partidas)) {
      try {
        await this.services.ofrecer(quoteId, proveedorId, {
          scope: suyos.join(' · '),
          adminId: null,
          total: calc.total,
        });
        const p = await prisma.providers.findUnique({ where: { id: proveedorId }, select: { name: true } });
        if (p) proveedores.push(p.name);
      } catch (e) {
        this.log.warn(`No se pudo ofrecer ${q.quote_number} al aliado ${proveedorId}: ${(e as Error).message}`);
      }
    }

    const url = `/cuenta/cotizaciones/${q.quote_number}`;
    await this.notifications.push({
      userId,
      type: 'service_status',
      title: `Recibimos tu solicitud de servicio ${cot.folio}`,
      body: proveedores.length
        ? `Ya la tiene ${proveedores.join(' y ')} para revisarla. Cuando la acepte te avisamos.`
        : 'Estamos buscando al proveedor que la atienda. Te avisamos en cuanto esté asignado.',
      link: url,
    });

    // El documento del cotizador queda como ACEPTADO por el cliente: pedir el
    // servicio con ese precio es aceptarlo. Deja de contar como "solicitada"
    // porque ya tiene dueño: el servicio del tablero.
    await prisma.quoter_quotes.update({
      where: { id: cot.id },
      data: { state: 'aceptada', updated_at: ahora },
    });

    return { quoteId, quoteNumber: q.quote_number, proveedores, url };
  }
}
