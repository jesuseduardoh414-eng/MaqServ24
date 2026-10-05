'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FILTER_DEFS } from '@/lib/catalog-filters';
import { Icon } from '@/components/Icon';

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
    <div ref={ref} className="cf">
      <style>{CSS}</style>
      {FILTER_DEFS.map((d) => {
        const isOpen = open === d.id;
        const current = params.get(d.id) ?? '';
        const cur = d.options.find((o) => o[0] === current) ?? d.options[0];
        const active = current !== '';
        return (
          <div key={d.id} className="cf-item">
            <button
              type="button"
              className="cf-btn"
              data-on={isOpen || active ? 'true' : undefined}
              onClick={() => setOpen((o) => (o === d.id ? null : d.id))}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              style={{ opacity: pending === d.id ? 0.6 : 1 }}
            >
              <span className="cf-label">{d.label}</span>
              <span className="cf-value" data-active={active ? 'true' : undefined}>{cur[1]}</span>
              <span className="cf-chev"><Icon name="chevronDown" size={14} style={{ transition: 'transform .18s', transform: isOpen ? 'rotate(180deg)' : 'none' }} /></span>
            </button>
            {isOpen ? (
              <div role="listbox" aria-label={d.label} className="cf-menu">
                {d.options.map((o) => {
                  const selected = o[0] === current;
                  return (
                    <button
                      key={o[0]}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="cf-opt"
                      onClick={() => choose(d.id, o[0])}
                    >
                      <span>{o[1]}</span>
                      {selected ? <Icon name="check" size={15} style={{ color: 'var(--color-primary)' }} /> : null}
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

/** Estilos propios de la barra (prefijo `cf-`): controles de 44 px y radio 8 como `.ms-select`. */
const CSS = `
.cf{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cf-item{ position:relative; min-width:0; }
.cf-btn{ display:flex; align-items:center; gap:8px; min-height:44px; padding:0 12px 0 13px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; color:var(--color-text); font-family:inherit; font-size:14px; cursor:pointer; text-align:left; transition:border-color .18s ease, opacity .18s ease; max-width:100%; width:100%; }
.cf-btn:hover{ border-color:color-mix(in srgb, var(--color-text) 28%, var(--color-border)); }
.cf-btn[data-on="true"]{ border-color:color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); }
.cf-btn:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.cf-label{ color:var(--color-text-muted); white-space:nowrap; }
.cf-value{ font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
.cf-value[data-active="true"]{ font-weight:600; }
.cf-menu{ position:absolute; top:calc(100% + 6px); left:0; min-width:100%; width:max-content; max-width:min(280px, calc(100vw - 32px)); background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; box-shadow:0 16px 36px -12px rgba(0,0,0,.5); padding:6px; z-index:40; }
.cf-chev{ display:flex; flex-shrink:0; color:var(--color-text-muted); }
.cf-opt{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; border:none; background:transparent; font-family:inherit; font-size:14px; font-weight:500; color:var(--color-text); text-align:left; padding:10px 12px; border-radius:8px; cursor:pointer; white-space:nowrap; }
.cf-opt:hover{ background:color-mix(in srgb, var(--color-text) 6%, transparent); }
.cf-opt[aria-selected="true"]{ background:color-mix(in srgb, var(--color-primary) 12%, transparent); font-weight:600; }
@media (max-width: 640px){
  .cf{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); }
  .cf-btn{ flex-wrap:wrap; gap:0 6px; padding:6px 10px 6px 12px; position:relative; }
  .cf-label{ width:100%; font-size:12px; }
  .cf-chev{ position:absolute; right:10px; top:50%; transform:translateY(-50%); }
  .cf-value{ padding-right:16px; }
  .cf-item:nth-child(even) .cf-menu{ left:auto; right:0; }
}
`;
