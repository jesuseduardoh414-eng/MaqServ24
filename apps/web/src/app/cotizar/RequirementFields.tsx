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
 */
export function RequirementFields({
  form,
  values,
  onChange,
  estilos,
}: {
  form: RequestForm;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  estilos: { campo: React.CSSProperties; etiqueta: React.CSSProperties; tarjeta: React.CSSProperties; leyenda: React.CSSProperties };
}) {
  return (
    <div style={estilos.tarjeta}>
      <h2 style={estilos.leyenda}>Sobre el servicio · {form.title}</h2>
      <p style={{ margin: '0 0 18px', color: 'var(--color-text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
        {form.intro}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {form.fields.map((f) => {
          // Los campos largos ocupan la fila completa: partirlos en dos columnas
          // deja cajas de texto demasiado angostas para escribir una condición.
          const anchoCompleto = f.type === 'parrafo';
          const comun = {
            id: `req-${f.key}`,
            value: values[f.key] ?? '',
            required: f.required,
            style: estilos.campo,
            'aria-label': f.label,
          };

          return (
            <div key={f.key} style={anchoCompleto ? { gridColumn: '1 / -1' } : undefined}>
              <label htmlFor={`req-${f.key}`} style={estilos.etiqueta}>
                {f.label}
                {f.unit ? <span style={{ color: 'var(--color-text-muted)' }}> ({f.unit})</span> : null}
                {f.required ? <span style={{ color: 'var(--color-primary)' }}> *</span> : null}
              </label>

              {f.type === 'opcion' ? (
                <select {...comun} onChange={(e) => onChange(f.key, e.target.value)}>
                  <option value="">Selecciona…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === 'parrafo' ? (
                <textarea
                  {...comun}
                  rows={2}
                  style={{ ...estilos.campo, resize: 'vertical', lineHeight: 1.55 }}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              ) : (
                <input
                  {...comun}
                  type={f.type === 'fecha' ? 'date' : f.type === 'numero' ? 'number' : 'text'}
                  min={f.type === 'numero' ? 0 : undefined}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}

              {f.hint ? (
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                  {f.hint}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
