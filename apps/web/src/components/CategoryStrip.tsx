'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

const GAP = 16;

/** Estilos propios del carrusel (prefijo `cs-`): encabezado del sistema y flechas de 40 px, radio 8. */
const CSS = `
.cs-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:24px; }
.cs-arrow{ width:40px; height:40px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:border-color .18s ease, opacity .18s ease; }
.cs-arrow:hover:not(:disabled){ border-color:var(--color-text-muted); }
.cs-arrow:disabled{ opacity:.35; cursor:default; }
.cs-arrow:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
`;

/**
 * Carrusel de categorías.
 *
 * DOS ARREGLOS QUE VALE LA PENA DEJAR ESCRITOS, porque los dos se veían como
 * "tarjetas cortadas a media palabra":
 *
 * 1. EL AVANCE SE MIDE AL HACER CLIC, no se hereda del servidor. Antes se
 *    movía `perView` tarjetas, un número calculado en el server sin saber el
 *    ancho real del navegador: en un teléfono caben ~1.6 tarjetas y avanzaba
 *    4, así que el carrusel quedaba entre dos posiciones y se leía "RADOS" en
 *    vez de "TRITURADOS". Ahora se cuenta cuántas caben de verdad en ese
 *    momento y se avanza esa cantidad exacta.
 *
 * 2. LAS FLECHAS SE APAGAN EN LOS EXTREMOS. Sin eso, la mitad de los clics no
 *    hacían nada y no había forma de saber si el carrusel se había acabado o
 *    estaba roto.
 *
 * `perView` sigue llegando del servidor: es lo que decide el ANCHO de cada
 * tarjeta (y eso sí es una decisión de diseño, no del navegador).
 */
export function CategoryStrip({
  eyebrow, title, subtitle, viewAllLabel, viewAllHref,
  eyebrowColor, titleColor, accentColor, perView, children,
}: {
  eyebrow: string; title: string; subtitle: string; viewAllLabel: string; viewAllHref: string;
  eyebrowColor: string; titleColor: string; accentColor: string;
  perView: number; children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(false);

  /** ¿Queda algo a izquierda o derecha? Decide si las flechas sirven. */
  const medir = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // 2px de margen: los anchos fraccionarios hacen que `scrollLeft` no llegue
    // nunca al máximo exacto y la flecha derecha se quedaría siempre activa.
    setAlInicio(el.scrollLeft <= 2);
    setAlFinal(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    // También al cambiar de tamaño: girar el teléfono cambia cuántas caben.
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      ro.disconnect();
    };
  }, [medir]);

  function scroll(dir: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-cat-card]');
    const anchoTarjeta = (card?.offsetWidth ?? 260) + GAP;
    // Cuántas caben AHORA. Nunca menos de una: en pantallas donde solo entra
    // una tarjeta, avanzar cero dejaría las flechas muertas.
    const caben = Math.max(1, Math.floor(el.clientWidth / anchoTarjeta));
    el.scrollBy({ left: dir * anchoTarjeta * caben, behavior: 'smooth' });
  }

  // `accentColor` ya no tiñe la última palabra del título (el azul es solo
  // acción o datos); se conserva en la firma porque lo manda el tema.
  void accentColor;

  return (
    <>
      <style>{CSS}</style>
      <div className="cat-head cs-head">
        <div className="ms-head-txt" style={{ maxWidth: 600 }}>
          {eyebrow ? <p className="ms-kicker" style={{ color: eyebrowColor }}>{eyebrow}</p> : null}
          <h2 className="ms-title" style={{ color: titleColor }}>{title}</h2>
          {subtitle ? <p className="ms-desc">{subtitle}</p> : null}
        </div>
        {/*
          `marginLeft: auto` es lo que arregla la posición en móvil. El bloque
          va a la derecha del título mientras caben los dos; cuando no caben y
          baja de renglón, se queda pegado al borde DERECHO en vez de caer
          debajo del título, alineado a la izquierda, como si se hubiera
          descolgado por error. Es el mismo eje que en escritorio.
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {viewAllLabel ? (
            <Link href={viewAllHref} className="ms-link">
              {viewAllLabel} <Icon name="arrowRight" size={14} />
            </Link>
          ) : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" aria-label="Categorías anteriores" disabled={alInicio} className="cs-arrow" onClick={() => scroll(-1)}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <button type="button" aria-label="Categorías siguientes" disabled={alFinal} className="cs-arrow" onClick={() => scroll(1)}>
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={track}
        className="no-sb"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          // En pantallas estrechas la tarjeta ocupa el 74 % del ancho: así se
          // ve entera y se asoma la siguiente, que es lo que dice "hay más" sin
          // necesidad de explicarlo. El mínimo de 200px dejaba dos tarjetas
          // apretadas y una tercera cortada por la mitad.
          gridAutoColumns: `minmax(min(74%, 240px), calc((100% - ${(perView - 1) * GAP}px) / ${perView}))`,
          gap: GAP,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          // Sin esto el punto de anclaje ignora el relleno y la tarjeta queda
          // 4px corrida, que basta para que se vea un filo de la anterior.
          scrollPaddingInline: 4,
          padding: '4px 4px 10px',
          scrollBehavior: 'smooth',
        }}
      >
        {children}
      </div>
    </>
  );
}
