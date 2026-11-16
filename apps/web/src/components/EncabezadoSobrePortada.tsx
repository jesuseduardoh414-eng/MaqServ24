'use client';

import { useEffect } from 'react';

/**
 * MENÚ Y PORTADA COMO UNA SOLA PIEZA (2026-11-16, el dueño: «el header se ve
 * negro, debe de quedar igual como si fuera solo uno como el hero»).
 *
 * En el inicio la portada sube por detrás del menú (CSS de la portada) y el
 * menú va transparente mientras se está arriba. Esto solo hace dos cosas:
 *  - marca `data-desplazado` en <html> al bajar, para que el menú recupere su
 *    fondo oscuro y se lea sobre el resto de la página;
 *  - mide el alto real del menú (`--alto-hdr`): la portada se sube justo eso.
 * Sin JavaScript (o antes de cargar) el CSS ya trae un alto aproximado y el
 * menú transparente, que es lo correcto al llegar arriba de la página.
 */
export function EncabezadoSobrePortada() {
  useEffect(() => {
    const html = document.documentElement;
    const hdr = document.querySelector<HTMLElement>('[data-encabezado-sitio]');
    const medir = () => { if (hdr) html.style.setProperty('--alto-hdr', `${hdr.offsetHeight}px`); };
    const ro = hdr ? new ResizeObserver(medir) : null;
    if (hdr && ro) ro.observe(hdr);
    medir();
    const alMover = () => {
      if (window.scrollY > 12) html.setAttribute('data-desplazado', '');
      else html.removeAttribute('data-desplazado');
    };
    alMover();
    window.addEventListener('scroll', alMover, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', alMover);
      html.removeAttribute('data-desplazado');
      html.style.removeProperty('--alto-hdr');
    };
  }, []);
  return null;
}
