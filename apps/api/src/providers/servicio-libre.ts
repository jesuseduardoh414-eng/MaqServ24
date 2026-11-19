import { prisma } from '@maqserv/db';
import type { LineaRegistro } from '@maqserv/config';

/**
 * LO QUE UN PROVEEDOR ESCRIBE LIBRE AL REGISTRARSE (2026-11-18, el dueño: «en
 * el registro de los proveedores pueden meter lo que sea, cualquier servicio,
 * ya que eso no va a ir en el sitio público»).
 *
 * Cada renglón («Grúa 30 t», «Retroexcavadora 416», «Renta de baños») se
 * guarda como servicio suyo. Para que se agrupe con lo que MAQSER24 maneja se
 * acomoda solo: en el tipo de MAQSER24 si lo nombra completo, si no en la línea
 * cuya palabra principal aparece, y si nada coincide en «Otros servicios de
 * proveedores», una línea apagada que no sale en el sitio. Nada pasa por
 * Categorías ni espera a que alguien lo clasifique.
 */
export const LINEA_OTROS = { slug: 'otros-servicios-de-proveedores', nombre: 'Otros servicios de proveedores' };

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'en', 'y', 'a', 'un', 'una', 'renta', 'venta', 'servicio', 'servicios']);

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Palabras que cuentan, sin plurales: «Grúas de 30 t» → grua, 30. */
function palabras(s: string): string[] {
  return norm(s)
    .split(' ')
    .filter((w) => w && !VACIAS.has(w) && (w.length > 1 || /\d/.test(w)))
    .map((w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** La palabra al principio de una palabra del texto: «retro» no encuentra «excavadora». */
const tiene = (texto: string, w: string) => ` ${texto}`.includes(` ${w}`);

/** El tipo de MAQSER24 (si lo nombra completo) o la línea por su palabra principal; null = otros. */
export function clasificarServicio(nombre: string, lineas: LineaRegistro[]): { slug: string; tipoId: number | null } | null {
  const texto = palabras(nombre).join(' ');
  if (!texto) return null;
  let mejor: { slug: string; tipoId: number; n: number } | null = null;
  for (const l of lineas) {
    for (const t of l.tipos) {
      const ws = palabras(t.nombre);
      if (ws.length && ws.every((w) => tiene(texto, w)) && (!mejor || ws.length > mejor.n)) mejor = { slug: l.slug, tipoId: t.id, n: ws.length };
    }
  }
  if (mejor) return { slug: mejor.slug, tipoId: mejor.tipoId };
  for (const l of lineas) {
    const principales = [palabras(l.nombre)[0], ...l.tipos.map((t) => palabras(t.nombre)[0])].filter((w): w is string => !!w && w.length > 2);
    if (principales.some((w) => tiene(texto, w))) return { slug: l.slug, tipoId: null };
  }
  return null;
}

/** La línea «Otros servicios de proveedores» (apagada: no sale en el sitio). Se crea la primera vez. */
export async function lineaOtros(): Promise<{ id: number; slug: string }> {
  const ya = await prisma.categories.findUnique({ where: { cat_slug: LINEA_OTROS.slug }, select: { id: true, cat_slug: true } });
  if (ya) return { id: ya.id, slug: ya.cat_slug };
  const ultima = await prisma.categories.aggregate({ _max: { sort_order: true } });
  const c = await prisma.categories.create({
    data: { cat_name: LINEA_OTROS.nombre, cat_slug: LINEA_OTROS.slug, status: 0, sort_order: (ultima._max.sort_order ?? 0) + 1 },
    select: { id: true, cat_slug: true },
  });
  return { id: c.id, slug: c.cat_slug };
}
