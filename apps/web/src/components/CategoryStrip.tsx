'use client';

import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Eyebrow } from '@/components/Carousel';
import { Icon } from '@/components/Icon';

/**
 * Carrusel de categorías (sin efecto de hover). Muestra `perView` tarjetas;
 * avanza `step` a la vez (calculado en el server: de perView en perView si el
 * total es múltiplo, si no de 1 en 1). Encabezado con título de palabra en
 * acento, subtítulo y enlace "ver todas".
 */
export function CategoryStrip({
  eyebrow, title, subtitle, viewAllLabel, viewAllHref,
  eyebrowColor, titleColor, accentColor, perView, step, children,
}: {
  eyebrow: string; title: string; subtitle: string; viewAllLabel: string; viewAllHref: string;
  eyebrowColor: string; titleColor: string; accentColor: string;
  perView: number; step: number; children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-cat-card]');
    const gap = 22;
    const cardW = card ? card.offsetWidth + gap : 300;
    el.scrollBy({ left: dir * cardW * step, behavior: 'smooth' });
  }

  const arrow: React.CSSProperties = {
    width: 48, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '18px', cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  // Última palabra del título en color de acento (como el diseño).
  const parts = title.trim().split(' ');
  const last = parts.length > 1 ? parts.pop() : null;
  const head = parts.join(' ');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 40, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 560 }}>
          <Eyebrow color={eyebrowColor} tickColor={accentColor}>{eyebrow}</Eyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 4.4vw, 2.7rem)', textTransform: 'uppercase', letterSpacing: '-.01em', margin: 0, color: titleColor, lineHeight: 1.02 }}>
            {last ? head : title}{last ? <> <span style={{ color: accentColor }}>{last}</span></> : null}
          </h2>
          {subtitle ? (
            <p style={{ margin: '14px 0 0', color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: 1.55, maxWidth: 440 }}>{subtitle}</p>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {viewAllLabel ? (
            <Link href={viewAllHref} style={{ color: titleColor, fontWeight: 700, fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {viewAllLabel} <span style={{ color: accentColor, display: 'flex' }}><Icon name="arrowRight" size={14} /></span>
            </Link>
          ) : null}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" aria-label="Anterior" style={arrow} onClick={() => scroll(-1)}><Icon name="arrowLeft" size={18} /></button>
            <button type="button" aria-label="Siguiente" style={arrow} onClick={() => scroll(1)}><Icon name="arrowRight" size={18} /></button>
          </div>
        </div>
      </div>
      <div
        ref={track}
        className="no-sb"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: `minmax(200px, calc((100% - ${(perView - 1) * 22}px) / ${perView}))`,
          gap: 22,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '4px 4px 10px',
          scrollBehavior: 'smooth',
        }}
      >
        {children}
      </div>
    </>
  );
}
