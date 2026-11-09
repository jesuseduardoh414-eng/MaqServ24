'use client';

import { CAMPOS_UNIDAD, MAX_UNIDADES_IDENTIFICADAS, type UnidadEquipo } from '@maqserv/config';
import { Icon } from '@/components/Icon';

/**
 * UNA FILA POR UNIDAD (2026-11-09): número económico, placas, serie y año de
 * cada máquina igual. Todo opcional: con uno basta para reconocerla, y las
 * obras suelen pedir las placas para dejar entrar.
 *
 * Lo usan "Agregar equipo" (las filas siguen al número de unidades: `fijo`) y
 * "Unidades" en Equipos (agregar o quitar una fila es tener una unidad más o
 * una menos). En el teléfono cada fila se parte en dos renglones.
 */

const CSS = `
.un-tabla{ display:grid; gap:8px; }
.un-fila{ display:grid; grid-template-columns:24px minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) 72px 36px; gap:8px; align-items:center; }
.un-cab{ font-size:12px; color:var(--color-text-muted); font-weight:500; }
.un-n{ font-size:13px; color:var(--color-text-muted); font-variant-numeric:tabular-nums; text-align:right; }
.un-fila .ms-input{ min-width:0; }
.un-quitar{ background:none; border:1px solid transparent; border-radius:8px; color:var(--color-text-muted); cursor:pointer; display:grid; place-items:center; width:36px; height:36px; }
.un-quitar:hover{ color:var(--color-error); border-color:var(--color-border); }
.un-quitar:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.un-quitar:disabled{ opacity:.35; cursor:default; }
.un-quitar:disabled:hover{ color:var(--color-text-muted); border-color:transparent; }
.un-pie{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
@media (max-width: 640px){
  .un-cab{ display:none; }
  .un-fila{ grid-template-columns:20px minmax(0,1fr) minmax(0,1fr) 36px; }
  .un-fila:not(.un-cab) + .un-fila{ border-top:1px solid var(--color-border); padding-top:8px; }
  .un-n{ grid-column:1; grid-row:1 / span 2; align-self:start; padding-top:10px; }
  .un-c-eco{ grid-column:2; grid-row:1; }
  .un-c-placas{ grid-column:3; grid-row:1; }
  .un-c-serie{ grid-column:2; grid-row:2; }
  .un-c-anio{ grid-column:3; grid-row:2; }
  .un-quitar{ grid-column:4; grid-row:1 / span 2; }
}
`;

export function UnidadesEditor({
  filas,
  onChange,
  fijo = false,
  idBase = 'un',
}: {
  filas: UnidadEquipo[];
  onChange: (filas: UnidadEquipo[]) => void;
  /** Las filas las manda otro campo (el número de unidades): sin agregar ni quitar. */
  fijo?: boolean;
  /** Para que los campos de dos editores en la misma página no compartan nombre. */
  idBase?: string;
}) {
  const cambiar = (i: number, clave: keyof UnidadEquipo, valor: string) =>
    onChange(filas.map((f, j) => (j === i ? { ...f, [clave]: valor } : f)));

  return (
    <div className="un-tabla">
      <style>{CSS}</style>
      <div className="un-fila un-cab" aria-hidden>
        <span />
        {CAMPOS_UNIDAD.map((c) => <span key={c.clave}>{c.label}</span>)}
        <span />
      </div>
      {filas.map((f, i) => (
        <div key={i} className="un-fila">
          <span className="un-n">{i + 1}</span>
          {CAMPOS_UNIDAD.map((c) => (
            <input
              key={c.clave}
              id={`${idBase}-${c.clave}-${i}`}
              className={`ms-input un-c-${c.clave}`}
              value={f[c.clave] ?? ''}
              maxLength={c.largo}
              inputMode={c.clave === 'anio' ? 'numeric' : undefined}
              autoCapitalize={c.clave === 'placas' || c.clave === 'serie' ? 'characters' : undefined}
              placeholder={c.label}
              aria-label={`Unidad ${i + 1}: ${c.label.toLowerCase()}`}
              onChange={(e) => cambiar(i, c.clave, c.clave === 'anio' ? e.target.value.replace(/\D/g, '') : e.target.value)}
            />
          ))}
          {fijo ? <span /> : (
            <button
              type="button"
              className="un-quitar"
              aria-label={`Quitar la unidad ${i + 1}`}
              title="Quitar esta unidad"
              disabled={filas.length <= 1}
              onClick={() => onChange(filas.filter((_, j) => j !== i))}
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      ))}
      {!fijo ? (
        <div className="un-pie">
          <button
            type="button"
            className="ms-btn ms-btn-sec ms-btn-sm"
            disabled={filas.length >= MAX_UNIDADES_IDENTIFICADAS}
            onClick={() => onChange([...filas, {}])}
          >
            + Otra unidad
          </button>
          <span className="ms-hint">{filas.length} {filas.length === 1 ? 'unidad' : 'unidades'}</span>
        </div>
      ) : null}
    </div>
  );
}
