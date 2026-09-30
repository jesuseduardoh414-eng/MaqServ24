'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANDINGS } from '@/lib/landings';
import { Icon, type IconName } from '@/components/Icon';

type Resultado = { href: string; titulo: string; detalle: string; icono: IconName; imagen?: string | null };
type Equipo = { id: number; slug: string; name: string; brand?: string | null; image?: string | null; isRental?: boolean };

/** Minúsculas y sin acentos, para que "grua" encuentre "Grúa". */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ATAJOS: Resultado[] = [
  { href: '/cotizador/maquinaria', titulo: 'Cotizar maquinaria', detalle: 'Precio al momento por día, semana o mes', icono: 'calculator' },
  { href: '/cotizador/triturados', titulo: 'Cotizar triturados', detalle: 'Grava, arena y base por tonelada o viaje', icono: 'calculator' },
  { href: '/cotizar', titulo: 'Pedir algo a la medida', detalle: 'Cuéntanos qué necesitas y te respondemos', icono: 'chat' },
  { href: '/rastreo', titulo: 'Rastrear un pedido', detalle: 'Con tu número de pedido y correo', icono: 'truck' },
];

/**
 * BUSCADOR DEL ENCABEZADO (2026-09-30).
 *
 * Una barra que baja pegada al encabezado —la página sigue a la vista, sin
 * fondo oscuro ni ventana al centro— con las sugerencias en una lista justo
 * debajo de lo que se escribe, como en cualquier tienda grande.
 *
 * Antes mandaba a /productos?q= y solo buscaba en el nombre del equipo:
 * "concreto" o "pipa" daban cero aunque existieran esas líneas. Ahora sugiere:
 *  - Equipos: el catálogo, que la API busca por nombre, marca, etiquetas y línea.
 *  - Soluciones: las cinco páginas de servicio (nombre, lo que incluyen, usos).
 *  - Atajos: el cotizador y el rastreo, que es a lo que viene casi todo el mundo.
 * Enter abre lo resaltado; sin sugerencias, busca el texto en el catálogo.
 *
 * Va `position:absolute` dentro del header (sticky), así que baja con él.
 */
export function BuscadorGlobal({ onClose, placeholder }: { onClose: () => void; placeholder: string }) {
  const router = useRouter();
  const caja = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 10);
    // Clic fuera de la barra la cierra. El botón de la lupa hace su propio
    // cambio, por eso se ignora aquí (si no, se cerraría y se volvería a abrir).
    const fuera = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (caja.current?.contains(el) || el.closest('[data-buscador-toggle]')) return;
      onClose();
    };
    document.addEventListener('mousedown', fuera);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', fuera); };
  }, [onClose]);

  // Equipos: con pausa de 220 ms para no pedir una búsqueda por tecla.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setEquipos([]); setCargando(false); return; }
    setCargando(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/proxy/catalog/products?search=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: Equipo[] }) => setEquipos(Array.isArray(d.items) ? d.items.slice(0, 5) : []))
        .catch(() => {})
        .finally(() => setCargando(false));
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const soluciones = useMemo<Resultado[]>(() => {
    const palabras = plano(q).split(/\s+/).filter(Boolean);
    // Primero las que lo dicen en el nombre o el resumen; después las que solo
    // lo mencionan en lo que incluyen o para qué obra sirven.
    const lista = palabras.length === 0
      ? LANDINGS
      : LANDINGS
        .map((l) => {
          const corto = plano([l.nombre, l.resumen].join(' '));
          const largo = plano([l.h1, ...l.incluye.items, ...l.usos].join(' '));
          const ok = palabras.every((p) => corto.includes(p) || largo.includes(p));
          return { l, ok, peso: palabras.filter((p) => corto.includes(p)).length };
        })
        .filter((x) => x.ok)
        .sort((a, b) => b.peso - a.peso)
        .map((x) => x.l);
    return lista.map((l) => ({ href: l.ruta, titulo: l.nombre, detalle: l.resumen, icono: 'grid' as IconName }));
  }, [q]);

  const atajos = useMemo(() => {
    const palabras = plano(q).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return ATAJOS;
    return ATAJOS.filter((a) => palabras.every((p) => plano(`${a.titulo} ${a.detalle}`).includes(p)));
  }, [q]);

  const deEquipos: Resultado[] = equipos.map((e) => ({
    href: `/servicios/${e.slug}`,
    titulo: e.name,
    detalle: [e.brand, e.isRental ? 'Renta' : null].filter(Boolean).join(' · ') || 'Ver ficha',
    icono: 'box',
    imagen: e.image,
  }));

  const term = q.trim();
  // Con texto, los equipos van primero: si alguien escribe "excavadora 320",
  // busca esa máquina. Sin texto, se ofrecen las soluciones y los atajos.
  const grupos = (term
    ? [
      { titulo: 'Equipos', items: deEquipos },
      { titulo: 'Soluciones', items: soluciones },
      { titulo: 'Atajos', items: atajos },
    ]
    : [
      { titulo: 'Soluciones', items: soluciones },
      { titulo: 'Lo más buscado', items: atajos },
    ]).filter((g) => g.items.length > 0);
  const planos = grupos.flatMap((g) => g.items);

  useEffect(() => { setActivo(term ? 0 : -1); }, [term, equipos.length]);

  function ir(href: string) {
    onClose();
    router.push(href);
  }
  function verTodo() {
    ir(term ? `/servicios?q=${encodeURIComponent(term)}` : '/servicios');
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(planos.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(-1, i - 1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const elegido = activo >= 0 ? planos[activo] : undefined;
      if (elegido) ir(elegido.href);
      else verTodo();
    }
  }

  // Que el activo siempre quede a la vista al moverse con las flechas.
  useEffect(() => {
    if (activo >= 0) caja.current?.querySelector(`[data-bg-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  let i = -1;

  return (
    <div ref={caja} className="bg-bar" onKeyDown={onKey}>
      <style>{CSS}</style>
      <div className="bg-inner">
        <form
          className="bg-in"
          role="search"
          onSubmit={(e) => { e.preventDefault(); }}
        >
          <Icon name="search" size={19} />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-controls="bg-list"
            aria-activedescendant={activo >= 0 && planos[activo] ? `bg-op-${activo}` : undefined}
            role="combobox"
            aria-expanded
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          {cargando ? <span className="bg-spin" aria-label="Buscando" /> : null}
          {q ? (
            <button type="button" className="bg-clear" onClick={() => { setQ(''); input.current?.focus(); }}>Borrar</button>
          ) : null}
          <button type="button" className="bg-x" onClick={onClose} aria-label="Cerrar buscador"><Icon name="x" size={16} /></button>
        </form>

        <div className="bg-drop" id="bg-list" role="listbox">
          <div className="bg-cols">
            {grupos.map((g) => (
              <div key={g.titulo} className="bg-grp">
                <p className="bg-grp-t">{g.titulo}</p>
                {g.items.map((r) => {
                  i += 1;
                  const idx = i;
                  return (
                    <button
                      key={`${g.titulo}-${r.href}`}
                      type="button"
                      id={`bg-op-${idx}`}
                      data-bg-i={idx}
                      role="option"
                      aria-selected={idx === activo}
                      className="bg-op"
                      onMouseMove={() => setActivo(idx)}
                      onClick={() => ir(r.href)}
                    >
                      <span className="bg-op-ico">
                        {/* El icono queda debajo: si la foto no carga, se ve él y no un hueco. */}
                        <Icon name={r.icono} size={15} />
                        {r.imagen
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={r.imagen} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          : null}
                      </span>
                      <span className="bg-op-txt">
                        <span className="bg-op-t">{r.titulo}</span>
                        <span className="bg-op-d">{r.detalle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {term.length >= 2 && !cargando && planos.length === 0 ? (
            <div className="bg-none">
              <p className="bg-none-t">No encontramos nada con «{term}»</p>
              <p className="bg-none-d">Prueba con otra palabra, o dinos qué necesitas y te lo conseguimos.</p>
              <button type="button" className="bg-none-b" onClick={() => ir('/cotizar')}>Pedir algo a la medida</button>
            </div>
          ) : null}

          {term ? (
            <button type="button" className="bg-all" onClick={verTodo}>
              <Icon name="search" size={14} />
              Buscar «{term.length > 40 ? `${term.slice(0, 40)}…` : term}» en todo el catálogo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.bg-bar{ position:absolute; left:0; right:0; top:100%; z-index:45; background:var(--color-surface); color:var(--color-text); border-top:1px solid var(--color-border); border-bottom:1px solid var(--color-border); box-shadow:0 24px 48px -28px rgba(0,0,0,.7); font-family:var(--font-sans); animation:bg-down .18s ease; }
@keyframes bg-down{ from{ opacity:0; transform:translateY(-6px) } to{ opacity:1; transform:none } }
.bg-inner{ max-width:1240px; margin:0 auto; padding:14px clamp(16px, 4vw, 26px) 16px; }
.bg-in{ display:flex; align-items:center; gap:12px; min-height:50px; padding:0 8px 0 16px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:10px; color:var(--color-text-muted); transition:border-color .18s ease, box-shadow .18s ease; }
.bg-in:focus-within{ border-color:var(--color-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent); }
.bg-in input{ flex:1; min-width:0; border:none; outline:none; background:transparent; color:var(--color-text); font-family:inherit; font-size:16px; }
.bg-in input::placeholder{ color:var(--color-text-muted); }
.bg-clear{ font:inherit; font-size:12.5px; font-weight:600; color:var(--color-text-muted); background:none; border:none; cursor:pointer; padding:4px 6px; }
.bg-clear:hover{ color:var(--color-text); }
.bg-x{ width:34px; height:34px; display:grid; place-items:center; border:none; border-radius:8px; background:transparent; color:var(--color-text-muted); cursor:pointer; }
.bg-x:hover{ background:color-mix(in srgb, var(--color-text) 7%, transparent); color:var(--color-text); }
.bg-spin{ width:15px; height:15px; border-radius:50%; border:2px solid var(--color-border); border-top-color:var(--color-primary); animation:bg-rot .7s linear infinite; }
@keyframes bg-rot{ to{ transform:rotate(360deg) } }
.bg-drop{ margin-top:10px; max-height:min(460px, 62vh); overflow-y:auto; }
.bg-cols{ display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:4px 20px; }
.bg-grp{ min-width:0; }
.bg-grp-t{ margin:0; padding:8px 10px 4px; font-size:12px; font-weight:600; color:var(--color-text-muted); }
.bg-op{ width:100%; display:flex; align-items:center; gap:12px; padding:8px 10px; border:none; border-radius:8px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.bg-op[aria-selected="true"]{ background:color-mix(in srgb, var(--color-primary) 12%, transparent); }
.bg-op-ico{ position:relative; width:34px; height:34px; flex-shrink:0; border-radius:8px; display:grid; place-items:center; overflow:hidden; background:var(--color-bg); border:1px solid var(--color-border); color:var(--color-text-muted); }
.bg-op[aria-selected="true"] .bg-op-ico{ color:var(--color-primary); border-color:color-mix(in srgb, var(--color-primary) 40%, var(--color-border)); }
.bg-op-ico img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.bg-op-txt{ flex:1; min-width:0; display:grid; }
.bg-op-t{ font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bg-op-d{ font-size:12.5px; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bg-none{ padding:18px 10px 8px; }
.bg-none-t{ margin:0; font-size:14.5px; font-weight:600; }
.bg-none-d{ margin:4px 0 12px; font-size:13.5px; color:var(--color-text-muted); }
.bg-none-b{ font:inherit; font-size:14px; font-weight:600; color:var(--color-primary-fg); background:var(--color-primary); border:none; border-radius:var(--radius-button, 8px); padding:9px 16px; cursor:pointer; }
.bg-all{ display:flex; align-items:center; gap:8px; width:100%; margin-top:8px; padding:11px 10px; border:none; border-top:1px solid var(--color-border); background:none; font:inherit; font-size:13.5px; font-weight:600; color:var(--color-primary); cursor:pointer; text-align:left; }
.bg-all:hover{ text-decoration:underline; }
.bg-op:focus-visible, .bg-all:focus-visible, .bg-x:focus-visible{ outline:2px solid var(--color-primary); outline-offset:-2px; }
@media (max-width: 640px){
  .bg-inner{ padding:10px 12px 12px; }
  .bg-drop{ max-height:calc(100dvh - 190px); }
  .bg-clear{ display:none; }
}
`;
