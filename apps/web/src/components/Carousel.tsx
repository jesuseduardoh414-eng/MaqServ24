'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';

const GAP = 22;

/**
 * Carrusel horizontal con encabezado (eyebrow + título) y botones ←/→.
 * Presentacional: las tarjetas (children) se renderizan en el servidor y se
 * pasan aquí; este componente solo aporta el scroll interactivo.
 * Estilos: solo tokens del tema (var(--...)).
 *
 * EL AVANCE SE MIDE AL HACER CLIC. Antes era un número fijo de píxeles (422,
 * el ancho de la tarjeta en escritorio) que no tenía nada que ver con el ancho
 * real en el navegador de turno: en un teléfono, donde la tarjeta mide el 84 %
 * de la pantalla, cada clic dejaba el carrusel entre dos tarjetas y se veían
 * las dos cortadas. Mismo arreglo que en `CategoryStrip`.
 */
export function Carousel({
  eyebrow,
  title,
  eyebrowColor,
  titleColor,
  children,
}: {
  eyebrow: string;
  title: string;
  eyebrowColor?: string;
  titleColor?: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(false);

  const medir = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // 2px de margen: con anchos fraccionarios `scrollLeft` no llega nunca al
    // máximo exacto y la flecha derecha se quedaría siempre encendida.
    setAlInicio(el.scrollLeft <= 2);
    setAlFinal(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      ro.disconnect();
    };
  }, [medir]);

  function by(dir: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const ancho = (card?.offsetWidth ?? 380) + GAP;
    const caben = Math.max(1, Math.floor(el.clientWidth / ancho));
    el.scrollBy({ left: dir * ancho * caben, behavior: 'smooth' });
  }

  const arrow = (apagada: boolean): React.CSSProperties => ({
    width: 44,
    height: 44,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: apagada ? 'var(--color-text-muted)' : 'var(--color-text)',
    cursor: apagada ? 'default' : 'pointer',
    opacity: apagada ? 0.4 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity .18s ease, color .18s ease',
  });

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 30,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
          {/* Título de sección del home: tipo oración, hasta 34 px (sistema 2026-09-30). */}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.15, margin: 0, textWrap: 'balance', ...(titleColor ? { color: titleColor } : {}) }}>
            {title}
          </h2>
        </div>
        {/* `marginLeft: auto`: al bajar de renglón en pantallas estrechas, las
            flechas se van al borde derecho en vez de quedar descolgadas bajo el
            título, que es donde parecían un error. */}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <button type="button" aria-label="Anterior" disabled={alInicio} style={arrow(alInicio)} onClick={() => by(-1)}>
            <Icon name="arrowLeft" size={18} />
          </button>
          <button type="button" aria-label="Siguiente" disabled={alFinal} style={arrow(alFinal)} onClick={() => by(1)}>
            <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </div>
      <div
        ref={track}
        className="no-sb"
        style={{
          display: 'flex',
          gap: GAP,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollPaddingInline: 4,
          padding: '4px 4px 22px',
          scrollBehavior: 'smooth',
        }}
      >
        {children}
      </div>
    </>
  );
}

/**
 * Kicker de sección (se reutiliza en varias secciones del home y en
 * `CategoryStrip`). Sistema de diseño 2026-09-30: 13 px, azul, tipo oración,
 * sin MAYÚSCULAS espaciadas ni la raya gruesa de antes (equivale a `.ms-kicker`).
 * `color` permite override por sección (default = tokens del tema).
 * `tickColor` se conserva por compatibilidad con quien lo pase; ya no se pinta.
 */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string; tickColor?: string }) {
  return (
    <p className="ms-kicker" style={color ? { color } : undefined}>
      {children}
    </p>
  );
}
