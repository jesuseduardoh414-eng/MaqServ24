import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTheme, t } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { ProfileForms } from './ProfileForms';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'account.title')} — ${t(theme, 'site.name')}` };
}

export default async function AccountPage() {
  const [theme, user] = await Promise.all([getTheme(), getSessionUser()]);
  if (!user) redirect('/login');

  const links = [
    { href: '/cuenta', label: 'Mi perfil', active: true },
    { href: '/cuenta/pedidos', label: t(theme, 'account.orders.title'), active: false },
    { href: '/cuenta/cotizaciones', label: t(theme, 'account.quotes.title'), active: false },
    { href: '/cuenta/favoritos', label: t(theme, 'account.wishlist.title'), active: false },
  ];

  return (
    <>
      <SiteHeader theme={theme} />
      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <style>{`
          @media (max-width: 900px){
            .acc-cols{ grid-template-columns:1fr !important; }
            .acc-wrap{ padding-left:22px !important; padding-right:22px !important; }
            .acc-title{ font-size:34px !important; }
          }
          @media (max-width: 560px){ .acc-two{ grid-template-columns:1fr !important; } }
          .acc-help:hover .acc-arrow{ transform: translateX(3px); }
          .acc-nav-link:hover{ border-color: var(--color-text) !important; }
        `}</style>

        <main className="acc-wrap" style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 40px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 22, flexWrap: 'wrap' }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', display: 'grid', placeItems: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
              {(user.name.trim()[0] ?? 'U').toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <h1 className="acc-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{user.name}</h1>
              <p style={{ margin: '8px 0 0', fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{user.email}</p>
            </div>
          </div>

          {/* Navegación del área de cuenta */}
          <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="acc-nav-link"
                aria-current={l.active ? 'page' : undefined}
                style={{
                  textDecoration: 'none',
                  fontFamily: MONO,
                  fontSize: 11.5,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: l.active ? 'var(--color-bg)' : 'var(--color-text)',
                  background: l.active ? 'var(--color-text)' : 'transparent',
                  border: `1px solid ${l.active ? 'var(--color-text)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-button)',
                  padding: '9px 16px',
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <ProfileForms
            user={user}
            labels={{
              profileTitle: t(theme, 'account.profile.title'),
              name: t(theme, 'auth.field.name'),
              phone: t(theme, 'checkout.field.phone'),
              address: t(theme, 'checkout.field.address'),
              city: t(theme, 'checkout.field.city'),
              zip: t(theme, 'checkout.field.zip'),
              save: t(theme, 'account.profile.save'),
              saved: t(theme, 'account.profile.saved'),
              passwordTitle: t(theme, 'account.password.title'),
              current: t(theme, 'account.password.current'),
              next: t(theme, 'account.password.new'),
              submit: t(theme, 'account.password.submit'),
              changed: t(theme, 'account.password.changed'),
            }}
          />
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
