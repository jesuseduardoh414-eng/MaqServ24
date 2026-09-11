import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Query, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import { VENDOR_STATE, type VendorState } from '@maqserv/types';
import { AdminGuard, Modulo } from './admin-auth';
import { imageUrl } from '../catalog/images';

/**
 * Marketplace → Vendedores. Esta pantalla es la PUERTA del marketplace: un cliente
 * solicita vender desde el sitio (`POST /vendor/apply` → is_vendor 1) y aquí se
 * aprueba (2) o se revoca (0). Solo con is_vendor=2 puede publicar productos,
 * ver sus ventas y pedir retiros.
 *
 * `is_vendor` es la fuente de verdad: 0 = sin acceso · 1 = pendiente · 2 = aprobado.
 * OJO: 0 es también el default de CUALQUIER cliente (74 de 75 usuarios reales), así
 * que un revocado NO es "is_vendor = 0" a secas — es 0 **con `shop_name`**, o sea
 * alguien que alguna vez solicitó. Sin ese matiz la pestaña "Revocados" listaría a
 * todos los clientes del sitio.
 */
const WHERE: Record<VendorState, Record<string, unknown>> = {
  pendiente: { is_vendor: 1 },
  aprobado: { is_vendor: 2 },
  revocado: { is_vendor: 0, shop_name: { not: null } },
};
/** Todos los que alguna vez fueron/quisieron ser vendedores. */
const ANY_VENDOR = { OR: [{ is_vendor: { in: [1, 2] } }, { is_vendor: 0, shop_name: { not: null } }] };

/** Orden de trabajo de la lista: pendiente → aprobado → revocado. */
const RANK: Record<number, number> = { 1: 0, 2: 1, 0: 2 };

const toState = (raw: string | undefined): VendorState | null =>
  raw && Object.prototype.hasOwnProperty.call(WHERE, raw) ? (raw as VendorState) : null;

@Modulo('marketplace')
@Controller('admin/vendors')
@UseGuards(AdminGuard)
export class AdminVendorsController {
  @Get()
  async list(@Query('state') state?: string) {
    const st = toState(state);
    const where = st ? WHERE[st] : ANY_VENDOR;

    const rows = await prisma.users.findMany({
      where,
      orderBy: { id: 'desc' },
      select: {
        id: true, name: true, email: true, shop_name: true,
        is_vendor: true, current_balance: true, created_at: true,
      },
    });
    // Pendientes primero: son los únicos que esperan una decisión. No sale de un
    // `orderBy` porque el orden útil (1 → 2 → 0) no es el numérico. `sort` es estable,
    // así que dentro de cada grupo se conserva el id desc. La lista son todos los
    // vendedores que han existido: cabe de sobra en memoria.
    rows.sort((a, b) => (RANK[a.is_vendor] ?? 3) - (RANK[b.is_vendor] ?? 3));

    // Contadores de las pestañas: 3 queries fijas, no una por vendedor.
    const [pendiente, aprobado, revocado] = await Promise.all([
      prisma.users.count({ where: WHERE.pendiente }),
      prisma.users.count({ where: WHERE.aprobado }),
      prisma.users.count({ where: WHERE.revocado }),
    ]);

    const ids = rows.map((r) => r.id);
    const signals = await this.signals(ids);

    return {
      counts: { pendiente, aprobado, revocado, all: pendiente + aprobado + revocado },
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        shopName: u.shop_name,
        status: u.is_vendor,
        balance: u.current_balance,
        createdAt: u.created_at ? u.created_at.toISOString() : null,
        ...(signals.get(u.id) ?? { products: 0, sales: 0, sold: 0, pendingWithdraws: 0 }),
      })),
    };
  }

  /**
   * Señales de actividad de varios vendedores en 3 agregados (nunca una consulta por
   * fila): con esto se distingue un vendedor vivo de uno que solo ocupa lugar.
   */
  private async signals(ids: number[]) {
    const out = new Map<number, { products: number; sales: number; sold: number; pendingWithdraws: number }>();
    if (ids.length === 0) return out;

    const [products, sales, withdraws] = await Promise.all([
      prisma.products.groupBy({ by: ['user_id'], where: { user_id: { in: ids }, status: 1 }, _count: { _all: true } }),
      prisma.vendor_orders.groupBy({ by: ['user_id'], where: { user_id: { in: ids } }, _count: { _all: true }, _sum: { price: true } }),
      prisma.withdraws.groupBy({ by: ['user_id'], where: { user_id: { in: ids }, status: 'pending' }, _count: { _all: true } }),
    ]);

    const get = (id: number) => {
      const v = out.get(id) ?? { products: 0, sales: 0, sold: 0, pendingWithdraws: 0 };
      out.set(id, v);
      return v;
    };
    for (const p of products) get(p.user_id).products = p._count._all;
    for (const s of sales) {
      const v = get(s.user_id);
      v.sales = s._count._all;
      v.sold = s._sum.price ?? 0;
    }
    for (const w of withdraws) if (w.user_id) get(w.user_id).pendingWithdraws = w._count._all;
    return out;
  }

  /**
   * Detalle del vendedor. Existe porque la lista no alcanza para DECIDIR: los datos
   * de la solicitud (`shop_message`, `reg_number`, dirección, teléfono) se capturan
   * en `/vendor/apply` y hasta ahora no se mostraban en ningún lado — el admin
   * aprobaba a ciegas.
   */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const u = await prisma.users.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Vendedor no encontrado');
    if (u.is_vendor === 0 && !u.shop_name) {
      throw new NotFoundException('Ese usuario nunca solicitó ser vendedor');
    }

    // Las listas van acotadas, así que los totales se cuentan aparte: si no, un
    // vendedor con 60 productos rotularía "de 50" (mentira del `take`).
    const [products, orders, withdraws, productTotal, activeTotal] = await Promise.all([
      prisma.products.findMany({
        where: { user_id: id },
        orderBy: { id: 'desc' },
        take: 50,
        select: { id: true, name: true, cprice: true, stock: true, status: true, photo: true, is_rental: true },
      }),
      prisma.vendor_orders.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 50 }),
      prisma.withdraws.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 50 }),
      prisma.products.count({ where: { user_id: id } }),
      prisma.products.count({ where: { user_id: id, status: 1 } }),
    ]);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.is_vendor,
      balance: u.current_balance,
      createdAt: u.created_at ? u.created_at.toISOString() : null,
      productTotal,
      activeTotal,
      // La solicitud: esto es lo que se necesita para decidir.
      application: {
        shopName: u.shop_name,
        ownerName: u.owner_name,
        shopNumber: u.shop_number,
        shopAddress: u.shop_address,
        regNumber: u.reg_number,
        shopMessage: u.shop_message,
        shopDetails: u.shop_details,
      },
      products: products.map((p) => ({
        id: p.id,
        slug: productSlug(p.name, p.id),
        name: p.name,
        price: p.cprice,
        stock: p.stock,
        status: p.status,
        image: imageUrl(p.photo),
        isRental: p.is_rental,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        qty: o.qty,
        price: o.price,
        status: o.status,
      })),
      withdraws: withdraws.map((w) => ({
        id: w.id,
        amount: w.amount ?? 0,
        method: w.method,
        reference: w.reference,
        status: w.status,
        createdAt: w.created_at ? w.created_at.toISOString() : null,
      })),
    };
  }

  /** Aprobar (2), regresar a pendiente (1) o revocar (0). */
  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: { status?: number }) {
    const status = Number(body?.status);
    if (![0, 1, 2].includes(status)) throw new BadRequestException('status debe ser 0, 1 o 2');
    const u = await prisma.users.findUnique({ where: { id }, select: { id: true, shop_name: true } });
    if (!u) throw new NotFoundException('Vendedor no encontrado');
    // Sin `shop_name` no hay solicitud que aprobar (y aprobar a un cliente cualquiera
    // le abriría el panel de vendedor sin haber pedido nada).
    if (status !== 0 && !u.shop_name) throw new BadRequestException('Ese usuario no tiene una solicitud de vendedor');

    await prisma.users.update({ where: { id }, data: { is_vendor: status, updated_at: new Date() } });
    return { ok: true, state: VENDOR_STATE[status as 0 | 1 | 2] };
  }
}
