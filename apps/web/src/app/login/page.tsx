import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import { redirect } from 'next/navigation';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { AuthCard } from '@/components/AuthCard';
import { authLabels } from '@/lib/auth-labels';
import { getAuthProviders } from '@/lib/auth-providers';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'auth.login.title')} — ${t(theme, 'site.name')}` };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [theme, user, sp, proveedores] = await Promise.all([
    getTheme(), getSessionUser(), searchParams, getAuthProviders(),
  ]);
  // Solo rutas internas y nunca `//otro-sitio` (ver destinoSeguro en google-auth).
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  // Quien ya tiene sesión y llegó aquí con `next` (por ejemplo, desde el
  // candado de cotizar) sigue a donde iba, no al inicio.
  if (user) redirect(next);

  return (
    <>
      <SiteHeader theme={theme} />
      {/* Tarjeta centrada de ~440 px (la tarjeta fija su ancho). */}
      <main className="ms-wrap">
        <AuthCard initialView="login" redirectTo={next} labels={authLabels(theme)} googleActivo={proveedores.google} errorInicial={sp.error ?? null} />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
