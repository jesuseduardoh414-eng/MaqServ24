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
    width: 46,
    height: 46,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: apagada ? 'var(--color-text-muted)' : 'var(--color-text)',
    cursor: apagada ? 'default' : 'pointer',
    opacity: apagada ? 0.4 : 1,
    boxShadow: apagada ? 'none' : 'var(--shadow-sm)',
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
        <div>
          <Eyebrow color={eyebrowColor} tickColor={eyebrowColor}>{eyebrow}</Eyebrow>
          <h2 style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.4rem)', textTransform: 'uppercase', letterSpacing: '-.005em', margin: 0, ...(titleColor ? { color: titleColor } : {}) }}>
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
 * Etiqueta pequeña con guion (se reutiliza en varias secciones).
 * `color` y `tickColor` permiten override por sección (default = tokens del tema).
 */
export function Eyebrow({ children, color, tickColor }: { children: ReactNode; color?: string; tickColor?: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: color ?? 'var(--color-accent)',
        fontWeight: 700,
        fontSize: '12.5px',
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        marginBottom: 12,
      }}
    >
      <span style={{ width: 24, height: 3, background: tickColor ?? 'var(--color-primary)', display: 'inline-block' }} />
      {children}
    </div>
  );
}
