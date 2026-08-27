'use client';

import { useRef, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';

/**
 * Carrusel horizontal con encabezado (eyebrow + título) y botones ←/→.
 * Presentacional: las tarjetas (children) se renderizan en el servidor y se
 * pasan aquí; este componente solo aporta el scroll interactivo.
 * Estilos: solo tokens del tema (var(--...)).
 */
export function Carousel({
  eyebrow,
  title,
  step = 300,
  eyebrowColor,
  titleColor,
  children,
}: {
  eyebrow: string;
  title: string;
  step?: number;
  eyebrowColor?: string;
  titleColor?: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const by = (dir: number) => track.current?.scrollBy({ left: dir * step, behavior: 'smooth' });

  const arrow: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '18px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

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
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" aria-label="Anterior" style={arrow} onClick={() => by(-1)}><Icon name="arrowLeft" size={18} /></button>
          <button type="button" aria-label="Siguiente" style={arrow} onClick={() => by(1)}><Icon name="arrowRight" size={18} /></button>
        </div>
      </div>
      <div
        ref={track}
        className="no-sb"
        style={{
          display: 'flex',
          gap: 22,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
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
