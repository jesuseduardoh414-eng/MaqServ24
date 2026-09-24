import { Injectable, Logger } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import {
  COTIZADORES_META,
  analizarPartidas,
  calcularCotizacion,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CotizadorTipo,
  type OpcionesCotizador,
  type PartidaAnalizada,
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
 * DEL COTIZADOR AL SERVICIO (decisión del cliente, 2026-09-23; relación con
 * líneas y catálogo, 2026-09-24).
 *
 * Lo que sale del cotizador público no es "una solicitud de cotización": el
 * cliente YA vio el precio. Es la SOLICITUD DEL SERVICIO con esa cotización.
 * Se crea la cotización YA RESPONDIDA (precio congelado, vigencia, incluye,
 * condiciones) y YA ACEPTADA, arranca el servicio en "por asignar" y se le
 * OFRECE al proveedor que corresponde, que la acepta o la rechaza en su portal.
 *
 * DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. SE PARTE POR LÍNEA DE SERVICIO. Una solicitud del cotizador de maquinaria
 *    puede traer una excavadora (maquinaria pesada) y una pipa (transporte y
 *    servicios de obra). Son trabajos de proveedores distintos: cada línea
 *    se vuelve su propio servicio, con su propio precio (se recalcula con el
 *    mismo motor sobre sus partidas), su propia categoría y su propia oferta.
 *    Antes todo quedaba como "maquinaria pesada" y la pipa se le ofrecía a
 *    quien no le tocaba, y los indicadores contaban mal la línea.
 *
 * 2. EL DUEÑO SALE DEL CATÁLOGO. Cada renglón del tabulador apunta a productos
 *    (`productos`); el proveedor es quien tiene esos productos publicados. Si
 *    el renglón no tiene productos ligados, vale el `proveedor_id` viejo como
 *    respaldo. Si VARIOS proveedores tienen ese equipo, no se elige a ciegas:
 *    el servicio queda "por asignar" y Operaciones decide con el emparejamiento.
 *
 * 3. Si algo falla, la solicitud del cotizador se queda en `solicitada` (lo
 *    cuenta el panel) y alguien la atiende a mano. El cliente nunca se queda
 *    sin folio ni sin nadie que se entere.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ServicioAbierto {
  /** El primer servicio abierto (el que se enseña al cliente como principal). */
  quoteId: number;
  quoteNumber: string;
  /** Aliados a los que se les ofreció algo, por nombre, de todas las líneas. */
  proveedores: string[];
  /** A dónde sigue el cliente su solicitud (el primer servicio). */
  url: string;
  /** Todos los servicios abiertos, uno por línea. */
  servicios: Array<{ quoteId: number; quoteNumber: string; linea: string; url: string; proveedores: string[] }>;
}

@Injectable()
export class QuoterServicio {
  private readonly log = new Logger('QuoterServicio');

  constructor(
    private readonly services: ServiceService,
    private readonly notifications: NotificationsService,
  ) {}

  async abrir(entrada: {
    cotizacion: {
      id: number; folio: string; kind: string; work: string | null; attention: string | null;
      municipality: string | null; phone: string | null; notes: string | null; snapshot: unknown; options?: unknown;
    };
    catalogo: CatalogoCotizador;
    partidas: PartidaCotizador[];
    cuenta: DatosCuenta;
    /** Nombre con el que firmó la solicitud (puede ser la empresa). */
    cliente: string;
    userId: number;
  }): Promise<ServicioAbierto> {
    const { cotizacion: cot, catalogo, partidas, cuenta, userId } = entrada;
    const tipo = cot.kind as CotizadorTipo;
    const calcTotal = (cot.snapshot as { calc?: CalculoCotizacion } | null)?.calc;
    if (!calcTotal) throw new Error(`La cotización ${cot.folio} no trae cálculo congelado`);
    const opciones = (cot.options ?? {}) as Partial<OpcionesCotizador>;
    const nombreCotizador = COTIZADORES_META[tipo].titulo.toLowerCase();

    // ── 1. Partidas por línea ──
    const analizadas = analizarPartidas(catalogo, partidas);
    const porLinea = new Map<string, PartidaAnalizada[]>();
    for (const a of analizadas) porLinea.set(a.linea, [...(porLinea.get(a.linea) ?? []), a]);
    if (porLinea.size === 0) throw new Error(`La cotización ${cot.folio} no trae partidas reconocibles`);

    // ── 2. Dueños: quién tiene publicados los productos ligados a cada renglón ──
    const idsProductos = [...new Set(analizadas.flatMap((a) => a.productos))];
    const productos = idsProductos.length
      ? await prisma.products.findMany({
          where: { id: { in: idsProductos }, status: 1, provider_id: { not: null } },
          select: { id: true, provider_id: true },
        })
      : [];
    const duenoDe = new Map(productos.map((p) => [p.id, p.provider_id as number]));
    const duenosDePartida = (a: PartidaAnalizada): number[] => {
      const deCatalogo = [...new Set(a.productos.map((id) => duenoDe.get(id)).filter((x): x is number => !!x))];
      if (deCatalogo.length) return deCatalogo;
      return a.proveedorId ? [a.proveedorId] : [];
    };

    const nombresLinea = new Map(
      (await prisma.categories.findMany({ where: { cat_slug: { in: [...porLinea.keys()] } }, select: { cat_slug: true, cat_name: true } }))
        .map((c) => [c.cat_slug, c.cat_name]),
    );

    // ── 3. Un servicio por línea ──
    const servicios: ServicioAbierto['servicios'] = [];
    const unaSola = porLinea.size === 1;
    for (const [linea, grupo] of porLinea) {
      // Una sola línea: el cálculo congelado del documento es exactamente este.
      const calc = unaSola ? calcTotal : calcularCotizacion(catalogo, grupo.map((g) => g.partida), opciones);
      const abierto = await this.crearServicio({ cot, tipo, nombreCotizador, linea, lineaNombre: nombresLinea.get(linea) ?? linea, calc, grupo, entrada });

      // Ofertas: a cada dueño único, lo suyo; lo que tiene varios dueños lo decide Operaciones.
      const porProveedor = new Map<number, string[]>();
      const variosDuenos: string[] = [];
      for (const a of grupo) {
        const duenos = duenosDePartida(a);
        if (duenos.length === 1) porProveedor.set(duenos[0], [...(porProveedor.get(duenos[0]) ?? []), a.concepto]);
        else if (duenos.length > 1) variosDuenos.push(`${a.concepto} (${duenos.length} aliados lo tienen)`);
      }
      const ofrecidos: string[] = [];
      for (const [proveedorId, conceptos] of porProveedor) {
        try {
          await this.services.ofrecer(abierto.quoteId, proveedorId, { scope: conceptos.join(' · '), adminId: null, total: calc.total });
          const p = await prisma.providers.findUnique({ where: { id: proveedorId }, select: { name: true } });
          if (p) ofrecidos.push(p.name);
        } catch (e) {
          this.log.warn(`No se pudo ofrecer ${abierto.quoteNumber} al aliado ${proveedorId}: ${(e as Error).message}`);
        }
      }
      if (variosDuenos.length) {
        await prisma.service_events.create({
          data: {
            quote_id: BigInt(abierto.quoteId),
            to_state: estadoInicial(),
            note: `Elige aliado con el emparejamiento: ${variosDuenos.join(' · ')}`,
            created_at: new Date(),
          },
        });
      }
      servicios.push({ ...abierto, linea, proveedores: ofrecidos });
    }

    // ── 4. Avisar al cliente y cerrar el documento del cotizador ──
    const todos = [...new Set(servicios.flatMap((s) => s.proveedores))];
    const principal = servicios[0];
    await this.notifications.push({
      userId,
      type: 'service_status',
      title: `Recibimos tu solicitud de servicio ${cot.folio}`,
      body: todos.length
        ? `Ya la tiene ${todos.join(' y ')} para revisarla. Cuando la acepte te avisamos.`
        : 'Estamos buscando al proveedor que la atienda. Te avisamos en cuanto esté asignado.',
      link: principal.url,
    });
    await prisma.quoter_quotes.update({ where: { id: cot.id }, data: { state: 'aceptada', updated_at: new Date() } });

    return { quoteId: principal.quoteId, quoteNumber: principal.quoteNumber, proveedores: todos, url: principal.url, servicios };
  }

  /** Crea la cotización aceptada + el servicio de UNA línea, con su historial y su cliente/obra. */
  private async crearServicio(d: {
    cot: { id: number; folio: string; work: string | null; attention: string | null; municipality: string | null; phone: string | null; notes: string | null };
    tipo: CotizadorTipo;
    nombreCotizador: string;
    linea: string;
    lineaNombre: string;
    calc: CalculoCotizacion;
    grupo: PartidaAnalizada[];
    entrada: { cuenta: DatosCuenta; cliente: string; userId: number };
  }): Promise<{ quoteId: number; quoteNumber: string; url: string }> {
    const { cot, calc, entrada } = d;
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + VIGENCIA_DEFAULT_DIAS * 86400000);

    // El cotizador trae los fletes DENTRO del subtotal; se sacan para que
    // subtotal + traslado + impuesto cuadren con el total en la cuenta.
    const fletes = r2(calc.desglose.fletes);
    const subtotal = r2(calc.subtotal - fletes);
    const incluye = calc.renglones
      .map((r) => `${r.concepto} · ${r.cantidad} ${r.unidad} × ${dinero(r.pu)} = ${dinero(r.importe)}`)
      .join('\n');
    const condiciones = calc.condiciones.map((b) => [b.titulo, ...b.puntos.map((p) => `- ${p}`)].join('\n')).join('\n\n');
    const conceptos = d.grupo.map((g) => g.concepto);

    const q = await prisma.quotes.create({
      data: {
        user_id: entrada.userId,
        name: entrada.cliente || entrada.cuenta.name,
        email: entrada.cuenta.email,
        phone: cot.phone || entrada.cuenta.phone || '',
        region: cot.municipality,
        address: [cot.work, cot.municipality].filter(Boolean).join(', ') || null,
        product_interested: `${d.lineaNombre} · cotizador de ${d.nombreCotizador} · ${cot.folio}`.slice(0, 250),
        acquisition_option: d.tipo === 'maquinaria' ? 'renta' : 'compra',
        comments: [
          `Solicitud del cotizador de ${d.nombreCotizador}, folio ${cot.folio}.`,
          conceptos.length ? `Conceptos: ${conceptos.join(' · ')}` : '',
          cot.attention ? `Atención: ${cot.attention}` : '',
          cot.notes ? `Notas del cliente: ${cot.notes}` : '',
        ].filter(Boolean).join('\n'),
        cart_data: '{}',
        subtotal: new Prisma.Decimal(subtotal),
        freight_cost: new Prisma.Decimal(fletes),
        tax: new Prisma.Decimal(r2(calc.iva)),
        total: new Prisma.Decimal(r2(calc.total)),
        // Nace RESPONDIDA (el precio lo puso el tabulador) y ACEPTADA (pedir el
        // servicio con ese precio es aceptarlo).
        status: 'completed',
        responded_at: ahora,
        responded_by: `Cotizador de ${d.nombreCotizador}`,
        valid_until: vence,
        included: incluye,
        conditions: condiciones || null,
        accepted_at: ahora,
        service_state: estadoInicial(),
        // La línea REAL de lo pedido, no la del cotizador.
        service_category: d.linea,
        requirements: {
          origen: 'cotizador',
          cotizador: d.tipo,
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

    await prisma.service_events.create({
      data: {
        quote_id: q.id,
        to_state: estadoInicial(),
        note: `El cliente solicitó ${d.lineaNombre.toLowerCase()} desde el cotizador de ${d.nombreCotizador} (${cot.folio}) por ${dinero(calc.total)}`,
        created_at: ahora,
      },
    });

    // A qué cliente y obra pertenece. Nunca lanza.
    const ligada = await resolverClienteYObra({
      contactName: entrada.cliente || entrada.cuenta.name,
      email: entrada.cuenta.email,
      phone: cot.phone,
      address: cot.work,
      region: cot.municipality,
      userId: entrada.userId,
    });
    if (ligada.clientId) {
      await prisma.quotes.update({ where: { id: q.id }, data: { client_id: ligada.clientId, site_id: ligada.siteId } });
    }

    return { quoteId: Number(q.id), quoteNumber: q.quote_number, url: `/cuenta/cotizaciones/${q.quote_number}` };
  }
}
