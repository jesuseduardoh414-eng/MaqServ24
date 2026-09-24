import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { VendorProductRow } from '@maqserv/types';
import { MARKETPLACE_ACTIVO } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ProductsManager } from './ProductsManager';
import { MONO, VendorHeader, VendorMain } from '../vendor-kit';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'vendor.panel.products')} — ${t(theme, 'site.name')}` };
}

export default async function VendorProductsPage() {
  if (!MARKETPLACE_ACTIVO) notFound(); // marketplace apagado
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, categories, res] = await Promise.all([
    getTheme(),
    getCategories(),
    fetch(`${API_URL}/vendor/products`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
  ]);
  if (res.status === 401) redirect('/login');
  if (res.status === 403) redirect('/vendedor');
  const products = (await res.json().catch(() => [])) as VendorProductRow[];

  return (
    <>
      <SiteHeader theme={theme} />
      <VendorMain>
        <VendorHeader
          title={t(theme, 'vendor.panel.products')}
          aside={
            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--color-text-muted)' }}>
              {products.length} PUBLICADO{products.length === 1 ? '' : 'S'}
            </span>
          }
          back={{ href: '/vendedor', label: t(theme, 'vendor.back') }}
        />
        <ProductsManager
          products={products}
          categories={categories}
          labels={{
            newTitle: t(theme, 'vendor.products.new'),
            name: t(theme, 'vendor.products.name'),
            category: t(theme, 'vendor.products.category'),
            price: t(theme, 'vendor.products.price'),
            oldPrice: t(theme, 'vendor.products.oldPrice'),
            stock: t(theme, 'vendor.products.stock'),
            brand: t(theme, 'vendor.products.brand'),
            description: t(theme, 'vendor.products.description'),
            photo: t(theme, 'vendor.products.photo'),
            isRental: t(theme, 'vendor.products.isRental'),
            rentalFreight: t(theme, 'vendor.products.rentalFreight'),
            create: t(theme, 'vendor.products.create'),
            created: t(theme, 'vendor.products.created'),
            deactivate: t(theme, 'vendor.products.deactivate'),
            empty: t(theme, 'vendor.products.empty'),
          }}
        />
      </VendorMain>
      <SiteFooter theme={theme} />
    </>
  );
}
