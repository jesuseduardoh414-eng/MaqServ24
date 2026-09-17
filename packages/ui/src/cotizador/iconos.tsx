import type { CSSProperties } from 'react';

/**
 * Iconos del cotizador: maquinaria y materiales.
 *
 * Son de trazo (`stroke`) y heredan `currentColor` a propósito: la identidad de
 * MAQSER24 es técnica y monocroma, y el azul eléctrico solo marca acción o
 * dato. Así el mismo icono sirve apagado en una tarjeta y encendido cuando la
 * tarjeta está elegida, sin tener dos versiones.
 *
 * Vienen del sistema del que se migró el cotizador; ahí eran cadenas sueltas
 * dentro del JavaScript de la página.
 */
const TRAZOS: Record<string, string> = {
  excavadora:
    'M4 27h19a3 3 0 0 1 0 6H4a3 3 0 0 1 0-6z M9 27v-6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6 M11 15h6 M18 20l8-4 6 4 M32 20l1.6 5-5 1.5-1.2-4',
  martillo_exc:
    'M4 27h19a3 3 0 0 1 0 6H4a3 3 0 0 1 0-6z M9 27v-6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6 M18 20l9-3.5 M27 15.5l2.2 1v6.5l-2.2 1z M28.1 24v6',
  retro:
    'M8 25l2-6h9l2 4 M4 21l4-1 1 3 M4 24V19l3-1 M21 20l7-3 4 3 M32 20l1 4-4 1',
  retro_mart:
    'M8 25l2-6h9l2 4 M4 22l3.5-1.2 1 3 M21 20l7-2.5 M28 16.5l2 1v6l-2 1z M29 24.5v5',
  moto:
    'M6 25l3-6h4l3 3 M13 22h14v-4l4 1v6 M12 27h13 M12 27l1-3',
  vibro:
    'M19 22h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-6 M22 22v-4h5l1 4',
  pipa:
    'M14 16h13a4.5 4.5 0 0 1 0 9H14z M14 25H8a2 2 0 0 1-2-2v-4h6 M6 19l2-3h4v3 M14 30h12',
  agua:
    'M20 6c6 8 9 12 9 17a9 9 0 0 1-18 0c0-5 3-9 9-17z M15 24a5 5 0 0 0 5 4',
  retiro:
    'M6 26v-4h4l3-3 8 3v4 M6 22l2-3h3 M14 19l11-7 5 9-3 5H14 M17 15l2 3 M22 13l2 3',
  material:
    'M3 31h34 M6 31l8-13 8 13 M20 31l6-9 6 9',
  zona:
    'M6 26v-4h4l3-3 8 3v4 M6 22l2-3h3 M14 19l11-7 5 9-3 5H14',
  banco:
    'M7 30h26 M10 30V20l10-6 10 6v10 M16 30v-6h8v6',
  personalizado:
    'M7 8h26a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z M20 14v12 M14 20h12',
  documento:
    'M11 5h12l7 7v23a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M23 5v7h7 M14 21h12 M14 27h8',
};

/** Ruedas y detalles rellenos, por icono. Van aparte para no ensuciar el path. */
const EXTRAS: Record<string, Array<[number, number, number]>> = {
  excavadora: [[8.5, 30, 1.1], [18.5, 30, 1.1]],
  martillo_exc: [[8.5, 30, 1.1], [18.5, 30, 1.1]],
  retro: [[12, 29, 4], [27, 29, 4]],
  retro_mart: [[12, 29, 4], [27, 29, 4]],
  moto: [[9, 29, 3.4], [20, 29, 3.4], [31, 29, 3.4]],
  vibro: [[12, 27, 7], [12, 27, 2.4], [30, 30, 2.2]],
  pipa: [[11, 30, 3], [29, 30, 3]],
  retiro: [[12, 30, 3], [27, 30, 3]],
  zona: [[12, 30, 3], [27, 30, 3]],
};

export function IconoCotizador({
  nombre,
  size = 30,
  style,
}: {
  nombre: string;
  size?: number;
  style?: CSSProperties;
}) {
  const d = TRAZOS[nombre] ?? TRAZOS.excavadora;
  const ruedas = EXTRAS[nombre] ?? [];
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      <path d={d} />
      {ruedas.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}
