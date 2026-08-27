import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { VendorPublic } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'vendors.title')} — ${t(theme, 'site.name')}` };
}

export default async function VendorsPage() {
  const [theme, vendors] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/vendors`, { next: { revalidate: 60 } })
      .then((r) => r.json())
      .catch(() => []) as Promise<VendorPublic[]>,
  ]);

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '1.4rem' }}>{t(theme, 'vendors.title')}</h1>
        {vendors.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t(theme, 'vendors.empty')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.2rem' }}>
            {vendors.map((v) => (
              <Link
                key={v.id}
                href={`/tienda/${v.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                  padding: '1.2rem',
                  display: 'grid',
                  gap: '.5rem',
                  textAlign: 'center',
                }}
              >
                {v.photo ? (
                  <span style={{ position: 'relative', width: 72, height: 72, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', display: 'block' }}>
                    <Image src={v.photo} alt={v.shopName} fill sizes="72px" style={{ objectFit: 'cover' }} />
                  </span>
                ) : null}
                <strong style={{ fontSize: 'var(--text-lg)' }}>{v.shopName}</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  {v.productCount} {t(theme, 'vendors.products')}
                </span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {t(theme, 'vendors.visit')}
                  <Icon name="arrowRight" size={14} style={{ width: '1em', height: '1em' }} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
