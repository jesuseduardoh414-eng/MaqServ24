'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { EVENTO_NAVEGAR } from '@/components/Enlace';

/**
 * PANTALLA DE CARGA (2026-10-29, pedido del dueño: "que se vea que va a
 * cargar la siguiente página", con siluetas grises —esqueleto—).
 *
 * En cuanto se toca un enlace (Enlace avisa con EVENTO_NAVEGAR) se tapa el
 * contenido, justo debajo del encabezado, con la silueta de la página que
 * viene: catálogo, ficha de un equipo, formulario, cuenta, texto o portada.
 * No espera al servidor: con el hosting lento, la página nueva podía tardar
 * segundos y parecía que el clic no había hecho nada.
 *
 * - Aparece a los 100 ms: si la página llega antes, no parpadea.
 * - Se quita sola cuando cambia la dirección (llegó la página) y, por si la
 *   página nunca llega (sin red), a los 15 s.
 * - Se monta en el layout raíz (no se desmonta entre páginas).
 * - Con "reducir movimiento", sin brillo.
 */
const APARECE_MS = 100;
const TOPE_MS = 15_000;

type Forma = 'inicio' | 'catalogo' | 'detalle' | 'formulario' | 'cuenta' | 'texto';

function formaDe(ruta: string): Forma {
  const p = ruta.split('?')[0] || '/';
  if (p === '/') return 'inicio';
  if (/^\/(servicios|productos)\/[^/]+$/.test(p)) return 'detalle';
  if (p === '/cotizador' || p.startsWith('/cuenta/favoritos')) return 'catalogo';
  if (/^\/(cotizador|cotizar|cotizacion|contacto|proveedores|login|registro|restablecer|resena)(\/|$)/.test(p)) return 'formulario';
  if (/^\/cuenta(\/|$)/.test(p)) return 'cuenta';
  if (/^\/(blog\/[^/]+|privacidad|terminos|quienes-somos|preguntas-frecuentes)$/.test(p)) return 'texto';
  return 'catalogo';
}

const CSS = `
.esq-velo{ position:fixed; left:0; right:0; bottom:0; z-index:45; background:var(--color-bg); overflow:hidden; animation:esqAparece .18s ease both; }
@keyframes esqAparece{ from{ opacity:0; } to{ opacity:1; } }
.esq-caja{ max-width:1180px; margin:0 auto; padding:40px 32px; display:grid; gap:28px; }
.esq-caja-angosta{ max-width:760px; }
.esq{ display:block; position:relative; overflow:hidden; border-radius:8px; background:color-mix(in srgb, var(--color-text) 7%, var(--color-bg)); }
.esq::after{ content:''; position:absolute; inset:0; transform:translateX(-100%);
  background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-text) 7%, transparent), transparent);
  animation:esqBrillo 1.3s ease-in-out infinite; }
@keyframes esqBrillo{ to{ transform:translateX(100%); } }
.esq-cab{ display:grid; gap:12px; }
.esq-fila{ display:flex; gap:10px; overflow:hidden; }
.esq-fila > .esq{ flex-shrink:0; }
.esq-rejilla{ display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:20px; }
.esq-tarjeta{ display:grid; gap:12px; padding:14px; border:1px solid var(--color-border); border-radius:14px; }
.esq-dos{ display:grid; grid-template-columns:1.15fr 1fr; gap:32px; align-items:start; }
.esq-cuenta{ display:grid; grid-template-columns:240px 1fr; gap:28px; align-items:start; }
.esq-campos{ display:grid; grid-template-columns:1fr 1fr; gap:18px 20px; padding:24px; border:1px solid var(--color-border); border-radius:14px; }
.esq-campo{ display:grid; gap:8px; }
.esq-lista{ display:grid; gap:12px; }
@media (max-width:760px){
  .esq-caja{ padding:24px 16px; gap:22px; }
  .esq-dos, .esq-cuenta, .esq-campos{ grid-template-columns:1fr; }
  .esq-rejilla{ grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:14px; }
  .esq-solo-ancho{ display:none; }
}
@media (prefers-reduced-motion: reduce){ .esq::after{ animation:none; } .esq-velo{ animation:none; } }
`;

/** Un bloque gris. */
function B({ w = '100%', h = 14, r, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="esq" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function Cabecera({ ancho = '46%' }: { ancho?: string }) {
  return (
    <div className="esq-cab">
      <B w={90} h={11} />
      <B w={ancho} h={34} r={10} style={{ maxWidth: '100%' }} />
      <B w="62%" h={14} />
    </div>
  );
}

function Tarjetas({ n }: { n: number }) {
  return (
    <div className="esq-rejilla">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="esq-tarjeta">
          <B h={0} r={10} style={{ paddingTop: '72%' }} />
          <B w="80%" h={15} />
          <B w="55%" h={12} />
          <B w="100%" h={38} r={10} />
        </div>
      ))}
    </div>
  );
}

function Lineas({ n }: { n: number }) {
  const anchos = ['100%', '96%', '88%', '100%', '72%', '94%', '83%', '100%', '64%', '91%', '78%', '45%'];
  return (
    <div className="esq-lista">
      {Array.from({ length: n }, (_, i) => <B key={i} w={anchos[i % anchos.length]} h={13} />)}
    </div>
  );
}

function Silueta({ forma }: { forma: Forma }) {
  switch (forma) {
    case 'inicio':
      return (
        <div className="esq-caja">
          <B h="min(46vh, 420px)" r={18} />
          <div className="esq-fila">{[120, 96, 140, 110, 90].map((w, i) => <B key={i} w={w} h={34} r={999} />)}</div>
          <Tarjetas n={4} />
        </div>
      );
    case 'detalle':
      return (
        <div className="esq-caja">
          <B w={220} h={12} />
          <div className="esq-dos">
            <div className="esq-lista">
              <B h={0} r={16} style={{ paddingTop: '75%' }} />
              <div className="esq-fila esq-solo-ancho">{[0, 1, 2, 3].map((i) => <B key={i} w={84} h={64} r={10} />)}</div>
            </div>
            <div className="esq-lista" style={{ gap: 16 }}>
              <B w={110} h={24} r={999} />
              <B w="90%" h={30} r={10} />
              <B w="60%" h={30} r={10} />
              <Lineas n={4} />
              <B h={92} r={14} />
              <div className="esq-fila"><B w="48%" h={46} r={12} /><B w="48%" h={46} r={12} /></div>
            </div>
          </div>
        </div>
      );
    case 'formulario':
      return (
        <div className="esq-caja">
          <Cabecera ancho="40%" />
          <div className="esq-fila">{[0, 1, 2, 3].map((i) => <B key={i} w={130} h={34} r={999} />)}</div>
          <div className="esq-campos">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="esq-campo"><B w={i % 2 ? '35%' : '45%'} h={12} /><B h={44} r={10} /></div>
            ))}
          </div>
          <B w={200} h={46} r={12} />
        </div>
      );
    case 'cuenta':
      return (
        <div className="esq-caja">
          <Cabecera ancho="32%" />
          <div className="esq-cuenta">
            <div className="esq-lista esq-solo-ancho">{[0, 1, 2, 3, 4].map((i) => <B key={i} h={38} r={10} />)}</div>
            <div className="esq-lista">{[0, 1, 2, 3, 4].map((i) => <B key={i} h={76} r={14} />)}</div>
          </div>
        </div>
      );
    case 'texto':
      return (
        <div className="esq-caja esq-caja-angosta">
          <Cabecera ancho="70%" />
          <Lineas n={12} />
          <Lineas n={7} />
        </div>
      );
    default:
      return (
        <div className="esq-caja">
          <Cabecera />
          <div className="esq-fila">{[90, 130, 110, 150, 100, 120].map((w, i) => <B key={i} w={w} h={34} r={999} />)}</div>
          <Tarjetas n={8} />
        </div>
      );
  }
}

export function CargaDePagina() {
  const [destino, setDestino] = useState<string | null>(null);
  const [arriba, setArriba] = useState(0);
  const espera = useRef<number | undefined>(undefined);
  /** La dirección al tocar el enlace: cuando ya no es esa, llegó la página. */
  const origen = useRef('');

  useEffect(() => {
    const aqui = () => window.location.pathname + window.location.search;
    const alTocar = (e: Event) => {
      const ruta = (e as CustomEvent<string>).detail;
      origen.current = aqui();
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(() => {
        if (aqui() !== origen.current) return; // llegó antes de los 100 ms
        const encabezado = document.querySelector('[data-encabezado-sitio]');
        setArriba(Math.max(0, encabezado?.getBoundingClientRect().bottom ?? 0));
        setDestino(ruta);
      }, APARECE_MS);
    };
    window.addEventListener(EVENTO_NAVEGAR, alTocar);
    return () => {
      window.removeEventListener(EVENTO_NAVEGAR, alTocar);
      window.clearTimeout(espera.current);
    };
  }, []);

  // Llegó la página: cambió la ruta…
  const pathname = usePathname();
  useEffect(() => {
    window.clearTimeout(espera.current);
    setDestino(null);
  }, [pathname]);

  // …o solo los filtros (?categoria=…), que no cambian la ruta: Next cambia la
  // dirección del navegador al pintar la página nueva, y se vigila mientras se
  // ve el esqueleto. Sin `useSearchParams` a propósito: obliga a envolverlo en
  // Suspense y entonces arrancaba casi un segundo tarde (un clic justo al
  // cargar se perdía).
  useEffect(() => {
    if (!destino) return;
    const vigilar = window.setInterval(() => {
      if (window.location.pathname + window.location.search !== origen.current) setDestino(null);
    }, 100);
    const tope = window.setTimeout(() => setDestino(null), TOPE_MS);
    return () => {
      window.clearInterval(vigilar);
      window.clearTimeout(tope);
    };
  }, [destino]);

  if (!destino) return null;
  return (
    <div className="esq-velo" style={{ top: arriba }} role="status" aria-live="polite" aria-busy="true">
      <style>{CSS}</style>
      <span className="sr-only">Cargando…</span>
      <Silueta forma={formaDe(destino)} />
    </div>
  );
}
