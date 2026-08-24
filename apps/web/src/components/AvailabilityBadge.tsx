import type { Disponibilidad } from '@/lib/availability';

/**
 * Indicador de disponibilidad (21 / ESTADOS DE DISPONIBILIDAD).
 *
 * "El estado debe leerse en un segundo. El color apoya al texto, nunca lo
 * sustituye." Por eso el punto de color va SIEMPRE junto a la etiqueta y
 * además marcado como `aria-hidden`: quien no distingue el color, o usa lector
 * de pantalla, recibe exactamente la misma información.
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
        border: `1px solid color-mix(in srgb, ${info.color} 40%, transparent)`,
        background: `color-mix(in srgb, ${info.color} 12%, transparent)`,
        color: info.color,
        fontSize: ficha ? 12 : 10.5,
        fontWeight: 700,
        letterSpacing: '0.08em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: '50%', background: info.color, flexShrink: 0 }}
      />
      {info.etiqueta}
      {ficha ? (
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: 0 }}>
          · {info.nota}
        </span>
      ) : null}
    </span>
  );
}
