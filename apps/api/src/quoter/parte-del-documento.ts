import { prisma } from '@maqserv/db';
import type { CalculoCotizacion, RenglonCotizacion } from '@maqserv/config';

/**
 * LO QUE LE TOCA A CADA ALIADO DEL DOCUMENTO (2026-10-19).
 *
 * "Solo le debe llegar lo de él; el completo solo lo ve el cliente y
 * MAQSER24." Un documento del cotizador (o de varias máquinas del catálogo) se
 * parte en una solicitud por línea o por máquina, y cada parte se le ofrece a
 * aliados distintos. Todas apuntan al MISMO documento (`requirements.quoterId`),
 * así que enseñarle "el documento" al de la pipa era enseñarle también la
 * excavadora con su precio, y un total que no cuadraba con el suyo.
 *
 * Aquí se recorta el documento congelado a los renglones de UNA parte. No se
 * recalcula nada: los precios son los mismos que vio el cliente.
 *
 * - Una sola parte: el documento entero es suyo.
 * - Del cotizador: la parte guarda los `id` de sus renglones
 *   (`requirements.renglones`, ver QuoterServicio.abrir).
 * - De máquinas del catálogo: su renglón es el de su máquina (`productId`) y,
 *   pegado a él, su traslado.
 * - Si no se puede saber cuáles son (partes creadas antes de este cambio), no
 *   se enseña ninguno: mejor sin partidas que con las de otro aliado.
 */

/** Lo que hace falta de la solicitud para recortarle su parte. */
export interface SolicitudDeLaParte {
  requirements: unknown;
  subtotal: unknown;
  freight_cost: unknown;
  tax: unknown;
  total: unknown;
  conditions: string | null;
}

type DocumentoCotizador = NonNullable<Awaited<ReturnType<typeof prisma.quoter_quotes.findUnique>>>;

export interface ParteDelDocumento {
  /** El documento del cotizador tal cual: folio, cliente, obra, notas. */
  doc: DocumentoCotizador;
  /** El documento congelado con el cálculo ya recortado a esta parte. */
  snapshot: Record<string, unknown> & { calc: CalculoCotizacion };
  /** true si se quitaron renglones de otras partes. */
  parcial: boolean;
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/**
 * El documento del cotizador ligado a la solicitud, recortado a lo suyo. Null
 * si no trae documento o si no se puede saber cuál es su parte.
 */
export async function parteDelDocumento(q: SolicitudDeLaParte): Promise<ParteDelDocumento | null> {
  const id = (q.requirements as { quoterId?: unknown } | null)?.quoterId;
  if (typeof id !== 'number') return null;
  const doc = await prisma.quoter_quotes.findUnique({ where: { id } });
  const snapshot = doc?.snapshot as (Record<string, unknown> & { calc?: CalculoCotizacion }) | null;
  if (!doc || !snapshot?.calc) return null;

  const partes = await prisma.quotes.count({ where: { requirements: { path: '$.folio', equals: doc.folio } } });
  if (partes <= 1) return { doc, snapshot: { ...snapshot, calc: snapshot.calc }, parcial: false };

  const calc = recortar(snapshot.calc, q);
  return calc ? { doc, snapshot: { ...snapshot, calc }, parcial: true } : null;
}

/**
 * Cómo se reconoce un renglón del documento: clase e id, para que un equipo y
 * un servicio que compartan id no se crucen. Es lo que guarda cada parte.
 */
export const claveDeRenglon = (r: Pick<RenglonCotizacion, 'clase' | 'id'>) => `${r.clase}:${r.id}`;

/** Los renglones como se le enseñan al aliado en el correo y en su portal. */
export function partidasParaAliado(calc: CalculoCotizacion): Array<{ concepto: string; cantidad: string; importe: number }> {
  return calc.renglones
    .filter((r) => r.concepto)
    .map((r) => ({ concepto: String(r.concepto), cantidad: `${r.cantidad ?? ''} ${r.unidad ?? ''}`.trim(), importe: Number(r.importe ?? 0) }));
}

/** El cálculo con solo los renglones de esta parte y sus importes. */
function recortar(calc: CalculoCotizacion, q: SolicitudDeLaParte): CalculoCotizacion | null {
  const propios = renglonesDeLaParte(calc.renglones, q.requirements);
  if (!propios?.length) return null;
  const suma = (clases: string[]) => r2(propios.filter((r) => clases.includes(r.clase)).reduce((s, r) => s + Number(r.importe ?? 0), 0));

  // Las condiciones de su parte son las que se le escribieron a su solicitud
  // (un bloque por título). Si no se reconoce ninguna, van todas: son reglas
  // del servicio, no precios de nadie.
  const titulos = new Set((q.conditions ?? '').split(/\r?\n[ \t]*\r?\n/).map((b) => b.split(/\r?\n/)[0].trim()).filter(Boolean));
  const suyas = (calc.condiciones ?? []).filter((b) => titulos.has(b.titulo.trim()));

  return {
    ...calc,
    renglones: propios,
    desglose: {
      renta: suma(['equipo']),
      servicios: suma(['servicio']),
      fletes: suma(['flete']),
      materiales: suma(['material', 'banco', 'zona']),
    },
    // Los importes son los de SU solicitud: lo mismo que ve como "Importe
    // cotizado" en el correo y en el portal. El flete va dentro del subtotal,
    // igual que en el documento.
    subtotal: r2(Number(q.subtotal) + Number(q.freight_cost ?? 0)),
    iva: r2(Number(q.tax ?? 0)),
    total: r2(Number(q.total)),
    condiciones: suyas.length ? suyas : calc.condiciones,
  };
}

function renglonesDeLaParte(renglones: RenglonCotizacion[], requirements: unknown): RenglonCotizacion[] | null {
  const req = (requirements ?? {}) as { origen?: unknown; renglones?: unknown; productId?: unknown; fecha_inicio?: unknown };

  // Del cotizador: la clave (clase:id) de cada renglón suyo. El flete de un
  // equipo lleva el id del equipo, así que viaja con él.
  if (Array.isArray(req.renglones)) {
    const claves = new Set(req.renglones.map(String));
    return renglones.filter((r) => r.id !== undefined && claves.has(claveDeRenglon(r)));
  }

  // De máquinas del catálogo: el renglón de su máquina y, si lo trae, el
  // traslado que va justo después. Si la misma máquina va dos veces, la fecha
  // dice cuál es.
  if (req.origen === 'maquina' && req.productId != null) {
    const producto = String(req.productId);
    const fecha = typeof req.fecha_inicio === 'string' ? req.fecha_inicio : null;
    let indices = renglones.map((r, i) => (r.clase !== 'flete' && String(r.id) === producto ? i : -1)).filter((i) => i >= 0);
    if (indices.length > 1 && fecha) {
      const deEsaFecha = indices.filter((i) => renglones[i].detalle?.includes(fecha));
      if (deEsaFecha.length) indices = deEsaFecha;
    }
    if (indices.length === 0) return null;
    const i = indices[0];
    return renglones[i + 1]?.clase === 'flete' ? [renglones[i], renglones[i + 1]] : [renglones[i]];
  }

  return null;
}
