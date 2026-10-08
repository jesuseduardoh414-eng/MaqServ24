'use client';

import { useCallback, useEffect, useState } from 'react';
import { ESTADO_SOLICITUD_PROVEEDOR } from '@maqserv/config';
import { Btn, FormField, IconBtn, Note, Panel } from '@/components/ui';

/**
 * EL CRM, DENTRO DEL EXPEDIENTE (2026-10-08).
 *
 * El CRM de proveedores era una pantalla aparte con su propia lista de
 * proveedores. Se juntó con Proveedores: los datos del aliado ya se editan
 * aquí, y lo único que el CRM tenía de propio —sus máquinas con lo que cobra
 * por hora— vive ahora como una sección del expediente. Misma tabla
 * (`provider_machines`) y misma API (`admin/proveedores-crm`).
 *
 * Los costos son SOLO de referencia para negociar: no los lee el cotizador ni
 * ningún precio del sitio.
 */

interface Maquina {
  id: number;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  caracteristicas: string | null;
  costoSinOp: number | null;
  costoConOp: number | null;
  costoTodo: number | null;
  notas: string | null;
}

interface ProveedorCrm {
  id: number;
  name: string;
  status: number;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  registrado: string;
  maquinas: Maquina[];
}

type Form = { tipo: string; marca: string; modelo: string; caracteristicas: string; costoSinOp: string; costoConOp: string; costoTodo: string; notas: string };
const vacia: Form = { tipo: '', marca: '', modelo: '', caracteristicas: '', costoSinOp: '', costoConOp: '', costoTodo: '', notas: '' };

/** Tipos sugeridos: la oferta vigente. Se puede escribir otro. */
const TIPOS = ['Excavadora', 'Retroexcavadora', 'Motoconformadora', 'Vibrocompactador', 'Pipa de agua', 'Camión de volteo'];

const pesos = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

async function leerCrm(): Promise<ProveedorCrm[] | null> {
  const r = await fetch('/api/admin/proveedores-crm', { cache: 'no-store' });
  return r.ok ? ((await r.json()) as ProveedorCrm[]) : null;
}

export function CostosReferencia({ providerId }: { providerId: number }) {
  const [maquinas, setMaquinas] = useState<Maquina[] | null>(null);
  const [edit, setEdit] = useState<{ id: number | null; form: Form } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const todos = await leerCrm();
    setMaquinas(todos?.find((p) => p.id === providerId)?.maquinas ?? []);
  }, [providerId]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar() {
    if (!edit || guardando) return;
    if (edit.form.tipo.trim().length < 2) { setError('Escribe el tipo de maquinaria.'); return; }
    setGuardando(true); setError(null);
    const r = edit.id == null
      ? await fetch(`/api/admin/proveedores-crm/${providerId}/maquinas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit.form) })
      : await fetch(`/api/admin/proveedores-crm/maquinas/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit.form) });
    const d = await r.json().catch(() => null);
    setGuardando(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo guardar.'); return; }
    setEdit(null);
    void cargar();
  }

  async function borrar(m: Maquina) {
    if (!window.confirm(`¿Borrar «${[m.tipo, m.marca, m.modelo].filter(Boolean).join(' ')}»?`)) return;
    await fetch(`/api/admin/proveedores-crm/maquinas/${m.id}`, { method: 'DELETE' });
    void cargar();
  }

  const campo = (k: keyof Form, titulo: string, extra?: { num?: boolean; ancho?: boolean; ph?: string; lista?: string }) => (
    <FormField label={titulo} style={{ gridColumn: extra?.ancho ? '1 / -1' : undefined }}>
      <input className={extra?.num ? 'adm-input adm-num' : 'adm-input'} type={extra?.num ? 'number' : 'text'} min={extra?.num ? 0 : undefined} step={extra?.num ? '0.01' : undefined}
        inputMode={extra?.num ? 'decimal' : undefined} placeholder={extra?.ph} list={extra?.lista} value={edit?.form[k] ?? ''}
        onChange={(e) => edit && setEdit({ ...edit, form: { ...edit.form, [k]: e.target.value } })} />
    </FormField>
  );

  return (
    <section style={{ borderTop: '1px solid var(--adm-border)', marginTop: 24, paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--adm-text)' }}>Costos de referencia</h3>
        {!edit ? (
          <Btn size="sm" icon="ph-plus" onClick={() => { setError(null); setEdit({ id: null, form: vacia }); }}>Agregar máquina</Btn>
        ) : null}
      </div>
      <p style={{ margin: '4px 0 14px', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.6 }}>
        Lo que este aliado te cobra por hora, por máquina (antes el CRM). Solo de referencia para negociar: no cambia ningún
        precio del cotizador.
      </p>

      {maquinas === null ? (
        <p style={{ fontSize: 13, color: 'var(--adm-faint)', margin: 0 }}>Cargando…</p>
      ) : maquinas.length === 0 ? (
        !edit ? <p style={{ fontSize: 13, color: 'var(--adm-faint)', margin: 0 }}>Sin costos registrados.</p> : null
      ) : (
        <Panel flush clip>
          {maquinas.map((m) => (
            <div key={m.id} className="adm-trow" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span className="adm-cell-title" style={{ fontSize: 13.5 }}>{m.tipo}</span>
                  {m.marca || m.modelo ? <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{[m.marca, m.modelo].filter(Boolean).join(' ')}</span> : null}
                </div>
                {m.caracteristicas ? <div className="adm-cell-sub">{m.caracteristicas}</div> : null}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2px 12px', marginTop: 6, fontSize: 12.5, color: 'var(--adm-text)' }}>
                  <span><span style={{ color: 'var(--adm-faint)' }}>Sin op. ni diésel</span> · <span className="adm-num">{pesos(m.costoSinOp)}/h</span></span>
                  <span><span style={{ color: 'var(--adm-faint)' }}>Con op., sin diésel</span> · <span className="adm-num">{pesos(m.costoConOp)}/h</span></span>
                  <span><span style={{ color: 'var(--adm-faint)' }}>Con op. y diésel</span> · <span className="adm-num">{pesos(m.costoTodo)}/h</span></span>
                </div>
                {m.notas ? <div style={{ fontSize: 12, color: 'var(--adm-faint)', marginTop: 4 }}>{m.notas}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <IconBtn icon="ph-pencil-simple" label="Editar" onClick={() => {
                  const t = (v: number | null) => (v == null ? '' : String(v));
                  setError(null);
                  setEdit({ id: m.id, form: { tipo: m.tipo, marca: m.marca ?? '', modelo: m.modelo ?? '', caracteristicas: m.caracteristicas ?? '', costoSinOp: t(m.costoSinOp), costoConOp: t(m.costoConOp), costoTodo: t(m.costoTodo), notas: m.notas ?? '' } });
                }} />
                <IconBtn icon="ph-trash" label="Borrar" danger onClick={() => void borrar(m)} />
              </div>
            </div>
          ))}
        </Panel>
      )}

      {/* Formulario en línea y no en otra ventana: el expediente ya es una. */}
      {edit ? (
        <div className="adm-card" style={{ marginTop: 12, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)', marginBottom: 12 }}>{edit.id == null ? 'Agregar máquina' : 'Editar máquina'}</div>
          {error ? <div role="alert" style={{ marginBottom: 12 }}><Note tone="bad">{error}</Note></div> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px 14px' }}>
            {campo('tipo', 'Tipo de maquinaria *', { lista: 'costos-ref-tipos', ph: 'Excavadora, retroexcavadora…' })}
            {campo('marca', 'Marca', { ph: 'Caterpillar, JCB…' })}
            {campo('modelo', 'Modelo', { ph: '320, 416, 3CX…' })}
            {campo('caracteristicas', 'Características', { ancho: true, ph: 'Año, capacidad, implementos, horas de uso…' })}
            {campo('costoSinOp', 'Sin operador y sin diésel ($/h)', { num: true })}
            {campo('costoConOp', 'Con operador, sin diésel ($/h)', { num: true })}
            {campo('costoTodo', 'Con operador y diésel ($/h)', { num: true })}
            {campo('notas', 'Notas', { ancho: true, ph: 'Disponibilidad, condiciones, mínimo de horas…' })}
          </div>
          <datalist id="costos-ref-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn>
            {/* Primario dentro de su formulario: solo existe mientras se edita. */}
            <Btn size="sm" variant="primary" onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Btn>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Celda CSV: entre comillas si trae coma, comilla o salto de línea. */
const celda = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const SITUACION: Record<number, string> = { 1: 'Activo en la red', [ESTADO_SOLICITUD_PROVEEDOR]: 'Solicitud por revisar', 0: 'Dado de baja' };

/**
 * El Excel del CRM, ahora desde Proveedores: una fila por máquina con sus
 * costos; el aliado sin máquinas sale en una fila sola.
 */
export function DescargarExcelProveedores() {
  const [ocupado, setOcupado] = useState(false);
  async function descargar() {
    setOcupado(true);
    const provs = await leerCrm();
    setOcupado(false);
    if (!provs) { window.alert('No se pudo leer la lista de proveedores.'); return; }
    const enc = ['Proveedor', 'Situación', 'Contacto', 'Correo', 'WhatsApp / celular', 'Ubicación del taller', 'Ciudad', 'Estado',
      'Tipo de maquinaria', 'Marca', 'Modelo', 'Características', 'Costo por hora sin operador y sin diésel',
      'Costo por hora con operador y sin diésel', 'Costo por hora con operador y con diésel', 'Notas de la máquina', 'Registrado'];
    const filas: unknown[][] = [];
    for (const p of provs) {
      const base = [p.name, SITUACION[p.status] ?? 'Dado de baja', p.contactName, p.email, p.phone, p.address, p.city, p.state];
      const reg = p.registrado.slice(0, 10);
      if (p.maquinas.length === 0) filas.push([...base, '', '', '', '', '', '', '', '', reg]);
      for (const m of p.maquinas) filas.push([...base, m.tipo, m.marca, m.modelo, m.caracteristicas, m.costoSinOp, m.costoConOp, m.costoTodo, m.notas, reg]);
    }
    const csv = [enc, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
    // El BOM hace que Excel lea bien los acentos.
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `proveedores-maqser24-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Btn icon="ph-download-simple" onClick={() => void descargar()} disabled={ocupado}>Descargar Excel</Btn>
  );
}
