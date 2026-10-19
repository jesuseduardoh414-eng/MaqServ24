'use client';

import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

const GAP = 16;
/** Velocidad del giro en px por segundo: seis tarjetas dan la vuelta completa en ~40 s. */
const VELOCIDAD = 40;
/** Con el cursor encima no se para (el giro se ve siempre): baja a esta fracción, lenta para atinarle al clic. */
const LENTO = 0.2;

/**
 * Estilos propios del carrusel (prefijo `cs-`): encabezado del sistema y flechas de 40 px, radio 8.
 *
 * `.cs-vp` lleva `container-type`: en el giro la pista mide más que la
 * ventana, así que el ancho de tarjeta se saca de la ventana (`cqw`) y no de
 * la pista; con `%` cada tarjeta se calcularía contra la pista entera.
 */
const CSS = `
.cs-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:24px; }
.cs-arrow{ width:40px; height:40px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:border-color .18s ease, opacity .18s ease; }
.cs-arrow:hover:not(:disabled){ border-color:var(--color-text-muted); }
.cs-arrow:disabled{ opacity:.35; cursor:default; }
.cs-arrow:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.cs-vp{ container-type:inline-size; padding:4px 4px 10px; }
.cs-vp:not([data-modo="giro"]){ overflow-x:auto; scroll-snap-type:x mandatory; scroll-padding-inline:4px; scroll-behavior:smooth; }
.cs-vp[data-modo="giro"]{ --cs-fade:min(56px, 7%); overflow:hidden; touch-action:pan-y; user-select:none; -webkit-user-select:none;
  -webkit-mask-image:linear-gradient(90deg, transparent, #000 var(--cs-fade), #000 calc(100% - var(--cs-fade)), transparent);
  mask-image:linear-gradient(90deg, transparent, #000 var(--cs-fade), #000 calc(100% - var(--cs-fade)), transparent); }
.cs-set{ display:grid; grid-auto-flow:column; gap:${GAP}px; grid-auto-columns:minmax(min(74%, 240px), calc((100% - (var(--cs-per) - 1) * ${GAP}px) / var(--cs-per))); }
.cs-vp[data-modo="giro"] .cs-track{ display:flex; width:max-content; will-change:transform; }
.cs-vp[data-modo="giro"] .cs-set{ grid-auto-columns:min(74cqw, 240px); padding-right:${GAP}px; }
`;

/**
 * 'inicio': lo que manda el servidor, antes de saber el ancho real.
 * 'giro':   las tarjetas no caben → carrusel infinito en movimiento.
 * 'quieto': caben todas → no hay nada que girar; queda la rejilla de siempre.
 */
type Modo = 'inicio' | 'giro' | 'quieto';

type Motor = {
  pos: number; // cuánto ha avanzado la pista, en px (se pinta en módulo una vuelta)
  vel: number; // px/s actuales; se acercan suave a la velocidad que toca
  encima: boolean;
  foco: boolean;
  arrastre: boolean;
  tween: { de: number; a: number; t0: number; dur: number } | null; // avance de las flechas
  toque: { id: number; x0: number; pos0: number; ultX: number; ultT: number; vel: number; movido: boolean } | null;
  soltado: number; // cuándo terminó el último arrastre, para tragarse el clic que lo sigue
};

const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Carrusel de categorías del inicio.
 *
 * GIRA SOLO Y NO REGRESA (2026-10-19, pedido del cliente). Las tarjetas van
 * dos veces seguidas en la pista: cuando la primera tanda termina de pasar ya
 * viene entrando la segunda, idéntica, y la pista vuelve a cero sin que se
 * note. Así nunca se ve el "rebobinado" al principio de los carruseles
 * comunes: es una vuelta continua.
 *
 *  - Se mueve con `transform` en cada cuadro (no con `scrollLeft`, que en
 *    varios navegadores redondea a px enteros y a 40 px/s se ve a saltos).
 *  - Las flechas avanzan una tarjeta hacia cualquier lado, también sin fin;
 *    en teléfono se arrastra con el dedo y al soltar sigue con inercia.
 *  - Con el cursor encima frena, sin pararse; con el teclado (Tab) se para y
 *    trae a la vista la tarjeta enfocada.
 *  - Fuera de pantalla no gasta: se detiene hasta que vuelve a verse.
 *  - Con "reducir movimiento" no avanza solo; las flechas y el arrastre siguen.
 *
 * La segunda tanda es `inert`: el lector de pantalla y el Tab la ignoran, así
 * que cada categoría se anuncia una vez.
 *
 * `perView` sigue llegando del servidor: decide el ANCHO de cada tarjeta
 * cuando todas caben y el carrusel se queda quieto.
 */
export function CategoryStrip({
  eyebrow, title, subtitle, viewAllLabel, viewAllHref,
  eyebrowColor, titleColor, accentColor, perView, children,
}: {
  eyebrow: string; title: string; subtitle: string; viewAllLabel: string; viewAllHref: string;
  eyebrowColor: string; titleColor: string; accentColor: string;
  perView: number; children: ReactNode;
}) {
  const vp = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const tanda = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor>({ pos: 0, vel: 0, encima: false, foco: false, arrastre: false, tween: null, toque: null, soltado: 0 });
  const [modo, setModo] = useState<Modo>('inicio');

  /** ¿Sobran tarjetas? Se decide con el ancho real, y otra vez al girar el teléfono. */
  useEffect(() => {
    const el = vp.current;
    const set = tanda.current;
    if (!el || !set) return;
    const decidir = () => {
      // 2px de margen por los anchos fraccionarios; 8px son el relleno lateral.
      const sobra = modo === 'giro'
        ? set.offsetWidth - GAP > el.clientWidth - 8 + 2
        : el.scrollWidth > el.clientWidth + 2;
      setModo(sobra ? 'giro' : 'quieto');
    };
    const ro = new ResizeObserver(decidir);
    ro.observe(el);
    ro.observe(set);
    return () => ro.disconnect();
  }, [modo]);

  /** El motor del giro: un cuadro por fotograma mientras la banda está en pantalla. */
  useEffect(() => {
    if (modo !== 'giro') return;
    const el = vp.current;
    const pistaEl = pista.current;
    const set = tanda.current;
    if (!el || !pistaEl || !set) return;
    const m = motor.current;
    const quieto = sinMovimiento();
    let vuelta = set.offsetWidth; // una tanda completa, con su hueco final
    let raf = 0;
    let antes = 0;

    // Si alguien alcanzó a deslizar antes de que cargara el script, se sigue desde ahí.
    m.pos += el.scrollLeft;
    el.scrollLeft = 0;

    const paso = (t: number) => {
      const dt = antes ? Math.min(0.05, (t - antes) / 1000) : 0;
      antes = t;
      const tw = m.tween;
      if (tw) {
        const k = tw.dur ? Math.min(1, Math.max(0, (t - tw.t0) / tw.dur)) : 1;
        m.pos = tw.de + (tw.a - tw.de) * (1 - (1 - k) ** 3);
        if (k >= 1) {
          m.tween = null;
          m.vel = 0; // y de ahí retoma el giro, acelerando suave
        }
      } else if (!m.arrastre) {
        const meta = quieto || m.foco ? 0 : m.encima ? VELOCIDAD * LENTO : VELOCIDAD;
        m.vel += (meta - m.vel) * (1 - Math.exp(-dt / 0.45));
        m.pos += m.vel * dt;
        if (m.pos < 0 || m.pos >= vuelta) m.pos = ((m.pos % vuelta) + vuelta) % vuelta;
      }
      const x = ((m.pos % vuelta) + vuelta) % vuelta;
      pistaEl.style.transform = `translate3d(${-x}px,0,0)`;
      raf = requestAnimationFrame(paso);
    };
    const arrancar = () => {
      if (raf) return;
      antes = 0;
      raf = requestAnimationFrame(paso);
    };
    const parar = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? arrancar() : parar()));
    io.observe(el);
    const ro = new ResizeObserver(() => {
      vuelta = set.offsetWidth || vuelta;
    });
    ro.observe(set);
    // Al enfocar con Tab, el navegador desplaza la ventana por su cuenta; ese
    // desplazamiento se descarta: la posición la lleva el motor.
    const alDesplazar = () => {
      if (el.scrollLeft) el.scrollLeft = 0;
    };
    el.addEventListener('scroll', alDesplazar, { passive: true });

    return () => {
      parar();
      io.disconnect();
      ro.disconnect();
      el.removeEventListener('scroll', alDesplazar);
      pistaEl.style.transform = '';
      m.pos = 0;
      m.vel = 0;
      m.tween = null;
    };
  }, [modo]);

  /** Flechas: una tarjeta hacia el lado pedido, alineada al borde. Clics seguidos se encadenan. */
  function mover(dir: -1 | 1) {
    const m = motor.current;
    const card = tanda.current?.querySelector<HTMLElement>('[data-cat-card]');
    if (modo !== 'giro' || !card) return;
    const paso = card.offsetWidth + GAP;
    const base = m.tween ? m.tween.a : m.pos;
    const a = dir > 0
      ? (Math.floor(base / paso + 0.02) + 1) * paso
      : (Math.ceil(base / paso - 0.02) - 1) * paso;
    m.tween = { de: m.pos, a, t0: performance.now(), dur: sinMovimiento() ? 0 : 520 };
  }

  /* ---- Arrastre con dedo o mouse ---- */
  function alBajar(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const m = motor.current;
    m.toque = { id: e.pointerId, x0: e.clientX, pos0: m.pos, ultX: e.clientX, ultT: e.timeStamp, vel: 0, movido: false };
  }
  function alMover(e: PointerEvent<HTMLDivElement>) {
    const m = motor.current;
    const tq = m.toque;
    if (!tq || tq.id !== e.pointerId) return;
    const dx = e.clientX - tq.x0;
    if (!tq.movido) {
      // Menos de 6px es un clic tembloroso, no un arrastre.
      if (Math.abs(dx) < 6) return;
      tq.movido = true;
      tq.pos0 = m.pos + dx; // la pista sigue al dedo desde donde está, sin brinco
      m.arrastre = true;
      m.tween = null;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    m.pos = tq.pos0 - dx;
    const dt = e.timeStamp - tq.ultT;
    if (dt > 0) tq.vel = tq.vel * 0.5 + (-(e.clientX - tq.ultX) / (dt / 1000)) * 0.5;
    tq.ultX = e.clientX;
    tq.ultT = e.timeStamp;
  }
  function alSoltar(e: PointerEvent<HTMLDivElement>) {
    const m = motor.current;
    const tq = m.toque;
    if (!tq || tq.id !== e.pointerId) return;
    m.toque = null;
    if (!tq.movido) return;
    m.arrastre = false;
    m.soltado = performance.now();
    // Inercia al soltar, salvo que el dedo se haya quedado quieto antes.
    m.vel = e.timeStamp - tq.ultT > 90 ? 0 : Math.max(-2500, Math.min(2500, tq.vel));
  }

  // `accentColor` ya no tiñe la última palabra del título (el azul es solo
  // acción o datos); se conserva en la firma porque lo manda el tema.
  void accentColor;

  const giro = modo === 'giro';

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
            <button type="button" aria-label="Categorías anteriores" disabled={modo === 'quieto'} className="cs-arrow" onClick={() => mover(-1)}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <button type="button" aria-label="Categorías siguientes" disabled={modo === 'quieto'} className="cs-arrow" onClick={() => mover(1)}>
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={vp}
        className="cs-vp no-sb"
        data-modo={modo}
        style={{ '--cs-per': perView } as CSSProperties}
        {...(giro
          ? {
              onPointerDown: alBajar,
              onPointerMove: alMover,
              onPointerUp: alSoltar,
              onPointerCancel: alSoltar,
              onPointerEnter: (e: PointerEvent<HTMLDivElement>) => {
                if (e.pointerType === 'mouse') motor.current.encima = true;
              },
              onPointerLeave: () => {
                motor.current.encima = false;
              },
              // Sin esto, arrastrar con el mouse "agarra" el enlace o la foto (arrastre nativo).
              onDragStart: (e: DragEvent) => e.preventDefault(),
              // El clic que llega justo al soltar un arrastre no debe abrir la categoría.
              onClickCapture: (e: MouseEvent) => {
                if (performance.now() - motor.current.soltado < 350) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              },
              onFocus: (e: FocusEvent) => {
                const t = e.target as HTMLElement;
                if (!t.matches(':focus-visible')) return; // el foco del clic con mouse no mueve nada
                const card = t.closest<HTMLElement>('[data-cat-card]');
                const set = tanda.current;
                const m = motor.current;
                m.foco = true;
                if (!card || !set) return;
                // Trae la tarjeta al borde izquierdo por el camino corto (sin dar media vuelta).
                const x = card.getBoundingClientRect().left - set.getBoundingClientRect().left;
                const vuelta = set.offsetWidth;
                const a = x + Math.round((m.pos - x) / vuelta) * vuelta;
                m.tween = { de: m.pos, a, t0: performance.now(), dur: sinMovimiento() ? 0 : 420 };
              },
              onBlur: (e: FocusEvent) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) motor.current.foco = false;
              },
            }
          : {})}
      >
        <div ref={pista} className="cs-track">
          <div ref={tanda} className="cs-set">{children}</div>
          {giro ? (
            <div className="cs-set" inert aria-hidden>
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
