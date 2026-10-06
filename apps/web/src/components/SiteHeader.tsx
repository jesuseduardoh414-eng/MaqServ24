import Link from 'next/link';
import { MARKETPLACE_ACTIVO, NEWSLETTER_ACTIVO, defaultTheme, type Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { getCatalogoResumen, getSiteSettings } from '@/lib/api';
import { HeaderActions } from '@/components/HeaderActions';
import { MainNav } from '@/components/MainNav';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FooterNewsletter } from '@/components/FooterNewsletter';
import { CookiesPreferencias } from '@/components/AvisoCookies';
import { Icon } from '@/components/Icon';
import { LANDINGS } from '@/lib/landings';
import { telHref } from '@/lib/telefono';
import { RedesSociales, redesParaMostrar } from '@/components/RedesSociales';

// Padding fluido, sin media query (el estilo inline no las admite).
//
// Se apretó de 26 a 18 px: el menú creció con "Cotizador" y esos 16 px de más
// a cada lado eran aire que le hacía falta. El tope de 1240 se queda como está
// a propósito —lo comparten todas las páginas— porque ensanchar solo el header
// dejaría el logo desalineado con el contenido de abajo.
const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(14px, 2vw, 18px)' };

/**
 * Header del diseño SEGAshop:
 *  1) barra superior oscura: contacto + horario + accesos.
 *  2) header sticky con logo, navegación y acciones (buscar/fav/carrito/sesión).
 * Todo color/texto sale de tokens/copys/BD (regla de oro).
 */
export async function SiteHeader({ theme }: { theme: Theme }) {
  const [settings, resumen] = await Promise.all([
    getSiteSettings().catch(() => ({ email: null, phone: null, logo: null })),
    getCatalogoResumen(),
  ]);
  const brand = t(theme, 'site.name');
  // Canales de contacto (editables en Diseño → Contacto): alimentan la barra superior.
  const contact = theme.tokens.contact ?? defaultTheme.tokens.contact;
  const cPhone = contact.phone || settings.phone;
  const cEmail = contact.email || settings.email;
  // Fuente única de la navegación: la comparten el nav de escritorio y el
  // drawer de móvil (si divergen, el menú miente en uno de los dos).
  const navItems = [
    { href: '/', label: t(theme, 'nav.home') },
    // Servicios y Productos (2026-09-25): cada pestaña solo si hay algo publicado
    // de ese tipo. Hoy todo son servicios; "Productos" aparece cuando exista uno.
    ...(resumen.servicios > 0 || resumen.productos === 0 ? [{ href: '/servicios', label: t(theme, 'nav.services') }] : []),
    ...(resumen.productos > 0 ? [{ href: '/productos', label: t(theme, 'nav.products') }] : []),
    // Soluciones (2026-09-30): el antiguo «Categorías» se vuelve submenú con las
    // páginas de aterrizaje. El href sigue siendo /categorias (lo abre el clic en
    // escritorio); en móvil el padre solo pliega, por eso «Ver todas» va al final.
    {
      href: '/categorias',
      label: t(theme, 'nav.solutions'),
      children: [
        ...LANDINGS.map((l) => ({ href: l.ruta, label: l.nombre, description: l.resumen })),
        { href: '/categorias', label: t(theme, 'nav.solutions.all'), description: t(theme, 'nav.solutions.all.hint') },
      ],
    },
    // Cotizador: el único con submenú. Son DOS herramientas con tabuladores
    // distintos —maquinaria y triturados— con el PRECIO ÚNICO de MAQSER24
    // (se regresó a esto el 2026-09-28: "el cotizador es un solo precio").
    {
      href: '/cotizador',
      label: t(theme, 'nav.quoter'),
      children: [
        { href: '/cotizador/maquinaria', label: t(theme, 'nav.quoter.machinery'), description: t(theme, 'nav.quoter.machinery.hint') },
        { href: '/cotizador/triturados', label: t(theme, 'nav.quoter.aggregates'), description: t(theme, 'nav.quoter.aggregates.hint') },
      ],
    },
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
              <a href={telHref(cPhone)} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
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
          {/* Proveedores en la barra superior: donde el botón no cabe en el header. */}
          <Link href="/proveedores" className="tb-prov" data-evento="proveedor_cta" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--color-primary)', display: 'flex' }}><Icon name="user" size={14} /></span>{t(theme, 'nav.providerSignup')}
          </Link>
          <div className="tb-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/rastreo" style={{ color: 'rgba(255,255,255,.66)' }}>{t(theme, 'topbar.track')}</Link>
            <span style={{ opacity: 0.25 }}>|</span>
            {/* "Vender" es del marketplace heredado; apagado no se ofrece. */}
            {MARKETPLACE_ACTIVO ? (
              <>
                <Link href="/vendedor" style={{ color: 'rgba(255,255,255,.66)' }}>{t(theme, 'topbar.sell')}</Link>
                <span style={{ opacity: 0.25 }}>|</span>
              </>
            ) : null}
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

          {/* Navegación (resalta el activo por ruta). Por debajo de 1200px la
              sustituye el cajón de `MobileNav`: aquí ya no cabe. */}
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
              providerSignup: t(theme, 'nav.providerSignup'),
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
              groupQuick: t(theme, 'nav.group.quick'),
              groupAccount: t(theme, 'nav.group.account'),
              search: t(theme, 'catalog.search.placeholder'),
              themeLight: t(theme, 'nav.theme.light'),
              themeDark: t(theme, 'nav.theme.dark'),
            }}
            brand={{
              name: brand,
              logoLight: theme.tokens.branding?.logoLight ?? settings.logo ?? null,
              logoDark: theme.tokens.branding?.logoDark ?? null,
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
  const contactoPie = theme.tokens.contact ?? defaultTheme.tokens.contact;
  const columns = f.columns;
  const copyright = f.copyright.trim() || `© ${year} ${brand}. ${t(theme, 'footer.rights')}.`;

  // Pie (sistema de diseño 2026-09-30): fondo de banda, tipo oración, enlaces
  // de 14 px con peso normal y piezas de radio 8. Hover/foco en `.sf-*`.

  return (
    <footer style={{ background: 'var(--band)', color: 'rgba(255,255,255,.7)', marginTop: 40, borderTop: '1px solid var(--color-border)' }}>
      <style>{`
        .sf-a{ transition:color .18s ease; }
        .sf-a:hover{ color:#fff !important; }
        .sf-a:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; border-radius:4px; }
        /* Franja superior: marca a la izquierda, contacto rápido a la derecha. */
        .sf-top{ display:flex; justify-content:space-between; align-items:flex-end; gap:24px 48px; flex-wrap:wrap; padding-bottom:36px; border-bottom:1px solid rgba(255,255,255,.08); }
        .sf-marca{ min-width:0; max-width:560px; }
        .sf-tag{ font-size:14.5px; line-height:1.6; margin:16px 0 0; max-width:56ch; }
        .sf-contacto{ display:flex; flex-direction:column; gap:10px; align-items:flex-start; }
        .sf-ct{ display:inline-flex; align-items:center; gap:10px; color:rgba(255,255,255,.78); text-decoration:none; font-size:14.5px; }
        .sf-ct svg{ color:var(--color-primary); flex-shrink:0; }
        /* Columnas parejas. Mismo ritmo vertical en todas. */
        .sf-cols{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:32px 40px; padding:36px 0 44px; }
        .sf-h{ margin:0 0 14px; color:#fff; font-weight:600; font-size:14.5px; }
        .sf-list{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
        .sf-list a{ color:rgba(255,255,255,.7); text-decoration:none; font-size:14px; line-height:20px; }
        .sf-redes{ display:flex; align-items:center; justify-content:center; gap:14px 24px; flex-wrap:wrap; }
        @media (max-width:640px){
          .sf-top{ align-items:flex-start; }
          .sf-cols{ grid-template-columns:repeat(2, minmax(0,1fr)); gap:28px 20px; }
          .sf-cols > :first-child{ grid-column:1 / -1; }
        }
      `}</style>
      <div style={{ ...CONTAINER, paddingTop: 56 }}>
        {/* El boletín no está en el modelo MAQSER24: apagado por código aunque
            el tema lo tenga encendido (ver newsletter.ts en @maqserv/config). */}
        {f.showNewsletter && NEWSLETTER_ACTIVO ? (
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

        {/* Franja superior (2026-10-05): la marca con su descripción a lo ancho y,
            a la derecha, el contacto directo. Antes la marca era una columna
            angosta y la descripción se partía en cuatro renglones. */}
        <div className="sf-top">
          <div className="sf-marca">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {footerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={footerLogo} alt={brand} style={{ height: 42, width: 'auto', maxWidth: 240, objectFit: 'contain', display: 'block' }} />
              ) : (
                <>
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary-fg)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '20px',
                    }}
                  >
                    {brand.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '19px', letterSpacing: '-.015em', color: '#fff' }}>{brand}</span>
                </>
              )}
            </div>
            <p className="sf-tag">{f.tagline}</p>
          </div>
          {contactoPie.phone || contactoPie.email ? (
            <div className="sf-contacto">
              {contactoPie.phone ? <a href={telHref(contactoPie.phone)} className="sf-a sf-ct"><Icon name="phone" size={16} />{contactoPie.phone}</a> : null}
              {contactoPie.email ? <a href={`mailto:${contactoPie.email}`} className="sf-a sf-ct"><Icon name="mail" size={16} />{contactoPie.email}</a> : null}
              {contactoPie.hours ? <span className="sf-ct"><Icon name="clock" size={16} />{contactoPie.hours}</span> : null}
            </div>
          ) : null}
        </div>

        {/* Columnas parejas. Soluciones va por código (lib/landings.ts) y no en
            las columnas del tema, para que ningún cambio en Diseño deje a las
            páginas de servicio sin enlaces internos; antes era una tira suelta. */}
        <div className="sf-cols">
          <nav aria-label="Soluciones">
            <p className="sf-h">Soluciones</p>
            <ul className="sf-list">
              {LANDINGS.map((l) => (
                <li key={l.ruta}><Link href={l.ruta} className="sf-a">{l.nombre}</Link></li>
              ))}
            </ul>
          </nav>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="sf-h">{col.title}</p>
              <ul className="sf-list">
                {col.links.map((l, i) => (
                  <li key={`${l.label}-${i}`}><Link href={l.href} className="sf-a">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Redes (2026-10-06): franja horizontal con iconos grandes sobre la barra
          legal (antes eran una columna más, con iconos chicos). Las que no tienen
          enlace no se pintan; si no hay ninguna, no sale la franja. */}
      {redesParaMostrar(f.social, contactoPie.whatsapp).length ? (
        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div className="sf-redes" style={{ ...CONTAINER, paddingTop: 24, paddingBottom: 24 }}>
            <p className="sf-h" style={{ margin: 0 }}>Síguenos</p>
            <RedesSociales redes={f.social} whatsapp={contactoPie.whatsapp} tono="claro" forma="barra" />
          </div>
        </div>
      ) : null}

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ ...CONTAINER, display: 'flex', justifyContent: 'space-between', gap: '12px 16px', flexWrap: 'wrap', paddingTop: 20, paddingBottom: 20, fontSize: '13px', color: 'rgba(255,255,255,.55)' }}>
          <span>{copyright}</span>
          <span style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap' }}>
            <Link href="/terminos" className="sf-a" style={{ color: 'rgba(255,255,255,.55)', textDecoration: 'none' }}>{t(theme, 'footer.terms')}</Link>
            <Link href="/privacidad" className="sf-a" style={{ color: 'rgba(255,255,255,.55)', textDecoration: 'none' }}>{t(theme, 'footer.privacy')}</Link>
            <CookiesPreferencias label={t(theme, 'cookies.preferences')} />
          </span>
        </div>
      </div>
    </footer>
  );
}
