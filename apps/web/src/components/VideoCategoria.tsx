'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

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
 * Sin sonido siempre: es lo único que deja a los navegadores reproducir solo.
 *
 * También lo usa el video del hero (`style` cambia el encuadre).
 */
export function VideoCategoria({ src, poster, className, style }: { src: string; poster: string | null; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);

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

  return (
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
}
