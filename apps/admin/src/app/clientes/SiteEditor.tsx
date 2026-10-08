'use client';

import { useState, type CSSProperties } from 'react';
import { Btn, Chip, FormField, StatusText } from '@/components/ui';

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

  // Una obra es un bloque con acciones, requisitos e historial propio: se
  // queda como tarjeta (la del kit, sin sombra). La de alta vive dentro del
  // modal y ahí no necesita otra caja alrededor.
  const caja: CSSProperties = {
    background: 'var(--adm-card)', border: '1px solid var(--adm-border)', borderRadius: 12,
    padding: 16, opacity: obra && obra.status === 0 ? 0.55 : 1,
  };

  if (!editando && obra) {
    return (
      <div style={caja}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="adm-cell-title">{obra.name}</span>
              {obra.status === 0 ? <Chip tone="muted">Dada de baja</Chip> : null}
            </div>
            {obra.address ? <div className="adm-cell-sub">{obra.address}</div> : null}
            {obra.contactName || obra.contactPhone ? (
              <div className="adm-cell-sub">
                {obra.contactName ?? ''}{obra.contactName && obra.contactPhone ? ' · ' : ''}
                {obra.contactPhone ? <a href={`tel:${obra.contactPhone}`} className="adm-link adm-mono">{obra.contactPhone}</a> : null}
              </div>
            ) : null}
          </div>
          <Btn size="sm" icon="ph-pencil-simple" onClick={() => setEditando(true)}>Editar</Btn>
        </div>

        {obra.requirements.length > 0 ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {obra.requirements.map((r) => <Chip key={r} tone="warn">{r}</Chip>)}
          </div>
        ) : null}

        {obra.history.length > 0 ? (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--adm-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--adm-faint)', marginBottom: 8 }}>
              <span className="adm-num">{obra.history.length}</span> servicio{obra.history.length === 1 ? '' : 's'} en esta obra
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {obra.history.slice(0, 6).map((h) => (
                <div key={h.id} style={{ display: 'flex', gap: 12, fontSize: 13, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="adm-mono" style={{ color: 'var(--adm-faint)', minWidth: 112 }}>{h.quoteNumber}</span>
                  <span style={{ color: 'var(--adm-muted)', minWidth: 130 }}>{h.category ?? 'sin línea'}</span>
                  <span className="adm-num" style={{ color: 'var(--adm-text)' }}>{money(h.total)}</span>
                  {h.serviceLabel ? <StatusText tone="accent">{h.serviceLabel}</StatusText> : null}
                  <span style={{ color: 'var(--adm-faint)', marginLeft: 'auto', fontSize: 12.5 }}>{fecha(h.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--adm-faint)' }}>Todavía no se le ha servido nada a esta obra.</div>
        )}
      </div>
    );
  }

  // Botones-chip del editor de requisitos: el reset de <button> + la forma de `.adm-chip`.
  const chipBtn: CSSProperties = { border: 0, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div style={nueva ? undefined : caja}>
      <div className="adm-form-grid">
        <FormField label="Cómo le dicen a la obra *" style={{ gridColumn: '1 / -1' }}>
          <input className="adm-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Torre Vasconcelos · Frente 3" autoFocus />
        </FormField>
        <FormField label="Dirección" style={{ gridColumn: '1 / -1' }}>
          <input className="adm-input" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Av. Vasconcelos 1500, Monterrey, N.L." />
        </FormField>
        <FormField label="Municipio">
          <input className="adm-input" value={f.municipality} onChange={(e) => set('municipality', e.target.value)} placeholder="Monterrey" />
        </FormField>
        <FormField label="Quién responde en obra">
          <input className="adm-input" value={f.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Ing. residente" />
        </FormField>
        <FormField label="Su teléfono">
          <input className="adm-input" value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="81 8000 0000" />
        </FormField>
      </div>

      {/* Lo que la obra exige. Es el campo que evita la llamada de "¿y traen
          inducción?" cuando la máquina ya está en la puerta. */}
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <span className="adm-label">Qué exige esta obra para dejar entrar</span>
        {reqs.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {reqs.map((r) => (
              <button
                key={r}
                type="button"
                className="adm-chip t-warn"
                onClick={() => setReqs(reqs.filter((x) => x !== r))}
                title="Quitar"
                style={chipBtn}
              >
                {r} <i className="ph ph-x" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="adm-input"
            style={{ maxWidth: 280 }}
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
              className="adm-chip"
              onClick={() => setReqs([...reqs, s])}
              style={{ ...chipBtn, background: 'transparent', border: '1px dashed var(--adm-border-strong)', color: 'var(--adm-muted)' }}
            >
              <i className="ph ph-plus" aria-hidden /> {s}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Notas" style={{ marginTop: 16 }}>
        <textarea
          className="adm-textarea"
          rows={3}
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Acceso por terracería, entra lowboy. Preguntar por el velador después de las 18:00."
        />
      </FormField>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {/* Primario solo en el alta (es la acción del modal); al editar una obra
            dentro de la ficha, la acción principal de la página sigue siendo otra. */}
        <Btn variant={nueva ? 'primary' : 'secondary'} size={nueva ? 'md' : 'sm'} icon={nueva ? undefined : 'ph-check'} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : nueva ? 'Agregar obra' : 'Guardar'}
        </Btn>
        <Btn
          variant="ghost"
          size={nueva ? 'md' : 'sm'}
          onClick={() => { if (nueva) onCancelar?.(); else setEditando(false); }}
        >
          Cancelar
        </Btn>
        {!nueva && obra!.status === 1 ? (
          <Btn variant="ghost" size="sm" icon="ph-archive" style={{ marginLeft: 'auto' }} onClick={archivar}>
            Dar de baja
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
