import { BadRequestException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { z } from 'zod';
import {
  MAX_UNIDADES_IDENTIFICADAS, atributosConUnidades, identificacionDe, limpiarUnidad, limpiarUnidades, textoUnidad, unidadVacia,
  type UnidadEquipo,
} from '@maqserv/config';
import { PREFIJO_RESERVA } from './availability';

/**
 * CADA MÁQUINA CON SU IDENTIFICACIÓN, del lado del API (2026-11-09).
 *
 * La regla y el formato viven en @maqserv/config (unidades-equipo.ts): la
 * lista va en `products.attributes.unidades` y su largo es el `stock`. Aquí va
 * lo que toca la base: guardarla desde el portal o el panel, y la unidad que
 * el aliado manda a un servicio (`quotes.requirements.unidadAsignada`).
 */

/** Lo que manda el portal o el panel por cada unidad. Todo opcional. */
export const unidadSchema = z.object({
  eco: z.string().max(60).optional().nullable(),
  placas: z.string().max(60).optional().nullable(),
  serie: z.string().max(80).optional().nullable(),
  anio: z.union([z.string().max(10), z.number()]).optional().nullable(),
});

export const listaUnidadesSchema = z
  .array(unidadSchema)
  .min(1, 'Debe quedar al menos una unidad.')
  .max(MAX_UNIDADES_IDENTIFICADAS, `Son más de ${MAX_UNIDADES_IDENTIFICADAS} unidades: escríbenos y lo cargamos nosotros.`);

/**
 * Las mismas placas, el mismo económico o la misma serie dos veces es un
 * error de captura (se copió el renglón de arriba): se dice cuál antes de
 * guardar, porque luego la obra no deja entrar a la que no es.
 */
export function exigirSinRepetidas(lista: UnidadEquipo[]): void {
  for (const [clave, nombre] of [['placas', 'las placas'], ['eco', 'el número económico'], ['serie', 'la serie']] as const) {
    const vistos = new Set<string>();
    for (const u of lista) {
      const v = u[clave]?.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!v) continue;
      if (vistos.has(v)) throw new BadRequestException(`Repetiste ${nombre} ${u[clave]}: cada unidad lleva las suyas.`);
      vistos.add(v);
    }
  }
}

/**
 * Guarda la identificación de cada unidad y deja `stock` = cuántas son. La
 * ficha técnica que ya tenía `attributes` se queda como estaba.
 */
export async function guardarUnidades(productId: number, entrada: unknown[]): Promise<{ unidades: number; identificacion: UnidadEquipo[] }> {
  const lista = limpiarUnidades(entrada);
  if (!lista.length) throw new BadRequestException('Debe quedar al menos una unidad.');
  exigirSinRepetidas(lista);
  const actual = await prisma.products.findUnique({ where: { id: productId }, select: { attributes: true } });
  const attrs = atributosConUnidades(actual?.attributes ?? null, lista);
  await prisma.products.update({
    where: { id: productId },
    data: { attributes: (attrs ?? Prisma.JsonNull) as never, stock: lista.length, updated_at: new Date() },
  });
  return { unidades: lista.length, identificacion: identificacionDe(attrs) };
}

/** Lo que se guarda del equipo al elegir la unidad: la foto de ese momento, aunque luego cambie su lista. */
export interface UnidadAsignada extends UnidadEquipo {
  /** El aliado que la eligió: si el servicio pasa a otro, ya no cuenta. */
  aliadoId: number;
  productId: number;
  /** Su lugar en la lista de ese equipo (empieza en 0). */
  indice: number;
  /** El nombre del equipo ("Volteo 14 m³ Kenworth T800"). */
  equipo: string;
}

/** La unidad que el aliado eligió para el servicio, si la hay y está bien formada. */
export function unidadAsignadaDe(requirements: unknown): UnidadAsignada | null {
  const u = (requirements as { unidadAsignada?: unknown } | null)?.unidadAsignada as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return null;
  const aliadoId = Number(u.aliadoId);
  const productId = Number(u.productId);
  const indice = Number(u.indice);
  if (!Number.isInteger(aliadoId) || !Number.isInteger(productId) || !Number.isInteger(indice) || indice < 0) return null;
  const datos = limpiarUnidad(u);
  if (unidadVacia(datos)) return null;
  return { ...datos, aliadoId, productId, indice, equipo: typeof u.equipo === 'string' ? u.equipo : '' };
}

/**
 * "Eco. 12 · placas RX-12-345", solo si la eligió un aliado que sigue en el
 * servicio (`aliados`: los que lo aceptaron). Si se bajó, no se enseña.
 */
export function textoUnidadAsignada(requirements: unknown, aliados: number[]): string | null {
  const u = unidadAsignadaDe(requirements);
  return u && aliados.includes(u.aliadoId) ? textoUnidad(u) : null;
}

/**
 * SIN ELEGIR, LA ÚNICA QUE PUEDE IR. Si el aliado no ha dicho cuál va pero lo
 * apartado para el folio es un equipo de UNA sola unidad identificada, es esa:
 * no tiene otra. Así el panel tiene las placas sin que nadie tenga que
 * apretar nada. Folio → quién y cuál.
 */
export async function unidadApartadaPorFolio(folios: string[]): Promise<Map<string, { aliadoId: number; texto: string }>> {
  const mapa = new Map<string, { aliadoId: number; texto: string }>();
  if (!folios.length) return mapa;
  const bloques = await prisma.availability_blocks.findMany({
    where: { note: { in: folios.map((f) => `${PREFIJO_RESERVA}${f}`) } },
    select: { product_id: true, note: true },
  });
  if (!bloques.length) return mapa;
  const productos = await prisma.products.findMany({
    where: { id: { in: [...new Set(bloques.map((b) => b.product_id))] } },
    select: { id: true, provider_id: true, stock: true, attributes: true },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));
  const porFolio = new Map<string, Set<number>>();
  for (const b of bloques) {
    const f = (b.note ?? '').slice(PREFIJO_RESERVA.length);
    porFolio.set(f, (porFolio.get(f) ?? new Set()).add(b.product_id));
  }
  for (const [folio, ids] of porFolio) {
    if (ids.size !== 1) continue;
    const p = porId.get([...ids][0]);
    if (!p || p.provider_id === null || (p.stock ?? 1) > 1) continue;
    const suyas = identificacionDe(p.attributes).filter((u) => !unidadVacia(u));
    if (suyas.length === 1) mapa.set(folio, { aliadoId: p.provider_id, texto: textoUnidad(suyas[0]) });
  }
  return mapa;
}

/**
 * QUÉ UNIDAD VA, PARA LOS CORREOS AL CLIENTE (2026-11-09). La que eligió el
 * aliado que sigue en el servicio; si no eligió, la única que pudo ir. Las
 * obras piden las placas para dejar entrar: con esto llegan en el correo.
 * Nunca lanza: sin dato, el correo sale sin la línea.
 */
export async function unidadParaCorreo(folio: string, requirements: unknown, aliados: number[]): Promise<string | null> {
  try {
    const elegida = textoUnidadAsignada(requirements, aliados);
    if (elegida) return elegida;
    const apartada = (await unidadApartadaPorFolio([folio])).get(folio);
    return apartada && aliados.includes(apartada.aliadoId) ? apartada.texto : null;
  } catch {
    return null;
  }
}
