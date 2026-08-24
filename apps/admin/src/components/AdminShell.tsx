'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarNav } from './SidebarNav';
import { useBranding } from './branding';

const COLLAPSE_KEY = 'maqserv_admin_sidebar_collapsed';

/**
 * Cromo del panel admin: sidebar colapsable + topbar con búsqueda (filtra el
 * menú) + perfil con cierre de sesión. Diseño "Panel MAQSER24".
 */
export function AdminShell({
  adminName,
  adminEmail,
  children,
}: {
  adminName: string;
  adminEmail?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const branding = useBranding();
  const [collapsed, setCollapsed] = useState(false);
  // En móvil el sidebar no se "contrae": se abre y cierra encima del contenido.
  // Un riel de iconos de 78px se come un quinto de una pantalla de 390px.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');

  // El sidebar es oscuro → preferimos la variante para fondo oscuro (logoDark).
  // Colapsado usamos el isotipo cuadrado si existe.
  const fullLogo = branding.logoDark || branding.logoLight || branding.logoAlt || null;
  const brandImg = collapsed ? branding.icon || fullLogo : fullLogo;

  // Recupera la preferencia de colapso tras montar (evita mismatch de hidratación).
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
    } catch {
      /* sin localStorage: se queda expandido */
    }
  }, []);

  // El mismo botón hace dos cosas según el ancho: en escritorio contrae el
  // sidebar, en móvil abre/cierra el drawer.
  const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;

  function toggleSidebar() {
    if (isNarrow()) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* noop */
      }
      return next;
    });
  }

  // Escape cierra el drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Al navegar el drawer se cierra (el shell no se desmonta entre páginas).
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const initial = (adminName?.trim()?.[0] ?? 'A').toUpperCase();

  return (
    <div className={`adm-shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}>
      {/* Velo del drawer: solo existe en móvil (lo apaga el CSS en escritorio). */}
      <div className="adm-scrim" onClick={() => setMobileOpen(false)} aria-hidden />

      {/* SIDEBAR */}
      <aside className="adm-sidebar">
        <div className="adm-brand">
          {brandImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={`adm-brand-img${collapsed ? ' is-square' : ''}`}
              src={brandImg}
              alt="MAQSER24 · Panel admin"
            />
          ) : (
            <>
              <div className="adm-logo">
                <i className="ph-bold ph-lightning" aria-hidden />
              </div>
              <div className="adm-brand-text">
                <span className="adm-brand-name">MAQSER24</span>
                <span className="adm-brand-sub">Panel admin</span>
              </div>
            </>
          )}
        </div>

        <SidebarNav collapsed={collapsed} query={query} />

        <div className="adm-profile-wrap">
          <button className="adm-profile" onClick={logout} title="Cerrar sesión" type="button">
            <span className="adm-avatar">{initial}</span>
            <span className="adm-profile-text">
              <span className="adm-profile-name">{adminName}</span>
              <span className="adm-profile-mail">{adminEmail ?? 'Administrador'}</span>
            </span>
            <i className="ph ph-sign-out adm-profile-signout" aria-hidden />
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="adm-main">
        <header className="adm-topbar">
          <button
            className="adm-iconbtn sm"
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            type="button"
          >
            <i className="ph ph-sidebar-simple" aria-hidden />
          </button>

          <div className="adm-topbar-search">
            <i className="ph ph-magnifying-glass" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el panel…"
              aria-label="Buscar en el panel"
            />
          </div>

          <div className="adm-topbar-spacer" />

          <button className="adm-iconbtn" title="Notificaciones" aria-label="Notificaciones" type="button">
            <i className="ph ph-bell" aria-hidden />
            <span className="adm-notif-dot" />
          </button>
          <div className="adm-topbar-divider" />
          <span className="adm-avatar" aria-hidden>{initial}</span>
        </header>

        <div className="adm-content">
          <div className="adm-content-inner">{children}</div>
        </div>
      </main>
    </div>
  );
}
