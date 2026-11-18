'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from '@/components/Enlace';

/**
 * PESTAÑAS DE CATEGORÍAS DE /servicios (2026-11-18, el dueño: «no recargues ni
 * quites los demás; cuando seleccione una opción solo debe mandarme a donde
 * está, o sea van a seguir apareciendo todos»).
 *
 * En la página van TODAS las categorías, una fila cada una (`#cat-<slug>`). Una
 * pestaña no recarga ni filtra: baja (suave) hasta la fila de esa categoría.
 *  - Se quedan fijas debajo del menú al bajar, para cambiar de categoría sin
 *    volver a subir; en una sola línea que se desliza de lado si no caben.
 *  - Se marca sola la de la fila que se está viendo.
 *  - Si en la página no están las filas (una búsqueda, o un enlace viejo a una
 *    sola categoría), el enlace lleva a la lista completa en esa fila.
 */
export function PestanasCategorias({ base, cats, todosLabel, activa = null }: {
  base: string;
  cats: Array<{ slug: string; name: string }>;
  todosLabel: string;
  /** La categoría elegida por URL (enlace viejo ?categoria=), si hay. */
  activa?: string | null;
}) {
  const nav = useRef<HTMLElement>(null);
  const [top, setTop] = useState(74);
  const [actual, setActual] = useState<string>(activa ?? '');

  // Pegadas justo debajo del menú fijo (su alto cambia con el ancho).
  useEffect(() => {
    const hdr = document.querySelector<HTMLElement>('[data-encabezado-sitio]');
    if (!hdr) { setTop(0); return; }
    const medir = () => setTop(hdr.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(hdr);
    return () => ro.disconnect();
  }, []);

  // La pestaña de la fila que se está viendo.
  useEffect(() => {
    const filas = cats.map((c) => document.getElementById(`cat-${c.slug}`)).filter((f): f is HTMLElement => !!f);
    if (!filas.length) return;
    const alMover = () => {
      const limite = top + (nav.current?.offsetHeight ?? 0) + 48;
      let vista = '';
      for (const f of filas) if (f.getBoundingClientRect().top <= limite) vista = f.id.slice(4);
      setActual(vista);
    };
    alMover();
    window.addEventListener('scroll', alMover, { passive: true });
    return () => window.removeEventListener('scroll', alMover);
  }, [cats, top]);

  // En el celular las pestañas van en una línea que se desliza: la marcada, siempre a la vista.
  useEffect(() => {
    const n = nav.current;
    const tab = n?.querySelector<HTMLElement>('.ms-tab[aria-current]');
    if (!n || !tab) return;
    const izq = tab.offsetLeft - n.offsetLeft;
    if (izq < n.scrollLeft || izq + tab.offsetWidth > n.scrollLeft + n.clientWidth) {
      n.scrollTo({ left: Math.max(0, izq - 16), behavior: 'smooth' });
    }
  }, [actual]);

  const ir = (e: MouseEvent<HTMLAnchorElement>, slug: string) => {
    const destino = slug ? document.getElementById(`cat-${slug}`) : document.querySelector<HTMLElement>('.cl-lista');
    if (!destino) return; // sin filas en esta página: el enlace lleva a la lista completa
    e.preventDefault();
    const y = destino.getBoundingClientRect().top + window.scrollY - top - (nav.current?.offsetHeight ?? 0) - 12;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, y), behavior: quieto ? 'auto' : 'smooth' });
    history.replaceState(history.state, '', slug ? `#cat-${slug}` : `${window.location.pathname}${window.location.search}`);
    setActual(slug);
  };

  return (
    <nav ref={nav} aria-label="Categorías" className="ms-tabs cl-tabs cl-tabs-fijas" style={{ top }} id="resultados">
      <Link href={base} scroll={false} onClick={(e) => ir(e, '')} className="ms-tab" aria-current={!actual ? 'page' : undefined}>{todosLabel}</Link>
      {cats.map((c) => (
        <Link key={c.slug} href={`${base}#cat-${c.slug}`} onClick={(e) => ir(e, c.slug)} className="ms-tab" aria-current={actual === c.slug ? 'page' : undefined}>
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
