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
import { avisarPanel } from '../notifications/panel';
import { ServiceService } from '../quotes/service.service';
import { newQuoteNumber } from '../quotes/quotes.service';
import { estadoInicial } from '../quotes/service-flow';
import { VIGENCIA_DEFAULT_DIAS } from '../quotes/quote-validity';
import { resolverClienteYObra } from '../quotes/client-resolver';
import type { DatosCuenta } from '../common/cuenta';
import { claveDeRenglon } from './parte-del-documento';

/**
 * DEL COTIZADOR AL SERVICIO (decisión del cliente, 2026-09-23; relación con
 * líneas y catálogo, 2026-09-24).
 *
 * CAMBIO 2026-10-15: lo que manda el cliente desde el cotizador ya NO entra
 * aceptado. Llega a Solicitudes › Por cotizar con su documento; en el panel se
 * confirman datos y precios y se le responde; él la acepta desde su cuenta.
 * CAMBIO 2026-10-23: el cliente ya no ve precios en el sitio, y al aceptar
 * NADA sale solo a los aliados: MAQSER24 elige a quién se la da desde
 * Servicios › Buscar aliado. Lo de abajo sobre "ya respondida y ya aceptada"
 * describe cómo era antes.
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

/** Prefijo de la nota con los aliados sugeridos; el tablero de Servicios la lee por él. */
export const SUGERIDOS = 'Aliados con ese equipo publicado:';
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Empresa y obra elegidas en el sitio, o la dirección de la obra nueva. */
export interface Destino {
  clientId: number | null;
  siteId: number | null;
  direccion: string | null;
  /** Fecha de inicio o entrega (AAAA-MM-DD): la leen las reservas, la ficha y el aliado. */
  fecha?: string | null;
  /** Del panel: cliente y obra elegidos de todos los registrados (ver resolverClienteYObra). */
  confiable?: boolean;
  /** Triturados con flete (2026-10-29): la ubicación de la obra en Google Maps. */
  ubicacion?: string | null;
}

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
    /** Null cuando la cotización la armó el panel para alguien sin cuenta. */
    userId: number | null;
    /**
     * `por_confirmar` (sitio, 2026-10-15): el cliente la pidió viendo el precio
     * y MAQSER24 la revisa antes de mandarla a los aliados.
     * `aceptada` (cotizador del panel): el cliente ya dijo que sí por teléfono
     * o WhatsApp; nace en servicio, por asignar (2026-10-23: ya no se ofrece sola).
     */
    modo?: 'por_confirmar' | 'aceptada';
    /** Quién la marcó aceptada en el panel (solo `aceptada`). */
    adminNombre?: string | null;
    /**
     * A qué empresa y obra va (sitio, 2026-10-23): una de las suyas, o una obra
     * nueva con su dirección (su nombre es `cotizacion.work`).
     */
    destino?: Destino | null;
  }): Promise<ServicioAbierto> {
    const { cotizacion: cot, catalogo, partidas, cuenta, userId } = entrada;
    const modo = entrada.modo ?? 'por_confirmar';
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
      const abierto = await this.crearServicio({ cot, tipo, nombreCotizador, linea, lineaNombre: nombresLinea.get(linea) ?? linea, calc, grupo, entrada, modo, parte: !unaSola });

      /**
       * PRECIO ÚNICO Y ASIGNA MAQSER24 (decisión del cliente, 2026-09-28).
       * "El cotizador es un solo precio, una sola configuración… se va a
       * manejar un solo estándar." El servicio queda "por asignar" y
       * MAQSER24 elige al aliado desde Servicios; ya NO se le ofrece solo al
       * dueño del equipo. Quién tiene ese equipo publicado queda anotado en
       * el historial como sugerencia para decidir más rápido.
       */
      const sugeridos = new Set<number>();
      for (const a of grupo) for (const id of duenosDePartida(a)) sugeridos.add(id);
      if (sugeridos.size) {
        const nombres = (await prisma.providers.findMany({ where: { id: { in: [...sugeridos] }, status: 1 }, select: { name: true } })).map((p) => p.name);
        if (nombres.length) {
          await prisma.service_events.create({
            data: {
              quote_id: BigInt(abierto.quoteId),
              to_state: estadoInicial(),
              note: `${SUGERIDOS} ${nombres.join(' · ')}`,
              created_at: new Date(),
            },
          });
        }
      }
      servicios.push({ ...abierto, linea, proveedores: [] });
    }

    // ── 4. Avisar al cliente y al panel ──
    const principal = servicios[0];

    /**
     * Del panel (el cliente ya dijo que sí): nace en Servicios › Por asignar y
     * NO sale sola a los aliados (2026-10-23). MAQSER24 elige a quién se la da
     * desde "Buscar aliado" (uno, varios o "Mandar a todos"). La campana la
     * pone quien llama: aceptada desde el correo avisa en quoter.controller; la
     * que marcó una persona en el panel no necesita avisarle a ella misma.
     */
    if (modo === 'aceptada') {
      return { quoteId: principal.quoteId, quoteNumber: principal.quoteNumber, proveedores: [], url: principal.url, servicios };
    }

    // Del sitio (2026-10-23): el cliente no vio precios. Lo revisa MAQSER24 y
    // se lo manda; nada sale a los aliados hasta que él acepte.
    if (userId) await this.notifications.push({
      userId,
      type: 'service_status',
      title: `Recibimos tu solicitud ${cot.folio}`,
      body: 'La revisamos y te mandamos la cotización con precio por correo y a tu cuenta.',
      link: principal.url,
    });
    // Ya no hay aprobación automática (2026-10-23): esta es la campana de que
    // llegó algo por revisar. El documento sigue "solicitada"; pasa a "enviada"
    // al mandarle el precio y a "aceptada" cuando el cliente la acepta.
    void avisarPanel({
      modulo: 'cotizaciones',
      evento: 'cotizacion',
      titulo: `Nueva solicitud ${cot.folio} de ${entrada.cliente || cuenta.name}: revisa el precio y mándaselo`,
      cuerpo: servicios.length > 1
        ? `Viene en ${servicios.length} partes (${servicios.map((s) => nombresLinea.get(s.linea) ?? s.linea).join(', ')}). Llegó con precio estimado del tabulador.`
        : `${nombresLinea.get(principal.linea) ?? principal.linea}. Llegó con precio estimado del tabulador.`,
      link: `/cotizaciones?ver=${principal.quoteId}`,
    });

    return { quoteId: principal.quoteId, quoteNumber: principal.quoteNumber, proveedores: [], url: principal.url, servicios };
  }

  /**
   * COTIZACIÓN DEL PANEL ACEPTADA (2026-10-15).
   *
   * Las cotizaciones que arma MAQSER24 en su cotizador (clientes que llaman o
   * escriben por WhatsApp) eran solo un documento. Al marcarla "Aceptada" en
   * Cotizaciones emitidas, ahora se abre su servicio, que queda por asignar
   * igual que lo demás (desde el 2026-10-23 no se ofrece solo: MAQSER24 elige). Si ya tenía servicio (o viene de una solicitud del
   * sitio, que sigue su propio camino), no hace nada.
   */
  async abrirDesdePanel(docId: number, catalogo: CatalogoCotizador, adminNombre: string | null): Promise<ServicioAbierto | null> {
    const doc = await prisma.quoter_quotes.findUnique({ where: { id: docId } });
    if (!doc || doc.origin !== 'panel') return null;
    const ya = await prisma.quotes.count({ where: { requirements: { path: '$.folio', equals: doc.folio } } });
    if (ya > 0) return null;
    return this.abrir({
      cotizacion: {
        id: doc.id, folio: doc.folio, kind: doc.kind, work: doc.work, attention: doc.attention,
        municipality: doc.municipality, phone: doc.phone, notes: doc.notes, snapshot: doc.snapshot, options: doc.options,
      },
      catalogo,
      partidas: doc.items as unknown as PartidaCotizador[],
      cuenta: { name: doc.attention || doc.client_name, email: doc.email ?? '', phone: doc.phone },
      cliente: doc.client_name,
      userId: doc.user_id ?? null,
      modo: 'aceptada',
      adminNombre,
      // El cliente y la obra que se eligieron al cotizar (2026-10-23).
      destino: (() => {
        const snap = doc.snapshot as { destino?: { clientId?: number; siteId?: number | null }; fecha?: string; ubicacion?: string } | null;
        const dst = snap?.destino;
        const fecha = snap?.fecha ?? null;
        const ubicacion = snap?.ubicacion ?? null;
        if (dst?.clientId) return { clientId: dst.clientId, siteId: dst.siteId ?? null, direccion: null, fecha, ubicacion, confiable: true };
        return fecha || ubicacion ? { clientId: null, siteId: null, direccion: null, fecha, ubicacion } : null;
      })(),
    });
  }

  /**
   * Crea la cotización (por confirmar o aceptada) + el servicio de UNA línea,
   * con su historial y su cliente/obra. Público desde el 2026-10-23: al volver a
   * cotizar, una línea nueva del documento abre su propia parte con esto.
   */
  async crearServicio(d: {
    cot: { id: number; folio: string; work: string | null; attention: string | null; municipality: string | null; phone: string | null; notes: string | null };
    tipo: CotizadorTipo;
    nombreCotizador: string;
    linea: string;
    lineaNombre: string;
    calc: CalculoCotizacion;
    grupo: PartidaAnalizada[];
    entrada: { cuenta: DatosCuenta; cliente: string; userId: number | null; adminNombre?: string | null; destino?: Destino | null };
    modo: 'por_confirmar' | 'aceptada';
    /** El documento trae otras líneas: esta solicitud es solo una parte de él. */
    parte: boolean;
  }): Promise<{ quoteId: number; quoteNumber: string; url: string }> {
    const { cot, calc, entrada } = d;
    const aceptada = d.modo === 'aceptada';
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
    const ligados = [...new Set(d.grupo.flatMap((g) => g.productos))];
    // Cuántos días de calendario ocupa el equipo (2026-10-19): sin esto la
    // reserva no tenía de dónde sacarlo y apartaba un solo día aunque se
    // cotizaran 3. Las horas extra ocupan un día más.
    const diasEquipo = Math.max(0, ...d.grupo.map(({ partida: p }) =>
      p.tipo === 'equipo' ? (p.dias ?? 0) + ((p.horas ?? 0) > 0 ? 1 : 0) : 0));

    /**
     * A qué cliente y obra pertenece, ANTES de crearla (2026-10-23): la
     * dirección de la solicitud es la de su obra. Del sitio llega la obra que
     * eligió o una nueva con nombre y dirección; las partes de un mismo
     * documento caen en la misma obra (la segunda la encuentra por su nombre).
     * Sin destino (el panel) se deduce como antes. Nunca lanza.
     * "Cliente o empresa" va como EMPRESA (2026-10-19): sin ella, la cuenta
     * recién creada seguía con el nombre de la persona.
     */
    const destino = entrada.destino ?? null;
    const ligada = await resolverClienteYObra({
      companyName: entrada.cliente || null,
      // El contacto de la obra es una persona ("Atención a" o el de la cuenta), no la empresa.
      contactName: cot.attention || entrada.cuenta.name || entrada.cliente,
      email: entrada.cuenta.email,
      phone: cot.phone,
      address: destino?.direccion ? [destino.direccion, cot.municipality].filter(Boolean).join(', ') : cot.work,
      region: cot.municipality,
      userId: entrada.userId ?? undefined,
      siteId: destino?.siteId ?? null,
      clientId: destino?.clientId ?? null,
      siteName: destino ? cot.work : null,
      confiarEnIds: destino?.confiable ?? false,
    });
    const obra = ligada.siteId
      ? await prisma.client_sites.findUnique({ where: { id: ligada.siteId }, select: { address: true, municipality: true } })
      : null;

    const q = await prisma.quotes.create({
      data: {
        user_id: entrada.userId ?? null,
        name: entrada.cliente || entrada.cuenta.name,
        email: entrada.cuenta.email,
        phone: cot.phone || entrada.cuenta.phone || '',
        region: cot.municipality,
        address: obra?.address || [cot.work, cot.municipality].filter(Boolean).join(', ') || null,
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
        // Nace POR CONFIRMAR (2026-10-15): el panel revisa datos y precios y le
        // responde; la vigencia la pone esa respuesta. Lo que incluye y las
        // condiciones ya van llenos con lo del documento.
        status: 'pending',
        included: incluye,
        conditions: condiciones || null,
        // Del panel ya aceptada: respondida (el precio lo puso MAQSER24 en el
        // documento), aceptada (el cliente dijo que sí) y en servicio.
        ...(aceptada
          ? {
              status: 'completed',
              responded_at: ahora,
              responded_by: entrada.adminNombre ?? `Cotizador de ${d.nombreCotizador}`,
              valid_until: vence,
              accepted_at: ahora,
              service_state: estadoInicial(),
            }
          : {}),
        // La línea REAL de lo pedido, no la del cotizador.
        service_category: d.linea,
        requirements: {
          // `panel`: la armó MAQSER24 en su cotizador (cliente por teléfono o WhatsApp).
          origen: aceptada ? 'panel' : 'cotizador',
          cotizador: d.tipo,
          folio: cot.folio,
          quoterId: cot.id,
          // Equipos ligados a los renglones pedidos. No se aparta ninguno
          // todavía (asigna MAQSER24); cuando un aliado acepta, se aparta el
          // suyo de esta lista (ver quotes/reservas.ts).
          ...(ligados.length ? { productos: ligados } : {}),
          // Qué renglones del documento son de esta parte (2026-10-19): el
          // aliado solo ve los suyos; el documento completo es del cliente y
          // de MAQSER24 (ver parte-del-documento.ts).
          ...(d.parte ? { renglones: [...new Set(calc.renglones.filter((r) => r.id !== undefined).map(claveDeRenglon))] } : {}),
          ...(cot.work ? { obra: cot.work } : {}),
          ...(cot.municipality ? { obra_ubicacion: cot.municipality } : {}),
          // La misma llave que el formulario de /cotizar: la lee quotes/reservas.ts.
          ...(diasEquipo > 0 ? { duracion: `${diasEquipo} ${diasEquipo === 1 ? 'día' : 'días'}` } : {}),
          // La fecha que pidió (2026-10-23), con la misma llave que /cotizar.
          ...(entrada.destino?.fecha ? { fecha_inicio: entrada.destino.fecha } : {}),
          // Con flete de triturados: dónde medir los km (2026-10-29). El panel lo enseña como enlace.
          ...(entrada.destino?.ubicacion ? { ubicacion_maps: entrada.destino.ubicacion } : {}),
        } as Prisma.InputJsonValue,
        quote_number: newQuoteNumber(),
        created_at: ahora,
        updated_at: ahora,
      },
    });

    if (aceptada) {
      await prisma.service_events.create({
        data: {
          quote_id: q.id,
          to_state: estadoInicial(),
          note: `El cliente aceptó la cotización ${cot.folio}${entrada.adminNombre ? ` (la registró ${entrada.adminNombre})` : ''}`,
          created_at: ahora,
        },
      });
    }

    if (ligada.clientId) {
      await prisma.quotes.update({ where: { id: q.id }, data: { client_id: ligada.clientId, site_id: ligada.siteId } });
    }

    return { quoteId: Number(q.id), quoteNumber: q.quote_number, url: `/cuenta/cotizaciones/${q.quote_number}` };
  }
}
