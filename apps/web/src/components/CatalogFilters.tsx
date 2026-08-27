'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FILTER_DEFS } from '@/lib/catalog-filters';

/**
 * Filtros del catálogo. La selección va a la URL y el servidor la consulta contra
 * la API — antes vivía en un `useState` y no salía de aquí: los menús cambiaban de
 * etiqueta y la lista de productos se quedaba igual.
 *
 * Las opciones y su traducción a la consulta viven en `@/lib/catalog-filters`, que
 * comparte esta barra con la página.
 */
export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // El valor lo manda la URL, no un estado local: así el filtro sobrevive a recargar,
  // compartir el enlace y al botón "atrás".
  useEffect(() => { setPending(null); }, [params]);

  function choose(id: string, value: string) {
    setOpen(null);
    setPending(id);
    const n = new URLSearchParams(params.toString());
    if (value) n.set(id, value);
    else n.delete(id);
    n.delete('page'); // otro filtro = volver a la primera página
    router.push(`${pathname}?${n.toString()}`);
  }

  return (
    <div ref={ref} className="cat-filters" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {FILTER_DEFS.map((d) => {
        const isOpen = open === d.id;
        const current = params.get(d.id) ?? '';
        const cur = d.options.find((o) => o[0] === current) ?? d.options[0];
        const active = current !== '';
        return (
          <div key={d.id} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpen((o) => (o === d.id ? null : d.id))}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 168, background: 'var(--color-surface)', border: `1px solid ${isOpen || active ? 'var(--color-text)' : 'var(--color-border)'}`, borderRadius: 13, padding: '9px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(16,24,40,.03)', transition: 'border-color .15s', opacity: pending === d.id ? 0.6 : 1 }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.02em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{d.label}</span>
              <span className="cf-value" style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '100%' }}>
                <span style={{ fontSize: '14.5px', fontWeight: active ? 700 : 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur[1]}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .18s', transform: isOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            </button>
            {isOpen ? (
              <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: '100%', width: 'max-content', maxWidth: 280, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, boxShadow: '0 12px 32px rgba(16,24,40,.18)', padding: 6, zIndex: 40 }}>
                {d.options.map((o) => {
                  const selected = o[0] === current;
                  return (
                    <button
                      key={o[0]}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="filter-opt"
                      onClick={() => choose(d.id, o[0])}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, border: 'none', background: selected ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: selected ? 700 : 600, color: 'var(--color-text)', textAlign: 'left', padding: '10px 12px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <span>{o[1]}</span>
                      {selected ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
