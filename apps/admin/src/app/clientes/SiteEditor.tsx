'use client';

import { useState } from 'react';
import { C, input, label, boton, botonSec } from './ClientsManager';

/**
 * UNA OBRA.
 *
 * Lo que el documento pide guardar de cada frente: dónde es, quién responde
 * ahí y qué exige para dejar entrar. Ese último campo es el que hoy se dice
 * por teléfono y se olvida entre una obra y otra — y es el que después permite
 * advertir cuando un aliado no acredita lo que ese cliente exige.
 */

export interface Obra {
  id: number;
  name: string;
  address: string | null;
  municipality: string | null;
  state: string | null;
  contactName: string | null;
  contactPhone: string | null;
  requirements: string[];
  notes: string | null;
  status: number;
  history: Array<{
    id: number;
    quoteNumber: string;
    category: string | null;
    total: number;
    serviceState: string | null;
    serviceLabel: string | null;
    createdAt: string | null;
  }>;
}

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

/**
 * Los que más se repiten en obra. Se pueden escribir otros.
 *
 * IMPORTAN LAS PALABRAS EXACTAS: estas etiquetas coinciden con el catálogo de
 * `requirements-match` en la API, que es el que cruza lo que la obra exige
 * contra el expediente del aliado. Uno escrito a mano también sirve —el
 * catálogo reconoce sinónimos— pero uno que no reconozca sale como "hay que
 * confirmarlo con el aliado" en vez de verificarse solo.
 *
 * "Acceso sólo por la mañana" se quitó de aquí a propósito: no es algo que un
 * aliado pueda acreditar con un papel, así que va en Notas y no como requisito.
 */
const SUGERIDOS = [
  'Inducción de seguridad',
  'Seguro vigente del operador',
  'Póliza de responsabilidad civil',
  'DC-3 del operador',
  'Vehículo con torreta',
  'Extintor a bordo',
];

export function SiteEditor({
  clientId, obra, onListo, onCancelar,
}: {
  clientId: number;
  /** Sin obra = formulario de alta. */
  obra?: Obra;
  onListo: () => void;
  onCancelar?: () => void;
}) {
  const nueva = !obra;
  const [editando, setEditando] = useState(nueva);
  const [guardando, setGuardando] = useState(false);
  const [f, setF] = useState({
    name: obra?.name ?? '',
    address: obra?.address ?? '',
    municipality: obra?.municipality ?? '',
    contactName: obra?.contactName ?? '',
    contactPhone: obra?.contactPhone ?? '',
    notes: obra?.notes ?? '',
  });
  const [reqs, setReqs] = useState<string[]>(obra?.requirements ?? []);
  const [nuevoReq, setNuevoReq] = useState('');

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    if (f.name.trim().length < 2) return;
    setGuardando(true);
    const cuerpo = { ...f, requirements: reqs };
    const r = nueva
      ? await fetch(`/api/admin/clients/${clientId}/sites`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        })
      : await fetch(`/api/admin/clients/sites/${obra!.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        });
    setGuardando(false);
    if (r.ok) { setEditando(false); onListo(); }
  }

  async function archivar() {
    if (!obra) return;
    // No se borra: sus solicitudes son el historial del cliente y borrarla los
    // dejaría huérfanos.
    await fetch(`/api/admin/clients/sites/${obra.id}`, { method: 'DELETE' });
    onListo();
  }

  const caja = {
    background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 12,
    padding: '14px 16px', opacity: obra && obra.status === 0 ? 0.55 : 1,
  };

  if (!editando && obra) {
    return (
      <div style={caja}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>
              {obra.name}
              {obra.status === 0 ? <span style={{ marginLeft: 8, fontSize: 10.5, color: C.dim }}>DADA DE BAJA</span> : null}
            </div>
            {obra.address ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{obra.address}</div> : null}
            {obra.contactName || obra.contactPhone ? (
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
                {obra.contactName ?? ''}{obra.contactName && obra.contactPhone ? ' · ' : ''}
                {obra.contactPhone ? <a href={`tel:${obra.contactPhone}`} style={{ color: C.accent, textDecoration: 'none' }}>{obra.contactPhone}</a> : null}
              </div>
            ) : null}
          </div>
          <button type="button" style={{ ...botonSec, padding: '6px 12px', fontSize: 12.5 }} onClick={() => setEditando(true)}>
            Editar
          </button>
        </div>

        {obra.requirements.length > 0 ? (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {obra.requirements.map((r) => (
              <span key={r} style={{ fontSize: 11.5, color: C.warn, border: `1px solid color-mix(in srgb, var(--color-warning) 34%, transparent)`, borderRadius: 20, padding: '2px 9px' }}>
                {r}
              </span>
            ))}
          </div>
        ) : null}

        {obra.history.length > 0 ? (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6 }}>
              {obra.history.length} servicio{obra.history.length === 1 ? '' : 's'} en esta obra
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {obra.history.slice(0, 6).map((h) => (
                <div key={h.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: C.dim, minWidth: 112 }}>{h.quoteNumber}</span>
                  <span style={{ color: C.muted, minWidth: 130 }}>{h.category ?? 'sin línea'}</span>
                  <span style={{ color: C.ink }}>{money(h.total)}</span>
                  {h.serviceLabel ? <span style={{ color: C.accent }}>{h.serviceLabel}</span> : null}
                  <span style={{ color: C.dim, marginLeft: 'auto' }}>{fecha(h.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 12, color: C.dim }}>Todavía no se le ha servido nada a esta obra.</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...caja, background: C.panel3 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={label}>Cómo le dicen a la obra *</span>
          <input style={input} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Torre Vasconcelos · Frente 3" autoFocus />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={label}>Dirección</span>
          <input style={input} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Av. Vasconcelos 1500, Monterrey, N.L." />
        </div>
        <div><span style={label}>Municipio</span><input style={input} value={f.municipality} onChange={(e) => set('municipality', e.target.value)} placeholder="Monterrey" /></div>
        <div><span style={label}>Quién responde en obra</span><input style={input} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Ing. residente" /></div>
        <div><span style={label}>Su teléfono</span><input style={input} value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="81 8000 0000" /></div>
      </div>

      {/* Lo que la obra exige. Es el campo que evita la llamada de "¿y traen
          inducción?" cuando la máquina ya está en la puerta. */}
      <div style={{ marginTop: 14 }}>
        <span style={label}>Qué exige esta obra para dejar entrar</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {reqs.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReqs(reqs.filter((x) => x !== r))}
              title="Quitar"
              style={{ fontSize: 11.5, color: C.warn, background: 'none', border: `1px solid color-mix(in srgb, var(--color-warning) 34%, transparent)`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {r} ×
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...input, maxWidth: 280 }}
            value={nuevoReq}
            onChange={(e) => setNuevoReq(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const v = nuevoReq.trim();
              if (v && !reqs.includes(v)) setReqs([...reqs, v]);
              setNuevoReq('');
            }}
            placeholder="Escribe uno y pulsa Enter"
          />
          {SUGERIDOS.filter((s) => !reqs.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setReqs([...reqs, s])}
              style={{ fontSize: 11.5, color: C.muted, background: 'none', border: `1px dashed ${C.line2}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={label}>Notas</span>
        <textarea
          style={{ ...input, minHeight: 62, resize: 'vertical', lineHeight: 1.5 }}
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Acceso por terracería, entra lowboy. Preguntar por el velador después de las 18:00."
        />
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...boton, opacity: guardando ? 0.6 : 1 }} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : nueva ? 'Agregar obra' : 'Guardar'}
        </button>
        <button
          type="button"
          style={botonSec}
          onClick={() => { if (nueva) onCancelar?.(); else setEditando(false); }}
        >
          Cancelar
        </button>
        {!nueva && obra!.status === 1 ? (
          <button type="button" style={{ ...botonSec, color: C.dim, marginLeft: 'auto' }} onClick={archivar}>
            Dar de baja
          </button>
        ) : null}
      </div>
    </div>
  );
}
