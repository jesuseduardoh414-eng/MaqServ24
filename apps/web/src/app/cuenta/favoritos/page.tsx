import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { ProductCard as ProductCardDto } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ProductCard } from '@/components/ProductCard';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'account.wishlist.title')} — ${t(theme, 'site.name')}` };
}

export default async function WishlistPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, res] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (res.status === 401) redirect('/login');
  const products = (await res.json().catch(() => [])) as ProductCardDto[];

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '1.4rem' }}>
          {t(theme, 'account.wishlist.title')}
        </h1>
        {products.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t(theme, 'account.wishlist.empty')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.2rem' }}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} theme={theme} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
