'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ESTADOS_OPERACION, ESTADO_SOLICITUD_PROVEEDOR } from '@maqserv/config';
import { Modal } from '@/components/Modal';

export interface Maquina {
  id: number;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  caracteristicas: string | null;
  costoSinOp: number | null;
  costoConOp: number | null;
  costoTodo: number | null;
  notas: string | null;
  actualizado: string;
}

export interface ProveedorCrm {
  id: number;
  name: string;
  status: number;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  notes: string | null;
  registrado: string;
  maquinas: Maquina[];
}

const C = {
  panel: '#141416', panel2: '#1b1e26', line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '11px 13px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const label: CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 6, display: 'block' };
const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 10,
  padding: '11px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};
const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 10,
  padding: '11px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};
const chico: CSSProperties = { ...botonSec, padding: '7px 12px', fontSize: 13, borderRadius: 9 };

/** Tipos sugeridos: la oferta vigente (2026-10-06). Se puede escribir otro. */
const TIPOS = ['Excavadora', 'Retroexcavadora', 'Motoconformadora', 'Vibrocompactador', 'Bobcat (minicargador)', 'Camión de volteo', 'Pipa de agua'];

const SITUACION: Record<number, { texto: string; color: string }> = {
  1: { texto: 'Activo en la red', color: C.ok },
  [ESTADO_SOLICITUD_PROVEEDOR]: { texto: 'Solicitud por revisar', color: C.warn },
  0: { texto: 'Dado de baja', color: C.dim },
};
const situacion = (s: number) => SITUACION[s] ?? SITUACION[0];

const pesos = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

function waDe(tel: string | null): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 13 && d.startsWith('521')) return `52${d.slice(3)}`;
  return null;
}

/** Celda CSV: entre comillas si trae coma, comilla o salto de línea. */
const celda = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type FormProveedor = { name: string; contactName: string; phone: string; email: string; address: string; city: string; state: string };
type FormMaquina = { tipo: string; marca: string; modelo: string; caracteristicas: string; costoSinOp: string; costoConOp: string; costoTodo: string; notas: string };

const provVacio: FormProveedor = { name: '', contactName: '', phone: '', email: '', address: '', city: '', state: 'Nuevo León' };
const maqVacia: FormMaquina = { tipo: '', marca: '', modelo: '', caracteristicas: '', costoSinOp: '', costoConOp: '', costoTodo: '', notas: '' };

/**
 * CRM DE PROVEEDORES (2026-10-06). Una sola vista con todos los proveedores
 * —solicitudes del sitio, red activa y bajas— y su maquinaria. Los costos por
 * hora son solo referencia: no tocan el cotizador ni ningún precio.
 */
export function CrmProveedores({ initial }: { initial: ProveedorCrm[] }) {
  const [provs, setProvs] = useState(initial);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'solicitudes' | 'bajas'>('todos');
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  // Modales
  const [provEdit, setProvEdit] = useState<{ id: number | null; form: FormProveedor } | null>(null);
  const [maqEdit, setMaqEdit] = useState<{ providerId: number; id: number | null; form: FormMaquina } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    const r = await fetch('/api/admin/proveedores-crm');
    if (r.ok) setProvs(await r.json());
  }

  const cuenta = {
    todos: provs.length,
    activos: provs.filter((p) => p.status === 1).length,
    solicitudes: provs.filter((p) => p.status === ESTADO_SOLICITUD_PROVEEDOR).length,
    bajas: provs.filter((p) => p.status === 0).length,
  };
  const totalMaquinas = provs.reduce((n, p) => n + p.maquinas.length, 0);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return provs.filter((p) => {
      if (filtro === 'activos' && p.status !== 1) return false;
      if (filtro === 'solicitudes' && p.status !== ESTADO_SOLICITUD_PROVEEDOR) return false;
      if (filtro === 'bajas' && p.status !== 0) return false;
      if (!t) return true;
      const texto = [p.name, p.contactName, p.email, p.phone, p.city, p.address, ...p.maquinas.flatMap((m) => [m.tipo, m.marca, m.modelo])]
        .filter(Boolean).join(' ').toLowerCase();
      return texto.includes(t);
    });
  }, [provs, q, filtro]);

  function alternar(id: number) {
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  /** Excel: una fila por máquina; el proveedor sin máquinas sale en una fila sola. */
  function descargar() {
    const enc = ['Proveedor', 'Situación', 'Contacto', 'Correo', 'WhatsApp / celular', 'Ubicación del taller', 'Ciudad', 'Estado',
      'Tipo de maquinaria', 'Marca', 'Modelo', 'Características', 'Costo por hora sin operador y sin diésel',
      'Costo por hora con operador y sin diésel', 'Costo por hora con operador y con diésel', 'Notas de la máquina', 'Registrado'];
    const filas: unknown[][] = [];
    for (const p of visibles) {
      const base = [p.name, situacion(p.status).texto, p.contactName, p.email, p.phone, p.address, p.city, p.state];
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
    setMsg(`Se descargaron ${visibles.length} proveedores (${filas.length} filas).`);
  }

  async function guardarProveedor() {
    if (!provEdit || guardando) return;
    const f = provEdit.form;
    if (f.name.trim().length < 2) { setError('Escribe el nombre del proveedor.'); return; }
    setGuardando(true); setError(null);
    const cuerpo = {
      name: f.name.trim(), contactName: f.contactName.trim() || null, phone: f.phone.trim() || null,
      email: f.email.trim() || null, address: f.address.trim() || null, city: f.city.trim() || null, state: f.state || null,
    };
    const r = provEdit.id == null
      // Alta desde el CRM: entra a la red sin mandarle invitación; se la mandas
      // después desde Red de aliados cuando toque.
      ? await fetch('/api/admin/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cuerpo, enviarAcceso: false }) })
      : await fetch(`/api/admin/providers/${provEdit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => null);
    setGuardando(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo guardar.'); return; }
    setMsg(provEdit.id == null ? `«${cuerpo.name}» quedó registrado. Agrégale sus máquinas.` : 'Datos del proveedor guardados.');
    if (provEdit.id == null && d?.id) setAbiertos((s) => new Set(s).add(d.id));
    setProvEdit(null);
    void recargar();
  }

  async function guardarMaquina() {
    if (!maqEdit || guardando) return;
    const f = maqEdit.form;
    if (f.tipo.trim().length < 2) { setError('Escribe el tipo de maquinaria.'); return; }
    setGuardando(true); setError(null);
    const cuerpo = { ...f };
    const r = maqEdit.id == null
      ? await fetch(`/api/admin/proveedores-crm/${maqEdit.providerId}/maquinas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      : await fetch(`/api/admin/proveedores-crm/maquinas/${maqEdit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => null);
    setGuardando(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo guardar.'); return; }
    setMsg(maqEdit.id == null ? 'Máquina agregada.' : 'Máquina guardada.');
    setMaqEdit(null);
    void recargar();
  }

  async function borrarMaquina(m: Maquina) {
    if (!window.confirm(`¿Borrar «${[m.tipo, m.marca, m.modelo].filter(Boolean).join(' ')}»?`)) return;
    const r = await fetch(`/api/admin/proveedores-crm/maquinas/${m.id}`, { method: 'DELETE' });
    setMsg(r.ok ? 'Máquina borrada.' : 'No se pudo borrar.');
    void recargar();
  }

  const campo = (k: keyof FormProveedor, titulo: string, extra?: { tipo?: string; ancho?: boolean; ph?: string }) => (
    <div style={extra?.ancho ? { gridColumn: '1 / -1' } : undefined}>
      <span style={label}>{titulo}</span>
      <input style={input} type={extra?.tipo ?? 'text'} placeholder={extra?.ph} value={provEdit?.form[k] ?? ''}
        onChange={(e) => provEdit && setProvEdit({ ...provEdit, form: { ...provEdit.form, [k]: e.target.value } })} />
    </div>
  );
  const campoM = (k: keyof FormMaquina, titulo: string, extra?: { num?: boolean; ancho?: boolean; ph?: string; lista?: string }) => (
    <div style={extra?.ancho ? { gridColumn: '1 / -1' } : undefined}>
      <span style={label}>{titulo}</span>
      <input style={input} type={extra?.num ? 'number' : 'text'} min={extra?.num ? 0 : undefined} step={extra?.num ? '0.01' : undefined}
        inputMode={extra?.num ? 'decimal' : undefined} placeholder={extra?.ph} list={extra?.lista} value={maqEdit?.form[k] ?? ''}
        onChange={(e) => maqEdit && setMaqEdit({ ...maqEdit, form: { ...maqEdit.form, [k]: e.target.value } })} />
    </div>
  );

  return (
    <div style={{ color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 className="adm-page-title">CRM de proveedores</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 0', maxWidth: 720 }}>
            Todos los proveedores —los que se registran en el sitio y los de la red— con su contacto, la ubicación de su taller
            y su maquinaria. Los costos por hora son solo de referencia: no cambian ningún precio.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={botonSec} onClick={descargar} disabled={visibles.length === 0}>
            <i className="ph ph-download-simple" style={{ marginRight: 6 }} />Descargar Excel
          </button>
          <button type="button" style={boton} onClick={() => { setError(null); setProvEdit({ id: null, form: provVacio }); }}>+ Nuevo proveedor</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Proveedores', cuenta.todos, C.ink],
          ['Activos en la red', cuenta.activos, C.ok],
          ['Solicitudes por revisar', cuenta.solicitudes, cuenta.solicitudes ? C.warn : C.dim],
          ['Máquinas registradas', totalMaquinas, C.ink],
        ].map(([t, n, col]) => (
          <div key={String(t)} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12.5, color: C.muted }}>{t}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: col as string }}>{n as number}</div>
          </div>
        ))}
      </div>

      {msg ? (
        <div role="status" style={{ background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13.5 }}>{msg}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input style={{ ...input, maxWidth: 380 }} placeholder="Buscar por proveedor, contacto, ciudad o máquina…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['todos', 'Todos'], ['activos', 'Activos'], ['solicitudes', 'Solicitudes'], ['bajas', 'Bajas']] as const).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)} aria-pressed={filtro === k}
              style={{ ...chico, borderRadius: 999, ...(filtro === k ? { borderColor: C.accent, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' } : {}) }}>
              {t} <span style={{ color: C.muted, marginLeft: 4 }}>{cuenta[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* minmax(0,1fr): sin esto la tabla de máquinas (min 860 px) ensancha todas las tarjetas en móvil. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        {visibles.length === 0 ? (
          <div style={{ color: C.muted, padding: 30, textAlign: 'center', border: `1px dashed ${C.line2}`, borderRadius: 14 }}>
            {provs.length === 0 ? 'Todavía no hay proveedores. Registra el primero con «Nuevo proveedor».' : 'Ningún proveedor coincide con la búsqueda.'}
          </div>
        ) : null}

        {visibles.map((p) => {
          const s = situacion(p.status);
          const abierto = abiertos.has(p.id);
          const wa = waDe(p.phone);
          return (
            <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', opacity: p.status === 0 ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 16 }}>{p.name}</strong>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: s.color, border: `1px solid color-mix(in srgb, ${s.color} 40%, transparent)`, borderRadius: 6, padding: '2px 8px' }}>{s.texto}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}>{p.maquinas.length} {p.maquinas.length === 1 ? 'máquina' : 'máquinas'}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={chico} onClick={() => {
                    setError(null);
                    setProvEdit({ id: p.id, form: { name: p.name, contactName: p.contactName ?? '', phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '', city: p.city ?? '', state: p.state ?? 'Nuevo León' } });
                  }}>Editar datos</button>
                  <button type="button" style={chico} onClick={() => alternar(p.id)} aria-expanded={abierto}>{abierto ? 'Ocultar máquinas' : 'Ver máquinas'}</button>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 12, fontSize: 13.5 }}>
                <Dato titulo="Contacto" valor={p.contactName} />
                <Dato titulo="Correo" valor={p.email ? <a href={`mailto:${p.email}`} style={{ color: C.ink }}>{p.email}</a> : null} />
                <Dato titulo="WhatsApp / celular" valor={p.phone ? (wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" style={{ color: C.ink }}>{p.phone}</a> : p.phone) : null} />
                <Dato titulo="Ubicación del taller" valor={p.address || [p.city, p.state].filter(Boolean).join(', ') || null} />
              </div>

              {abierto ? (
                <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  {p.maquinas.length === 0 ? (
                    <p style={{ color: C.muted, fontSize: 13.5, margin: '0 0 12px' }}>Sin máquinas registradas.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
                        <thead>
                          <tr style={{ color: C.muted, textAlign: 'left' }}>
                            {['Tipo', 'Marca / modelo', 'Características', 'Sin op. y sin diésel', 'Con op., sin diésel', 'Con op. y diésel', ''].map((h) => (
                              <th key={h} style={{ padding: '6px 8px', fontWeight: 600, borderBottom: `1px solid ${C.line2}`, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.maquinas.map((m) => (
                            <tr key={m.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{m.tipo}</td>
                              <td style={{ padding: '8px' }}>{[m.marca, m.modelo].filter(Boolean).join(' ') || '—'}</td>
                              <td style={{ padding: '8px', color: C.muted, maxWidth: 260 }}>{m.caracteristicas || '—'}{m.notas ? <div style={{ color: C.dim, marginTop: 4 }}>{m.notas}</div> : null}</td>
                              <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{pesos(m.costoSinOp)}</td>
                              <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{pesos(m.costoConOp)}</td>
                              <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{pesos(m.costoTodo)}</td>
                              <td style={{ padding: '8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                <button type="button" style={{ ...chico, marginRight: 6 }} onClick={() => {
                                  setError(null);
                                  const t = (v: number | null) => (v == null ? '' : String(v));
                                  setMaqEdit({ providerId: p.id, id: m.id, form: { tipo: m.tipo, marca: m.marca ?? '', modelo: m.modelo ?? '', caracteristicas: m.caracteristicas ?? '', costoSinOp: t(m.costoSinOp), costoConOp: t(m.costoConOp), costoTodo: t(m.costoTodo), notas: m.notas ?? '' } });
                                }}>Editar</button>
                                <button type="button" style={{ ...chico, color: C.bad, borderColor: `color-mix(in srgb, ${C.bad} 45%, transparent)` }} onClick={() => borrarMaquina(m)}>Borrar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ fontSize: 12, color: C.dim, margin: '8px 0 0' }}>Costos por hora, en pesos. Solo de referencia.</p>
                    </div>
                  )}
                  <button type="button" style={{ ...chico, marginTop: 12 }} onClick={() => { setError(null); setMaqEdit({ providerId: p.id, id: null, form: maqVacia }); }}>+ Agregar máquina</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <datalist id="crm-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>

      <Modal
        abierto={provEdit !== null}
        titulo={provEdit?.id == null ? 'Nuevo proveedor' : 'Datos del proveedor'}
        subtitulo={provEdit?.id == null ? 'Entra a la red sin mandarle invitación. Su enlace al portal se lo mandas desde Red de aliados.' : undefined}
        onCerrar={() => setProvEdit(null)}
        ancho={760}
        pie={<>
          <button type="button" style={botonSec} onClick={() => setProvEdit(null)}>Cancelar</button>
          <button type="button" style={{ ...boton, opacity: guardando ? 0.6 : 1 }} onClick={guardarProveedor} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}
      >
        {error ? <div role="alert" style={{ marginBottom: 14, color: C.bad, fontSize: 13.5 }}>{error}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          {campo('name', 'Nombre del proveedor *')}
          {campo('contactName', 'Persona de contacto')}
          {campo('phone', 'WhatsApp / celular', { tipo: 'tel', ph: '10 dígitos' })}
          {campo('email', 'Correo', { tipo: 'email' })}
          {campo('address', 'Ubicación del taller', { ancho: true, ph: 'Calle, número, colonia y municipio' })}
          {campo('city', 'Ciudad')}
          <div>
            <span style={label}>Estado</span>
            <select style={input} value={provEdit?.form.state ?? 'Nuevo León'} onChange={(e) => provEdit && setProvEdit({ ...provEdit, form: { ...provEdit.form, state: e.target.value } })}>
              {[...new Set([...ESTADOS_OPERACION, provEdit?.form.state || 'Nuevo León'])].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        abierto={maqEdit !== null}
        titulo={maqEdit?.id == null ? 'Agregar máquina' : 'Editar máquina'}
        subtitulo={maqEdit ? provs.find((p) => p.id === maqEdit.providerId)?.name : undefined}
        onCerrar={() => setMaqEdit(null)}
        ancho={760}
        pie={<>
          <button type="button" style={botonSec} onClick={() => setMaqEdit(null)}>Cancelar</button>
          <button type="button" style={{ ...boton, opacity: guardando ? 0.6 : 1 }} onClick={guardarMaquina} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}
      >
        {error ? <div role="alert" style={{ marginBottom: 14, color: C.bad, fontSize: 13.5 }}>{error}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          {campoM('tipo', 'Tipo de maquinaria *', { lista: 'crm-tipos', ph: 'Excavadora, retroexcavadora…' })}
          {campoM('marca', 'Marca', { ph: 'Caterpillar, JCB…' })}
          {campoM('modelo', 'Modelo', { ph: '320, 416, 3CX…' })}
          {campoM('caracteristicas', 'Características', { ancho: true, ph: 'Año, capacidad, implementos, horas de uso…' })}
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '18px 0 4px' }}>Lo que cobra por hora</p>
        <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 10px' }}>Solo de referencia, en pesos. Deja vacío lo que no sepas.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          {campoM('costoSinOp', 'Sin operador y sin diésel', { num: true, ph: '$ por hora' })}
          {campoM('costoConOp', 'Con operador, sin diésel', { num: true, ph: '$ por hora' })}
          {campoM('costoTodo', 'Con operador y con diésel', { num: true, ph: '$ por hora' })}
          {campoM('notas', 'Notas', { ancho: true, ph: 'Disponibilidad, condiciones, mínimo de horas…' })}
        </div>
      </Modal>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: C.dim }}>{titulo}</div>
      <div style={{ marginTop: 2, overflowWrap: 'anywhere', color: valor ? C.ink : C.dim }}>{valor || '—'}</div>
    </div>
  );
}
