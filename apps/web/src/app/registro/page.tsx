import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { AuthCard } from '@/components/AuthCard';
import { authLabels } from '@/lib/auth-labels';
import { getAuthProviders } from '@/lib/auth-providers';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'auth.register.title')} — ${t(theme, 'site.name')}` };
}

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
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
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <AuthCard initialView="register" redirectTo={next} labels={authLabels(theme)} googleActivo={proveedores.google} errorInicial={sp.error ?? null} />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
