import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Paginated, ProductCard as ProductCardDto, VendorPublic } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ProductCard } from '@/components/ProductCard';
import { Pagination } from '@/components/Pagination';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

type Params = { id: string };
type Search = { page?: string };
type StoreResponse = { vendor: VendorPublic; products: Paginated<ProductCardDto> };

async function fetchStore(id: string, page: number): Promise<StoreResponse | null> {
  if (!/^\d+$/.test(id)) return null;
  // Tope por Promise.race (fetch con revalidate no admite signal): una conexión
  // colgada con Render dormido retenía el render de la tienda.
  const res = await Promise.race([
    fetch(`${API_URL}/vendors/${id}?page=${page}`, { next: { revalidate: 60 } }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('tienda timeout')), 6_000)),
  ]).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as StoreResponse;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const [theme, store] = await Promise.all([getTheme(), fetchStore(id, 1)]);
  return {
    title: store
      ? `${store.vendor.shopName} — ${t(theme, 'site.name')}`
      : t(theme, 'site.name'),
  };
}

export default async function StorePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const [theme, store] = await Promise.all([getTheme(), fetchStore(id, page)]);
  if (!store) notFound();

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <header style={{ marginBottom: '1.6rem', display: 'grid', gap: '.4rem' }}>
          <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            {t(theme, 'vendor.store.title')}
          </span>
          <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>{store.vendor.shopName}</h1>
          {store.vendor.shopDetails ? (
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{store.vendor.shopDetails}</p>
          ) : null}
        </header>

        {store.products.items.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t(theme, 'catalog.empty')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.2rem' }}>
            {store.products.items.map((p) => (
              <ProductCard key={p.id} product={p} theme={theme} />
            ))}
          </div>
        )}
        <Pagination
          page={store.products.page}
          pages={store.products.pages}
          makeHref={(p) => `/tienda/${id}${p > 1 ? `?page=${p}` : ''}`}
          theme={theme}
        />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
