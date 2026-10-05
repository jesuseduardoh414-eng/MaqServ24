'use client';

import { Icon } from '@/components/Icon';

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
 *
 * Usa el pasador común `.ms-steps` (sistema de diseño). El botón de un paso
 * hecho cubre todo el renglón con un ::after para que también el número sea
 * pulsable, sin romper el `li > span` del que depende el estilo común.
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
    <nav aria-label="Etapas de la cotización" className="qst-nav">
      <style>{`
        .qst-nav{ margin-bottom:8px; }
        /* Conector más corto que el común: así los seis pasos caben en una
           línea dentro del contenedor angosto (760 px) sin partirse. */
        .qst-nav .ms-steps{ gap:10px 6px; }
        .qst-nav .ms-steps li + li::before{ width:12px; }
        .qst-nav .ms-steps li{ position:relative; }
        .qst-btn{ background:none; border:none; padding:0; font:inherit; color:inherit; cursor:pointer; }
        .qst-btn::after{ content:''; position:absolute; inset:-4px; }
        .qst-btn:hover{ color:var(--color-text); }
        .qst-btn:focus-visible{ outline:none; }
        .qst-btn:focus-visible::after{ outline:2px solid var(--color-primary); outline-offset:2px; border-radius:6px; }
        .qst-txt{ font-weight:inherit; }
        .qst-cuenta{ display:none; font-size:13px; color:var(--color-text-muted); margin:0 0 10px; }
        @media (max-width: 640px){
          /* En móvil seis nombres no caben: se deja el número de cada paso y
             el nombre solo del paso actual, más el "Paso n de m" arriba. */
          .qst-cuenta{ display:block; }
          .qst-nav .ms-steps{ gap:10px 4px; }
          .qst-nav .ms-steps li + li::before{ width:8px; }
          .qst-nav .ms-steps li:not([data-on="true"]) .qst-txt{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
        }
      `}</style>
      <p className="qst-cuenta" aria-hidden>Paso {actual + 1} de {pasos.length}</p>
      <ol className="ms-steps">
        {pasos.map((p, i) => {
          const hecho = i < actual;
          const activo = i === actual;
          return (
            <li
              key={p.clave}
              data-on={activo ? 'true' : undefined}
              data-done={hecho ? 'true' : undefined}
              aria-current={activo ? 'step' : undefined}
            >
              {/* El número se cambia por una palomita al completarse: el color
                  por sí solo no distingue "hecho" de "pendiente". */}
              <span aria-hidden>{hecho ? <Icon name="check" size={12} /> : i + 1}</span>
              {hecho ? (
                <button type="button" className="qst-btn" onClick={() => onIr(i)}>
                  <b className="qst-txt">{p.titulo}</b>
                </button>
              ) : (
                // <b> y no <span>: `.ms-steps li > span` es el círculo del número.
                <b className="qst-txt">{p.titulo}</b>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
