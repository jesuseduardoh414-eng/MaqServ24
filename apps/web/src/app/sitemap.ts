import type { MetadataRoute } from 'next';
import { getBlogs, getProducts, getSectors } from '@/lib/api';
import { SITE_URL, esRutaPrivada } from '@/lib/seo';

type Entrada = MetadataRoute.Sitemap[number];
type Frecuencia = NonNullable<Entrada['changeFrequency']>;

/** Rutas fijas públicas. Lo privado NO va aquí (ver RUTAS_PRIVADAS en lib/seo.ts). */
const FIJAS: Array<[ruta: string, freq: Frecuencia, prio: number]> = [
  ['/', 'daily', 1],
  ['/productos', 'daily', 0.9],
  ['/categorias', 'weekly', 0.7],
  ['/cotizador', 'monthly', 0.8],
  ['/cotizador/maquinaria', 'monthly', 0.8],
  ['/cotizador/triturados', 'monthly', 0.8],
  ['/quienes-somos', 'monthly', 0.6],
  ['/contacto', 'monthly', 0.6],
  ['/blog', 'weekly', 0.7],
  ['/privacidad', 'yearly', 0.2],
  ['/terminos', 'yearly', 0.2],
];

/**
 * /sitemap.xml: rutas fijas + contenido de la base (artículos, sectores,
 * productos). Se regenera solo (ISR del layout) y coincide con robots.txt:
 * nada de lo que robots prohíbe entra aquí.
 *
 * Cada bloque dinámico va en su propio try: si la API no responde, sale lo
 * que se haya juntado y el build NO falla. Antes, una excepción aquí tumbaba
 * el despliegue completo cuando la API dormía durante la compilación.
 *
 * Las listas filtradas (`/productos?categoria=…`) ya no van: son la misma
 * página con parámetros y su canonical apunta a /productos.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = FIJAS.filter(([ruta]) => !esRutaPrivada(ruta)).map(([ruta, changeFrequency, priority]) => ({
    url: `${SITE_URL}${ruta === '/' ? '' : ruta}`,
    changeFrequency,
    priority,
  }));

  // Artículos del blog (el endpoint admite hasta 60).
  try {
    for (const b of await getBlogs(60)) {
      entries.push({ url: `${SITE_URL}/blog/${b.slug}`, changeFrequency: 'monthly', priority: 0.6, ...(b.date ? { lastModified: b.date } : {}) });
    }
  } catch (err) {
    console.warn('[sitemap] sin artículos del blog:', err);
  }

  // Sectores estratégicos.
  try {
    for (const s of await getSectors()) {
      entries.push({ url: `${SITE_URL}/sectores/${s.slug}`, changeFrequency: 'monthly', priority: 0.5 });
    }
  } catch (err) {
    console.warn('[sitemap] sin sectores:', err);
  }

  // Todos los productos (recorriendo la paginación de la API).
  try {
    let page = 1;
    let pages = 1;
    do {
      const res = await getProducts({ page });
      pages = res.pages;
      for (const p of res.items) {
        entries.push({ url: `${SITE_URL}/productos/${p.slug}`, changeFrequency: 'weekly', priority: 0.8 });
      }
      page++;
    } while (page <= pages);
  } catch (err) {
    console.warn('[sitemap] sin productos:', err);
  }

  return entries;
}
