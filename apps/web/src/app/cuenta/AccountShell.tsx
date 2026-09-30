import Link from 'next/link';
import type { AuthUser } from '@maqserv/types';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon, type IconName } from '@/components/Icon';
import { CerrarSesion } from './CerrarSesion';

export type SeccionCuenta = 'perfil' | 'cotizaciones' | 'pedidos' | 'favoritos';

/** Rutas verificadas: el rastreo es /rastreo (no /rastrear) y el FAQ vive en el home. */
const AYUDA: { href: string; label: string; icon: IconName }[] = [
  { href: '/contacto', label: 'Hablar con un asesor', icon: 'chat' },
  { href: '/rastreo', label: 'Rastrear un pedido', icon: 'truck' },
  { href: '/#faq', label: 'Preguntas frecuentes', icon: 'article' },
];

const LEGALES = [
  { href: '/terminos', label: 'Términos' },
  { href: '/privacidad', label: 'Privacidad' },
];

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const a = partes[0]?.[0] ?? 'U';
  const b = partes.length > 1 ? partes[1]![0] : '';
  return `${a}${b}`.toUpperCase();
}

function desde(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(iso));
}

/**
 * EL MARCO DE LA CUENTA (2026-09-30). Antes cada pantalla armaba su propio
 * encabezado: el perfil tenía pestañas, pedidos y cotizaciones un "← Mi cuenta"
 * y favoritos ni el estilo del sitio. Ahora las cuatro comparten la barra
 * lateral (quién eres, a dónde ir, ayuda y salir) y un encabezado de página.
 * En móvil la barra se vuelve una fila de pestañas deslizables y la ayuda
 * baja al final, para que el contenido quede arriba.
 */
export function AccountShell({
  theme,
  user,
  active,
  title,
  description,
  action,
  children,
}: {
  theme: Theme;
  user: AuthUser;
  active: SeccionCuenta;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const nav: { key: SeccionCuenta; href: string; label: string; icon: IconName }[] = [
    { key: 'perfil', href: '/cuenta', label: 'Mi perfil', icon: 'user' },
    { key: 'cotizaciones', href: '/cuenta/cotizaciones', label: t(theme, 'account.quotes.title'), icon: 'calculator' },
    { key: 'pedidos', href: '/cuenta/pedidos', label: t(theme, 'account.orders.title'), icon: 'box' },
    { key: 'favoritos', href: '/cuenta/favoritos', label: t(theme, 'account.wishlist.title'), icon: 'heart' },
  ];
  const miembro = desde(user.createdAt);

  const ayuda = (
    <div className="ac-extra">
      <p className="ac-kicker">Ayuda</p>
      <ul className="ac-list">
        {AYUDA.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="ac-link ac-link-sm">
              <Icon name={l.icon} size={15} />
              <span>{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="ac-foot">
        <CerrarSesion />
        <span className="ac-legal">
          {LEGALES.map((l, i) => (
            <span key={l.href}>
              {i > 0 ? ' · ' : ''}
              <Link href={l.href}>{l.label}</Link>
            </span>
          ))}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <SiteHeader theme={theme} />
      <div className="ac-page">
        <style>{CSS}</style>
        <div className="ac-grid">
          <aside className="ac-side" aria-label="Tu cuenta">
            <div className="ac-me">
              <span className="ac-avatar" aria-hidden>{iniciales(user.name)}</span>
              <div className="ac-me-txt">
                <p className="ac-me-name">{user.name}</p>
                <p className="ac-me-mail">{user.email}</p>
                {miembro ? <p className="ac-me-since">Cliente desde {miembro}</p> : null}
              </div>
            </div>

            <nav className="ac-nav" aria-label="Secciones de tu cuenta">
              {nav.map((n) => (
                <Link key={n.key} href={n.href} className="ac-link" aria-current={n.key === active ? 'page' : undefined}>
                  <Icon name={n.icon} size={17} />
                  <span>{n.label}</span>
                </Link>
              ))}
            </nav>

            <div className="ac-extra-desk">{ayuda}</div>
          </aside>

          <main className="ac-main">
            <header className="ac-head">
              <div className="ac-head-txt">
                <h1 className="ac-title">{title}</h1>
                {description ? <p className="ac-desc">{description}</p> : null}
              </div>
              {action ? <div className="ac-head-act">{action}</div> : null}
            </header>
            {children}
            <div className="ac-extra-mob">{ayuda}</div>
          </main>
        </div>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}

/** Estado vacío de las listas: dice qué es la sección y qué hacer para llenarla. */
export function EstadoVacio({
  icono,
  titulo,
  texto,
  accion,
  secundaria,
}: {
  icono: IconName;
  titulo: string;
  texto: string;
  accion?: { href: string; label: string };
  secundaria?: { href: string; label: string };
}) {
  return (
    <div className="ac-empty">
      <span className="ac-empty-ico" aria-hidden><Icon name={icono} size={22} /></span>
      <h2 className="ac-empty-t">{titulo}</h2>
      <p className="ac-empty-p">{texto}</p>
      {accion || secundaria ? (
        <div className="ac-empty-acts">
          {accion ? <Link href={accion.href} className="ac-btn">{accion.label}</Link> : null}
          {secundaria ? <Link href={secundaria.href} className="ac-btn-link">{secundaria.label}<Icon name="arrowRight" size={14} /></Link> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Estilos de toda el área de cuenta. Viven aquí (no en globals.css) porque
 * Turbopack no recompila el global de forma fiable; un <style> en el TSX sí.
 * Fondo negro (`--color-bg`), gunmetal solo en elementos (avatar, bordes) y el
 * azul solo en lo que se puede pulsar o en datos.
 */
const CSS = `
.ac-page{ background:var(--color-bg); color:var(--color-text); }
.ac-grid{ max-width:1180px; margin:0 auto; padding:40px 32px 80px; display:grid; grid-template-columns:260px minmax(0,1fr); gap:48px; align-items:start; }
.ac-side{ position:sticky; top:104px; display:grid; gap:22px; min-width:0; }
.ac-me{ min-width:0; }
.ac-me{ display:flex; gap:12px; align-items:center; padding-bottom:20px; border-bottom:1px solid var(--color-border); }
.ac-avatar{ width:48px; height:48px; border-radius:12px; flex-shrink:0; display:grid; place-items:center; background:var(--color-secondary); color:#F5F7FA; font-family:var(--font-display); font-weight:700; font-size:17px; letter-spacing:.02em; border:1px solid var(--color-border); }
.ac-me-txt{ min-width:0; }
.ac-me-name{ margin:0; font-size:15px; font-weight:600; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ac-me-mail{ margin:3px 0 0; font-size:13px; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ac-me-since{ margin:6px 0 0; font-size:12px; color:var(--color-text-muted); }
.ac-nav{ display:grid; gap:2px; }
.ac-link{ display:flex; align-items:center; gap:11px; min-height:42px; padding:0 12px; border-radius:8px; color:var(--color-text-muted); text-decoration:none; font-size:14.5px; font-weight:500; position:relative; transition:background .18s ease, color .18s ease; }
.ac-link:hover{ background:color-mix(in srgb, var(--color-text) 6%, transparent); color:var(--color-text); }
.ac-link[aria-current="page"]{ background:color-mix(in srgb, var(--color-primary) 13%, transparent); color:var(--color-text); font-weight:600; }
.ac-link[aria-current="page"]::before{ content:''; position:absolute; left:0; top:10px; bottom:10px; width:3px; border-radius:3px; background:var(--color-primary); }
.ac-link[aria-current="page"] svg{ color:var(--color-primary); }
.ac-link:focus-visible, .ac-btn:focus-visible, .ac-btn-link:focus-visible, .ac-row:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.ac-link-sm{ min-height:36px; font-size:13.5px; }
.ac-kicker{ margin:0 0 6px; padding:0 12px; font-size:12px; font-weight:600; color:var(--color-text-muted); }
.ac-list{ list-style:none; margin:0; padding:0; display:grid; gap:1px; }
.ac-extra{ padding-top:18px; border-top:1px solid var(--color-border); }
.ac-foot{ margin-top:14px; padding:0 12px; display:grid; gap:10px; }
.ac-legal{ font-size:12px; color:var(--color-text-muted); }
.ac-legal a{ color:inherit; text-decoration:none; }
.ac-legal a:hover{ color:var(--color-text); text-decoration:underline; }
.ac-extra-mob{ display:none; }

.ac-main{ min-width:0; }
.ac-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:28px; }
.ac-head-txt{ min-width:0; }
.ac-title{ margin:0; font-family:var(--font-display); font-size:30px; font-weight:700; letter-spacing:-.025em; line-height:1.15; text-wrap:balance; }
.ac-desc{ margin:8px 0 0; font-size:14.5px; line-height:1.55; color:var(--color-text-muted); max-width:62ch; text-wrap:pretty; }

.ac-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:0 20px; border-radius:var(--radius-button, 8px); border:none; background:var(--color-primary); color:var(--color-primary-fg); font-family:var(--font-sans); font-size:14.5px; font-weight:600; text-decoration:none; cursor:pointer; transition:filter .18s ease, transform .12s ease, opacity .18s ease; }
.ac-btn:hover{ filter:brightness(1.08); }
.ac-btn:active{ transform:translateY(1px); }
.ac-btn[disabled]{ opacity:.45; cursor:not-allowed; filter:none; transform:none; }
.ac-btn-ghost{ background:transparent; color:var(--color-text); border:1px solid var(--color-border); }
.ac-btn-ghost:hover{ filter:none; border-color:var(--color-text-muted); }
.ac-btn-link{ display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--color-primary); text-decoration:none; }
.ac-btn-link svg{ transition:transform .18s ease; }
.ac-btn-link:hover svg{ transform:translateX(3px); }

.ac-panel{ background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; }
.ac-empty{ border:1px dashed var(--color-border); border-radius:12px; padding:48px 32px 52px; display:grid; justify-items:start; gap:6px; }
.ac-empty-ico{ width:48px; height:48px; border-radius:12px; display:grid; place-items:center; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 10%, transparent); border:1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); margin-bottom:10px; }
.ac-empty-t{ margin:0; font-family:var(--font-display); font-size:20px; font-weight:700; letter-spacing:-.015em; }
.ac-empty-p{ margin:0; font-size:14.5px; color:var(--color-text-muted); line-height:1.55; max-width:52ch; }
.ac-empty-acts{ display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin-top:16px; }

.ac-rows{ display:grid; gap:10px; }
.ac-row{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px 24px; align-items:center; padding:18px 22px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; color:var(--color-text); text-decoration:none; transition:border-color .18s ease, background .18s ease; }
a.ac-row:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.ac-folio{ font-family:var(--font-display); font-size:17px; font-weight:700; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
.ac-meta{ margin-top:4px; font-size:13px; color:var(--color-text-muted); }
.ac-amount{ font-family:var(--font-display); font-size:19px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; text-align:right; }
.ac-amount small{ display:block; font-family:var(--font-sans); font-size:12px; font-weight:500; letter-spacing:0; color:var(--color-text-muted); }
.ac-chips{ display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
.ac-chip{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; border-radius:6px; padding:3px 9px; white-space:nowrap; }
.ac-chip::before{ content:''; width:6px; height:6px; border-radius:50%; background:currentColor; }

@media (max-width: 900px){
  .ac-grid{ grid-template-columns:minmax(0,1fr); gap:24px; padding:24px 16px 64px; }
  .ac-side{ position:static; gap:16px; }
  .ac-me{ padding-bottom:16px; }
  .ac-nav{ display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; margin:0 -16px; padding:0 16px; }
  .ac-nav::-webkit-scrollbar{ display:none; }
  .ac-nav .ac-link{ flex-shrink:0; min-height:38px; border:1px solid var(--color-border); border-radius:999px; padding:0 14px; font-size:13.5px; }
  .ac-nav .ac-link[aria-current="page"]{ border-color:color-mix(in srgb, var(--color-primary) 50%, var(--color-border)); }
  .ac-nav .ac-link[aria-current="page"]::before{ display:none; }
  .ac-extra-desk{ display:none; }
  .ac-extra-mob{ display:block; margin-top:40px; }
  .ac-title{ font-size:25px; }
  .ac-empty{ padding:36px 22px 40px; }
  .ac-row{ padding:16px 16px; }
}
@media (max-width: 560px){
  .ac-row{ grid-template-columns:minmax(0,1fr); }
  .ac-amount{ text-align:left; }
}
`;
