'use client';

import { useState } from 'react';
import {
  CAMPOS_UNIDAD, MAX_UNIDADES_IDENTIFICADAS, ajustarUnidades, presentacionEstado, textoUnidad, unidadVacia, type UnidadEquipo,
} from '@maqserv/config';
import { colorVivo } from '@/components/modo';
import { Btn, Chip, IconBtn, StatusText } from '@/components/ui';

/**
 * UNA MÁQUINA DEL ALIADO EN SU EXPEDIENTE, CON SUS UNIDADES (2026-11-09).
 *
 * El renglón de siempre (qué es, de qué tipo, si está libre; el nombre abre
 * la ficha) y, debajo, cada unidad con su número económico y sus placas: es lo
 * que pide la obra para dejar entrar. Lo normal es que lo capture el aliado
 * en su portal; el lápiz es para corregirlo cuando llama o manda la tarjeta de
 * circulación por WhatsApp. Un renglón por unidad: quitar uno es tener una
 * unidad menos.
 */

export interface EquipoConUnidades {
  id: number;
  name: string;
  brand: string | null;
  tipo?: string | null;
  availability: string;
  location: string | null;
  pending?: boolean;
  /** Cuántas iguales tiene. */
  units?: number;
  /** Económico, placas, serie y año de cada una, en orden. */
  identificacion?: UnidadEquipo[];
  /** Máquina o vehículo: se identifica una por una. */
  identificable?: boolean;
}

const CSS = `
.eq-u { padding: 11px 16px; }
.eq-u-top { display: flex; align-items: center; gap: 12px; }
.eq-u-link { min-width: 0; flex: 1; color: inherit; text-decoration: none; }
.eq-u-link:hover .adm-cell-title { color: var(--adm-accent); }
.eq-u-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.eq-u-falta { font-size: 12.5px; color: var(--adm-faint); }
.eq-u-edit { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--adm-border); display: grid; gap: 10px; }
.eq-u-fila { display: grid; grid-template-columns: 22px minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) 72px 38px; gap: 8px; align-items: center; }
.eq-u-cab { font-size: 12px; color: var(--adm-muted); font-weight: 500; }
.eq-u-n { font-size: 12.5px; color: var(--adm-faint); text-align: right; font-variant-numeric: tabular-nums; }
.eq-u-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
@media (max-width: 760px) {
  .eq-u-cab { display: none; }
  .eq-u-fila { grid-template-columns: 18px minmax(0,1fr) minmax(0,1fr) 38px; }
  .eq-u-fila:not(.eq-u-cab) + .eq-u-fila { border-top: 1px solid var(--adm-border); padding-top: 8px; }
  .eq-u-n { grid-column: 1; grid-row: 1 / span 2; align-self: start; padding-top: 10px; }
  .eq-u-c-eco { grid-column: 2; grid-row: 1; }
  .eq-u-c-placas { grid-column: 3; grid-row: 1; }
  .eq-u-c-serie { grid-column: 2; grid-row: 2; }
  .eq-u-c-anio { grid-column: 3; grid-row: 2; }
  .eq-u-quitar { grid-column: 4; grid-row: 1 / span 2; }
}
`;

/** Las filas para corregir: las que tiene y, si faltan, vacías hasta completar sus unidades. */
function filasDe(e: EquipoConUnidades): UnidadEquipo[] {
  const ident = e.identificacion ?? [];
  const n = Math.max(1, e.units ?? 1);
  return ident.length >= n ? ident : ajustarUnidades(ident, n);
}

/** Todas sus máquinas, una por renglón (lo nuevo primero lo ordena quien llama). */
export function EquiposDelAliado({ equipos, onCambio }: { equipos: EquipoConUnidades[]; onCambio: (texto: string) => void }) {
  return (
    <>
      <style>{CSS}</style>
      {equipos.map((e) => <EquipoDelAliado key={e.id} e={e} onCambio={onCambio} />)}
    </>
  );
}

function EquipoDelAliado({ e, onCambio }: { e: EquipoConUnidades; onCambio: (texto: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<UnidadEquipo[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disp = presentacionEstado(e.availability);
  const n = Math.max(1, e.units ?? 1);
  const sub = [e.pending ? null : e.tipo, e.brand, e.location, e.identificable || n > 1 ? `${n} ${n === 1 ? 'unidad' : 'unidades'}` : null].filter(Boolean).join(' · ');
  const identificadas = (e.identificacion ?? []).filter((u) => !unidadVacia(u));
  const sinId = Math.max(0, n - identificadas.length);

  function abrir() {
    setFilas(filasDe(e));
    setError(null);
    setAbierto((v) => !v);
  }

  const cambiar = (i: number, clave: keyof UnidadEquipo, valor: string) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [clave]: clave === 'anio' ? valor.replace(/\D/g, '') : valor } : f)));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await fetch(`/api/admin/providers/equipos/${e.id}/unidades`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidades: filas }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setGuardando(false);
    if (!r?.ok) { setError(d?.message ?? 'No se pudo guardar. Intenta otra vez.'); return; }
    setAbierto(false);
    onCambio(`Listo: «${e.name}» queda con ${d?.unidades ?? filas.length} ${(d?.unidades ?? filas.length) === 1 ? 'unidad' : 'unidades'}.`);
  }

  return (
    <div className="adm-trow eq-u">
      <div className="eq-u-top">
        <a href={`/productos/editar/${e.id}`} className="eq-u-link">
          <span className="adm-cell-title" style={{ display: 'block' }}>{e.name}</span>
          {sub ? <span className="adm-cell-sub" style={{ display: 'block' }}>{sub}</span> : null}
        </a>
        {e.pending ? (
          <Chip tone="warn" title="No está en tu lista de tipos: se decide en Inventario">Nuevo</Chip>
        ) : (
          <StatusText color={colorVivo(disp)} title={disp.nota}>{disp.nombre}</StatusText>
        )}
        {e.identificable ? (
          <IconBtn icon={abierto ? 'ph-caret-up' : 'ph-pencil-simple'} label={abierto ? 'Cerrar' : 'Corregir sus unidades (económico y placas)'} aria-expanded={abierto} onClick={abrir} />
        ) : null}
      </div>

      {e.identificable && !abierto ? (
        <div className="eq-u-chips">
          {identificadas.map((u, i) => <Chip key={i} tone="muted"><i className="ph ph-truck" aria-hidden />{textoUnidad(u)}</Chip>)}
          {sinId > 0 ? (
            <span className="eq-u-falta">
              {identificadas.length ? `+ ${sinId} sin identificar` : `${sinId === 1 ? 'Sin' : `Las ${sinId} sin`} número económico ni placas`}
            </span>
          ) : null}
        </div>
      ) : null}

      {abierto ? (
        <div className="eq-u-edit">
          <div className="eq-u-fila eq-u-cab" aria-hidden>
            <span />
            {CAMPOS_UNIDAD.map((c) => <span key={c.clave}>{c.label}</span>)}
            <span />
          </div>
          {filas.map((f, i) => (
            <div key={i} className="eq-u-fila">
              <span className="eq-u-n">{i + 1}</span>
              {CAMPOS_UNIDAD.map((c) => (
                <input
                  key={c.clave}
                  className={`adm-input eq-u-c-${c.clave}`}
                  value={f[c.clave] ?? ''}
                  maxLength={c.largo}
                  inputMode={c.clave === 'anio' ? 'numeric' : undefined}
                  placeholder={c.label}
                  aria-label={`Unidad ${i + 1}: ${c.label.toLowerCase()}`}
                  onChange={(ev) => cambiar(i, c.clave, ev.target.value)}
                />
              ))}
              <IconBtn
                icon="ph-x"
                label={`Quitar la unidad ${i + 1}`}
                danger
                className="eq-u-quitar"
                disabled={filas.length <= 1}
                onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          {error ? <div role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)' }}>{error}</div> : null}
          <div className="eq-u-pie">
            <Btn size="sm" variant="ghost" icon="ph-plus" disabled={filas.length >= MAX_UNIDADES_IDENTIFICADAS} onClick={() => setFilas((fs) => [...fs, {}])}>
              Otra unidad
            </Btn>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Btn>
              <Btn size="sm" variant="primary" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? 'Guardando…' : `Guardar ${filas.length} ${filas.length === 1 ? 'unidad' : 'unidades'}`}
              </Btn>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
