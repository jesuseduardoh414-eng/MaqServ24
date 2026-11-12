'use client';

import { useState } from 'react';
import {
  CAMPOS_UNIDAD, MAX_UNIDADES_IDENTIFICADAS, UNIDADES, ajustarUnidades, presentacionEstado, textoUnidad, unidadVacia, unidadesDe, resumenDetalle, type UnidadEquipo,
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
  /** Su línea (maquinaria, transporte, triturados…): decide en qué unidades se le pone precio. */
  categorySlug?: string | null;
  /** Lo que cobra el proveedor por unidad ({ hora: 850, dia: 6500 }), 2026-11-12. */
  precio?: Record<string, number>;
  /** Qué incluye ese precio ("con operador y diésel"). */
  precioNota?: string | null;
}

const pesos = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

/** «$850 / hora · $6,500 / día», o null sin precio. */
export function textoPrecio(precio: Record<string, number> | undefined): string | null {
  const xs = Object.entries(precio ?? {}).filter(([, v]) => v > 0);
  return xs.length ? xs.map(([u, v]) => `${pesos(v)} / ${UNIDADES[u]?.singular ?? u}`).join(' · ') : null;
}

const CSS = `
.eq-u-cond { font-size: 12.5px; color: var(--adm-muted); margin-top: 2px; }
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
.eq-u-precio { display: flex; align-items: baseline; gap: 7px; margin-top: 7px; font-size: 13px; color: var(--adm-text); }
.eq-u-precio > i { color: var(--adm-muted); font-size: 14px; position: relative; top: 2px; }
.eq-u-precio b { font-weight: 600; }
.eq-u-precio-btn { margin-left: auto; background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; cursor: pointer; white-space: nowrap; }
.eq-u-precios { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.eq-u-p { display: grid; gap: 5px; min-width: 0; }
.eq-u-plbl { font-size: 12px; color: var(--adm-muted); font-weight: 500; }
.eq-u-pesos { position: relative; display: block; }
.eq-u-pesos > span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--adm-muted); font-size: 13px; pointer-events: none; }
.eq-u-pesos > input { padding-left: 24px; width: 100%; }
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

/**
 * SU PRECIO (2026-11-12, la libreta de proveedores): lo que cobra el proveedor
 * por ese equipo, en las unidades de su línea (hora, día, viaje, tonelada…), y
 * qué incluye. Lo captura MAQSER24 cuando le pide precio; nunca sale al cliente.
 */
function PrecioDelEquipo({ e, onCambio }: { e: EquipoConUnidades; onCambio: (texto: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unidades = unidadesDe(e.categorySlug);
  // Las que ya tienen precio aunque no sean de su línea (no se pierden al guardar).
  const extra = Object.keys(e.precio ?? {}).filter((u) => !unidades.some((x) => x.clave === u) && UNIDADES[u]).map((u) => UNIDADES[u]);
  const texto = textoPrecio(e.precio);

  function abrir() {
    setValores(Object.fromEntries(Object.entries(e.precio ?? {}).map(([u, v]) => [u, String(v)])));
    setNota(e.precioNota ?? '');
    setError(null);
    setAbierto((v) => !v);
  }

  async function guardar() {
    const precio: Record<string, number> = {};
    for (const [u, v] of Object.entries(valores)) {
      const n = Number(String(v).replace(/[^\d.]/g, ''));
      if (Number.isFinite(n) && n > 0) precio[u] = n;
    }
    setGuardando(true);
    setError(null);
    const r = await fetch(`/api/admin/providers/equipos/${e.id}/precio`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precio, nota: nota.trim() }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setGuardando(false);
    if (!r?.ok) { setError(d?.message ?? 'No se pudo guardar. Intenta otra vez.'); return; }
    setAbierto(false);
    onCambio(textoPrecio(precio) ? `Listo: «${e.name}» cobra ${textoPrecio(precio)}.` : `Listo: «${e.name}» queda sin precio.`);
  }

  return (
    <>
      <div className="eq-u-precio">
        <i className="ph ph-currency-dollar" aria-hidden />
        <span style={{ minWidth: 0 }}>
          {texto ? <><b>Su precio:</b> {texto}</> : <span style={{ color: 'var(--adm-faint)' }}>Sin precio del proveedor</span>}
          {e.precioNota ? <span style={{ color: 'var(--adm-muted)' }}> · {e.precioNota}</span> : null}
        </span>
        <button type="button" className="adm-link eq-u-precio-btn" aria-expanded={abierto} onClick={abrir}>
          {abierto ? 'Cerrar' : texto ? 'Cambiar' : 'Ponerle precio'}
        </button>
      </div>
      {abierto ? (
        <div className="eq-u-edit">
          <div className="eq-u-precios">
            {[...unidades, ...extra].map((u) => (
              <label key={u.clave} className="eq-u-p">
                <span className="eq-u-plbl">Por {u.singular}</span>
                <span className="eq-u-pesos">
                  <span aria-hidden>$</span>
                  <input
                    className="adm-input adm-num"
                    inputMode="decimal"
                    placeholder="—"
                    value={valores[u.clave] ?? ''}
                    aria-label={`Precio del proveedor por ${u.singular}`}
                    onChange={(ev) => setValores((vs) => ({ ...vs, [u.clave]: ev.target.value.replace(/[^\d.,]/g, '') }))}
                  />
                </span>
              </label>
            ))}
          </div>
          <label className="eq-u-p">
            <span className="eq-u-plbl">¿Qué incluye?</span>
            <input
              className="adm-input"
              maxLength={160}
              placeholder="Ej. con operador y diésel; flete aparte"
              value={nota}
              onChange={(ev) => setNota(ev.target.value)}
            />
          </label>
          {error ? <div role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)' }}>{error}</div> : null}
          <div className="eq-u-pie">
            <span className="adm-help" style={{ fontSize: 12.5 }}>Lo que cobra él. No lo ve el cliente.</span>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Btn>
              <Btn size="sm" variant="primary" onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar precio'}</Btn>
            </span>
          </div>
        </div>
      ) : null}
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
        <a href={`/servicios-proveedores/${e.id}?volver=ficha`} className="eq-u-link" title="Ver y corregir todo lo de este servicio">
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

      <PrecioDelEquipo e={e} onCambio={onCambio} />
      {resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10)).length ? (
        <div className="eq-u-cond">{resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10)).join(' · ')}</div>
      ) : null}

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
