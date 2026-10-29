import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { sanitizeUserHtml } from '../common/sanitize';
import { productSlug, LINEAS_SERVICIO, COTIZADORES_ACTIVOS, tipoDeCatalogo, tarifasDe, horarioDe, textoHorario, type CotizadorTipo } from '@maqserv/config';
import { QuoterService } from '../quoter/quoter.service';
import type { Paginated, ProductCard, ProductDetail, ProviderBadge } from '@maqserv/types';
import { imageUrl } from './images';
import { videoDeServicio } from './video-servicio';
import { ordenDeCategorias } from './categories.service';
import { lista } from '../common/json-list';
import { estadoDocumentos, estaVerificado, mesesEnRed } from './provider-trust';
import { disponibilidadDe } from './availability';

/**
 * Normalización de búsqueda (ES). Se aplica IGUAL a la columna y al término:
 *  - acentos: nadie escribe "hidráulica" en un buscador, escribe "hidraulica".
 *  - b → v: confusión clásica en español ("retroexcabadora" ↔ "Retroexcavadora").
 * `translate` es nativa de Postgres, así que no hace falta instalar unaccent/pg_trgm.
 * Ambas cadenas DEBEN tener el mismo número de caracteres.
 */

/** Normaliza el término que teclea el cliente: minúsculas, sin acentos, b→v (igual que el SQL de searchIds). */
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
  /** Legacy reusada: video principal (ver `video-servicio.ts`). */
  youtube: string | null;
  is_rental: boolean;
  price_unit: string | null;
  featured: number;
  stock: number | null;
  category_id: number;
  provider_id: number | null;
  location: string | null;
  availability_confirmed_at: Date | null;
};

/** Campos que se piden para armar una tarjeta. Uno solo, para no desincronizar consultas. */
const CAMPOS_TARJETA = {
  id: true, name: true, Marca: true, cprice: true, pprice: true,
  photo: true, youtube: true, is_rental: true, featured: true, stock: true, price_unit: true,
  category_id: true, provider_id: true, location: true, availability_confirmed_at: true,
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly quoter: QuoterService) {}

  /**
   * Qué cotizador tiene cada ficha de tipo en su tabulador (2026-10-22, Fase
   * 4): "Cotizar" en el catálogo abre ESE cotizador con el tipo ya elegido, en
   * vez del formulario a la medida sin precio. Sale de los renglones visibles
   * de los cotizadores encendidos en el sitio; el tabulador ya viene en caché.
   */
  private async cotizadorDeFichas(): Promise<Map<number, CotizadorTipo>> {
    const mapa = new Map<number, CotizadorTipo>();
    for (const tipo of COTIZADORES_ACTIVOS) {
      try {
        const cat = await this.quoter.catalogo(tipo);
        if (!cat.publico.habilitado) continue;
        const renglones: Array<{ productos?: number[]; oculto?: boolean }> =
          cat.tipo === 'maquinaria' ? [...cat.equipos, ...cat.servicios] : cat.productos;
        for (const r of renglones) {
          if (r.oculto) continue;
          for (const id of r.productos ?? []) if (!mapa.has(id)) mapa.set(id, tipo);
        }
      } catch { /* sin tabulador: se cotiza a la medida */ }
    }
    return mapa;
  }

  private toCard(
    p: ProductRow,
    catSlugs: Map<number, string>,
    provs: Map<number, ProviderBadge> = new Map(),
    bloqueos: Map<number, Array<{ state: string; starts_on: Date; ends_on: Date | null; note?: string | null }>> = new Map(),
    cotizadores: Map<number, CotizadorTipo> = new Map(),
  ): ProductCard {
    return {
      quoter: cotizadores.get(p.id) ?? null,
      id: p.id,
      slug: productSlug(p.name, p.id),
      name: p.name,
      brand: p.Marca,
      // El sitio NUNCA enseña precios (2026-10-23): el cliente pide y MAQSER24
      // le manda la cotización. Antes los escondía el tema (`quoteMode`), pero
      // un precio que viaja al navegador es un precio publicado.
      price: null,
      oldPrice: null,
      image: imageUrl(p.photo),
      video: videoDeServicio(p.youtube),
      isRental: p.is_rental,
      priceUnit: p.price_unit,
      featured: p.featured === 1,
      inStock: p.stock === null || p.stock > 0,
      stock: p.stock,
      provider: p.provider_id !== null ? (provs.get(p.provider_id) ?? null) : null,
      availability: disponibilidadDe({
        stock: p.stock,
        location: p.location,
        confirmedAt: p.availability_confirmed_at,
        blocks: bloqueos.get(p.id) ?? [],
      }),
      categorySlug: catSlugs.get(p.category_id) ?? null,
      kind: tipoDeCatalogo(catSlugs.get(p.category_id) ?? null),
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
        provider_documents: { select: { id: true, kind: true, name: true, expires_at: true } },
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
            verified: estaVerificado(docs),
            docsStatus: docs,
            coverage: lista(p.coverage),
            responseMinutes: p.response_minutes,
            monthsInNetwork: mesesEnRed(p.joined_at),
          },
        ];
      }),
    );
  }

  /**
   * Bloqueos VIGENTES HOY de una lista de equipos, en una sola consulta.
   *
   * Se filtra por fecha en la base y no en memoria: un equipo puede acumular
   * meses de historial de rentas, y traerlo todo para descartarlo aqui seria
   * pagar por datos que no se usan.
   */
  private async bloqueosVigentes(
    ids: number[],
  ): Promise<Map<number, Array<{ state: string; starts_on: Date; ends_on: Date | null; note: string | null }>>> {
    if (ids.length === 0) return new Map();
    const hoy = new Date();
    const filas = await prisma.availability_blocks.findMany({
      where: {
        product_id: { in: ids },
        starts_on: { lte: hoy },
        OR: [{ ends_on: null }, { ends_on: { gte: hoy } }],
      },
      select: { product_id: true, state: true, starts_on: true, ends_on: true, note: true },
    });
    const mapa = new Map<number, Array<{ state: string; starts_on: Date; ends_on: Date | null; note: string | null }>>();
    for (const f of filas) {
      const lista = mapa.get(f.product_id) ?? [];
      lista.push({ state: f.state, starts_on: f.starts_on, ends_on: f.ends_on, note: f.note });
      mapa.set(f.product_id, lista);
    }
    return mapa;
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
    // MySQL no tiene translate(). La colación utf8mb4_unicode_ci ya iguala
    // mayúsculas y acentos (á=a, ñ=n) en el LIKE; lo único que hay que igualar a
    // mano es b/v, que normalizeTerm() también colapsa a "v" en el término.
    // Cada palabra puede estar en el nombre, la marca, las etiquetas o el nombre
    // de su línea (2026-09-30): "concreto" o "pipa" daban 0 porque solo se
    // buscaba en el nombre, aunque la línea "Materiales…" sí existiera.
    const texto = Prisma.sql`REPLACE(LOWER(CONCAT_WS(' ', p.name, p.Marca, p.tags, c.cat_name)), 'b', 'v')`;
    const conds = tokens.map((tk) => Prisma.sql`${texto} LIKE ${`%${tk}%`}`);
    const rows = await prisma.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT p.id FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 1 AND ${Prisma.join(conds, ' AND ')} LIMIT 500`,
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

  private async idsDeLineasServicio(): Promise<number[]> {
    const cats = await prisma.categories.findMany({ where: { cat_slug: { in: [...LINEAS_SERVICIO] } }, select: { id: true } });
    return cats.map((c) => c.id);
  }

  /**
   * "Relevancia" (el orden por defecto) = el orden de las categorías que fija
   * el cliente (Catálogo → Categorías: Renta de maquinaria, Suministro de
   * triturados, Materiales…) y, dentro de cada una, el orden en que se dieron
   * de alta, que es como el cliente las lista (arena 4, arena 5, grava 1…).
   * Antes era "lo más nuevo primero" y la maquinaria quedaba hasta el final.
   *
   * products no tiene relación declarada con categories, así que el orden se
   * arma aquí: ids + categoría de todo lo que pasa el filtro (pocas filas,
   * dos columnas) y luego solo la página que toca.
   */
  private async porRelevancia(where: Record<string, unknown>, page: number) {
    const [todos, cats] = await Promise.all([
      prisma.products.findMany({ where, select: { id: true, category_id: true } }),
      prisma.categories.findMany({ orderBy: [{ sort_order: 'asc' }, { cat_name: 'asc' }], select: { id: true, sort_order: true } }),
    ]);
    const posicion = new Map(ordenDeCategorias(cats).map((c, i) => [c.id, i]));
    const lejos = Number.MAX_SAFE_INTEGER;
    todos.sort((a, b) => (posicion.get(a.category_id) ?? lejos) - (posicion.get(b.category_id) ?? lejos) || a.id - b.id);
    const pagina = todos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.id);
    const filas = pagina.length
      ? await prisma.products.findMany({ where: { id: { in: pagina } }, select: CAMPOS_TARJETA })
      : [];
    const lugar = new Map(pagina.map((id, i) => [id, i]));
    filas.sort((a, b) => (lugar.get(a.id) ?? 0) - (lugar.get(b.id) ?? 0));
    return [todos.length, filas] as const;
  }

  /** Cuántos servicios y cuántos productos hay publicados: decide qué pestañas enseña el sitio. */
  async resumen(): Promise<{ servicios: number; productos: number }> {
    const ids = await this.idsDeLineasServicio();
    const [servicios, productos] = await Promise.all([
      // Solo fichas de tipo: las máquinas de los aliados no salen en el sitio (Fase 4).
      prisma.products.count({ where: { status: 1, category_id: { in: ids }, provider_id: null } }),
      prisma.products.count({ where: { status: 1, category_id: { notIn: ids }, provider_id: null } }),
    ]);
    return { servicios, productos };
  }

  async list(opts: {
    page?: number;
    search?: string;
    category?: string; // cat_slug
    /** true = solo destacados · false = sin destacados · ausente = todos. */
    featured?: boolean;
    vendorId?: number; // tienda de un vendedor (products.user_id)
    subcategory?: string; // sub_slug
    minPrice?: number;
    maxPrice?: number;
    /** Calificación promedio mínima (2, 3 o 4 estrellas). */
    minRating?: number;
    /** `now` = con existencias · `rent` = en renta · `offer` = con precio anterior. */
    availability?: 'now' | 'rent' | 'offer';
    /** `low`/`high` = precio · `new` = más recientes. Default: relevancia (orden de categorías; ver porRelevancia). */
    sort?: 'low' | 'high' | 'new';
    /** Servicios (las líneas de MAQSER24) o productos (lo demás). */
    kind?: 'servicio' | 'producto';
  }): Promise<Paginated<ProductCard>> {
    const page = Math.max(1, opts.page ?? 1);

    // Solo productos publicados (status=1, convención del Laravel viejo)
    const where: Record<string, unknown> = { status: 1 };
    /**
     * CADA TIPO UNA VEZ (2026-10-22, Fase 4): en las líneas de servicio el
     * sitio enseña las fichas de tipo, no la máquina de cada aliado. Si no,
     * cuando los aliados publiquen las suyas saldrían cinco "Excavadora 20 t".
     * Va en AND para no chocar con el OR del filtro de existencias.
     */
    // Y NADA DE LOS ALIADOS (auditoría 2026-10-28, regla del dueño: "nada se
    // publica más que las categorías y los servicios que se agregan a MAQSER24").
    // Antes los productos de aliados fuera de las líneas de servicio sí salían,
    // con el nombre y la marca que escribió el aliado tal cual.
    where.AND = [{ provider_id: null }];
    if (opts.featured === true) where.featured = 1;
    else if (opts.featured === false) where.featured = { not: 1 };
    if (opts.vendorId) where.user_id = opts.vendorId;
    // Los 4 lookups previos (subcategoría, categoría, búsqueda, calificación)
    // son independientes entre sí: en paralelo cuestan 1 RTT en vez de hasta 4
    // en serie (~100 ms por viaje a la BD).
    const [sub, cat, searchIds, ratedIds] = await Promise.all([
      opts.subcategory ? prisma.subcategories.findFirst({ where: { sub_slug: opts.subcategory } }) : null,
      opts.category ? prisma.categories.findUnique({ where: { cat_slug: opts.category } }) : null,
      opts.search ? this.searchIds(opts.search) : null,
      opts.minRating ? this.ratedIds(opts.minRating) : null,
    ]);
    if (opts.subcategory) where.subcategory_id = sub ? sub.id : -1;
    if (opts.category) where.category_id = cat ? cat.id : -1; // categoría inexistente → 0 resultados
    // Por tipo: las categorías de servicio están en config; lo demás es producto.
    // Una categoría explícita ya decide el tipo, así que solo aplica sin ella.
    if (opts.kind && !opts.category) {
      const ids = await this.idsDeLineasServicio();
      where.category_id = opts.kind === 'servicio' ? { in: ids } : { notIn: ids };
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
    if (searchIds) idSets.push(searchIds);
    if (ratedIds) idSets.push(ratedIds);
    if (idSets.length > 0) {
      const ids = idSets.reduce((a, b) => {
        const keep = new Set(b);
        return a.filter((x) => keep.has(x));
      });
      where.id = { in: ids };
    }

    const [total, rows] = opts.sort
      ? await Promise.all([
          prisma.products.count({ where }),
          prisma.products.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: CAMPOS_TARJETA,
          }),
        ])
      : await this.porRelevancia(where, page);

    const [catSlugs, provs, bloqueos, cotizadores] = await Promise.all([
      this.categorySlugMap(),
      this.providerBadges(rows.map((r) => r.provider_id)),
      this.bloqueosVigentes(rows.map((r) => r.id)),
      this.cotizadorDeFichas(),
    ]);
    return {
      items: rows.map((p) => this.toCard(p, catSlugs, provs, bloqueos, cotizadores)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  async byId(id: number): Promise<ProductDetail> {
    // Solo lo de MAQSER24 (auditoría 2026-10-28): con el número en la dirección
    // se abría la ficha de la máquina de cualquier aliado, con su nombre y cobertura.
    const p = await prisma.products.findFirst({ where: { id, status: 1, provider_id: null } });
    if (!p) throw new NotFoundException(`Producto ${id} no encontrado`);

    const [gallery, cat, provs, bloqueos, cotizadores] = await Promise.all([
      prisma.galleries.findMany({ where: { product_id: id }, select: { photo: true } }),
      prisma.categories.findUnique({ where: { id: p.category_id } }),
      this.providerBadges([p.provider_id]),
      this.bloqueosVigentes([p.id]),
      this.cotizadorDeFichas(),
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
      ...this.toCard(p, catSlugs, provs, bloqueos, cotizadores),
      // Defensa en la salida: lo guardado antes del arreglo también se limpia.
      description: sanitizeUserHtml(p.description ?? ''),
      short: p.Corto && p.Corto.trim() ? p.Corto.trim() : null,
      specs,
      gallery: gallery.map((g) => imageUrl(g.photo)).filter((u): u is string => u !== null),
      medical: {
        lote: p.lote,
        caducidad: p.caducidad ? p.caducidad.toISOString().slice(0, 10) : null,
        fichaTecnica: imageUrl(p.ficha_tecnica),
        certificacionDc3: imageUrl(p.certificacion_dc3),
      },
      rentalFreight: null,
      youtube: p.youtube,
      tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      categoryName: cat?.cat_name ?? null,
      metaTitle: p.is_meta ? p.meta_tag : null,
      metaDescription: p.is_meta ? p.meta_description : null,
      views: p.views,
      // Cómo se cotiza (sin importes): unidades con tarifa, mínimo y horario.
      pricingUnits: Object.keys(tarifasDe(p.tarifas)),
      minUnits: p.minimo ?? null,
      schedule: p.horario ? textoHorario(horarioDe(p.horario)) : null,
      scheduleRaw: p.horario ? horarioDe(p.horario) : null,
      attributes: Object.fromEntries(
        Object.entries((p.attributes ?? {}) as Record<string, unknown>)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => [k, String(v)]),
      ),
    };
  }
}
