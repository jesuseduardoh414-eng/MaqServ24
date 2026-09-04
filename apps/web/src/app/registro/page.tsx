import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { AuthCard } from '@/components/AuthCard';
import { authLabels } from '@/lib/auth-labels';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'auth.register.title')} — ${t(theme, 'site.name')}` };
}

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [theme, user, sp] = await Promise.all([getTheme(), getSessionUser(), searchParams]);
  if (user) redirect('/');
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') ? sp.next : '/';

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <AuthCard initialView="register" redirectTo={next} labels={authLabels(theme)} />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
