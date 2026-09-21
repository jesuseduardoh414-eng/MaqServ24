import type { Disponibilidad } from '@/lib/availability';

/**
 * Chip claro de las tarjetas: plata + negro tecnológico de la paleta MAQSER24.
 *
 * Los valores van fijos y NO por tokens a propósito: el chip se pinta encima de
 * la foto del producto, donde `--color-surface` / `--color-text` se invierten
 * entre tema claro y oscuro y la etiqueta cambiaría de aspecto según el tema.
 */
export const CHIP_BG = '#D8DDE2'; // plata
export const CHIP_FG = '#07090C'; // negro tecnológico — 15:1 sobre plata
export const CHIP_BORDER = 'color-mix(in srgb, #07090C 14%, transparent)';

/**
 * Indicador de disponibilidad (21 / ESTADOS DE DISPONIBILIDAD).
 *
 * "El estado debe leerse en un segundo. El color apoya al texto, nunca lo
 * sustituye." Por eso el punto de color va SIEMPRE junto a la etiqueta y
 * además marcado como `aria-hidden`: quien no distingue el color, o usa lector
 * de pantalla, recibe exactamente la misma información.
 *
 * La píldora es gris plata con texto negro (misma pieza que el badge de la
 * foto); el color del estado se conserva en el punto, oscurecido para que
 * verde/ámbar/rojo sigan distinguiéndose sobre un fondo claro.
 *
 * `tamano="lista"` es el de las tarjetas del catálogo (solo la etiqueta) y
 * `"ficha"` el del detalle, que añade la segunda línea explicativa.
 */
export function AvailabilityBadge({
  info,
  tamano = 'lista',
}: {
  info: Disponibilidad;
  tamano?: 'lista' | 'ficha';
}) {
  const ficha = tamano === 'ficha';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: ficha ? '7px 13px' : '4px 9px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${CHIP_BORDER}`,
        background: CHIP_BG,
        color: CHIP_FG,
        fontSize: ficha ? 12 : 10.5,
        fontWeight: 700,
        letterSpacing: '0.08em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          // El color del estado sobre plata: sin oscurecer, el ámbar y el verde
          // del tema oscuro se lavan contra el chip claro.
          background: `color-mix(in srgb, ${info.color} 72%, ${CHIP_FG})`,
          flexShrink: 0,
        }}
      />
      {info.etiqueta}
      {ficha ? (
        <span style={{ color: `color-mix(in srgb, ${CHIP_FG} 62%, ${CHIP_BG})`, fontWeight: 500, letterSpacing: 0 }}>
          · {info.nota}
        </span>
      ) : null}
    </span>
  );
}
