import { Injectable } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { Category } from '@maqserv/types';
import { imageUrl } from './images';

@Injectable()
export class CategoriesService {
  async list(): Promise<Category[]> {
    const [cats, counts] = await Promise.all([
      // Primero el orden que fijó el cliente (sort_order 1..n); las que no lo
      // tienen (0) van al final por nombre.
      prisma.categories.findMany({ where: { status: 1 }, orderBy: [{ sort_order: 'asc' }, { cat_name: 'asc' }] }),
      prisma.products.groupBy({
        by: ['category_id'],
        where: { status: 1 },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.category_id, c._count._all]));
    return cats.map((c) => ({
      id: c.id,
      name: c.cat_name,
      slug: c.cat_slug,
      image: imageUrl(c.photo),
      description: c.description?.trim() || null,
      productCount: countMap.get(c.id) ?? 0,
    }));
  }
}
