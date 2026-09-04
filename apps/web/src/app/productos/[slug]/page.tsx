import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { parseProductSlug, productSlug } from '@maqserv/config';
import type { ProductCommentsSummary, ProductDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getProduct, getProducts, getSiteSettings } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ProductDetailView } from './ProductDetailView';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

type Params = { slug: string };

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

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [theme, product] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!product) return { title: t(theme, 'site.name') };
  const description = (product.metaDescription ?? product.short ?? stripHtml(product.description)).slice(0, 160);
  const canonical = `/productos/${productSlug(product.name, product.id)}`;
  return {
    title: `${product.metaTitle ?? product.name} — ${t(theme, 'site.name')}`,
    description,
    alternates: { canonical },
    openGraph: { title: product.name, description, images: product.image ? [product.image] : [], type: 'website' },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [theme, product] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!product) notFound();

  // Tope por Promise.race (un fetch con `next.revalidate` no admite `signal`):
  // sin él, una conexión colgada con Render dormido retenía el render entero.
  const sinComments = { items: [], average: 0, count: 0 } as ProductCommentsSummary;
  const [settings, comments, relatedRes] = await Promise.all([
    getSiteSettings().catch(() => ({ email: null, phone: null, logo: null })),
    Promise.race([
      fetch(`${API_URL}/catalog/products/${product.id}/comments`, { next: { revalidate: 60 } })
        .then((r) => r.json()) as Promise<ProductCommentsSummary>,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('comments timeout')), 6_000)),
    ]).catch(() => sinComments),
    (product.categorySlug ? getProducts({ category: product.categorySlug }) : getProducts({ featured: true })).catch(() => null),
  ]);

  const quoteMode = theme.tokens.quoteMode;
  const related = (relatedRes?.items ?? []).filter((p) => p.id !== product.id).slice(0, 3);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: stripHtml(product.description).slice(0, 500),
    image: [product.image, ...product.gallery].filter(Boolean),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(comments.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: comments.average, reviewCount: comments.count } } : {}),
    ...(!quoteMode && product.price !== null
      ? { offers: { '@type': 'Offer', price: product.price, priceCurrency: 'MXN', availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } }
      : {}),
  };

  return (
    <>
      <SiteHeader theme={theme} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
