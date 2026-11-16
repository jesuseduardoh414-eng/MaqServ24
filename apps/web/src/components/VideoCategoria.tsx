'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/Icon';
import { fotoLigera } from '@/lib/foto';

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
 * La portada va reducida (`fotoLigera`): se mandaba la foto tal como se subió,
 * y alguna pesaba 3 MB.
 *
 * También lo usan el video del hero (`style` cambia el encuadre), la página de
 * cada sector y las Promociones del mes, que piden `sonido`: un botón en la
 * esquina para oír el video (las promociones suelen venir narradas). Ese clic
 * cuenta como gesto del visitante, así que el navegador sí deja reproducir con
 * sonido, aun con "reducir movimiento".
 *
 * QUE NO SE QUEDE EN LA PORTADA (2026-11-16): en el Chrome del dueño los videos
 * de las promociones y del encabezado del sector se quedaban quietos, y en un
 * Chrome limpio corrían. Para no depender de un solo intento:
 *  - al verse, si no arranca, se reintenta dos veces más;
 *  - con el primer clic o tecla en la página se arrancan los que estén a la vista
 *    (algunos navegadores solo dejan reproducir después de un gesto);
 *  - si aun así no corre, con `boton` sale un ▶ que lo vuelve a cargar y lo
 *    reproduce (no en las tarjetas que son enlaces: el clic abriría la página).
 */
export function VideoCategoria({ src, poster, className, style, sonido = false, boton = sonido }: {
  src: string;
  poster: string | null;
  className?: string;
  style?: CSSProperties;
  sonido?: boolean;
  /** Botón ▶ si el video no arranca solo (por defecto, donde hay botón de sonido). */
  boton?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [oyendo, setOyendo] = useState(false);
  /** Se ve en pantalla pero no corre; `motivo` queda en el título del ▶ para saber qué pasó. */
  const [detenido, setDetenido] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // React no pone el atributo en el HTML del servidor; sin esto Safari no arranca.
    const quieto =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let visible = false;
    let reintentos = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;

    const corriendo = () => !v.paused && v.readyState >= 3;
    const revisar = () => setDetenido(visible && !corriendo());
    const intentar = () => {
      if (!visible || quieto) return;
      v.play().catch((e: unknown) => {
        setMotivo(e instanceof Error ? e.name : 'error');
        revisar();
      });
    };
    // Mientras se vea y no corra: dos reintentos y luego el ▶.
    const vigilar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        if (!visible || corriendo()) return;
        if (reintentos < 2) {
          reintentos++;
          if (v.readyState === 0) v.load();
          intentar();
          vigilar();
        } else {
          if (!motivo) setMotivo(`listo=${v.readyState} red=${v.networkState}`);
          revisar();
        }
      }, 1500);
    };

    const alCorrer = () => { setDetenido(false); reintentos = 0; };
    v.addEventListener('playing', alCorrer);
    v.addEventListener('pause', revisar);
    // Un gesto del visitante en cualquier parte de la página destraba la reproducción.
    const gesto = () => { if (visible && !corriendo()) intentar(); };
    window.addEventListener('pointerdown', gesto, { passive: true });
    window.addEventListener('keydown', gesto);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = !!e?.isIntersecting;
        if (!visible) { clearTimeout(espera); v.pause(); setDetenido(false); return; }
        if (quieto) { revisar(); return; }
        reintentos = 0;
        intentar();
        vigilar();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      clearTimeout(espera);
      v.removeEventListener('playing', alCorrer);
      v.removeEventListener('pause', revisar);
      window.removeEventListener('pointerdown', gesto);
      window.removeEventListener('keydown', gesto);
    };
    // `motivo` solo se lee para no pisar el primero; no debe reiniciar el observador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternarSonido() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setOyendo(!v.muted);
    if (!v.muted && v.paused) v.play().catch(() => undefined);
  }

  function reproducir() {
    const v = ref.current;
    if (!v) return;
    if (v.readyState < 2) v.load();
    v.play().then(() => setDetenido(false)).catch((e: unknown) => setMotivo(e instanceof Error ? e.name : 'error'));
  }

  const video = (
    <video
      ref={ref}
      src={src}
      poster={poster ? fotoLigera(poster, 1080) : undefined}
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
  const play = boton && detenido ? (
    <button
      type="button"
      onClick={reproducir}
      aria-label="Reproducir video"
      title={motivo ? `Reproducir video (no arrancó solo: ${motivo})` : 'Reproducir video'}
      style={{ position: 'absolute', zIndex: 3, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(6,6,8,.6)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
    >
      <Icon name="play" size={28} fill />
    </button>
  ) : null;
  if (!sonido) return <>{video}{play}</>;
  return (
    <>
      {video}
      {play}
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
