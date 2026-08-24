import type {
  BlogCard,
  BlogDetail,
  Category,
  FaqItem,
  HomeHero,
  Paginated,
  ProductCard,
  ProductDetail,
  ServiceItem,
  SiteReview,
  SiteSettings,
  StrategicSector,
  StrategicSectorDetail,
  WhyChooseUsItem,
} from '@maqserv/types';

import { cache } from 'react';
import { CONTENT_CACHE } from '@/lib/theme';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * PROD: ISR 60s (+ invalidación bajo demanda). DEV: sin caché para que los
 * cambios del admin se vean al refrescar, sin esperar. Ver CONTENT_CACHE.
 *
 * `cache()` deduplica por `path` dentro de un mismo render: si dos secciones
 * piden el mismo endpoint (p. ej. /catalog/categories o /theme), se hace UNA
 * sola llamada por request → menos viajes al DB, carga más rápida.
 */
/**
 * Tope por intento y reintentos ante fallo de RED.
 *
 * La API vive en Render con plan free y se duerme sin tráfico; despertarla
 * tarda decenas de segundos. Sin tope, la primera petición se queda colgada
 * hasta que la plataforma mata el proceso.
 *
 * Esto no es solo comodidad en runtime: varias páginas se prerenderizan en el
 * BUILD (`/sitemap.xml`, `/categorias`, `/quienes-somos`, `/blog`…), así que si
 * la API está dormida cuando Vercel compila, el fetch falla y **la build entera
 * se cae**. Fue exactamente lo que pasó: el deploy del 16 jul funcionó con la
 * API despierta y el redeploy del mismo día falló a los 53 s.
 *
 * Con reintentos, el primer intento la despierta y el segundo ya la encuentra
 * lista. Solo se reintenta ante fallo de red o timeout: un 404 o un 500 son
 * respuestas legítimas y reintentarlas solo alarga la espera.
 */
/**
 * El presupuesto de espera es DISTINTO en build y en runtime, y mezclarlos
 * rompe uno de los dos:
 *
 *  - En el BUILD no hay prisa y sí hay que aguantar el arranque en frío de
 *    Render, así que se insiste ~40 s.
 *  - En RUNTIME cada página es una función de Vercel, y en el plan Hobby esas
 *    funciones se cortan a los 10 s. Reintentar ahí no ayuda a nadie: la
 *    plataforma mata la función antes de terminar y el visitante recibe un 500.
 *    Un solo intento corto, y que la página decida qué hacer si falla.
 */
const EN_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const TIMEOUT_MS = EN_BUILD ? 15_000 : 6_000;
const INTENTOS = EN_BUILD ? 3 : 1;
const ESPERA_MS = 4_000;

/**
 * Tope de espera SIN `AbortSignal`.
 *
 * Parece más natural pasar `signal: AbortSignal.timeout(...)` al fetch, y así
 * estaba escrito primero. En local funcionaba y en Vercel fallaban TODAS las
 * llamadas de este módulo: el catálogo salía con cero productos y sin chips de
 * categoría, mientras `lib/theme.ts` —que hace el mismo fetch pero sin signal—
 * respondía bien. Un fetch con `next.revalidate` no admite un `signal`: Next no
 * puede guardar en su Data Cache una petición cancelable.
 *
 * Con `Promise.race` el tope es nuestro y las opciones del fetch quedan
 * intactas, así que el Data Cache sigue funcionando. La petición perdedora
 * termina sola en segundo plano; no se cancela, pero aquí lo que importa es no
 * dejar colgado el render.
 */
function conTope<T>(promesa: Promise<T>, ms: number, path: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) =>
      setTimeout(() => rechazar(new Error(`API ${path} no respondió en ${ms} ms`)), ms),
    ),
  ]);
}

const fetchJson = cache(async (path: string): Promise<unknown> => {
  let ultimo: unknown;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const res = await conTope(fetch(`${API_URL}${path}`, CONTENT_CACHE), TIMEOUT_MS, path);
      if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
      return await res.json();
    } catch (err) {
      ultimo = err;
      // Un status de error ya llegó respondido: no se reintenta.
      if (err instanceof Error && err.message.startsWith(`API ${path} →`)) throw err;
      if (intento === INTENTOS) break;
      console.warn(`[api] ${path}: intento ${intento}/${INTENTOS} falló, reintentando…`);
      await new Promise((r) => setTimeout(r, ESPERA_MS));
    }
  }
  throw ultimo;
});

async function get<T>(path: string): Promise<T> {
  return (await fetchJson(path)) as T;
}

/**
 * Igual que `get`, pero devuelve `fallback` en vez de lanzar.
 *
 * Lo usan los listados de CONTENIDO (categorías, blog, sectores, reseñas…) por
 * una razón de despliegue, no de estética: esas páginas se prerenderizan en el
 * BUILD, así que una excepción aquí **tumba el deploy entero**. Y la API vive en
 * Render con plan free, que se duerme sin tráfico: durante meses hubo builds
 * que fallaban solo porque la API estaba despertando.
 *
 * Con esto, en el peor caso el sitio se publica con una sección vacía y la
 * siguiente revalidación (60 s) la llena. Un hueco temporal es mucho mejor que
 * un despliegue caído que además no avisa.
 *
 * NO se usa en lo que necesita datos de verdad para tener sentido —una ficha de
 * producto, un pedido, el detalle de un blog—: ahí es correcto fallar y que
 * Next muestre el error o el 404.
 */
async function getOr<T>(path: string, fallback: T): Promise<T> {
  try {
    return (await fetchJson(path)) as T;
  } catch (err) {
    console.warn(`[api] ${path} no respondió; se usa el valor de respaldo:`, err);
    return fallback;
  }
}

export function getProducts(opts: {
  page?: number;
  search?: string;
  category?: string;
  subcategory?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability?: string;
  sort?: string;
} = {}): Promise<Paginated<ProductCard>> {
  const q = new URLSearchParams();
  if (opts.page) q.set('page', String(opts.page));
  if (opts.search) q.set('search', opts.search);
  if (opts.category) q.set('category', opts.category);
  if (opts.subcategory) q.set('subcategory', opts.subcategory);
  if (opts.featured) q.set('featured', '1');
  if (opts.minPrice !== undefined) q.set('minPrice', String(opts.minPrice));
  if (opts.maxPrice !== undefined) q.set('maxPrice', String(opts.maxPrice));
  if (opts.minRating !== undefined) q.set('minRating', String(opts.minRating));
  if (opts.availability) q.set('availability', opts.availability);
  if (opts.sort) q.set('sort', opts.sort);
  const qs = q.toString();
  return get(`/catalog/products${qs ? `?${qs}` : ''}`);
}

export function getSubcategories(categorySlug: string): Promise<Array<{ id: number; name: string; slug: string }>> {
  return get(`/catalog/categories/${encodeURIComponent(categorySlug)}/subcategories`);
}

export function getProduct(id: number): Promise<ProductDetail> {
  return get(`/catalog/products/${id}`);
}

export function getCategories(): Promise<Category[]> {
  return getOr('/catalog/categories', []);
}

export function getSiteSettings(): Promise<SiteSettings> {
  return getOr('/settings/site', { email: null, phone: null, logo: null });
}

// ---- Contenido de home / CMS ligero ----

export function getHero(): Promise<HomeHero | null> {
  return getOr('/content/hero', null);
}

export function getSectors(): Promise<StrategicSector[]> {
  return getOr('/content/sectors', []);
}

export function getSector(id: number): Promise<StrategicSectorDetail> {
  return get(`/content/sectors/${id}`);
}

export function getWhyChooseUs(): Promise<WhyChooseUsItem[]> {
  return getOr('/content/why-choose-us', []);
}

export function getServices(): Promise<ServiceItem[]> {
  return getOr('/content/services', []);
}

export function getBlogs(limit = 3): Promise<BlogCard[]> {
  return getOr(`/content/blogs?limit=${limit}`, []);
}

export function getBlog(id: number): Promise<BlogDetail> {
  return get(`/content/blogs/${id}`);
}

export function getReviews(limit = 6): Promise<SiteReview[]> {
  return getOr(`/content/reviews?limit=${limit}`, []);
}

export function getFaqs(): Promise<FaqItem[]> {
  return getOr('/content/faqs', []);
}
