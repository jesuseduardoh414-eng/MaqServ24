import { Injectable } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { Category } from '@maqserv/types';
import { imageUrl } from './images';

/**
 * Primero el orden que fijó el cliente (sort_order 1..n, Catálogo → Categorías);
 * las que no lo tienen (0) van al final por nombre. Ordenar por sort_order en
 * la consulta las ponía AL PRINCIPIO: las líneas recreadas desde el panel
 * quedaron en 0 y la banda del inicio salía alfabética con Renta al final.
 * Llega ya ordenada por (sort_order, nombre): basta mover los ceros al final.
 */
export function ordenDeCategorias<T extends { sort_order: number }>(cats: T[]): T[] {
  return [...cats.filter((c) => c.sort_order > 0), ...cats.filter((c) => c.sort_order <= 0)];
}

@Injectable()
export class CategoriesService {
  async list(): Promise<Category[]> {
    const [todas, counts] = await Promise.all([
      prisma.categories.findMany({ where: { status: 1 }, orderBy: [{ sort_order: 'asc' }, { cat_name: 'asc' }] }),
      prisma.products.groupBy({
        by: ['category_id'],
        where: { status: 1 },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.category_id, c._count._all]));
    const cats = ordenDeCategorias(todas);
    return cats.map((c) => ({
      id: c.id,
      name: c.cat_name,
      slug: c.cat_slug,
      image: imageUrl(c.photo),
      video: imageUrl(c.video),
      description: c.description?.trim() || null,
      productCount: countMap.get(c.id) ?? 0,
    }));
  }
}
