import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { ProductComment, ProductCommentsSummary } from '@maqserv/types';

/**
 * Opiniones/reseñas de producto (tabla `comments`). Solo LECTURA de las
 * aprobadas (status=1). La creación es verificada por compra y vive en
 * account/reviews.controller (`POST /account/reviews`).
 */
@Controller('catalog/products/:id/comments')
export class CommentsController {
  @Get()
  async list(@Param('id', ParseIntPipe) productId: number): Promise<ProductCommentsSummary> {
    const where = { product_id: productId, status: 1 };
    // El promedio y el total salen de un AGGREGATE sobre TODAS las reseñas del
    // producto; antes se calculaban sobre las últimas 50 y `count` reportaba
    // ese corte como total. Los comentarios legacy sin rating quedan FUERA del
    // promedio (contarlos como 5★ inflaba la calificación).
    const [rows, stats] = await Promise.all([
      prisma.comments.findMany({ where, orderBy: { id: 'desc' }, take: 50 }),
      prisma.comments.aggregate({ where, _count: { _all: true }, _avg: { rating: true } }),
    ]);
    const users = await prisma.users.findMany({
      where: { id: { in: rows.map((r) => r.user_id) } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));

    const items: ProductComment[] = rows.map((r) => ({
      id: r.id,
      author: names.get(r.user_id) ?? 'Cliente',
      rating: Math.max(1, Math.min(5, r.rating ?? 5)),
      text: r.text,
      date: r.created_at ? r.created_at.toISOString() : null,
      verified: r.order_id != null,
    }));
    const count = stats._count._all;
    const average = stats._avg.rating === null ? 0 : Math.round(stats._avg.rating * 10) / 10;
    return { items, average, count };
  }
}
