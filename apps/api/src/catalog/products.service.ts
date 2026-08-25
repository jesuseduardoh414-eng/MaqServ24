import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import type { Paginated, ProductCard, ProductDetail, ProviderBadge } from '@maqserv/types';
import { imageUrl } from './images';
import { estadoDocumentos, estaVerificado, mesesEnRed } from './provider-trust';

/**
 * Normalización de búsqueda (ES). Se aplica IGUAL a la columna y al término:
 *  - acentos: nadie escribe "hidráulica" en un buscador, escribe "hidraulica".
 *  - b → v: confusión clásica en español ("retroexcabadora" ↔ "Retroexcavadora").
 * `translate` es nativa de Postgres, así que no hace falta instalar unaccent/pg_trgm.
 * Ambas cadenas DEBEN tener el mismo número de caracteres.
 */
const NORM_FROM = 'áàäâãéèëêíìïîóòöôõúùüûñçb';
const NORM_TO = 'aaaaaeeeeiiiiooooouuuuncv';

/** Mismo criterio que NORM_FROM/NORM_TO, pero en JS para el término que teclea el cliente. */
function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // separa y quita los acentos
    .replace(/ç/g, 'c')
    .replace(/b/g, 'v');
}

const PAGE_SIZE = 16; // 2 grupos de 8 por página (8 → anuncio → 8 → promo)

type ProductRow = {
  id: number;
  name: string;
  Marca: string | null;
  cprice: number;
  pprice: number | null;
  photo: string | null;
  is_rental: boolean;
  featured: number;
  stock: number | null;
  category_id: number;
  provider_id: number | null;
};

/** Campos que se piden para armar una tarjeta. Uno solo, para no desincronizar consultas. */
const CAMPOS_TARJETA = {
  id: true, name: true, Marca: true, cprice: true, pprice: true,
  photo: true, is_rental: true, featured: true, stock: true,
  category_id: true, provider_id: true,
} as const;

@Injectable()
export class ProductsService {
  private toCard(
    p: ProductRow,
    catSlugs: Map<number, string>,
    provs: Map<number, ProviderBadge> = new Map(),
  ): ProductCard {
    return {
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
      provider: p.provider_id !== null ? (provs.get(p.provider_id) ?? null) : null,
      categorySlug: catSlugs.get(p.category_id) ?? null,
    };
  }

  /**
   * Sellos de confianza de los aliados que aparecen en una lista de productos.
   *
   * Se piden TODOS DE GOLPE y no uno por producto: una parrilla de 16 equipos
   * haría 16 consultas extra, y con la base a ~100 ms por viaje eso son 1.6 s
   * de más por pantalla. Los aliados que se repiten se consultan una sola vez.
   *
   * Devuelve un mapa vacío si no hay ninguno, así que un catálogo sin
   * proveedores asignados sigue funcionando igual que antes.
   */
  private async providerBadges(ids: Array<number | null>): Promise<Map<number, ProviderBadge>> {
    const unicos = [...new Set(ids.filter((x): x is number => x !== null))];
    if (unicos.length === 0) return new Map();

    const provs = await prisma.providers.findMany({
      where: { id: { in: unicos }, status: 1 },
      select: {
        id: true, name: true, slug: true, level: true, coverage: true,
        response_minutes: true, joined_at: true,
        provider_documents: { select: { expires_at: true } },
      },
    });

    return new Map(
      provs.map((p) => {
        const docs = estadoDocumentos(p.provider_documents);
        return [
          p.id,
          {
            name: p.name,
            slug: p.slug,
            level: p.level as ProviderBadge['level'],
            verified: estaVerificado(p.level, docs),
            docsStatus: docs,
            coverage: p.coverage,
            responseMinutes: p.response_minutes,
            monthsInNetwork: mesesEnRed(p.joined_at),
          },
        ];
      }),
    );
  }

  private async categorySlugMap(): Promise<Map<number, string>> {
    const cats = await prisma.categories.findMany({ select: { id: true, cat_slug: true } });
    return new Map(cats.map((c) => [c.id, c.cat_slug]));
  }

  /**
   * IDs que casan con el término, ignorando acentos/mayúsculas/b-v y exigiendo
   * que TODAS las palabras aparezcan (en cualquier orden): así "excavadora 320"
   * encuentra "Excavadora Hidráulica 320", que antes daba 0 resultados.
   */
  private async searchIds(term: string): Promise<number[]> {
    const tokens = term.trim().split(/\s+/).map(normalizeTerm).filter((t) => t.length > 0).slice(0, 6);
    if (tokens.length === 0) return [];
    const conds = tokens.map(
      (tk) => Prisma.sql`translate(lower(name), ${NORM_FROM}, ${NORM_TO}) LIKE ${`%${tk}%`}`,
    );
    const rows = await prisma.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM products WHERE status = 1 AND ${Prisma.join(conds, ' AND ')} LIMIT 500`,
    );
    return rows.map((r) => Number(r.id));
  }

  /**
   * IDs de productos cuya calificación PROMEDIO llega a `min`.
   *
   * `products` no tiene relación con `comments` (el esquema viene de la introspección
   * del Laravel viejo, sin llaves foráneas), así que no se puede filtrar por el
   * promedio de una relación: hay que agregarlo aparte.
   */
  private async ratedIds(min: number): Promise<number[]> {
    const rows = await prisma.comments.groupBy({
      by: ['product_id'],
      where: { status: 1 },
      _avg: { rating: true },
    });
    return rows.filter((r) => (r._avg.rating ?? 0) >= min).map((r) => r.product_id);
  }

  async list(opts: {
    page?: number;
    search?: string;
    category?: string; // cat_slug
    featured?: boolean;
    vendorId?: number; // tienda de un vendedor (products.user_id)
    subcategory?: string; // sub_slug
    minPrice?: number;
    maxPrice?: number;
    /** Calificación promedio mínima (2, 3 o 4 estrellas). */
    minRating?: number;
    /** `now` = con existencias · `rent` = en renta · `offer` = con precio anterior. */
    availability?: 'now' | 'rent' | 'offer';
    /** `low`/`high` = precio · `new` = más recientes. Default: relevancia (id desc). */
    sort?: 'low' | 'high' | 'new';
  }): Promise<Paginated<ProductCard>> {
    const page = Math.max(1, opts.page ?? 1);

    // Solo productos publicados (status=1, convención del Laravel viejo)
    const where: Record<string, unknown> = { status: 1 };
    if (opts.featured) where.featured = 1;
    if (opts.vendorId) where.user_id = opts.vendorId;
    if (opts.subcategory) {
      const sub = await prisma.subcategories.findFirst({ where: { sub_slug: opts.subcategory } });
      where.subcategory_id = sub ? sub.id : -1;
    }
    if (opts.category) {
      const cat = await prisma.categories.findUnique({ where: { cat_slug: opts.category } });
      where.category_id = cat ? cat.id : -1; // categoría inexistente → 0 resultados
    }

    // Precio: `cprice` es el precio de venta/renta mensual que ve el cliente.
    if (opts.minPrice !== undefined || opts.maxPrice !== undefined) {
      where.cprice = {
        ...(opts.minPrice !== undefined ? { gte: opts.minPrice } : {}),
        ...(opts.maxPrice !== undefined ? { lte: opts.maxPrice } : {}),
      };
    }

    if (opts.availability === 'now') {
      // Sin `stock` = sin control de existencias ⇒ disponible (mismo criterio que la card).
      where.OR = [{ stock: null }, { stock: { gt: 0 } }];
    } else if (opts.availability === 'rent') {
      where.is_rental = true;
    } else if (opts.availability === 'offer') {
      // "En oferta" = tiene precio anterior, que es justo cuando la card lo tacha.
      // No se comparan pprice > cprice: Prisma no compara dos columnas sin SQL crudo,
      // y el criterio debe ser el MISMO que el cliente ve en la tarjeta.
      where.pprice = { gt: 0 };
    }

    /**
     * Filtros que se resuelven como conjuntos de IDs (búsqueda y calificación) y hay
     * que INTERSECTAR: los dos escriben en `where.id` y el segundo pisaba al primero.
     */
    const idSets: number[][] = [];
    if (opts.search) idSets.push(await this.searchIds(opts.search));
    if (opts.minRating) idSets.push(await this.ratedIds(opts.minRating));
    if (idSets.length > 0) {
      const ids = idSets.reduce((a, b) => {
        const keep = new Set(b);
        return a.filter((x) => keep.has(x));
      });
      where.id = { in: ids };
    }

    const orderBy: Prisma.productsOrderByWithRelationInput =
      opts.sort === 'low' ? { cprice: 'asc' }
        : opts.sort === 'high' ? { cprice: 'desc' }
          : opts.sort === 'new' ? { created_at: 'desc' }
            : { id: 'desc' }; // relevancia

    const [total, rows] = await Promise.all([
      prisma.products.count({ where }),
      prisma.products.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: CAMPOS_TARJETA,
      }),
    ]);

    const [catSlugs, provs] = await Promise.all([
      this.categorySlugMap(),
      this.providerBadges(rows.map((r) => r.provider_id)),
    ]);
    return {
      items: rows.map((p) => this.toCard(p, catSlugs, provs)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  async byId(id: number): Promise<ProductDetail> {
    const p = await prisma.products.findFirst({ where: { id, status: 1 } });
    if (!p) throw new NotFoundException(`Producto ${id} no encontrado`);

    const [gallery, cat, provs] = await Promise.all([
      prisma.galleries.findMany({ where: { product_id: id }, select: { photo: true } }),
      prisma.categories.findUnique({ where: { id: p.category_id } }),
      this.providerBadges([p.provider_id]),
    ]);

    const catSlugs = new Map(cat ? [[cat.id, cat.cat_slug] as const] : []);
    let specs: Array<{ label: string; value: string }> = [];
    try {
      const parsed = JSON.parse(p.specs ?? '[]');
      if (Array.isArray(parsed)) {
        specs = parsed
          .filter((x) => x && typeof x.label === 'string' && x.label.trim())
          .map((x) => ({ label: String(x.label).trim(), value: String(x.value ?? '').trim() }));
      }
    } catch { /* specs legacy/no JSON */ }
    return {
      ...this.toCard(p, catSlugs, provs),
      description: p.description,
      short: p.Corto && p.Corto.trim() ? p.Corto.trim() : null,
      specs,
      gallery: gallery.map((g) => imageUrl(g.photo)).filter((u): u is string => u !== null),
      medical: {
        lote: p.lote,
        caducidad: p.caducidad ? p.caducidad.toISOString().slice(0, 10) : null,
        fichaTecnica: imageUrl(p.ficha_tecnica),
        certificacionDc3: imageUrl(p.certificacion_dc3),
      },
      rentalFreight: p.rental_freight ? Number(p.rental_freight) : null,
      youtube: p.youtube,
      tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      categoryName: cat?.cat_name ?? null,
      metaTitle: p.is_meta ? p.meta_tag : null,
      metaDescription: p.is_meta ? p.meta_description : null,
      views: p.views,
    };
  }
}
