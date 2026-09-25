import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { notFound, permanentRedirect } from 'next/navigation';
import { parseProductSlug, productSlug, rutaDeCatalogo } from '@maqserv/config';
import type { ProductCommentsSummary, ProductDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getProduct, getProducts, getSiteSettings, pedirOr } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ProductDetailView } from './ProductDetailView';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * FICHA DE UN SERVICIO O PRODUCTO. La comparten /servicios/[slug] y
 * /productos/[slug] (2026-09-25): es la misma vista, y lo que decide bajo qué
 * ruta vive cada ficha es su tipo (ver `tipoDeCatalogo`). Si alguien entra por
 * la ruta equivocada —un enlace viejo a /productos/excavadora— se le manda a la
 * correcta con 308, para que el índice no tenga la ficha dos veces.
 */

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchBySlug(slug: string): Promise<ProductDetail | null> {
  const id = parseProductSlug(slug);
  if (!id) return null;
  try {
    return await getProduct(id);
  } catch (err) {
    // Solo un 404 REAL de la API (el producto no existe) se traduce a
    // notFound(). Una API caída/dormida se relanza al error boundary: antes
    // convertía fichas reales en 404 INDEXABLES y Google las descatalogaba.
    if (err instanceof Error && /→ 404/.test(err.message)) return null;
    throw err;
  }
}

export async function metadataDetalle(slug: string): Promise<Metadata> {
  const [theme, product] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!product) return { title: t(theme, 'site.name') };
  const description = (product.metaDescription ?? product.short ?? stripHtml(product.description)).slice(0, 160);
  // El canonical es la ruta de su tipo, entre por donde entre.
  const canonical = `${rutaDeCatalogo(product.kind)}/${productSlug(product.name, product.id)}`;
  // Con metaTitle del panel va tal cual (ya viene pensado entero); si no, nombre + sitio.
  return paginaSeo(theme, {
    ruta: canonical,
    titulo: product.metaTitle || product.name,
    sinSufijo: !!product.metaTitle,
    descripcion: description,
    imagen: product.image,
  });
}

export async function PaginaDetalle({ slug, base }: { slug: string; base: '/servicios' | '/productos' }) {
  const [theme, product] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!product) notFound();
  const rutaBase = rutaDeCatalogo(product.kind);
  if (rutaBase !== base) permanentRedirect(`${rutaBase}/${productSlug(product.name, product.id)}`);
  const esServicio = product.kind === 'servicio';

  // Tope por Promise.race (un fetch con `next.revalidate` no admite `signal`):
  // sin él, una conexión colgada con Render dormido retenía el render entero.
  const sinComments = { items: [], average: 0, count: 0 } as ProductCommentsSummary;
  const [settings, comments, relatedRes] = await Promise.all([
    getSiteSettings().catch(() => ({ email: null, phone: null, logo: null })),
    Promise.race([
      pedirOr<ProductCommentsSummary>(
        `${API_URL}/catalog/products/${product.id}/comments`,
        { next: { revalidate: 60 } },
        sinComments,
        (v) => Array.isArray((v as ProductCommentsSummary | null)?.items),
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('comments timeout')), 6_000)),
    ]).catch(() => sinComments),
    (product.categorySlug ? getProducts({ category: product.categorySlug }) : getProducts({ featured: true, kind: product.kind })).catch(() => null),
  ]);
  void settings;

  const quoteMode = theme.tokens.quoteMode;
  const related = (relatedRes?.items ?? []).filter((p) => p.id !== product.id).slice(0, 3);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': esServicio ? 'Service' : 'Product',
    name: product.name,
    description: stripHtml(product.description).slice(0, 500),
    image: [product.image, ...product.gallery].filter(Boolean),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(comments.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: comments.average, reviewCount: comments.count } } : {}),
    // Un servicio no anuncia oferta fija: su precio final sale del cotizador.
    ...(!quoteMode && !esServicio && product.price !== null
      ? { offers: { '@type': 'Offer', price: product.price, priceCurrency: 'MXN', availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } }
      : {}),
  };

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd
        data={[
          jsonLd,
          migas([
            { nombre: t(theme, 'nav.home'), ruta: '/' },
            { nombre: t(theme, esServicio ? 'nav.services' : 'nav.products'), ruta: rutaBase },
            ...(product.categoryName && product.categorySlug ? [{ nombre: product.categoryName, ruta: `${rutaBase}?categoria=${product.categorySlug}` }] : []),
            { nombre: product.name },
          ]),
        ]}
      />
      <ProductDetailView
        product={product}
        theme={theme}
        rating={{ average: comments.average, count: comments.count }}
        reviews={comments.items}
        related={related}
        quoteMode={quoteMode}
      />
      <SiteFooter theme={theme} />
    </>
  );
}
