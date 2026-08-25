'use client';

/**
 * Indicador de etapas (manual, 23 / COTIZACIÓN).
 *
 * "El flujo ideal reduce captura manual: servicio → ubicación → fecha →
 * requerimiento → opciones → confirmación. El usuario siempre sabe en qué etapa
 * se encuentra." Y remata: "En cada etapa: estado visible, opción de regresar y
 * lenguaje directo."
 *
 * Se puede volver a un paso ya completado tocándolo, pero no saltar hacia
 * adelante: los pasos siguientes dependen de lo que se conteste antes.
 */
export interface Paso {
  clave: string;
  titulo: string;
}

export function Stepper({
  pasos,
  actual,
  onIr,
}: {
  pasos: Paso[];
  /** Índice del paso actual, base 0. */
  actual: number;
  onIr: (indice: number) => void;
}) {
  return (
    <nav aria-label="Etapas de la cotización" style={{ marginBottom: 26 }}>
      <ol
        style={{
          display: 'flex', gap: 6, listStyle: 'none', margin: 0, padding: 0,
          flexWrap: 'wrap',
        }}
      >
        {pasos.map((p, i) => {
          const hecho = i < actual;
          const activo = i === actual;
          const color = activo || hecho ? 'var(--color-primary)' : 'var(--color-text-muted)';
          return (
            <li key={p.clave} style={{ flex: '1 1 120px', minWidth: 92 }}>
              <button
                type="button"
                onClick={() => hecho && onIr(i)}
                disabled={!hecho}
                aria-current={activo ? 'step' : undefined}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 'none', padding: '0 0 9px', cursor: hecho ? 'pointer' : 'default',
                  borderBottom: `2px solid ${activo || hecho ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'block', fontSize: 10.5, letterSpacing: '0.1em', color, fontWeight: 700 }}>
                  {/* El número se acompaña de una palomita al completarse: el color
                      por sí solo no distingue "hecho" de "pendiente". */}
                  {hecho ? '✓' : i + 1} · PASO {i + 1}
                </span>
                <span
                  style={{
                    display: 'block', marginTop: 4, fontSize: 12.5,
                    color: activo ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontWeight: activo ? 700 : 400,
                  }}
                >
                  {p.titulo}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
