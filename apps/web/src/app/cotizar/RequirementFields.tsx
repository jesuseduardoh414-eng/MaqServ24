'use client';

import type { RequestForm } from '@maqserv/config';

/**
 * Preguntas propias del servicio (documento institucional, secciones 8 a 13).
 *
 * Cada categoría necesita datos distintos: a una excavadora se le pregunta
 * capacidad, implemento y acceso al terreno; a una pipa el origen, el destino y
 * cuántos viajes; a un triturado la especificación y el tonelaje. Preguntar lo
 * mismo para todo es lo que hacía que las cotizaciones salieran incompletas y
 * hubiera que llamar de vuelta.
 *
 * El manual pide no convertir esto en un trámite (19 / EXPERIENCIA DEL CLIENTE:
 * "si para solicitar una máquina el usuario tiene que llenar un formulario
 * interminable, la digitalización habrá sustituido una fricción por otra"). Por
 * eso solo se marcan obligatorias las que de verdad impiden cotizar, y cada
 * bloque explica arriba para qué sirve lo que se pregunta.
 *
 * Estilos: piezas del sistema de diseño (`ms-panel`, `ms-field`, `ms-input`…);
 * lo propio lleva el prefijo `rq-`.
 */
/** Claves que el asistente saca a sus propios pasos (ubicación y fecha). */
export const CLAVES_UBICACION = ['obra_ubicacion', 'destino', 'origen'];
export const CLAVES_FECHA = ['fecha_inicio', 'duracion', 'periodo', 'ventana', 'frecuencia', 'horario', 'horarios'];

export function RequirementFields({
  form,
  values,
  onChange,
  only,
  except,
  titulo,
  intro,
}: {
  form: RequestForm;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Renderiza SOLO estas claves. Sirve para repartir el formulario entre pasos. */
  only?: string[];
  /** Renderiza todas MENOS estas. */
  except?: string[];
  titulo?: string;
  intro?: string;
}) {
  const campos = form.fields.filter((f) => {
    if (only) return only.includes(f.key);
    if (except) return !except.includes(f.key);
    return true;
  });
  if (campos.length === 0) return null;

  return (
    <section className="ms-panel">
      <style>{`
        .rq-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap:18px 16px; margin-top:20px; }
        .rq-unit{ color:var(--color-text-muted); font-weight:400; }
      `}</style>
      <h2 className="ms-h2">{titulo ?? `Sobre el servicio: ${form.title}`}</h2>
      {intro ?? form.intro ? <p className="ms-h2-desc">{intro ?? form.intro}</p> : null}

      <div className="rq-grid">
        {campos.map((f) => {
          // Los campos largos ocupan la fila completa: partirlos en dos columnas
          // deja cajas de texto demasiado angostas para escribir una condición.
          const anchoCompleto = f.type === 'parrafo';
          const comun = {
            id: `req-${f.key}`,
            value: values[f.key] ?? '',
            required: f.required,
            'aria-label': f.label,
          };

          return (
            <div key={f.key} className={anchoCompleto ? 'ms-field ms-span' : 'ms-field'}>
              <label htmlFor={`req-${f.key}`} className="ms-label">
                {f.label}
                {f.unit ? <span className="rq-unit"> ({f.unit})</span> : null}
                {f.required ? <span className="ms-req" aria-hidden>*</span> : null}
              </label>

              {f.type === 'opcion' ? (
                <select {...comun} className="ms-select" onChange={(e) => onChange(f.key, e.target.value)}>
                  <option value="">Selecciona…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === 'parrafo' ? (
                <textarea
                  {...comun}
                  rows={3}
                  className="ms-textarea"
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              ) : (
                <input
                  {...comun}
                  className="ms-input"
                  type={f.type === 'fecha' ? 'date' : f.type === 'numero' ? 'number' : 'text'}
                  min={f.type === 'numero' ? 0 : undefined}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}

              {f.hint ? <p className="ms-hint">{f.hint}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
