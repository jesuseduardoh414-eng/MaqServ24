import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import { defaultTheme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { CartView } from './CartView';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'cart.title')} — ${t(theme, 'site.name')}` };
}

export default async function CartPage() {
  const theme = await getTheme();

  return (
    <>
      <SiteHeader theme={theme} />
      <CartView config={theme.tokens.checkout ?? defaultTheme.tokens.checkout} />
      <SiteFooter theme={theme} />
    </>
  );
}
