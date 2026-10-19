'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/Icon';

/**
 * Video en bucle de una tarjeta de categoría (2026-10-19, pedido del cliente:
 * video en lugar de imagen). Se sube en el panel: Catálogo → Categorías.
 *
 * Seis videos a la vez en un celular se comen los datos y la batería, así que:
 *  - solo baja los metadatos al cargar (`preload="metadata"`);
 *  - se reproduce cuando la tarjeta entra en pantalla y se pausa al salir
 *    (la banda del inicio es un carrusel: la mayoría están fuera);
 *  - con "reducir movimiento" o "ahorro de datos" se queda quieto en la foto
 *    de la categoría, que va de portada (`poster`).
 * Arranca sin sonido siempre: es lo único que deja a los navegadores reproducir solo.
 *
 * También lo usan el video del hero (`style` cambia el encuadre) y las
 * Promociones del mes, que piden `sonido`: un botón en la esquina para oír el
 * video (las promociones suelen venir narradas). Ese clic cuenta como gesto del
 * visitante, así que el navegador sí deja reproducir con sonido, aun con
 * "reducir movimiento".
 */
export function VideoCategoria({ src, poster, className, style, sonido = false }: { src: string; poster: string | null; className?: string; style?: CSSProperties; sonido?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [oyendo, setOyendo] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // React no pone el atributo en el HTML del servidor; sin esto Safari no arranca.
    const quieto =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (quieto) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  function alternarSonido() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setOyendo(!v.muted);
    if (!v.muted && v.paused) v.play().catch(() => undefined);
  }

  const video = (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
    />
  );
  if (!sonido) return video;
  return (
    <>
      {video}
      <button
        type="button"
        onClick={alternarSonido}
        aria-label={oyendo ? 'Silenciar video' : 'Activar sonido del video'}
        aria-pressed={oyendo}
        style={{ position: 'absolute', zIndex: 3, top: 12, right: 12, width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,.28)', background: 'rgba(6,6,8,.55)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
      >
        <Icon name={oyendo ? 'volume' : 'volumeOff'} size={18} />
      </button>
    </>
  );
}
