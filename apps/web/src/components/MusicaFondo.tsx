'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** Lo que la persona eligió con el botón: «on», «off» o nada (aún no decide). */
const CLAVE = 'maqser-musica';
const leerPref = (): string | null => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardarPref = (v: 'on' | 'off') => { try { localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento: solo esta visita */ } };

/** Gestos que el navegador cuenta para dejar sonar audio (un toque en el celular termina en pointerup/touchend). */
const GESTOS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

/**
 * MÚSICA DE FONDO EN TODO EL SITIO (2026-11-17, el dueño: «solicitaron meter
 * música de tecnología de fondo en toda la página»).
 *
 * Vive en el layout, así que sigue sonando al cambiar de página. Los
 * navegadores no dejan sonar nada hasta que la persona toca la página: arranca
 * con su primer clic, toque o tecla. El botón flotante (abajo a la derecha) la
 * pausa o la vuelve a poner, y la elección se recuerda en su navegador.
 *  - No baja el archivo hasta que va a sonar (`preload="none"`).
 *  - Se pausa con la pestaña oculta y sigue al volver.
 *  - No suena en las vistas previas del panel (ni dentro de un iframe).
 * El archivo y el volumen se cambian en el panel: Sitio web › Fondo y música.
 */
export function MusicaFondo({ archivo, volumen }: { archivo: string; volumen: number }) {
  const ruta = usePathname();
  const audio = useRef<HTMLAudioElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [sonando, setSonando] = useState(false);
  const [dentroDeMarco, setDentroDeMarco] = useState(false);
  const enVistaPrevia = Boolean(ruta?.startsWith('/vista-previa'));

  useEffect(() => {
    setDentroDeMarco(window.self !== window.top);
  }, []);

  // Arranque: con el primer gesto en la página, salvo que la haya apagado.
  useEffect(() => {
    const a = audio.current;
    if (!a || enVistaPrevia || window.self !== window.top) return;
    a.volume = Math.min(1, Math.max(0, volumen / 100));
    if (leerPref() === 'off') return;
    // Si el navegador ya deja sonar (visita con interacción previa), arranca de una vez.
    a.play().catch(() => { /* espera al primer gesto */ });
    const quitar = () => GESTOS.forEach((g) => window.removeEventListener(g, alGesto, true));
    function alGesto(e: Event) {
      // Un toque al propio botón lo resuelve el botón.
      if (boton.current && e.target instanceof Node && boton.current.contains(e.target)) { quitar(); return; }
      if (leerPref() === 'off' || !a) { quitar(); return; }
      if (!a.paused) { quitar(); return; }
      a.play().then(quitar).catch(() => { /* este gesto no contó: el siguiente sí */ });
    }
    GESTOS.forEach((g) => window.addEventListener(g, alGesto, true));
    return quitar;
  }, [enVistaPrevia, volumen]);

  // Pestaña oculta: pausa; al volver, sigue si estaba sonando.
  useEffect(() => {
    let seguir = false;
    const alCambiar = () => {
      const a = audio.current;
      if (!a) return;
      if (document.hidden) { seguir = !a.paused; a.pause(); }
      else if (seguir) { seguir = false; a.play().catch(() => undefined); }
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  if (enVistaPrevia || dentroDeMarco) return null;

  const alternar = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) { guardarPref('on'); a.play().catch(() => undefined); }
    else { guardarPref('off'); a.pause(); }
  };

  return (
    <>
      <style>{MF_CSS}</style>
      <audio ref={audio} src={archivo} loop preload="none" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} />
      <button
        ref={boton}
        type="button"
        className="mf-btn"
        onClick={alternar}
        aria-pressed={sonando}
        aria-label={sonando ? 'Pausar la música de fondo' : 'Poner la música de fondo'}
        title={sonando ? 'Pausar la música' : 'Poner música'}
      >
        {sonando ? (
          <span className="mf-eq" aria-hidden><i /><i /><i /><i /></span>
        ) : (
          <Icon name="volumeOff" size={19} />
        )}
      </button>
    </>
  );
}

const MF_CSS = `
.mf-btn{ position:fixed; right:16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index:40;
  width:46px; height:46px; border-radius:50%; display:grid; place-items:center; cursor:pointer; color:#fff; padding:0;
  border:1px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
  background: color-mix(in srgb, #06080c 72%, transparent); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  box-shadow: 0 0 22px -6px var(--color-primary); transition: box-shadow .2s ease, transform .2s ease; }
.mf-btn:hover{ box-shadow: 0 0 30px -4px var(--color-primary); transform: translateY(-2px); }
.mf-btn:focus-visible{ outline:2px solid var(--color-primary); outline-offset:3px; }
.mf-eq{ display:flex; align-items:flex-end; gap:3px; height:16px; }
.mf-eq i{ display:block; width:3px; height:6px; border-radius:2px; background: var(--color-primary); box-shadow: 0 0 6px var(--color-primary); animation: mf-sube .9s ease-in-out infinite; }
.mf-eq i:nth-child(2){ animation-delay: -.3s; }
.mf-eq i:nth-child(3){ animation-delay: -.6s; }
.mf-eq i:nth-child(4){ animation-delay: -.15s; }
@keyframes mf-sube{ 0%,100%{ height:4px; } 50%{ height:16px; } }
/* En la ficha de un equipo, en el celular, va arriba de la barra «Cotizar este servicio». */
@media (max-width: 760px){ body:has(.pd-barra-movil) .mf-btn{ bottom: calc(86px + env(safe-area-inset-bottom, 0px)); } }
@media (prefers-reduced-motion: reduce){ .mf-eq i{ animation:none; height:10px; } }
`;
