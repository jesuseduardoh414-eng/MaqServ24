'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShButton } from '@maqserv/ui';
import type { NavItem } from '@/components/MainNav';
import { Icon, type IconName } from '@/components/Icon';
import { ACCOUNT_LINKS } from '@/lib/account-links';

/**
 * Icono de cada entrada del menú y de cada acceso de cuenta. Van por RUTA y no
 * en los datos del nav porque las rutas son fijas (las arma `SiteHeader`) y los
 * copys sí son editables: el icono no debería depender de cómo se llame hoy la
 * entrada. Sin coincidencia se cae al punto, que no rompe la columna.
 */
const NAV_ICONS: Record<string, IconName> = {
  '/': 'home',
  '/productos': 'box',
  '/categorias': 'grid',
  '/cotizador': 'calculator',
  '/quienes-somos': 'users',
  '/blog': 'article',
  '/contacto': 'chat',
};
const ACCOUNT_ICONS: Record<string, IconName> = {
  '/cuenta': 'user',
  '/cuenta/pedidos': 'cart',
  '/cuenta/cotizaciones': 'specs',
  '/cuenta/favoritos': 'heart',
};

/*
 * ESTILOS: utilidades de Tailwind sobre el puente de tokens (`bg-panel`,
 * `text-ink`, `border-line`… = `var(--color-*)` que inyecta el SSR desde la BD),
 * al modo de shadcn/ui. La regla de oro sigue intacta: cambiar la paleta en
 * Diseño mueve también este cajón, sin recompilar.
 */
const FILA = 'flex items-center gap-2.5 h-10 rounded-[10px] px-3 no-underline transition-colors';
const SECCION = `${FILA} text-[14px] font-medium text-ink hover:bg-ink/[0.06]`;
/* Activo: relleno suave del color de marca y el icono a juego, sin barras ni
   bloques saturados — el peso lo lleva el color, no el área. */
const ACTIVO = 'bg-brand/[0.12] font-semibold text-brand hover:bg-brand/[0.12]';
const ACCESO = `${FILA} h-9 text-[13px] font-medium text-ink-muted hover:bg-ink/[0.06] hover:text-ink`;
const ROTULO = 'px-3 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted';

/**
 * Claro/Oscuro como segmento, no como un sol suelto en la esquina.
 *
 * Misma mecánica que `ThemeToggle` (que sigue sirviendo al header de
 * escritorio): escribe `data-theme` en <html> y guarda la preferencia. Aquí se
 * ve en qué modo estás sin tener que deducirlo del icono.
 */
function TemaSegmento({ claro, oscuro }: { claro: string; oscuro: string }) {
  const [modo, setModo] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const actual = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    setModo(actual ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }, []);

  function aplicar(m: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', m);
    try { localStorage.setItem('theme', m); } catch { /* ignora */ }
    setModo(m);
  }

  const base = 'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold transition-colors';
  const activo = 'bg-brand/[0.16] text-brand';
  const quieto = 'text-ink-muted hover:text-ink';
  return (
    <div className="flex gap-1 rounded-[10px] border border-line p-1" role="group">
      <button type="button" onClick={() => aplicar('light')} aria-pressed={modo === 'light'} className={`${base} ${modo === 'light' ? activo : quieto}`}>
        <Icon name="sun" size={14} /> {claro}
      </button>
      <button type="button" onClick={() => aplicar('dark')} aria-pressed={modo === 'dark'} className={`${base} ${modo === 'dark' ? activo : quieto}`}>
        <Icon name="moon" size={14} /> {oscuro}
      </button>
    </div>
  );
}

/**
 * Navegación de móvil/tablet: botón hamburguesa + panel lateral.
 * Solo se muestra por debajo del breakpoint del header (ver `.hdr-burger`
 * en globals.css); en escritorio manda `MainNav`.
 *
 * Recoge lo que en escritorio vive repartido por el header (marca, buscador,
 * nav, sesión, tema, contacto), porque ahí no cabe. Textos y colores siguen
 * saliendo de copys/tokens: este componente no decide contenido, solo lo acomoda.
 *
 * REPARTO DEL PANEL (tres franjas):
 *  - cabecera fija: marca + cerrar + buscador;
 *  - cuerpo con scroll: menú (con grupos plegables) + accesos rápidos;
 *  - pie fijo: tema, sesión y contacto.
 */
export function MobileNav({
  items,
  labels,
  contact,
  brand,
}: {
  items: NavItem[];
  labels: {
    login: string; register: string; logout: string; wishlist: string;
    track: string; sell: string; menu: string; groupQuick: string; groupAccount: string;
    search: string; themeLight: string; themeDark: string;
  };
  contact: { phone: string | null; email: string | null };
  brand: { name: string; logoLight: string | null; logoDark: string | null };
}) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  // Grupos plegados: por defecto TODOS abiertos (son dos opciones, no un árbol).
  // El plegado existe para quien ya sabe a dónde va y quiere la lista corta.
  const [plegado, setPlegado] = useState<Record<string, boolean>>({});

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  // Solo tras montar hay `document` para el portal (ver más abajo por qué).
  useEffect(() => { setMounted(true); }, []);

  // El drawer se cierra al navegar (la ruta cambia sin desmontar el header).
  useEffect(() => { setOpen(false); }, [pathname]);

  // Con el panel abierto: sin scroll de fondo y Escape cierra.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // La sesión se hidrata en cliente (igual que HeaderActions) para no romper el
  // render estático de las páginas.
  useEffect(() => {
    if (!open || user) return;
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d) => setUser(d.user ? { name: String(d.user.name ?? ''), email: String(d.user.email ?? '') } : null))
      .catch(() => setUser(null));
  }, [open, user]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setOpen(false);
    window.location.href = '/';
  }

  const logo = brand.logoLight || brand.logoDark;
  const dosLogos = Boolean(brand.logoLight && brand.logoDark);

  return (
    <>
      <button
        type="button"
        className="hdr-burger"
        aria-label={labels.menu}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={22} />
      </button>

      {/*
        El panel va por PORTAL a <body>, no aquí dentro: el header tiene
        `backdrop-filter`, y eso crea un bloque contenedor que captura a los
        `position: fixed` descendientes. Sin el portal el drawer se dibujaba
        dentro del header (70px de alto en vez de la pantalla completa).
      */}
      {open && mounted ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[90] bg-second/60 backdrop-blur-[2px] animate-in fade-in duration-200 motion-reduce:animate-none"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* `bg-panel` y no `bg-page`: el cajón se levanta del fondo negro de
              la página, como una tarjeta. Con los dos en negro, el único borde
              era la línea de 1px. */}
          <div
            className="fixed inset-y-0 right-0 z-[91] grid w-[min(344px,90vw)] grid-rows-[auto_1fr_auto]
                       overflow-hidden border-l border-line bg-panel font-body
                       shadow-[-24px_0_60px_-24px_rgba(0,0,0,.65)]
                       animate-in slide-in-from-right duration-200 ease-out motion-reduce:animate-none"
            role="dialog"
            aria-modal="true"
            aria-label={labels.menu}
          >
            <div className="px-3 pt-4 pb-3">
              {/* Marca arriba, como en cualquier panel lateral: el cajón tapa el
                  header, así que sin esto se pierde de qué sitio es. */}
              <div className="flex items-center gap-2.5">
                <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 no-underline">
                  {logo ? (
                    dosLogos ? (
                      <span className="brand-swap inline-flex items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="brand-logo-light h-8 w-auto object-contain" src={brand.logoLight as string} alt={brand.name} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="brand-logo-dark h-8 w-auto object-contain" src={brand.logoDark as string} alt={brand.name} />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="h-8 w-auto object-contain" src={logo} alt={brand.name} />
                    )
                  ) : (
                    <>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand font-head text-[17px] text-brand-fg">
                        {brand.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate font-head text-[15px] uppercase text-ink">{brand.name}</span>
                    </>
                  )}
                </Link>
                <ShButton variant="ghost" size="icon" aria-label="Cerrar" onClick={() => setOpen(false)}>
                  <Icon name="x" size={18} />
                </ShButton>
              </div>

              {/* Buscar dentro del cajón: con el panel abierto, el buscador del
                  header queda tapado. Mismo destino que aquél (/productos?q=). */}
              <form action="/productos" method="get" className="mt-3">
                <div className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-page px-3 focus-within:border-brand">
                  <Icon name="search" size={15} className="text-ink-muted" />
                  <input
                    name="q"
                    placeholder={labels.search}
                    aria-label={labels.search}
                    className="min-w-0 flex-1 border-0 bg-transparent font-body text-[13.5px] text-ink outline-none placeholder:text-ink-muted"
                  />
                </div>
              </form>
            </div>

            {/* `min-h-0` es lo que deja encoger a la franja `1fr`: sin ella el
                cuerpo crece con su contenido y el pie se va fuera de pantalla. */}
            <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
              <nav className="flex flex-col">
                {items.map((it) => {
                  const activo = isActive(it.href);
                  const conHijos = Boolean(it.children?.length);
                  const abierto = conHijos && !plegado[it.href];
                  const hijos = it.children ?? [];
                  const icono = (
                    <Icon
                      name={NAV_ICONS[it.href] ?? 'dot'}
                      size={17}
                      className={activo ? 'text-brand' : 'text-ink-muted'}
                    />
                  );
                  return (
                    <div key={it.href}>
                      {conHijos ? (
                        // TODA la fila pliega, como en los paneles de
                        // referencia. Antes solo el chevron, y eran 28px
                        // pegados al borde: en un pulgar, eso no existe.
                        <button
                          type="button"
                          onClick={() => setPlegado((p) => ({ ...p, [it.href]: !p[it.href] }))}
                          aria-expanded={abierto}
                          className={`${SECCION} ${activo ? ACTIVO : ''} w-full cursor-pointer text-left font-body`}
                        >
                          {icono}
                          <span className="min-w-0 flex-1 truncate">{it.label}</span>
                          <Icon name="chevronDown" size={14} className={`transition-transform ${abierto ? '' : '-rotate-90'}`} />
                        </button>
                      ) : (
                        <Link
                          href={it.href}
                          className={`${SECCION} ${activo ? ACTIVO : ''}`}
                          aria-current={activo ? 'page' : undefined}
                        >
                          {icono}
                          <span className="truncate">{it.label}</span>
                        </Link>
                      )}

                      {abierto ? (
                        // Riel con punto en el hijo activo: se lee de quién
                        // cuelgan sin repetir iconos ni sangrar a ojo.
                        <div className="my-0.5 ml-[21px] flex flex-col border-l border-line pl-3">
                          {hijos.map((c) => {
                            // Exacto, no `isActive`: con "empieza por" la
                            // portada salía activa también en sus hijas.
                            const act = pathname === c.href;
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                className={`relative flex h-9 items-center rounded-[8px] px-2.5 text-[13px] no-underline transition-colors ${
                                  act ? 'bg-brand/[0.12] font-semibold text-brand' : 'font-medium text-ink-muted hover:bg-ink/[0.06] hover:text-ink'
                                }`}
                              >
                                {act ? <span aria-hidden className="absolute -left-4 h-1.5 w-1.5 rounded-full bg-brand" /> : null}
                                {c.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>

              {/* Con sesión, la cuenta es su propio grupo y no se mezcla con los
                  accesos públicos. */}
              {user ? (
                <>
                  <div className="-mx-3 mt-3 h-px bg-line" />
                  <p className={ROTULO}>{labels.groupAccount}</p>
                  <nav className="flex flex-col">
                    {ACCOUNT_LINKS.map((l) => (
                      <Link key={l.href} href={l.href} className={ACCESO}>
                        <Icon name={ACCOUNT_ICONS[l.href] ?? 'user'} size={15} />{l.label}
                      </Link>
                    ))}
                  </nav>
                </>
              ) : null}

              <div className="-mx-3 mt-3 h-px bg-line" />
              <p className={ROTULO}>{labels.groupQuick}</p>
              <nav className="flex flex-col">
                {/* Favoritos solo sin sesión: con sesión ya sale en
                    ACCOUNT_LINKS y aparecía dos veces en el menú. */}
                {user ? null : (
                  <Link href="/cuenta/favoritos" className={ACCESO}><Icon name="heart" size={15} />{labels.wishlist}</Link>
                )}
                <Link href="/rastreo" className={ACCESO}><Icon name="truck" size={15} />{labels.track}</Link>
                <Link href="/vendedor" className={ACCESO}><Icon name="shield" size={15} />{labels.sell}</Link>
              </nav>
            </div>

            {/* Pie fijo: tema, sesión y contacto. La sesión es la acción
                principal del menú y el contacto es lo que el cliente busca
                cuando ya no encuentra lo que quiere: ninguno debería depender
                de cuánto haya rodado la lista. */}
            <div className="flex flex-col gap-3 border-t border-line bg-page px-3 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
              <TemaSegmento claro={labels.themeLight} oscuro={labels.themeDark} />

              {user ? (
                <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-panel p-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[15px] font-extrabold text-brand-fg">
                    {(user.name.trim()[0] ?? 'U').toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-bold text-ink">{user.name}</span>
                    {user.email ? <span className="truncate text-[11.5px] text-ink-muted">{user.email}</span> : null}
                  </span>
                  <ShButton variant="ghost" size="icon" onClick={logout} aria-label={labels.logout} title={labels.logout} className="text-ink-muted hover:text-bad">
                    <Icon name="logout" size={16} />
                  </ShButton>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <ShButton asChild variant="outline"><Link href="/login">{labels.login}</Link></ShButton>
                  <ShButton asChild><Link href="/registro">{labels.register}</Link></ShButton>
                </div>
              )}

              {contact.phone || contact.email ? (
                <div className="flex flex-col gap-1.5">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                      className="flex items-center gap-2 text-[12.5px] text-ink-muted no-underline transition-colors hover:text-ink"
                    >
                      <Icon name="phone" size={14} /> {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-[12.5px] text-ink-muted no-underline transition-colors hover:text-ink"
                    >
                      <Icon name="mail" size={14} /> {contact.email}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
}
