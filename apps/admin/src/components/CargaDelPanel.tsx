'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { EVENTO_NAVEGAR } from '@/components/Enlace';

/**
 * PANTALLA DE CARGA DEL PANEL (2026-10-29, pedido del dueño: siluetas grises
 * —esqueleto— mientras llega la siguiente pantalla).
 *
 * Vive dentro del área de trabajo (AdminShell): el menú lateral y la barra de
 * arriba se quedan quietos y solo el contenido cambia por la silueta de la
 * pantalla que viene (tablero, lista, ficha o formulario). Sale en cuanto se
 * toca un enlace (Enlace avisa con EVENTO_NAVEGAR), sin esperar al servidor.
 *
 * El contenido anterior no se desmonta, solo se esconde (`html[data-cargando]`
 * en globals.css): si la pantalla no llega, vuelve tal como estaba, con lo que
 * hubiera escrito. Aparece a los 100 ms (si la pantalla llega antes, no
 * parpadea) y se quita al cambiar la dirección o, por si acaso, a los 15 s.
 */
const APARECE_MS = 100;
const TOPE_MS = 15_000;

type Forma = 'tablero' | 'lista' | 'ficha' | 'formulario';

function formaDe(ruta: string): Forma {
  const p = ruta.split('?')[0] || '/';
  if (p === '/' || p === '/indicadores') return 'tablero';
  if (/\/(nuevo|editar)(\/|$)/.test(p) || /^\/(diseno|correo|cotizador\/(maquinaria|triturados|tarifas)|temas\/)/.test(p) || p === '/cotizador') return 'formulario';
  if (/^\/(cotizaciones|usuarios|cotizador\/historial)\/[^/]+$/.test(p)) return 'ficha';
  return 'lista';
}

/** Un bloque gris. */
function B({ w = '100%', h = 14, r, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="adm-esq" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function Cabecera() {
  return (
    <div className="adm-esq-cab">
      <div className="adm-esq-col" style={{ flex: 1 }}>
        <B w={220} h={26} r={8} />
        <B w="min(420px, 90%)" h={13} />
      </div>
      <B w={150} h={38} r={10} />
    </div>
  );
}

function Silueta({ forma }: { forma: Forma }) {
  switch (forma) {
    case 'tablero':
      return (
        <>
          <Cabecera />
          <div className="adm-esq-cuatro">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="adm-esq-caja"><B w="45%" h={12} /><B w="60%" h={28} r={8} /><B w="80%" h={11} /></div>
            ))}
          </div>
          <div className="adm-esq-dos">
            <div className="adm-esq-caja"><B w="35%" h={15} />{[0, 1, 2, 3, 4].map((i) => <B key={i} h={40} r={8} />)}</div>
            <div className="adm-esq-caja"><B w="45%" h={15} /><B h={190} r={10} /></div>
          </div>
        </>
      );
    case 'ficha':
      return (
        <>
          <Cabecera />
          <div className="adm-esq-fila">{[110, 90, 120, 100].map((w, i) => <B key={i} w={w} h={32} r={8} />)}</div>
          <div className="adm-esq-dos">
            <div className="adm-esq-caja">{[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="adm-esq-par"><B w="30%" h={12} /><B w="50%" h={12} /></div>
            ))}</div>
            <div className="adm-esq-caja"><B w="40%" h={15} />{[0, 1, 2].map((i) => <B key={i} h={54} r={10} />)}</div>
          </div>
        </>
      );
    case 'formulario':
      return (
        <>
          <Cabecera />
          <div className="adm-esq-caja adm-esq-campos">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="adm-esq-col"><B w={i % 2 ? '35%' : '48%'} h={11} /><B h={40} r={8} /></div>
            ))}
          </div>
          <B w={170} h={40} r={10} />
        </>
      );
    default:
      return (
        <>
          <Cabecera />
          <div className="adm-esq-fila">
            <B w="min(320px, 100%)" h={38} r={10} />
            {[100, 120, 90].map((w, i) => <B key={i} w={w} h={38} r={10} />)}
          </div>
          <div className="adm-esq-caja" style={{ gap: 0, padding: 0 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="adm-esq-renglon">
                <B w={34} h={34} r={999} />
                <div className="adm-esq-col" style={{ flex: 1 }}><B w={i % 3 ? '42%' : '55%'} h={13} /><B w="28%" h={11} /></div>
                <B w={90} h={24} r={999} />
                <B w={70} h={13} />
              </div>
            ))}
          </div>
        </>
      );
  }
}

export function CargaDelPanel() {
  const [destino, setDestino] = useState<string | null>(null);
  const espera = useRef<number | undefined>(undefined);
  /** La dirección al tocar el enlace: cuando ya no es esa, llegó la pantalla. */
  const origen = useRef('');

  useEffect(() => {
    const aqui = () => window.location.pathname + window.location.search;
    const alTocar = (e: Event) => {
      const ruta = (e as CustomEvent<string>).detail;
      origen.current = aqui();
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(() => {
        if (aqui() === origen.current) setDestino(ruta); // si ya cambió, llegó antes de los 100 ms
      }, APARECE_MS);
    };
    window.addEventListener(EVENTO_NAVEGAR, alTocar);
    return () => {
      window.removeEventListener(EVENTO_NAVEGAR, alTocar);
      window.clearTimeout(espera.current);
    };
  }, []);

  // Llegó la pantalla: cambió la ruta…
  const pathname = usePathname();
  useEffect(() => {
    window.clearTimeout(espera.current);
    setDestino(null);
  }, [pathname]);

  // …o solo la pestaña (?v=…), que no cambia la ruta: Next cambia la dirección
  // del navegador al pintar la pantalla nueva y se vigila mientras se ve el
  // esqueleto. Sin `useSearchParams`: obliga a un Suspense y arrancaba tarde.
  // Mientras tanto se esconde lo de antes y se sube al principio.
  useEffect(() => {
    if (!destino) return;
    const html = document.documentElement;
    html.setAttribute('data-cargando', '');
    document.querySelector('.adm-content')?.scrollTo({ top: 0 });
    const vigilar = window.setInterval(() => {
      if (window.location.pathname + window.location.search !== origen.current) setDestino(null);
    }, 100);
    const tope = window.setTimeout(() => setDestino(null), TOPE_MS);
    return () => {
      html.removeAttribute('data-cargando');
      window.clearInterval(vigilar);
      window.clearTimeout(tope);
    };
  }, [destino]);

  if (!destino) return null;
  return (
    <div className="adm-esq-pantalla" role="status" aria-live="polite" aria-busy="true">
      <span className="adm-sr">Cargando…</span>
      <Silueta forma={formaDe(destino)} />
    </div>
  );
}
