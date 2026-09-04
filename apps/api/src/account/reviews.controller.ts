import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { imageUrl } from '../catalog/images';
import { parseCartItems } from '../orders/cart.util';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';

const reviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(3).max(2000),
});

/**
 * Reseñas ligadas a una COMPRA (modelo tipo MercadoLibre). El cliente solo puede
 * opinar sobre productos que compró; la reseña se guarda en `comments` con
 * order_id (compra verificada) y status=1 (visible al instante, moderable).
 */
@Controller('account/reviews')
export class ReviewsController {
  /**
   * Órdenes que habilitan reseña: PAGADAS y no canceladas. Una orden creada y
   * jamás pagada (o cancelada) no es una compra — antes bastaba crear la orden
   * gratis para ganar el sello "compra verificada". El `select` deja fuera las
   * ~40 columnas que no se usan (el `cart` sí hace falta: trae los productos).
   */
  private comprasDe(userId: number) {
    return prisma.orders.findMany({
      where: {
        user_id: userId,
        payment_status: 'Completed',
        OR: [{ fulfillment: null }, { fulfillment: { not: 'cancelado' } }],
      },
      select: { id: true, order_number: true, cart: true, created_at: true },
      orderBy: { id: 'desc' },
      take: 100,
    });
  }

  /** Productos que el usuario compró (dedup) + si ya los reseñó. Alimenta "Mis compras". */
  @Get('reviewable')
  @UseGuards(JwtGuard)
  async reviewable(@Req() req: AuthedRequest) {
    const orders = await this.comprasDe(req.userId);
    const seen = new Map<number, { productId: number; name: string; image: string | null; orderNumber: string; date: string | null }>();
    for (const o of orders) {
      for (const it of parseCartItems(o.cart)) {
        if (!seen.has(it.productId)) {
          seen.set(it.productId, { productId: it.productId, name: it.name, image: imageUrl(it.image), orderNumber: o.order_number, date: o.created_at ? o.created_at.toISOString() : null });
        }
      }
    }
    const ids = [...seen.keys()];
    const mine = ids.length ? await prisma.comments.findMany({ where: { user_id: req.userId, product_id: { in: ids } } }) : [];
    const byProduct = new Map(mine.map((c) => [c.product_id, c]));
    return [...seen.values()].map((p) => {
      const c = byProduct.get(p.productId);
      return { ...p, reviewed: !!c, myRating: c?.rating ?? null, myText: c?.text ?? null };
    });
  }

  /** Crea o actualiza la reseña del usuario para un producto que compró. */
  @Post()
  @UseGuards(JwtGuard)
  async submit(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const { productId, rating, text } = parsed.data;

    // Verificar compra: alguna orden PAGADA y no cancelada que contenga el producto.
    const orders = await this.comprasDe(req.userId);
    let orderId: number | null = null;
    for (const o of orders) {
      if (parseCartItems(o.cart).some((it) => it.productId === productId)) { orderId = o.id; break; }
    }
    if (!orderId) throw new ForbiddenException('Solo puedes opinar sobre productos que compraste.');

    // Una reseña por usuario+producto: UPSERT sobre el unique de la tabla.
    // Antes era findFirst+create y dos envíos simultáneos creaban dos filas.
    await prisma.comments.upsert({
      where: { user_id_product_id: { user_id: req.userId, product_id: productId } },
      update: { text, rating, status: 1, order_id: orderId, updated_at: new Date() },
      create: { user_id: req.userId, product_id: productId, text, rating, status: 1, order_id: orderId, created_at: new Date(), updated_at: new Date() },
    });
    return { ok: true };
  }
}
