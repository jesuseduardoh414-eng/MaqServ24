import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import type { ProductCard } from '@maqserv/types';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { imageUrl } from '../catalog/images';

@Controller('wishlist')
@UseGuards(JwtGuard)
export class WishlistController {
  /** Alterna favorito; devuelve el estado final. */
  @Post('toggle')
  async toggle(@Req() req: AuthedRequest, @Body() body: { productId?: number }) {
    const productId = Number(body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new BadRequestException('productId inválido');
    }
    const existing = await prisma.wishlists.findFirst({
      where: { user_id: req.userId, product_id: productId },
    });
    if (existing) {
      await prisma.wishlists.delete({ where: { id: existing.id } });
      return { inWishlist: false };
    }
    await prisma.wishlists.create({ data: { user_id: req.userId, product_id: productId } });
    return { inWishlist: true };
  }

  /** Ids para pintar corazones sin cargar productos completos. */
  @Get('ids')
  async ids(@Req() req: AuthedRequest): Promise<number[]> {
    const rows = await prisma.wishlists.findMany({
      where: { user_id: req.userId },
      select: { product_id: true },
    });
    return rows.map((r) => r.product_id);
  }

  @Get()
  async list(@Req() req: AuthedRequest): Promise<ProductCard[]> {
    const rows = await prisma.wishlists.findMany({ where: { user_id: req.userId } });
    if (rows.length === 0) return [];
    const products = await prisma.products.findMany({
      where: { id: { in: rows.map((r) => r.product_id) }, status: 1 },
      select: {
        id: true, name: true, Marca: true, cprice: true, pprice: true,
        photo: true, is_rental: true, featured: true, stock: true, category_id: true,
      },
    });
    const cats = await prisma.categories.findMany({ select: { id: true, cat_slug: true } });
    const catMap = new Map(cats.map((c) => [c.id, c.cat_slug]));
    return products.map((p) => ({
      id: p.id,
      slug: productSlug(p.name, p.id),
      name: p.name,
      brand: p.Marca,
      price: p.cprice > 0 ? p.cprice : null,
      oldPrice: p.pprice && p.pprice > 0 ? p.pprice : null,
      image: imageUrl(p.photo),
      isRental: p.is_rental,
      featured: p.featured === 1,
      inStock: p.stock === null || p.stock > 0,
      stock: p.stock,
      categorySlug: catMap.get(p.category_id) ?? null,
    }));
  }
}
