import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { VendorPublic } from '@maqserv/types';
import { imageUrl } from '../catalog/images';
import { ProductsService } from '../catalog/products.service';
import { MarketplaceGuard } from './marketplace.guard';

/** Marketplace público: directorio de vendedores y su tienda. Apagado, 404 (ver el guard). */
@Controller('vendors')
@UseGuards(MarketplaceGuard)
export class VendorsController {
  constructor(private readonly products: ProductsService) {}

  private toPublic(u: {
    id: number; shop_name: string | null; owner_name: string | null; name: string;
    photo: string | null; shop_address: string | null; shop_number: string | null;
    shop_details: string | null;
  }, productCount: number): VendorPublic {
    return {
      id: u.id,
      shopName: u.shop_name ?? u.name,
      ownerName: u.owner_name ?? u.name,
      photo: imageUrl(u.photo),
      shopAddress: u.shop_address,
      shopNumber: u.shop_number,
      shopDetails: u.shop_details,
      productCount,
    };
  }

  @Get()
  async list(): Promise<VendorPublic[]> {
    const vendors = await prisma.users.findMany({
      where: { is_vendor: 2 },
      orderBy: { id: 'desc' },
    });
    if (vendors.length === 0) return [];
    const counts = await prisma.products.groupBy({
      by: ['user_id'],
      where: { user_id: { in: vendors.map((v) => v.id) }, status: 1 },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.user_id, c._count._all]));
    return vendors.map((v) => this.toPublic(v, countMap.get(v.id) ?? 0));
  }

  @Get(':id')
  async byId(@Param('id', ParseIntPipe) id: number, @Query('page') page?: string) {
    const v = await prisma.users.findFirst({ where: { id, is_vendor: 2 } });
    if (!v) throw new NotFoundException('Vendedor no encontrado');
    const products = await this.products.list({
      page: page ? Number(page) : 1,
      vendorId: id,
    });
    return { vendor: this.toPublic(v, products.total), products };
  }
}
