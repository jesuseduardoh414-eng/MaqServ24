import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import { AdminGuard, Modulo } from './admin-auth';

/**
 * Cuentas del sitio → la gente registrada. Solo lectura: aquí se consulta quién
 * entra al sitio y para quién pide; el cliente edita su perfil en /cuenta.
 *
 * CUENTA → EMPRESAS → OBRAS (2026-10-23). Una cuenta (`users`) puede pedir para
 * varias empresas (`clients.user_id`), y cada empresa tiene sus obras
 * (`client_sites`). Antes esta lista enseñaba "pedidos" y "gastado" del carrito
 * viejo, retirado el 2026-10-08: siempre salían en cero. Ahora enseña lo que
 * sí existe: sus empresas, sus obras y sus solicitudes.
 *
 * Vivía en `admin-community` junto con reseñas y preguntas; se separó porque no es
 * comunidad y porque la lista necesitaba señales propias.
 */
const PAGE_SIZE = 20;

/** "Han pedido": cuentas con al menos una solicitud. */
type Segment = 'piden';

/**
 * Ids de las cuentas que han pedido algo.
 *
 * `quotes.user_id` es BigInt y `users` no declara la relación (el esquema viene
 * de la introspección del Laravel viejo): se resuelven aparte.
 */
async function idsQuePiden(): Promise<number[]> {
  const rows = await prisma.quotes.groupBy({ by: ['user_id'], where: { user_id: { not: null } } });
  return rows.map((r) => Number(r.user_id));
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
    const seg: Segment | null = segment === 'piden' ? segment : null;
    const piden = await idsQuePiden();
    const where: Record<string, unknown> =
      seg === 'piden' ? { id: { in: piden } } : {};

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

    // Todo lo que no dependa de nada más va JUNTO: cada consulta cuesta un viaje
    // de red, así que lo que importa es cuántas van en serie, no cuántas hay.
    const [total, rows, all, conPedido] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, name: true, email: true, phone: true, created_at: true },
      }),
      prisma.users.count(),
      // Un `user_id` de una solicitud puede apuntar a una cuenta borrada: se
      // cuentan las que existen, no los ids sueltos.
      prisma.users.count({ where: { id: { in: piden } } }),
    ]);

    // Empresas, obras y solicitudes SOLO de los de esta página, en tres consultas.
    const ids = rows.map((u) => u.id);
    const [empresas, solicitudes] = ids.length
      ? await Promise.all([
          prisma.clients.findMany({
            where: { user_id: { in: ids } },
            orderBy: { id: 'asc' },
            select: { id: true, name: true, user_id: true, _count: { select: { client_sites: { where: { status: 1 } } } } },
          }),
          prisma.quotes.groupBy({
            by: ['user_id'],
            where: { user_id: { in: ids.map((i) => BigInt(i)) } },
            _count: { _all: true },
            _max: { created_at: true },
          }),
        ])
      : [[], []];
    const porSolic = new Map(solicitudes.map((s) => [Number(s.user_id), s]));

    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts: { all, piden: conPedido },
      items: rows.map((u) => {
        const suyas = empresas.filter((e) => e.user_id === u.id);
        const s = porSolic.get(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          empresas: suyas.map((e) => ({ id: e.id, name: e.name })),
          sites: suyas.reduce((n, e) => n + e._count.client_sites, 0),
          quotes: s?._count._all ?? 0,
          lastQuoteAt: s?._max.created_at ? s._max.created_at.toISOString() : null,
          createdAt: u.created_at ? u.created_at.toISOString() : null,
        };
      }),
    };
  }

  /**
   * Ficha de la cuenta: sus empresas con sus obras, sus solicitudes y lo que ha
   * dicho en el sitio. Los pedidos del carrito ya no salen: el carrito se
   * retiró el 2026-10-08 y lo que se pide ahora son solicitudes.
   */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const u = await prisma.users.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Cuenta no encontrada');

    const [empresas, quotes, comments, questions] = await Promise.all([
      prisma.clients.findMany({
        where: { user_id: id },
        orderBy: { id: 'asc' },
        select: {
          id: true, name: true, status: true,
          client_sites: {
            orderBy: [{ status: 'desc' }, { name: 'asc' }],
            select: { id: true, name: true, address: true, municipality: true, status: true },
          },
        },
      }),
      prisma.quotes.findMany({
        where: { user_id: BigInt(id) },
        orderBy: { id: 'desc' },
        take: 30,
        select: { id: true, quote_number: true, total: true, status: true, created_at: true, client_id: true, site_id: true, service_category: true },
      }),
      prisma.comments.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 20 }),
      prisma.product_questions.findMany({ where: { user_id: id }, orderBy: { id: 'desc' }, take: 20 }),
    ]);

    const productIds = [...new Set([...comments.map((c) => c.product_id), ...questions.map((q) => q.product_id).filter((x): x is number => x != null)])];
    const [products, cats] = await Promise.all([
      productIds.length
        ? prisma.products.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      prisma.categories.findMany({
        where: { cat_slug: { in: [...new Set(quotes.map((q) => q.service_category).filter((s): s is string => !!s))] } },
        select: { cat_slug: true, cat_name: true },
      }),
    ]);
    const pName = new Map(products.map((p) => [p.id, p.name]));
    const linea = new Map(cats.map((c) => [c.cat_slug, c.cat_name]));

    // A qué empresa y obra fue cada solicitud, con los nombres que ya se trajeron.
    const empresaDe = new Map(empresas.map((e) => [e.id, e.name]));
    const obraDe = new Map(empresas.flatMap((e) => e.client_sites.map((s) => [s.id, s.name] as const)));
    const pedidasPorObra = new Map<number, number>();
    for (const q of quotes) if (q.site_id !== null) pedidasPorObra.set(q.site_id, (pedidasPorObra.get(q.site_id) ?? 0) + 1);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.created_at ? u.created_at.toISOString() : null,
      profile: {
        address: u.address,
        city: u.city,
        zip: u.zip,
        residency: u.residency,
      },
      stats: {
        empresas: empresas.length,
        sites: empresas.reduce((n, e) => n + e.client_sites.filter((s) => s.status === 1).length, 0),
        quotes: quotes.length,
        comments: comments.length,
        questions: questions.length,
      },
      empresas: empresas.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        sites: e.client_sites.map((s) => ({
          id: s.id,
          name: s.name,
          address: s.address,
          municipality: s.municipality,
          status: s.status,
          quotes: pedidasPorObra.get(s.id) ?? 0,
        })),
      })),
      quotes: quotes.map((q) => ({
        id: Number(q.id),
        quoteNumber: q.quote_number,
        total: Number(q.total),
        status: q.status,
        createdAt: q.created_at ? q.created_at.toISOString() : null,
        empresa: q.client_id !== null ? empresaDe.get(q.client_id) ?? null : null,
        obra: q.site_id !== null ? obraDe.get(q.site_id) ?? null : null,
        linea: q.service_category ? linea.get(q.service_category) ?? q.service_category : 'Formulario',
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
        // Una pregunta general (del sitio) no tiene producto.
        product: q.product_id ? pName.get(q.product_id) ?? `#${q.product_id}` : 'Pregunta general',
        question: q.question,
        answered: Boolean(q.answer),
        createdAt: q.created_at.toISOString(),
      })),
    };
  }
}
