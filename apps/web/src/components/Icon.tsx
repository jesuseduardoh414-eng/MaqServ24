/**
 * LOS ICONOS DEL SITIO. Uno solo, y de aquí.
 *
 * El manual de identidad (sección de iconografía) pide "iconos de una sola
 * línea, todos del mismo estilo, en blanco, gris acero o azul". Lo que había
 * era lo contrario: glifos del teclado (✓ ▤ ⛟ ☎ ♥ ✕ ✆ ⚠ ● ‹ ›) mezclados con
 * SVG dibujados a mano en cinco grosores distintos (1.8, 2, 2.2, 2.6 y 3).
 *
 * Los glifos eran el problema de fondo, no la inconsistencia: un carácter lo
 * dibuja la fuente del sistema, así que el mismo "✓" se ve distinto en Windows,
 * en Mac y en Android, y algunos —⛟, ▤— ni siquiera existen en muchas fuentes y
 * salen como un cuadro vacío. Un icono no puede depender de qué tipografías
 * tenga instalada la persona.
 *
 * REGLAS:
 *  - Trazo único `TRAZO`. Cambiarlo aquí lo cambia en todo el sitio.
 *  - `currentColor`: el icono hereda el color del texto, así que respeta el
 *    tema claro/oscuro y los tokens sin que nadie le pase un color.
 *  - Decorativos por defecto (`aria-hidden`): un icono junto a su etiqueta que
 *    se anuncia al lector de pantalla lo repite todo. Pásale `label` sólo
 *    cuando el icono vaya SOLO y signifique algo.
 */
import type { CSSProperties } from 'react';

const TRAZO = 1.8;

/** Los trazos de cada icono, en una caja de 24×24. */
const PATHS = {
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
  truck: (
    <>
      <path d="M1 4h13v11H1z" />
      <path d="M14 8h4l4 4v3h-8" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  specs: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  star: <path d="m12 2.5 2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.33l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95z" />,
  heart: (
    <path d="M20.8 5.6a5.4 5.4 0 0 0-7.64 0L12 6.77l-1.16-1.17a5.4 5.4 0 1 0-7.64 7.64L12 21.5l8.8-8.26a5.4 5.4 0 0 0 0-7.64z" />
  ),
  warning: <><path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0z" /><path d="M12 9v4.5M12 17.2h.01" /></>,
  dot: <circle cx="12" cy="12" r="3.5" />,
  diamond: <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" />,
  chevronLeft: <polyline points="15 18 9 12 15 6" />,
  chevronRight: <polyline points="9 18 15 12 9 6" />,
  arrowRight: <><path d="M4 12h16" /><polyline points="14 6 20 12 14 18" /></>,
  arrowLeft: <><path d="M20 12H4" /><polyline points="10 6 4 12 10 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.4 11.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 1.5v2.5M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12h2.5M20 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" /></>,
  moon: <path d="M20.5 14.8A9 9 0 1 1 9.2 3.5a7 7 0 0 0 11.3 11.3z" />,
  mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name, size = 20, style, className, label, fill = false,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
  /** Sólo cuando el icono va SOLO y significa algo (un botón sin texto). */
  label?: string;
  /** Relleno: para el corazón activo y las estrellas de una calificación. */
  fill?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={TRAZO}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // `block` evita el hueco que deja la línea base del texto debajo del SVG:
      // en línea, el icono empuja unos píxeles y desalinea la fila.
      style={{ display: 'block', flexShrink: 0, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * Calificación en estrellas. Existe para que las cinco estrellas se dibujen
 * igual en todos lados: estaban repetidas como `'★'.repeat(n)` en el home, en
 * las opiniones y en "mis reseñas", y cada una decidía su tamaño por su cuenta.
 *
 * El número va en el `aria-label` y las estrellas quedan ocultas al lector:
 * cinco iconos seguidos se anuncian como cinco cosas, y lo que importa es "4 de 5".
 */
export function Stars({ value, size = 14, style }: { value: number; size?: number; style?: CSSProperties }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span role="img" aria-label={`${n} de 5`} style={{ display: 'inline-flex', gap: 1, ...style }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name="star" size={size} fill={i < n} style={i < n ? undefined : { opacity: 0.35 }} />
      ))}
    </span>
  );
}
