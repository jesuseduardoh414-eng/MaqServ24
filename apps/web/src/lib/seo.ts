import type { Metadata } from 'next';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';

/** Origen público sin barra final (`https://maqserv24.com`). En local, el dev server. */
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '');

/** Imagen para compartir cuando la página no tiene una propia (scripts/generar-imagen-og.cjs). */
export const IMAGEN_OG = '/og/portada.png';

/** Quita etiquetas HTML y compacta espacios (para descripciones y JSON-LD). */
export function sinHtml(html: string | null | undefined): string {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Etiquetas de UNA página pública: título con el nombre del sitio, descripción,
 * canonical absoluto (resuelve contra `metadataBase` del layout) y Open Graph +
 * Twitter completos. Van completos a propósito: Next NO fusiona `openGraph`
 * con el del layout, lo sustituye entero, así que una página que solo pusiera
 * el título perdería la imagen y el `siteName` por defecto.
 *
 * `sinSufijo`: para títulos SEO escritos a mano en el panel (metaTitle de un
 * producto o artículo), que ya vienen pensados enteros.
 */
export function paginaSeo(
  theme: Theme,
  opts: { ruta: string; titulo: string; descripcion?: string | null; imagen?: string | null; tipo?: 'website' | 'article'; sinSufijo?: boolean },
): Metadata {
  const sitio = t(theme, 'site.name');
  const titulo = opts.sinSufijo ? opts.titulo : `${opts.titulo} — ${sitio}`;
  const descripcion = opts.descripcion?.trim() || undefined;
  const imagen = opts.imagen || IMAGEN_OG;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: opts.ruta },
    openGraph: {
      type: opts.tipo ?? 'website',
      siteName: sitio,
      locale: 'es_MX',
      url: opts.ruta,
      title: opts.titulo,
      description: descripcion,
      images: [imagen === IMAGEN_OG ? { url: imagen, width: 1200, height: 630, alt: sitio } : { url: imagen }],
    },
    twitter: { card: 'summary_large_image', title: opts.titulo, description: descripcion, images: [imagen] },
  };
}

/** BreadcrumbList de schema.org. El último elemento es la página actual (sin enlace). */
export function migas(items: Array<{ nombre: string; ruta?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nombre,
      ...(it.ruta ? { item: `${SITE_URL}${it.ruta}` } : {}),
    })),
  };
}

/** `833 224 56 78` → `+528332245678` (E.164, como pide schema.org). Vacío si no parece un número mexicano. */
export function telefonoE164(valor: string | null | undefined): string | undefined {
  const d = (valor ?? '').replace(/\D/g, '');
  if (d.length === 10) return `+52${d}`;
  if (d.length === 12 && d.startsWith('52')) return `+${d}`;
  return undefined;
}

/**
 * Qué NO debe aparecer en buscadores. Fuente única para robots.txt (no se
 * rastrea) y para el `noindex` de cada página (segunda capa, por si llegan por
 * un enlace). El sitemap solo lista rutas que no estén aquí.
 *
 * robots casa por PREFIJO: `/vendedor` cubre también `/vendedores`, y `/cotizar`
 * cubriría `/cotizador` —que SÍ se indexa—, por eso va anclado (`$` y `?`).
 *
 * Esto no es seguridad: lo que exige sesión lo protege el código, no robots.
 */
export const RUTAS_PRIVADAS = [
  '/cuenta',
  '/checkout',
  '/carrito',
  '/pedido',
  '/login',
  '/registro',
  '/restablecer',
  '/aliado',
  '/vendedor', // también /vendedores (marketplace apagado)
  '/tienda',
  '/rastreo', // herramienta con número de pedido, sin valor para buscar
  '/cotizar$', // formulario que exige cuenta; /cotizador (con -dor) sí se indexa
  '/cotizar?',
  '/sin-conexion',
  '/api',
];

/** Para `metadata.robots` de las páginas privadas. */
export const NOINDEX: NonNullable<Metadata['robots']> = { index: false, follow: false };

/** ¿La ruta cae en alguna de las privadas? (para no meterla al sitemap ni a llms.txt). */
export function esRutaPrivada(pathname: string): boolean {
  return RUTAS_PRIVADAS.some((r) => (r.endsWith('$') ? pathname === r.slice(0, -1) : pathname.startsWith(r)));
}
