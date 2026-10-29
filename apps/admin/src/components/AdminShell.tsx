'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarNav } from './SidebarNav';
import { AvisosBell } from './AvisosBell';
import { useModoClaro } from './modo';
import { MiCuenta } from './MiCuenta';
import { DialogosHost } from './Dialogos';
import { ResultadosHost } from '@maqserv/ui';
import { useBranding } from './branding';
import { CargaDelPanel } from './CargaDelPanel';
import type { ModuloAdmin, RolAdmin } from '@maqserv/config';

const COLLAPSE_KEY = 'maqserv_admin_sidebar_collapsed';

/**
 * Cromo del panel admin: sidebar colapsable + topbar con búsqueda (filtra el
 * menú) + perfil con cierre de sesión. Diseño "Panel MAQSER24".
 */
export function AdminShell({
  adminName,
  adminEmail,
  adminRol,
  adminModulos,
  children,
}: {
  adminName: string;
  adminEmail?: string;
  /** Decide qué secciones se dibujan. Ver SidebarNav. */
  adminRol: RolAdmin;
  /** Módulos YA resueltos por la API (defaults + lo guardado en Permisos). */
  adminModulos?: ModuloAdmin[];
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
  const claro = useModoClaro();
  // En modo claro, la variante para fondo claro si la hay (2026-10-28); si no, la
  // plateada con un filtro que la oscurece (class logo-sobre-claro): sobre blanco no se leía.
  const varianteClara = claro && branding.logoLight && branding.logoLight !== branding.logoDark ? branding.logoLight : null;
  const fullLogo = varianteClara || branding.logoDark || branding.logoLight || branding.logoAlt || null;
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
              className={`adm-brand-img${collapsed ? ' is-square' : ''}${claro && !varianteClara ? ' logo-sobre-claro' : ''}`}
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

        <SidebarNav collapsed={collapsed} query={query} rol={adminRol} modulos={adminModulos} />

        {/* Mi cuenta (2026-10-28): el perfil abre el menú (apariencia, contraseña, salir). */}
        <div className="adm-profile-wrap">
          <MiCuenta
            nombre={adminName}
            correo={adminEmail}
            onCerrarSesion={() => void logout()}
            trigger={
              <button className="adm-profile" title="Mi cuenta" aria-label="Mi cuenta" type="button">
                <span className="adm-avatar">{initial}</span>
                <span className="adm-profile-text">
                  <span className="adm-profile-name">{adminName}</span>
                  <span className="adm-profile-mail">{adminEmail ?? 'Administrador'}</span>
                </span>
                <i className="ph ph-caret-up-down adm-profile-signout" aria-hidden />
              </button>
            }
          />
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

          {/* Campana real (2026-09-25): solicitudes, respuestas de aliados,
              ofertas por revisar y mensajes, en segundos. Ver AvisosBell. */}
          <AvisosBell />
          <div className="adm-topbar-divider" />
          <MiCuenta
            nombre={adminName}
            correo={adminEmail}
            onCerrarSesion={() => void logout()}
            trigger={<button type="button" className="adm-avatar" aria-label="Mi cuenta" title="Mi cuenta" style={{ cursor: 'pointer' }}>{initial}</button>}
          />
        </header>

        <div className="adm-content">
          {/* Silueta de la pantalla que viene, en cuanto se toca un enlace. */}
          <CargaDelPanel />
          <div className="adm-content-inner">{children}</div>
        </div>
      </main>

      {/* confirmar / pedirTexto / avisar: en lugar de los diálogos del navegador. */}
      <DialogosHost />
      {/* Aviso de "sí se hizo / no se hizo" tras CADA cambio. Ver Resultados. */}
      <ResultadosHost
        observar={['/api/admin/']}
        silencio={['/api/admin/auth/', '/api/admin/logout', '/api/admin/avisos/', '/api/admin/mail/previa/']}
        colores={{
          fondo: 'var(--adm-raised)', texto: 'var(--adm-text)', borde: 'var(--adm-border-strong)', tenue: 'var(--adm-faint)',
          ok: 'var(--adm-ok)', mal: 'var(--adm-bad)', alerta: 'var(--adm-warn)', info: 'var(--adm-info)',
        }}
      />
    </div>
  );
}
