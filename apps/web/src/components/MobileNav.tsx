'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NavItem } from '@/components/MainNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Icon } from '@/components/Icon';

/** Accesos del área de cuenta (mismos que el menú de usuario del header). */
const ACCOUNT_LINKS = [
  { href: '/cuenta', label: 'Mi perfil' },
  { href: '/cuenta/pedidos', label: 'Mis compras' },
  { href: '/cuenta/cotizaciones', label: 'Cotizaciones' },
  { href: '/cuenta/favoritos', label: 'Favoritos' },
];

/**
 * Navegación de móvil/tablet: botón hamburguesa + panel lateral.
 * Solo se muestra por debajo del breakpoint del header (ver `.hdr-burger`
 * en globals.css); en escritorio manda `MainNav`.
 *
 * Recoge lo que en escritorio vive repartido por el header (nav, sesión,
 * favoritos, contacto), porque ahí no cabe. Textos y colores siguen saliendo
 * de copys/tokens: este componente no decide contenido, solo lo acomoda.
 */
export function MobileNav({
  items,
  labels,
  contact,
}: {
  items: NavItem[];
  labels: { login: string; register: string; logout: string; wishlist: string; track: string; sell: string; menu: string };
  contact: { phone: string | null; email: string | null };
}) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

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

  return (
    <>
      <button
        type="button"
        className="hdr-burger"
        aria-label={labels.menu}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/*
        El panel va por PORTAL a <body>, no aquí dentro: el header tiene
        `backdrop-filter`, y eso crea un bloque contenedor que captura a los
        `position: fixed` descendientes. Sin el portal el drawer se dibujaba
        dentro del header (70px de alto en vez de la pantalla completa).
      */}
      {open && mounted ? createPortal(
        <>
          <div className="mnav-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="mnav-panel" role="dialog" aria-modal="true" aria-label={labels.menu}>
            <div className="mnav-head">
              <span className="mnav-title">{labels.menu}</span>
              {/* El toggle de tema vive aquí en móvil: en el header no cabe. */}
              <ThemeToggle />
              <button type="button" className="mnav-close" aria-label="Cerrar" onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="mnav-links">
              {items.map((it) => (
                <Link key={it.href} href={it.href} className={`mnav-link${isActive(it.href) ? ' is-active' : ''}`} aria-current={isActive(it.href) ? 'page' : undefined}>
                  {it.label}
                </Link>
              ))}
            </nav>

            <div className="mnav-sep" />

            {user ? (
              <>
                <div className="mnav-user">
                  <span className="mnav-avatar">{(user.name.trim()[0] ?? 'U').toUpperCase()}</span>
                  <span className="mnav-user-text">
                    <span className="mnav-user-name">{user.name}</span>
                    {user.email ? <span className="mnav-user-mail">{user.email}</span> : null}
                  </span>
                </div>
                <nav className="mnav-links is-sub">
                  {ACCOUNT_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className="mnav-link is-sub">{l.label}</Link>
                  ))}
                </nav>
                <button type="button" className="mnav-link is-sub mnav-logout" onClick={logout}>{labels.logout}</button>
              </>
            ) : (
              <div className="mnav-auth">
                <Link href="/login" className="mnav-btn is-ghost">{labels.login}</Link>
                <Link href="/registro" className="mnav-btn is-primary">{labels.register}</Link>
              </div>
            )}

            <div className="mnav-sep" />

            <nav className="mnav-links is-sub">
              {/* Favoritos solo aquí si NO hay sesión: con sesión ya sale en
                  ACCOUNT_LINKS y aparecía dos veces en el menú. */}
              {user ? null : <Link href="/cuenta/favoritos" className="mnav-link is-sub">{labels.wishlist}</Link>}
              <Link href="/rastreo" className="mnav-link is-sub">{labels.track}</Link>
              <Link href="/vendedor" className="mnav-link is-sub">{labels.sell}</Link>
            </nav>

            {contact.phone || contact.email ? (
              <div className="mnav-contact">
                {contact.phone ? (
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}><Icon name="phone" size={14} /> {contact.phone}</a>
                ) : null}
                {contact.email ? (
                  <a href={`mailto:${contact.email}`}><Icon name="mail" size={14} /> {contact.email}</a>
                ) : null}
              </div>
            ) : null}
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
}
