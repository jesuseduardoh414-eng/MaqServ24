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
      {/* Tarjeta centrada de ~440 px (la tarjeta fija su ancho). */}
      <main className="ms-wrap">
        <ResetPasswordCard token={token} />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
