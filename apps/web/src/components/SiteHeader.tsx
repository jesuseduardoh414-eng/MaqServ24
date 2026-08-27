import Link from 'next/link';
import { defaultTheme, type Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { getSiteSettings } from '@/lib/api';
import { HeaderActions } from '@/components/HeaderActions';
import { MainNav } from '@/components/MainNav';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FooterNewsletter } from '@/components/FooterNewsletter';
import { Icon } from '@/components/Icon';

// Padding fluido: 26px en escritorio, 16px en móvil (sin media query, el
// inline style no las admite).
const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };

/**
 * Header del diseño SEGAshop:
 *  1) barra superior oscura: contacto + horario + accesos.
 *  2) header sticky con logo, navegación y acciones (buscar/fav/carrito/sesión).
 * Todo color/texto sale de tokens/copys/BD (regla de oro).
 */
export async function SiteHeader({ theme }: { theme: Theme }) {
  const settings = await getSiteSettings().catch(() => ({ email: null, phone: null, logo: null }));
  const brand = t(theme, 'site.name');
  // Canales de contacto (editables en Diseño → Contacto): alimentan la barra superior.
  const contact = theme.tokens.contact ?? defaultTheme.tokens.contact;
  const cPhone = contact.phone || settings.phone;
  const cEmail = contact.email || settings.email;
  // Fuente única de la navegación: la comparten el nav de escritorio y el
  // drawer de móvil (si divergen, el menú miente en uno de los dos).
  const navItems = [
    { href: '/', label: t(theme, 'nav.home') },
    { href: '/productos', label: t(theme, 'nav.products') },
    { href: '/categorias', label: t(theme, 'nav.categories') },
    { href: '/quienes-somos', label: t(theme, 'nav.about') },
    { href: '/blog', label: t(theme, 'nav.blog') },
    { href: '/contacto', label: t(theme, 'nav.contact') },
  ];

  return (
    <>
      {/* Barra superior. En móvil se queda solo el teléfono (lo demás vive en el
          drawer): con todo visible se apilaba en 4 renglones y se comía media
          pantalla. */}
      <div style={{ background: 'var(--band)', color: 'rgba(255,255,255,.66)', fontSize: '12.5px', fontWeight: 300, borderBottom: '1px solid var(--color-border)' }}>
        <div className="tb-row" style={{ ...CONTAINER, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 9, paddingBottom: 9 }}>
          <div className="tb-left" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {cPhone ? (
              <a href={`tel:${cPhone.replace(/\s+/g, '')}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: 'var(--color-primary)', display: 'flex' }}><Icon name="phone" size={14} /></span>{cPhone}
              </a>
            ) : null}
            {cEmail ? (
              <a className="tb-email" href={`mailto:${cEmail}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: 'var(--color-primary)', display: 'flex' }}><Icon name="mail" size={14} /></span>{cEmail}
              </a>
            ) : null}
            <span className="tb-hours" style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: 0.7 }}>
              <span style={{ color: 'var(--color-primary)', display: 'flex' }}><Icon name="clock" size={14} /></span>{contact.hours || t(theme, 'topbar.hours')}
            </span>
          </div>
          <div className="tb-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/rastreo" style={{ color: 'rgba(255,255,255,.66)' }}>{t(theme, 'topbar.track')}</Link>
            <span style={{ opacity: 0.25 }}>|</span>
            <Link href="/vendedor" style={{ color: 'rgba(255,255,255,.66)' }}>{t(theme, 'topbar.sell')}</Link>
            <span style={{ opacity: 0.25 }}>|</span>
            <span style={{ opacity: 0.7 }}>{t(theme, 'topbar.locale')}</span>
          </div>
        </div>
      </div>

      {/* Header sticky */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'color-mix(in srgb, var(--color-bg) 94%, transparent)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="hdr-inner" style={{ ...CONTAINER, display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14, paddingBottom: 14 }}>
          {/* Logo */}
          <Link href="/" className="hdr-logo" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 0, textDecoration: 'none' }}>
            {(() => {
              const brand2 = theme.tokens.branding ?? {};
              const logoLight = brand2.logoLight ?? settings.logo;
              const logoDark = brand2.logoDark ?? null;
              // OJO: sin `display` inline. La conmutación claro/oscuro se hace por
              // CSS (.brand-swap .brand-logo-*), y un `display:block` inline la
              // anularía (los estilos inline ganan a las clases) → saldrían las dos.
              // La altura la fija `.hdr-logo-img` (CSS) para poder bajarla en móvil.
              const imgStyle: React.CSSProperties = { objectFit: 'contain', width: 'auto' };
              if (logoLight && logoDark) {
                // Ambas variantes: se intercambian por esquema de color (CSS).
                return (
                  <span className="brand-swap" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="brand-logo-light hdr-logo-img" src={logoLight} alt={brand} style={imgStyle} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="brand-logo-dark hdr-logo-img" src={logoDark} alt={brand} style={imgStyle} />
                  </span>
                );
              }
              if (logoLight || logoDark) {
                // eslint-disable-next-line @next/next/no-img-element
                return <img className="hdr-logo-img" src={(logoLight ?? logoDark) as string} alt={brand} style={imgStyle} />;
              }
              return null;
            })() ?? (
              <>
                <span
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 22px -12px color-mix(in srgb, var(--color-primary) 90%, transparent)',
                    color: 'var(--color-primary-fg)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '23px',
                  }}
                >
                  {brand.charAt(0).toUpperCase()}
                </span>
                <span style={{ lineHeight: 1 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '21px', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '-.01em' }}>
                    {brand}
                  </span>
                  <span style={{ display: 'block', fontSize: '9.5px', letterSpacing: '.24em', color: 'var(--grey)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>
                    {t(theme, 'site.tagline')}
                  </span>
                </span>
              </>
            )}
          </Link>

          {/* Navegación (resalta el activo por ruta). Debajo de 1024px la
              sustituye el drawer de `MobileNav`: aquí ya no cabe. */}
          <MainNav items={navItems} />

          {/* Acciones */}
          <span className="hdr-theme"><ThemeToggle /></span>
          <HeaderActions
            labels={{
              search: t(theme, 'nav.search'),
              wishlist: t(theme, 'nav.wishlist'),
              cart: t(theme, 'nav.cart'),
              login: t(theme, 'nav.login'),
              register: t(theme, 'nav.register'),
              logout: t(theme, 'auth.logout'),
              greeting: t(theme, 'auth.greeting'),
              searchPlaceholder: t(theme, 'catalog.search.placeholder'),
            }}
          />
          <MobileNav
            items={navItems}
            labels={{
              login: t(theme, 'nav.login'),
              register: t(theme, 'nav.register'),
              logout: t(theme, 'auth.logout'),
              wishlist: t(theme, 'nav.wishlist'),
              track: t(theme, 'topbar.track'),
              sell: t(theme, 'topbar.sell'),
              menu: t(theme, 'nav.menu'),
            }}
            contact={{ phone: cPhone ?? null, email: cEmail ?? null }}
          />
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ theme }: { theme: Theme }) {
  const brand = t(theme, 'site.name');
  const year = new Date().getFullYear();
  // El footer es siempre oscuro (--band) → logo para fondo oscuro (blanco).
  const b = theme.tokens.branding ?? {};
  const footerLogo = b.logoDark || b.logoLight || b.logoAlt || null;

  // Contenido del footer (editable en Diseño → Footer).
  const f = theme.tokens.footer ?? defaultTheme.tokens.footer;
  const columns = f.columns;
  const copyright = f.copyright.trim() || `© ${year} ${brand}. ${t(theme, 'footer.rights')}.`;

  const linkStyle: React.CSSProperties = { color: 'rgba(255,255,255,.66)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 300 };

  return (
    <footer style={{ background: 'var(--band)', color: 'rgba(255,255,255,.66)', marginTop: 40, borderTop: '1px solid var(--color-border)' }}>
      <div style={{ ...CONTAINER, paddingTop: 64 }}>
        {f.showNewsletter ? (
          <FooterNewsletter
            labels={{
              title: f.newsletterTitle,
              subtitle: f.newsletterSubtitle,
              placeholder: t(theme, 'newsletter.placeholder'),
              submit: t(theme, 'newsletter.submit'),
              success: t(theme, 'newsletter.success'),
              error: t(theme, 'newsletter.error'),
            }}
          />
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 40,
            paddingBottom: 48,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              {footerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={footerLogo} alt={brand} style={{ height: 42, width: 'auto', maxWidth: 240, objectFit: 'contain', display: 'block' }} />
              ) : (
                <>
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary-fg)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '20px',
                    }}
                  >
                    {brand.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '19px', color: '#fff', textTransform: 'uppercase' }}>{brand}</span>
                </>
              )}
            </div>
            <p style={{ fontSize: '13.5px', lineHeight: 1.6, maxWidth: 290, margin: '0 0 20px', fontWeight: 300 }}>{f.tagline}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {f.social.map((s, i) => (
                <a key={i} href={s.href || '#'} target={s.href ? '_blank' : undefined} rel={s.href ? 'noopener noreferrer' : undefined} aria-label={s.label} style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'inherit', textDecoration: 'none' }}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', marginBottom: 18 }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.links.map((l, i) => (
                  <Link key={`${l.label}-${i}`} href={l.href} style={linkStyle}>{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ ...CONTAINER, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 20, paddingBottom: 20, fontSize: '13px', opacity: 0.55, fontWeight: 300 }}>
          <span>{copyright}</span>
          <span style={{ display: 'flex', gap: 20 }}>
            <Link href="/terminos" style={{ color: 'rgba(255,255,255,.55)' }}>{t(theme, 'footer.terms')}</Link>
            <Link href="/privacidad" style={{ color: 'rgba(255,255,255,.55)' }}>{t(theme, 'footer.privacy')}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
