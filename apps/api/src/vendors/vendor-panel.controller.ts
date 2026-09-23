import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param,
  ParseIntPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mediaStorage } from '../common/media-multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import type { VendorMe, VendorOrderRow, VendorProductRow, WithdrawRow } from '@maqserv/types';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { MarketplaceGuard } from './marketplace.guard';
import { sanitizeUserHtml } from '../common/sanitize';
import { imageUrl } from '../catalog/images';

const photoStorage = mediaStorage();

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|avif)$/;

const applySchema = z.object({
  shopName: z.string().min(2).max(190),
  shopNumber: z.string().max(50).optional(),
  shopAddress: z.string().max(250).optional(),
  regNumber: z.string().max(100).optional(),
  shopMessage: z.string().max(1000).optional(),
});

const productSchema = z.object({
  name: z.string().min(2).max(250),
  categoryId: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0),
  oldPrice: z.coerce.number().min(0).optional(),
  /**
   * La ficha pública pinta esto como HTML (`dangerouslySetInnerHTML`), y quien lo
   * escribe es un vendedor: código ajeno en la página de todos. Se limpia AQUÍ, en el
   * esquema, para que lo hereden crear y editar y no dependa de acordarse en cada sitio.
   * Ver `sanitizeUserHtml`.
   */
  description: z.string().min(4).max(10000).transform(sanitizeUserHtml),
  stock: z.coerce.number().int().min(0).optional(),
  brand: z.string().max(190).optional(),
  isRental: z.coerce.boolean().optional(),
  rentalFreight: z.coerce.number().min(0).optional(),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().min(2).max(100),
  accName: z.string().max(190).optional(),
  accEmail: z.string().email().max(190).optional(),
  iban: z.string().max(100).optional(),
  swift: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  address: z.string().max(400).optional(),
  reference: z.string().max(400).optional(),
});

@Controller('vendor')
// El marketplace primero: apagado, nada de esto existe (404), con o sin sesión.
@UseGuards(MarketplaceGuard, JwtGuard)
export class VendorPanelController {
  /** Estado 2 (aprobado) requerido para operar; lanza 403 si no. */
  private async requireVendor(userId: number) {
    const u = await prisma.users.findUnique({ where: { id: userId } });
    if (!u || u.is_vendor !== 2) throw new ForbiddenException('Tu cuenta no es un vendedor aprobado');
    return u;
  }

  @Get('me')
  async me(@Req() req: AuthedRequest): Promise<VendorMe> {
    const u = await prisma.users.findUnique({ where: { id: req.userId } });
    return {
      status: (u?.is_vendor ?? 0) as 0 | 1 | 2,
      shopName: u?.shop_name ?? null,
      balance: u?.current_balance ?? 0,
      // `shop_name` es la huella de haber solicitado: revocar/rechazar pone is_vendor
      // en 0 pero NO borra la solicitud. Con esto el sitio distingue a quien nunca
      // pidió (formulario) de a quien perdió el acceso (explicación).
      application: u?.shop_name
        ? {
          shopName: u.shop_name,
          shopNumber: u.shop_number,
          shopAddress: u.shop_address,
          regNumber: u.reg_number,
          shopMessage: u.shop_message,
        }
        : null,
    };
  }

  /** Solicitud para volverse vendedor (queda pendiente de aprobación en admin F4). */
  @Post('apply')
  async apply(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const u = await prisma.users.findUnique({ where: { id: req.userId } });
    if (!u) throw new BadRequestException();
    if (u.is_vendor !== 0) throw new BadRequestException('Ya tienes una solicitud o cuenta de vendedor');
    await prisma.users.update({
      where: { id: req.userId },
      data: {
        is_vendor: 1,
        shop_name: parsed.data.shopName,
        shop_number: parsed.data.shopNumber ?? null,
        shop_address: parsed.data.shopAddress ?? null,
        reg_number: parsed.data.regNumber ?? null,
        shop_message: parsed.data.shopMessage ?? null,
        updated_at: new Date(),
      },
    });
    return { status: 1 };
  }

  // ---- Mis productos ----

  @Get('products')
  async myProducts(@Req() req: AuthedRequest): Promise<VendorProductRow[]> {
    await this.requireVendor(req.userId);
    const rows = await prisma.products.findMany({
      where: { user_id: req.userId },
      orderBy: { id: 'desc' },
      select: { id: true, name: true, cprice: true, stock: true, status: true, photo: true, is_rental: true },
    });
    return rows.map((p) => ({
      id: p.id,
      slug: productSlug(p.name, p.id),
      name: p.name,
      price: p.cprice,
      stock: p.stock,
      status: p.status,
      image: imageUrl(p.photo),
      isRental: p.is_rental,
    }));
  }

  @Post('products')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } }))
  async createProduct(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    await this.requireVendor(req.userId);
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) {
      throw new BadRequestException('La foto debe ser png/jpg/webp/avif');
    }
    const cat = await prisma.categories.findFirst({ where: { id: parsed.data.categoryId, status: 1 } });
    if (!cat) throw new BadRequestException('Categoría inválida');

    const p = await prisma.products.create({
      data: {
        user_id: req.userId,
        category_id: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description,
        cprice: parsed.data.price,
        pprice: parsed.data.oldPrice ?? null,
        stock: parsed.data.stock ?? null,
        Marca: parsed.data.brand ?? null,
        is_rental: parsed.data.isRental ?? false,
        rental_freight: parsed.data.rentalFreight ?? null,
        photo: photo ? `uploads/${photo.filename}` : null,
        status: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { id: p.id, slug: productSlug(p.name, p.id) };
  }

  @Patch('products/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } }))
  async updateProduct(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    await this.requireVendor(req.userId);
    const existing = await prisma.products.findFirst({ where: { id, user_id: req.userId } });
    if (!existing) throw new ForbiddenException('Ese producto no es tuyo');
    const parsed = productSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) {
      throw new BadRequestException('La foto debe ser png/jpg/webp/avif');
    }

    await prisma.products.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.categoryId !== undefined ? { category_id: parsed.data.categoryId } : {}),
        ...(parsed.data.price !== undefined ? { cprice: parsed.data.price } : {}),
        ...(parsed.data.oldPrice !== undefined ? { pprice: parsed.data.oldPrice } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.stock !== undefined ? { stock: parsed.data.stock } : {}),
        ...(parsed.data.brand !== undefined ? { Marca: parsed.data.brand } : {}),
        ...(parsed.data.isRental !== undefined ? { is_rental: parsed.data.isRental } : {}),
        ...(parsed.data.rentalFreight !== undefined ? { rental_freight: parsed.data.rentalFreight } : {}),
        ...(photo ? { photo: `uploads/${photo.filename}` } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  /** Baja lógica (status 0), como el "deactive" del legacy. */
  @Delete('products/:id')
  async deleteProduct(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.requireVendor(req.userId);
    const existing = await prisma.products.findFirst({ where: { id, user_id: req.userId } });
    if (!existing) throw new ForbiddenException('Ese producto no es tuyo');
    await prisma.products.update({ where: { id }, data: { status: 0, updated_at: new Date() } });
    return { ok: true };
  }

  // ---- Mis órdenes ----

  @Get('orders')
  async myOrders(@Req() req: AuthedRequest): Promise<VendorOrderRow[]> {
    await this.requireVendor(req.userId);
    const rows = await prisma.vendor_orders.findMany({
      where: { user_id: req.userId },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      qty: o.qty,
      price: o.price,
      status: o.status,
    }));
  }

  // ---- Retiros ----

  @Get('withdraws')
  async myWithdraws(@Req() req: AuthedRequest): Promise<WithdrawRow[]> {
    await this.requireVendor(req.userId);
    const rows = await prisma.withdraws.findMany({
      where: { user_id: req.userId },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return rows.map((w) => ({
      id: w.id,
      amount: w.amount ?? 0,
      fee: w.fee ?? 0,
      method: w.method,
      status: w.status,
      reference: w.reference,
      note: w.admin_note,
      createdAt: w.created_at ? w.created_at.toISOString() : null,
    }));
  }

  /** Descuenta el saldo al solicitar (evita doble retiro); el admin (F4) reembolsa si rechaza. */
  @Post('withdraws')
  async requestWithdraw(@Req() req: AuthedRequest, @Body() body: unknown) {
    const vendor = await this.requireVendor(req.userId);
    const parsed = withdrawSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const amount = Math.round(parsed.data.amount * 100) / 100;
    if (amount > vendor.current_balance) {
      throw new BadRequestException('El monto excede tu saldo disponible');
    }

    const [w] = await prisma.$transaction([
      prisma.withdraws.create({
        data: {
          user_id: req.userId,
          amount,
          fee: 0,
          method: parsed.data.method,
          acc_name: parsed.data.accName ?? null,
          acc_email: parsed.data.accEmail ?? null,
          iban: parsed.data.iban ?? null,
          swift: parsed.data.swift ?? null,
          country: parsed.data.country ?? null,
          address: parsed.data.address ?? null,
          reference: parsed.data.reference ?? null,
          status: 'pending',
          type: 'vendor',
          created_at: new Date(),
          updated_at: new Date(),
        },
      }),
      prisma.users.update({
        where: { id: req.userId },
        data: { current_balance: { decrement: Math.round(amount) } },
      }),
    ]);
    return { id: w.id, status: w.status };
  }
}
