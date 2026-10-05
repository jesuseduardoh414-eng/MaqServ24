import type { Disponibilidad } from '@/lib/availability';

/**
 * Chip claro de las tarjetas: plata + negro tecnológico de la paleta MAQSER24.
 *
 * Los valores van fijos y NO por tokens a propósito: el chip se pinta encima de
 * la foto del producto, donde `--color-surface` / `--color-text` se invierten
 * entre tema claro y oscuro y la etiqueta cambiaría de aspecto según el tema.
 * (Lo usa la insignia de la foto en ProductCard.)
 */
export const CHIP_BG = '#D8DDE2'; // plata
export const CHIP_FG = '#07090C'; // negro tecnológico — 15:1 sobre plata
export const CHIP_BORDER = 'color-mix(in srgb, #07090C 14%, transparent)';

/** "POR CONFIRMAR" → "Por confirmar": el sistema pide tipo oración. */
export function tipoOracion(s: string): string {
  const l = s.toLocaleLowerCase('es-MX');
  return l.charAt(0).toLocaleUpperCase('es-MX') + l.slice(1);
}

/** Color del estado → variante del chip del sistema (`.ms-chip-*`). */
function variante(color: string): string {
  if (color.includes('success')) return 'ms-chip-ok';
  if (color.includes('warning')) return 'ms-chip-warn';
  if (color.includes('error')) return 'ms-chip-bad';
  return '';
}

/**
 * Indicador de disponibilidad (21 / ESTADOS DE DISPONIBILIDAD).
 *
 * "El estado debe leerse en un segundo. El color apoya al texto, nunca lo
 * sustituye." Por eso el punto de color va SIEMPRE junto a la etiqueta: quien
 * no distingue el color, o usa lector de pantalla, recibe la misma información.
 *
 * Es el chip del sistema (`.ms-chip` + verde/ámbar/rojo), en tipo oración.
 * `tamano="lista"` es el de las tarjetas (solo la etiqueta) y `"ficha"` el del
 * detalle, que añade la nota explicativa.
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
      className={`ms-chip ms-chip-dot ${variante(info.color)}`}
      style={ficha ? { fontSize: 13, padding: '5px 11px' } : { fontSize: 11.5, padding: '2px 8px' }}
    >
      {tipoOracion(info.etiqueta)}
      {ficha ? (
        <span style={{ fontWeight: 500, opacity: 0.8 }}>· {info.nota}</span>
      ) : null}
    </span>
  );
}
