import type { Metadata } from 'next';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ResetPasswordCard } from '@/components/ResetPasswordCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `Restablecer contraseña — ${t(theme, 'site.name')}`, robots: { index: false } };
}

/** Destino del enlace de "¿Olvidaste tu contraseña?" (`/restablecer?token=…`). */
export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [theme, sp] = await Promise.all([getTheme(), searchParams]);
  const token = typeof sp.token === 'string' ? sp.token : '';

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <ResetPasswordCard token={token} />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
