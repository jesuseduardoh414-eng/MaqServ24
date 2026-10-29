import { prisma } from '@maqserv/db';
import { slugify } from '@maqserv/config';
import { ESTADO_CATEGORIA_PROPUESTA } from './ofertas';

const normal = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

/**
 * La categoría que propone un aliado (2026-10-28): si otro aliado ya propuso
 * una con el mismo nombre, se usa esa; si no, nace con
 * ESTADO_CATEGORIA_PROPUESTA. Nunca se junta sola con una categoría activa:
 * eso lo decide MAQSER24 en Categorías ("Es la misma que…").
 */
export async function categoriaPropuesta(nombre: string): Promise<{ id: number; slug: string; nombre: string }> {
  const limpio = nombre.trim().replace(/\s+/g, ' ').slice(0, 100);
  const propuestas = await prisma.categories.findMany({
    where: { status: ESTADO_CATEGORIA_PROPUESTA },
    select: { id: true, cat_slug: true, cat_name: true },
  });
  const igual = propuestas.find((c) => normal(c.cat_name) === normal(limpio));
  if (igual) return { id: igual.id, slug: igual.cat_slug, nombre: igual.cat_name };
  const base = `${slugify(limpio) || 'categoria'}-nueva`;
  let slug = base;
  for (let i = 2; await prisma.categories.findUnique({ where: { cat_slug: slug } }); i++) slug = `${base}-${i}`;
  const creada = await prisma.categories.create({
    data: { cat_name: limpio, cat_slug: slug, status: ESTADO_CATEGORIA_PROPUESTA, sort_order: 0 },
    select: { id: true, cat_slug: true, cat_name: true },
  });
  return { id: creada.id, slug: creada.cat_slug, nombre: creada.cat_name };
}
