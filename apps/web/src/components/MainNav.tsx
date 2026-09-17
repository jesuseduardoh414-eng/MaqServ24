'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

export interface NavItem {
  href: string;
  label: string;
  /** Submenú. Si viene, el enlace abre un desplegable en vez de navegar directo. */
  children?: Array<{ href: string; label: string; description?: string }>;
}

/**
 * Navegación principal del header. Client component para resaltar el enlace
 * activo según la ruta actual (usePathname). Los textos llegan ya resueltos
 * desde el server (copys del tema).
 */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() || '/';
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    // `hdr-nav`: por debajo del corte del header (1200px) la oculta el CSS y
    // manda el cajón lateral (MobileNav).
    //
    // UNA SOLA LÍNEA, siempre, y sin desbordar.
    //
    // Antes el tamaño de letra se escalaba con `clamp(…, 1.02vw, 14.5px)`, y
    // eso estaba AL REVÉS: el `vw` mira la ventana, pero el contenedor del
    // header está topado en 1240 px. En una pantalla de 1900 el `vw` mandaba al
    // máximo (14.5) dentro de la caja más estrecha que va a haber nunca, el nav
    // se pasaba ~15 px y, al estar centrado, se salía por los DOS lados: por la
    // derecha contra las acciones y por la izquierda encima del logo, que es lo
    // que se veía pegado a "MAQSER24".
    //
    // Como por debajo de 1200 px manda el cajón lateral, el rango real de este
    // menú es estrecho y no necesita escalar: medida fija que entra con holgura
    // en 1240, y la separación sí cede un poco en el tramo justo.
    <nav
      className="hdr-nav"
      style={{
        display: 'flex', alignItems: 'center',
        gap: 'clamp(10px, 1.1vw, 16px)', fontSize: '14px',
        fontWeight: 600, flex: 1, minWidth: 0, flexWrap: 'nowrap',
      }}
    >
      {/* El centrado vive en globals.css (`safe center`) y no aquí: un estilo
          inline le gana a la hoja y ese matiz es justo lo que impide que el
          menú, si algún día vuelve a no caber, se derrame sobre el logo. */}
      {items.map((item) =>
        item.children?.length ? (
          <NavDesplegable key={item.href} item={item} activo={isActive(item.href)} />
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            style={{
              color: 'var(--color-text)',
              textDecoration: 'none',
              paddingBottom: 3,
              whiteSpace: 'nowrap',
              borderBottom: isActive(item.href) ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/**
 * Entrada de menú con submenú (hoy: Cotizador → maquinaria / triturados).
 *
 * EL PADRE ES UN ENLACE DE VERDAD, no un botón. Se probó con botón y el
 * resultado fue que `/cotizador` no tenía NI UN enlace rastreable desde el
 * home: Google no llegaba a la portada, y sin JavaScript la entrada del menú
 * no iba a ninguna parte. Siendo enlace, el peor caso —sin JS, o un toque en
 * móvil— abre la portada, que justamente existe para elegir entre los dos.
 *
 * El submenú se abre al pasar el puntero y al enfocar con el teclado; Escape y
 * el clic fuera lo cierran.
 */
function NavDesplegable({ item, activo }: { item: NavItem; activo: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();

  // Al navegar, el menú se cierra (la ruta cambia sin desmontar el header).
  useEffect(() => { setAbierto(false); }, [pathname]);

  // Clic fuera y Escape cierran. Sin esto, el panel se queda abierto tapando
  // media pantalla en cuanto el puntero sale por un lado.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div
      ref={caja}
      style={{ position: 'relative' }}
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
      onFocus={() => setAbierto(true)}
      onBlur={(e) => {
        // Solo cierra cuando el foco sale del grupo entero; si no, tabular
        // del padre a la primera opción lo cerraría antes de llegar.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
    >
      <Link
        href={item.href}
        aria-expanded={abierto}
        aria-controls={id}
        aria-haspopup="true"
        aria-current={activo ? 'page' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          color: 'var(--color-text)', textDecoration: 'none', paddingBottom: 3,
          borderBottom: activo ? '2px solid var(--color-primary)' : '2px solid transparent',
        }}
      >
        {item.label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .16s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Link>

      {abierto ? (
        <div
          id={id}
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)',
            minWidth: 272, zIndex: 60, padding: 7,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 22px 48px -20px rgba(0,0,0,.55)',
          }}
        >
          {/* Puente invisible hasta el enlace padre: sin él, el hueco de 12 px
              cierra el menú justo cuando el puntero baja hacia las opciones. */}
          <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: -12, height: 12 }} />
          {item.children!.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              role="menuitem"
              className="hdr-drop-item"
              style={{
                display: 'block', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)', textDecoration: 'none',
              }}
            >
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{c.label}</span>
              {c.description ? (
                <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 400, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  {c.description}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
