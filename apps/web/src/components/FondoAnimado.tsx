'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * FONDO ANIMADO DE TODO EL SITIO (2026-11-16, el dueño: «el fondo se va cambiar
 * de nuevo, al que acabo de poner en descargas, además quieren movimiento: eso
 * en todas las pantallas»).
 *
 * Una capa fija detrás de todas las páginas (z-index -1) con el video en bucle y
 * un velo del color del fondo encima (`oscuridad`), para que el texto se siga
 * leyendo. Las bandas y la portada son semitransparentes en modo oscuro
 * (`--band-capa`, `--fondo-capa` en globals.css) y dejan ver el movimiento; las
 * tarjetas siguen sólidas.
 *
 *  - Video vertical en pantalla ancha (`girar`): se gira 90°. Así cubre la
 *    pantalla escalándose la mitad que de pie, y se ve más nítido. Sirve para
 *    fondos sin «arriba» (la nebulosa); para un video con texto, apagar `girar`.
 *  - Con «reducir movimiento» o «ahorro de datos» se queda en la imagen.
 *  - Se pausa con la pestaña oculta. Arranca sin sonido (es lo único que deja a
 *    los navegadores reproducir solo); si no arranca, se reintenta y se vuelve a
 *    intentar con el primer clic o tecla, como los videos de las tarjetas.
 */
export function FondoAnimado({ video, imagen, oscuridad, girar }: { video: string | null; imagen: string | null; oscuridad: number; girar: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const refImg = useRef<HTMLImageElement>(null);
  const [vertical, setVertical] = useState(false);
  const [quieto, setQuieto] = useState(false);

  // El video (o la imagen) puede terminar de cargar ANTES de que React conecte
  // sus eventos: la orientación se lee también aquí, no solo en el evento.
  useEffect(() => {
    const v = ref.current;
    if (v && v.readyState >= 1) setVertical(v.videoHeight > v.videoWidth);
    const i = refImg.current;
    if (i && i.complete && i.naturalWidth) setVertical(i.naturalHeight > i.naturalWidth);
  }, [video, imagen, quieto]);

  useEffect(() => {
    const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || conexion?.saveData) {
      setQuieto(true);
      return;
    }
    const v = ref.current;
    if (!v) return;
    const intentar = () => {
      if (!document.hidden) v.play().catch(() => { /* el navegador lo bloqueó: se reintenta */ });
    };
    intentar();
    const t1 = window.setTimeout(intentar, 1500);
    const t2 = window.setTimeout(intentar, 4000);
    const alGesto = () => intentar();
    window.addEventListener('pointerdown', alGesto, { once: true });
    window.addEventListener('keydown', alGesto, { once: true });
    const alCambiarPestana = () => (document.hidden ? v.pause() : intentar());
    document.addEventListener('visibilitychange', alCambiarPestana);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('pointerdown', alGesto);
      window.removeEventListener('keydown', alGesto);
      document.removeEventListener('visibilitychange', alCambiarPestana);
    };
  }, [video]);

  const capa = { ['--fa-velo' as string]: `${Math.min(95, Math.max(0, oscuridad))}%` };
  const conVideo = Boolean(video) && !quieto;
  return (
    <div aria-hidden className="fa-capa" data-girar={girar && vertical ? '' : undefined} style={capa}>
      {conVideo ? (
        <video
          ref={ref}
          className="fa-medio"
          src={video ?? undefined}
          poster={imagen ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          onLoadedMetadata={(e) => setVertical(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
        />
      ) : imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={refImg}
          className="fa-medio"
          src={imagen}
          alt=""
          onLoad={(e) => setVertical(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth)}
        />
      ) : null}
      <div className="fa-velo" />
    </div>
  );
}
