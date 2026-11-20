import Link from '@/components/Enlace';
import { COTIZADORES_SITIO, defaultTheme, type Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { getSiteSettings } from '@/lib/api';
import { HeaderActions } from '@/components/HeaderActions';
import { MainNav } from '@/components/MainNav';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CookiesPreferencias } from '@/components/AvisoCookies';
import { Icon } from '@/components/Icon';
import { LANDINGS } from '@/lib/landings';
import { telHref } from '@/lib/telefono';
import { mapaHref } from '@/lib/direccion';
import { fotoLigera } from '@/lib/foto';
import { RedesSociales, redesParaMostrar } from '@/components/RedesSociales';
import { TrazosLuz } from '@/components/BandaLuz';
import { BotonRegresar } from '@/components/BotonRegresar';
import { EncabezadoSobrePortada } from '@/components/EncabezadoSobrePortada';

// Padding fluido, sin media query (el estilo inline no las admite).
//
// Se apretó de 26 a 18 px: el menú creció con "Cotizador" y esos 16 px de más
// a cada lado eran aire que le hacía falta. El tope de 1240 se queda como está
// a propósito —lo comparten todas las páginas— porque ensanchar solo el header
// dejaría el logo desalineado con el contenido de abajo.
const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(14px, 2vw, 18px)' };

/**
 * El menú Cotizador en el orden y con los nombres de Soluciones (2026-11-20, el
 * dueño: «que cotizador coincida con soluciones»). Agua y acarreos son dos
 * cotizadores y van juntos donde Soluciones dice «Pipas de agua y volteos».
 * La descripción sigue siendo la de cada cotizador (cómo se cobra). Un
 * cotizador que no esté aquí sale al final, con su nombre de siempre.
 */
const MENU_COTIZADOR: ReadonlyArray<readonly [clave: string, nombre: string]> = [
  ['maquinaria', 'Renta de maquinaria pesada'],
  ['venta-de-maquinaria', 'Venta de maquinaria pesada'],
  ['agua', 'Pipas de agua'],
  ['acarreos', 'Volteos y acarreos'],
  ['triturados', 'Triturados: grava, arena y base'],
  ['materiales', 'Materiales para construcción'],
  ['carpeta-asfaltica', 'Carpeta asfáltica'],
];

function menuCotizador() {
  const nombre = new Map(MENU_COTIZADOR);
  const orden = (clave: string) => {
    const i = MENU_COTIZADOR.findIndex(([c]) => c === clave);
    return i < 0 ? MENU_COTIZADOR.length : i;
  };
  return [...COTIZADORES_SITIO]
    .sort((a, b) => orden(a.clave) - orden(b.clave))
    .map((c) => ({ href: `/cotizador/${c.clave}`, label: nombre.get(c.clave) ?? c.titulo, description: c.resumen }));
}

/**
 * Header del diseño SEGAshop:
 *  1) barra superior oscura: contacto + horario + accesos.
 *  2) header sticky con logo, navegación y acciones (buscar/fav/lista para cotizar/sesión).
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
    // Solo Servicios (2026-10-08): ya no hay venta en línea ni pestaña
    // "Productos"; /productos redirige a /servicios.
    { href: '/servicios', label: t(theme, 'nav.services') },
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
    // Cotizador: un cotizador por categoría (2026-11-02, pedido del dueño). Por
    // dentro siguen siendo los dos tabuladores con el PRECIO ÚNICO de MAQSER24;
    // cada uno enseña su parte. Desde 2026-11-20 («que cotizador coincida con
    // soluciones») va en el orden y con los nombres de Soluciones.
    {
      href: '/cotizador',
      label: t(theme, 'nav.quoter'),
      children: menuCotizador(),
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
      <div style={{ background: 'var(--band-capa)', color: 'rgba(255,255,255,.66)', fontSize: '12.5px', fontWeight: 300, borderBottom: '1px solid var(--color-border)' }}>
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
            {/* «Rastrear pedido» se fue con las compras en línea (2026-10-08) y
                «Vender» con el marketplace heredado (2026-10-15). */}
            {t(theme, 'topbar.locale') ? <span style={{ opacity: 0.7 }}>{t(theme, 'topbar.locale')}</span> : null}
          </div>
        </div>
      </div>

      {/* Header sticky. `data-encabezado-sitio`: la pantalla de carga se pone justo debajo (CargaDePagina). */}
      {/* Rediseño 2026-11-16 (el dueño: «el header no se ve como lo demás»): siempre
          oscuro como la barra de contacto, la portada y el pie, sin línea abajo
          (se funde con la portada); enlaces en la letra de titulares con
          subrayado azul brillante y botones con resplandor. Ver SH_CSS. */}
      <style>{SH_CSS}</style>
      <header
        data-encabezado-sitio
        className="sh-hdr"
        style={{ position: 'sticky', top: 0, zIndex: 50 }}
      >
        <div className="hdr-inner" style={{ ...CONTAINER, display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14, paddingBottom: 14 }}>
          {/* Logo */}
          <Link href="/" className="hdr-logo" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 0, textDecoration: 'none' }}>
            {(() => {
              const brand2 = theme.tokens.branding ?? {};
              // Reducidos: se ven a 42 px de alto y el archivo subido pesaba 400 KB.
              const subido = brand2.logoLight ?? settings.logo;
              const logoLight = subido ? fotoLigera(subido, 640, 90) : null;
              const logoDark = brand2.logoDark ? fotoLigera(brand2.logoDark, 640, 90) : null;
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
              // Sin copy en el tema todavía: el carrito pasó a ser la lista de
              // equipos para cotizar (2026-10-08).
              quoteList: 'Tu lista para cotizar',
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
              quoteList: 'Tu lista para cotizar',
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
      {/* En todas las páginas (2026-11-19): marca si ya se bajó, para que el menú tome su fondo (ver SH_CSS). */}
      <EncabezadoSobrePortada />
      {/* «Regresar» debajo del menú en todas las páginas menos el inicio (2026-11-16). */}
      <BotonRegresar />
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
    <footer className="sf-pie" style={{ background: 'var(--band-capa)', color: 'rgba(255,255,255,.7)', marginTop: 40, borderTop: '1px solid var(--color-border)' }}>
      {/* Rediseño 2026-11-16: trazo de luz en la esquina y línea azul arriba, como el resto del sitio. */}
      <TrazosLuz partes="arriba" />
      <style>{`
        .sf-pie{ position:relative; overflow:hidden; isolation:isolate; }
        .sf-pie::before{ content:''; position:absolute; top:-1px; left:50%; width:min(620px, 72vw); height:1px; transform:translateX(-50%);
          background: linear-gradient(90deg, transparent, var(--color-primary), transparent); box-shadow: 0 0 14px var(--color-primary); }
        .sf-pie::after{ content:''; position:absolute; z-index:-1; left:-10%; bottom:-40%; width:720px; height:520px; border-radius:50%; pointer-events:none;
          background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 65%); }
        .sf-cuerpo{ position:relative; z-index:1; }
        /* Pie más compacto (2026-11-16, el dueño: «así acomodado como está, pero un
           poco más comprimido, para que no abarque mucho espacio»): mismo orden,
           menos aire, trazo de luz más bajo y angosto para que no toque el contacto. */
        .sf-pie .bl-trazo{ height:44px !important; width:min(400px, 36vw) !important; }
        /* Si la página termina en una banda de luz (el inicio, con Preguntas
           frecuentes), el pie va pegado: sin la franja vacía ni la doble línea. */
        main:has(> .bl-banda:last-child) + .sf-pie{ margin-top:0 !important; border-top-color:transparent !important; }
        .sf-a{ transition:color .18s ease, transform .18s ease; }
        .sf-a:hover{ color:#fff !important; }
        .sf-list a{ display:inline-block; }
        .sf-list a:hover{ transform: translateX(3px); }
        .sf-a:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; border-radius:4px; }
        /* Franja superior: marca a la izquierda, contacto rápido a la derecha. */
        .sf-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:18px 48px; flex-wrap:wrap; padding-bottom:22px; border-bottom:1px solid rgba(255,255,255,.08); }
        .sf-marca{ min-width:0; max-width:560px; }
        .sf-tag{ font-size:14px; line-height:1.55; margin:10px 0 0; max-width:56ch; }
        .sf-contacto{ display:flex; flex-direction:column; gap:7px; align-items:flex-start; }
        .sf-ct{ display:inline-flex; align-items:center; gap:9px; color:rgba(255,255,255,.78); text-decoration:none; font-size:14px; }
        .sf-ct svg{ color:var(--color-primary); flex-shrink:0; box-sizing:content-box; padding:5px; border-radius:7px;
          border:1.5px solid color-mix(in srgb, var(--color-primary) 70%, transparent); box-shadow: 0 0 14px -4px var(--color-primary); }
        /* Dirección: puede ser larga, se parte en renglones con el pin arriba. */
        .sf-dir{ align-items:flex-start; max-width:380px; line-height:1.45; }
        .sf-dir svg{ margin-top:3px; }
        /* Columnas parejas. Mismo ritmo vertical en todas. */
        .sf-cols{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:20px 40px; padding:24px 0 26px; }
        .sf-h{ margin:0 0 10px; color:var(--color-primary); font-family:var(--font-display); font-weight:800; font-size:12.5px; letter-spacing:.08em; text-transform:uppercase; }
        .sf-list{ list-style:none; margin:0; padding:0; display:grid; gap:5px; }
        .sf-list a{ color:rgba(255,255,255,.7); text-decoration:none; font-size:14px; line-height:20px; }
        .sf-redes{ display:flex; align-items:center; justify-content:center; gap:10px 20px; flex-wrap:wrap; }
        .sf-redes .rs-barra a{ width:40px; min-width:40px; height:40px; border-radius:10px; }
        .sf-redes .rs-barra a svg{ width:20px; height:20px; }
        @media (max-width:640px){
          .sf-top{ align-items:flex-start; }
          .sf-cols{ grid-template-columns:repeat(2, minmax(0,1fr)); gap:28px 20px; }
          /* En celular los enlaces con más separación: se tocan con el dedo. */
          .sf-list{ gap:10px; }
          .sf-cols > :first-child{ grid-column:1 / -1; }
        }
      `}</style>
      <div className="sf-cuerpo" style={{ ...CONTAINER, paddingTop: 50 }}>
        {/* Franja superior (2026-10-05): la marca con su descripción a lo ancho y,
            a la derecha, el contacto directo. Antes la marca era una columna
            angosta y la descripción se partía en cuatro renglones. */}
        <div className="sf-top">
          <div className="sf-marca">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {footerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoLigera(footerLogo, 640, 90)} alt={brand} style={{ height: 36, width: 'auto', maxWidth: 220, objectFit: 'contain', display: 'block' }} />
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
          {contactoPie.phone || contactoPie.email || contactoPie.address.trim() ? (
            <div className="sf-contacto">
              {contactoPie.phone ? <a href={telHref(contactoPie.phone)} className="sf-a sf-ct"><Icon name="phone" size={16} />{contactoPie.phone}</a> : null}
              {contactoPie.email ? <a href={`mailto:${contactoPie.email}`} className="sf-a sf-ct"><Icon name="mail" size={16} />{contactoPie.email}</a> : null}
              {contactoPie.hours ? <span className="sf-ct"><Icon name="clock" size={16} />{contactoPie.hours}</span> : null}
              {/* Dirección (2026-11-09): la de Diseño → Contacto; abre Google Maps. */}
              {contactoPie.address.trim() ? (
                <a href={mapaHref(contactoPie.address)} target="_blank" rel="noopener noreferrer" className="sf-a sf-ct sf-dir">
                  <Icon name="mapPin" size={16} />{contactoPie.address.trim()}
                </a>
              ) : null}
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
          <div className="sf-redes" style={{ ...CONTAINER, paddingTop: 14, paddingBottom: 14 }}>
            <p className="sf-h" style={{ margin: 0 }}>Síguenos</p>
            <RedesSociales redes={f.social} whatsapp={contactoPie.whatsapp} tono="claro" forma="barra" />
          </div>
        </div>
      ) : null}

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ ...CONTAINER, display: 'flex', justifyContent: 'space-between', gap: '12px 16px', flexWrap: 'wrap', paddingTop: 14, paddingBottom: 14, fontSize: '13px', color: 'rgba(255,255,255,.55)' }}>
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

/**
 * Encabezado oscuro en los dos modos: las variables de color se fijan aquí
 * dentro, así los enlaces, iconos, menús y el cajón móvil del encabezado se
 * pintan en claro sobre el azul marino aunque el sitio esté en modo claro.
 */
const SH_CSS = `
.sh-hdr{ --color-text:#F5F7FA; --color-text-muted: rgba(245,247,250,.68); --color-border: rgba(255,255,255,.14); --color-surface:#11161C;
  color: var(--color-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--band) 90%, transparent), color-mix(in srgb, var(--band) 80%, transparent));
  backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
  transition: background .3s ease, box-shadow .3s ease; }
/* IGUAL QUE EN EL INICIO, EN TODAS LAS PÁGINAS (2026-11-19, el dueño: «el header cambia en las páginas, no se mantiene como en el hero»).
   En modo oscuro el menú va transparente arriba, sobre el fondo animado, y toma su fondo al bajar (data-desplazado,
   ver EncabezadoSobrePortada). En modo claro el fondo de la página es claro: ahí el menú se queda oscuro para que se lea. */
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .sh-hdr{ background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; } }
:root[data-theme="dark"] .sh-hdr{ background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; }
:root[data-desplazado] .sh-hdr{ background: linear-gradient(180deg, color-mix(in srgb, var(--band) 97%, transparent), color-mix(in srgb, var(--band) 90%, transparent));
  -webkit-backdrop-filter: blur(14px) saturate(140%); backdrop-filter: blur(14px) saturate(140%); box-shadow: 0 12px 30px -20px rgba(0,0,0,.9); }
.sh-hdr .brand-swap .brand-logo-light{ display:none !important; }
.sh-hdr .brand-swap .brand-logo-dark{ display:block !important; }
/* Montserrat es más ancha que la letra de texto: un poco más chica y con menos espacio, para que el menú no se encime con los iconos. */
.sh-hdr .hdr-nav{ font-family: var(--font-display); font-weight:700 !important; font-size:13.5px !important; gap: clamp(9px, .95vw, 15px) !important; letter-spacing:-.005em; }
.sh-hdr .hdr-nav a{ transition: color .18s ease, border-color .18s ease, box-shadow .18s ease; }
.sh-hdr .hdr-nav a:hover{ color: color-mix(in srgb, var(--color-primary) 60%, #fff) !important; }
.sh-hdr .hdr-nav a[aria-current="page"]{ color:#fff !important; border-bottom-color: var(--color-primary) !important; box-shadow: 0 9px 14px -11px var(--color-primary); }
.sh-hdr a.hdr-prov{ font-family: var(--font-display); font-weight:700 !important; background: color-mix(in srgb, #fff 4%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 60%, transparent) !important; transition: background .2s ease, box-shadow .2s ease; }
.sh-hdr a.hdr-prov:hover{ background: color-mix(in srgb, var(--color-primary) 14%, transparent); box-shadow: 0 0 20px -6px var(--color-primary); }
.sh-hdr a.hdr-auth[href="/login"]{ font-family: var(--font-display); font-weight:700 !important; }
.sh-hdr a.hdr-auth[href="/registro"]{ font-family: var(--font-display); font-weight:800 !important;
  box-shadow: 0 12px 28px -12px color-mix(in srgb, var(--color-primary) 85%, transparent), inset 0 1px 0 rgba(255,255,255,.22) !important;
  transition: transform .2s cubic-bezier(.16,1,.3,1), filter .2s ease; }
.sh-hdr a.hdr-auth[href="/registro"]:hover{ transform: translateY(-1px); filter: brightness(1.08); }
.sh-hdr .hdr-icon{ transition: color .18s ease, background .18s ease, box-shadow .18s ease; }
.sh-hdr .hdr-icon:hover{ color:#fff !important; background: color-mix(in srgb, var(--color-primary) 16%, transparent) !important; box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent); }
/* Desde 1440 px también va «Regístrate como proveedor» en el encabezado: botones un poco más compactos para que quepa todo. */
.sh-hdr a.hdr-prov, .sh-hdr a.hdr-auth{ font-size:13px !important; }
.sh-hdr a.hdr-prov{ padding:8px 11px !important; margin-right:6px !important; }
.sh-hdr a.hdr-auth[href="/registro"]{ padding:9px 13px !important; }
@media (prefers-reduced-motion: reduce){ .sh-hdr a.hdr-auth[href="/registro"]:hover{ transform:none; } }
`;
