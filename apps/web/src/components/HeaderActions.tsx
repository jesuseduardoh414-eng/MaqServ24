'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/CartProvider';
import { NotificationsBell } from '@/components/NotificationsBell';
import { Icon } from '@/components/Icon';

/** Accesos del menú de usuario (área de cuenta). */
const ACCOUNT_LINKS = [
  { href: '/cuenta', label: 'Mi perfil' },
  { href: '/cuenta/pedidos', label: 'Mis compras' },
  { href: '/cuenta/cotizaciones', label: 'Cotizaciones' },
  { href: '/cuenta/favoritos', label: 'Favoritos' },
];
const menuItemStyle: React.CSSProperties = {
  display: 'block', padding: '9px 12px', borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600,
};

/**
 * Zona derecha del header (cliente) al estilo SEGAshop: buscador desplegable,
 * favoritos, carrito con contador y sesión/registro. La sesión se hidrata en
 * cliente para que las páginas puedan seguir siendo estáticas (ISR).
 * Estilos: solo tokens del tema.
 */
export function HeaderActions({
  labels,
}: {
  labels: {
    search: string;
    wishlist: string;
    cart: string;
    login: string;
    register: string;
    logout: string;
    greeting: string;
    searchPlaceholder: string;
  };
}) {
  const cart = useCart();
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [favCount, setFavCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra el menú de usuario al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d) => setUser(d.user ? { id: Number(d.user.id), name: String(d.user.name ?? ''), email: String(d.user.email ?? '') } : null))
      .catch(() => setUser(null));
    fetch('/api/proxy/wishlist/ids')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: number[]) => Array.isArray(ids) && setFavCount(ids.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  }

  const iconBtn: React.CSSProperties = {
    position: 'relative', width: 38, height: 38, borderRadius: '50%',
    border: 'none', background: 'transparent', color: 'var(--color-text-muted)',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
  };

  return (
    // En móvil sobreviven aquí solo buscar y carrito; favoritos, avisos y
    // sesión se mueven al drawer (ver `.hdr-fav` / `.hdr-auth` en globals.css).
    <div className="hdr-actions" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button type="button" className="hdr-icon" title={labels.search} aria-label={labels.search} style={iconBtn} onClick={() => setSearchOpen((v) => !v)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      </button>

      {/* Solo con sesión: los avisos son por usuario. */}
      {user ? <span className="hdr-bell"><NotificationsBell userId={user.id} /></span> : null}

      <Link href="/cuenta/favoritos" className="hdr-icon hdr-fav" title={labels.wishlist} aria-label={labels.wishlist} style={iconBtn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
        {favCount > 0 ? <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, background: 'var(--color-primary)', borderRadius: '50%', border: '1.5px solid var(--color-surface)' }} /> : null}
      </Link>

      <Link href="/carrito" className="hdr-icon" title={labels.cart} aria-label={labels.cart} style={iconBtn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 2h2.5l2.2 12.4a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 6H5.5" /></svg>
        {cart.count > 0 ? (
          <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: 'var(--color-secondary)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--color-surface)', fontVariantNumeric: 'tabular-nums' }}>{cart.count}</span>
        ) : null}
      </Link>

      <span className="hdr-auth" style={{ width: 1, height: 26, background: 'var(--color-border)', margin: '0 8px' }} />

      {user ? (
        <div ref={menuRef} className="hdr-auth" style={{ position: 'relative' }}>
          <style>{`.hdr-menu-item:hover{ background: color-mix(in srgb, var(--color-text) 6%, transparent); }`}</style>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={`${labels.greeting}, ${user.name}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 100, padding: '4px 12px 4px 4px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>
              {(user.name.trim()[0] ?? 'U').toUpperCase()}
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name.split(' ')[0]}
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s', flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen ? (
            <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', minWidth: 230, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 44px -20px rgba(0,0,0,.45)', padding: 6, zIndex: 60 }}>
              <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                {user.email ? <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{user.email}</div> : null}
              </div>
              {ACCOUNT_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="hdr-menu-item" onClick={() => setMenuOpen(false)} style={menuItemStyle}>{l.label}</Link>
              ))}
              <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />
              <button type="button" className="hdr-menu-item" onClick={logout} style={{ ...menuItemStyle, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                {labels.logout}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <Link href="/login" className="hdr-auth" style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '14px', padding: '0 4px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {labels.login}
          </Link>
          <Link
            href="/registro"
            className="hdr-auth"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-fg)',
              fontWeight: 700,
              fontSize: '14px',
              padding: '10px 16px',
              whiteSpace: 'nowrap',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              boxShadow: '0 12px 24px -14px color-mix(in srgb, var(--color-primary) 95%, transparent)',
            }}
          >
            {labels.register}
          </Link>
        </>
      )}

      {/* Barra de búsqueda desplegable (anclada bajo el header sticky) */}
      {searchOpen ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 40,
          }}
        >
          <form
            action="/productos"
            method="get"
            style={{ maxWidth: 1240, margin: '0 auto', padding: '16px clamp(16px, 4vw, 26px)', display: 'flex', alignItems: 'center', gap: 12 }}
            onSubmit={() => setSearchOpen(false)}
          >
            <span style={{ fontSize: '20px', color: 'var(--grey)' }}>⌕</span>
            <input
              ref={searchInput}
              name="q"
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
              style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--color-text)', outline: 'none' }}
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Cerrar"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', width: 34, height: 34, cursor: 'pointer', color: 'var(--grey)' }}
            >
              <Icon name="x" size={15} style={{ margin: "0 auto" }} />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
