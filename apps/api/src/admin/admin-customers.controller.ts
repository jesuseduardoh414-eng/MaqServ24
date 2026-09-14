import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import { toFulfillment, toVendorState } from '@maqserv/types';
import { AdminGuard, Modulo } from './admin-auth';
import { parseCart } from '../orders/cart.util';

/**
 * Clientes → la gente registrada en el sitio (75 reales). Solo lectura: aquí se
 * consulta a quién le vendes, no se edita (el cliente edita su perfil en /cuenta).
 *
 * Vivía en `admin-community` junto con reseñas y preguntas; se separó porque no es
 * comunidad y porque la lista necesitaba señales propias.
 */
const PAGE_SIZE = 20;

/** Segmentos útiles: la lista completa mezcla compradores con basura del sistema viejo. */
type Segment = 'compradores' | 'vendedores';

const VENDORS_WHERE = { is_vendor: { gt: 0 } };

/**
 * Ids de quienes han comprado.
 *
 * `users` NO declara relación con `orders`: el esquema viene de la introspección del
 * Laravel viejo, que no tiene llaves foráneas. Por eso no se puede filtrar con
 * `{ orders: { some: {} } }` (Prisma lo rechaza) y los ids hay que resolverlos aparte.
 */
async function buyerIds(): Promise<number[]> {
  const rows = await prisma.orders.groupBy({ by: ['user_id'] });
  return rows.map((r) => r.user_id);
}

@Modulo('comunidad')
@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminCustomersController {
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
  ) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    const seg: Segment | null = segment === 'compradores' || segment === 'vendedores' ? segment : null;
    const buyers = await buyerIds();
    const where: Record<string, unknown> =
      seg === 'compradores' ? { id: { in: buyers } }
        : seg === 'vendedores' ? { ...VENDORS_WHERE }
          : {};

    // Sin `mode`: la colación utf8mb4_unicode_ci de MySQL ya ignora mayúsculas y acentos (Postgres necesitaba `mode: 'insensitive'`, que MySQL no admite).
    // Sin esto, buscar "prueba" no encontraba a "Cliente Prueba" y "PRUEBA" no
    // encontraba nada — el buscador mentía en silencio.
    const term = search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } },
      ];
    }

    // Todo lo que no dependa de nada más va JUNTO: cada consulta a Supabase cuesta un
    // viaje de red (~100 ms), así que lo que importa es cuántas van en serie, no cuántas
    // hay. `compradores` estaba suelto en su propio `await` y sumaba un viaje entero.
    const [total, rows, vendedores, all, compradores] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, name: true, email: true, phone: true, is_vendor: true, created_at: true },
      }),
      prisma.users.count({ where: VENDORS_WHERE }),
      prisma.users.count(),
      // Un `user_id` de una orden puede apuntar a un usuario borrado (pasa con la data
      // de 2021): se cuentan los que existen, no los ids sueltos.
      prisma.users.count({ where: { id: { in: buyers } } }),
    ]);

    const ids = rows.map((u) => u.id);
    // Órdenes y monto en UN agregado, solo de los de esta página.
    // Se excluyen las canceladas: sumarlas inflaría lo que el cliente realmente pidió.
    const agg = ids.length
      ? await prisma.orders.groupBy({
        by: ['user_id'],
        where: { user_id: { in: ids }, status: { not: 'declined' } },
        _count: { _all: true },
        _sum: { pay_amount: true },
      })
      : [];
    const byUser = new Map(agg.map((a) => [a.user_id, a]));

    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts: { all, compradores, vendedores },
      items: rows.map((u) => {
        const a = byUser.get(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          // El estado real, no solo "es vendedor aprobado": un solicitante pendiente
          // también importa. `is_vendor` 0 sin tienda = cliente normal.
          vendorState: u.is_vendor > 0 ? toVendorState(u.is_vendor) : null,
          orders: a?._count._all ?? 0,
          spent: a?._sum.pay_amount ?? 0,
          createdAt: u.created_at ? u.created_at.toISOString() : null,
        };
      }),
    };
  }

  /** Ficha del cliente: la lista decía "4 pedidos" pero no había forma de verlos. */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const u = await prisma.users.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Cliente no encontrado');

    const [orders, quotes, comments, questions] = await Promise.all([
      prisma.orders.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 50 }),
      prisma.quotes.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 20 }),
      prisma.comments.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 20 }),
      prisma.product_questions.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 20 }),
    ]);

    const productIds = [...new Set([...comments.map((c) => c.product_id), ...questions.map((q) => q.product_id)])];
    const products = productIds.length
      ? await prisma.products.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : [];
    const pName = new Map(products.map((p) => [p.id, p.name]));

    const live = orders.filter((o) => o.status !== 'declined');
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.created_at ? u.created_at.toISOString() : null,
      vendorState: u.is_vendor > 0 ? toVendorState(u.is_vendor) : null,
      shopName: u.shop_name,
      profile: {
        address: u.address,
        city: u.city,
        zip: u.zip,
        residency: u.residency,
      },
      stats: {
        orders: live.length,
        spent: live.reduce((s, o) => s + o.pay_amount, 0),
        quotes: quotes.length,
        comments: comments.length,
        questions: questions.length,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        total: o.pay_amount,
        status: o.status,
        paymentStatus: o.payment_status,
        // Estado del ENVÍO (módulo de envíos); null en órdenes que nunca pasaron por él.
        fulfillment: toFulfillment(o.fulfillment),
        items: parseCart(o.cart).items.length,
        createdAt: o.created_at ? o.created_at.toISOString() : null,
      })),
      quotes: quotes.map((q) => ({
        id: Number(q.id),
        quoteNumber: q.quote_number,
        total: Number(q.total),
        status: q.status,
        createdAt: q.created_at ? q.created_at.toISOString() : null,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        productId: c.product_id,
        product: pName.get(c.product_id) ?? `#${c.product_id}`,
        slug: productSlug(pName.get(c.product_id) ?? '', c.product_id),
        rating: c.rating,
        text: c.text,
        status: c.status,
        createdAt: c.created_at.toISOString(),
      })),
      questions: questions.map((q) => ({
        id: q.id,
        productId: q.product_id,
        product: pName.get(q.product_id) ?? `#${q.product_id}`,
        question: q.question,
        answered: Boolean(q.answer),
        createdAt: q.created_at.toISOString(),
      })),
    };
  }
}
