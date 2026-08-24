'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SHIP_METHODS, fulfillmentFlow, fulfillmentStep, type Fulfillment,
  type OrderShipping, type ShipMethod,
} from '@maqserv/types';
import { D } from '@/components/design-tokens';
import { stateColor } from '../order-status';

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const METHOD_KEYS = Object.keys(SHIP_METHODS) as ShipMethod[];

const label: React.CSSProperties = {
  display: 'block', fontSize: 10.5, letterSpacing: '1px', fontWeight: 700,
  color: '#7A7A7F', marginBottom: 7, textTransform: 'uppercase',
};
const input: React.CSSProperties = {
  width: '100%', background: D.inputBg, border: `1px solid ${D.inputBorder}`, borderRadius: 9,
  padding: '10px 12px', color: D.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
};

/**
 * Gestión del envío de un pedido: cómo sale, con qué datos y en qué paso va.
 *
 * Los datos (guía/unidad/sucursal) se guardan aparte del estado a propósito: capturar
 * la guía no es lo mismo que decirle al cliente "ya salió". Mover el estado es lo
 * único que dispara el aviso, y por eso vive en su propio botón.
 */
export function ShippingPanel({
  orderId,
  shipping,
  hasRental,
  branches,
}: {
  orderId: number;
  shipping: OrderShipping;
  hasRental: boolean;
  /** Sucursales reales, de Diseño → Contacto (no se duplica el catálogo aquí). */
  branches: string[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<ShipMethod | null>(shipping.method);
  const [carrier, setCarrier] = useState(shipping.carrier ?? '');
  const [tracking, setTracking] = useState(shipping.tracking ?? '');
  const [unit, setUnit] = useState(shipping.unit ?? '');
  const [branch, setBranch] = useState(shipping.branch ?? '');
  const [scheduled, setScheduled] = useState(shipping.scheduledAt?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(shipping.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flow = fulfillmentFlow(hasRental);
  const at = flow.indexOf(shipping.state);

  async function saveData() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          carrier: carrier || null,
          tracking: tracking || null,
          unit: unit || null,
          branch: branch || null,
          // <input type=date> da "YYYY-MM-DD"; la API espera ISO completo.
          scheduledAt: scheduled ? new Date(`${scheduled}T12:00:00`).toISOString() : null,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo guardar');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function move(state: Fulfillment) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo cambiar el estado');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  }

  const next = at >= 0 && at < flow.length - 1 ? flow[at + 1] : null;
  const nextStep = next ? fulfillmentStep(next, method) : null;
  const canceled = shipping.state === 'cancelado';

  return (
    <div style={{ background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 }}>
      <style>{`
        .sp-m:hover{ border-color: rgba(255,255,255,0.22) !important; }
        .sp-btn:hover:not(:disabled){ filter: brightness(1.1); }
        .sp-ghost:hover:not(:disabled){ background: rgba(255,255,255,0.06); }
      `}</style>

      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Envío</h2>
      <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#7A7A7F' }}>
        Cómo sale el equipo y con qué datos lo rastrea el cliente.
      </p>

      {/* --- Método --- */}
      <span style={label}>Método</span>
      <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
        {METHOD_KEYS.map((k) => {
          const on = method === k;
          return (
            <button
              key={k}
              type="button"
              className="sp-m"
              onClick={() => setMethod(k)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', cursor: 'pointer',
                background: on ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : D.inputBg,
                border: `1px solid ${on ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : D.inputBorder}`,
                borderRadius: 10, padding: '11px 13px', fontFamily: 'inherit',
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2, border: `2px solid ${on ? D.amber : '#4C4C51'}`, background: on ? D.amber : 'transparent' }} />
              <span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: on ? D.amber : '#EDEDEC' }}>{SHIP_METHODS[k].label}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#7A7A7F', marginTop: 2 }}>{SHIP_METHODS[k].hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* --- Datos que dependen del método --- */}
      {method === 'paqueteria' ? (
        <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={label} htmlFor="sp-carrier">Paquetería</label>
            <input id="sp-carrier" style={input} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DHL, Estafeta, Paquetexpress…" />
          </div>
          <div>
            <label style={label} htmlFor="sp-tracking">Número de guía</label>
            <input id="sp-tracking" style={{ ...input, fontFamily: MONO }} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="1234 5678 9012" />
          </div>
        </div>
      ) : null}

      {method === 'traslado' ? (
        <div style={{ marginBottom: 16 }}>
          <label style={label} htmlFor="sp-unit">Unidad y operador</label>
          <input id="sp-unit" style={input} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Torton 04 — Juan Pérez" />
        </div>
      ) : null}

      {method === 'sucursal' ? (
        <div style={{ marginBottom: 16 }}>
          <label style={label} htmlFor="sp-branch">Sucursal de recolección</label>
          {branches.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {branches.map((b) => (
                <button
                  key={b}
                  type="button"
                  className="sp-m"
                  onClick={() => setBranch(b)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                    background: branch === b ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : D.inputBg,
                    border: `1px solid ${branch === b ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : D.inputBorder}`,
                    borderRadius: 9, padding: '9px 12px', color: branch === b ? D.amber : '#B4B4B9',
                    fontWeight: branch === b ? 700 : 500,
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : (
            // Sin sucursales configuradas no se inventa un catálogo aquí.
            <p style={{ margin: 0, fontSize: 12.5, color: '#7A7A7F' }}>
              No hay sucursales configuradas. Agrégalas en <strong style={{ color: '#B4B4B9' }}>Diseño → Contacto</strong>.
            </p>
          )}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <div>
          <label style={label} htmlFor="sp-date">Fecha comprometida</label>
          <input id="sp-date" type="date" style={{ ...input, colorScheme: 'dark' }} value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="sp-notes">Indicaciones para el cliente</label>
          <textarea id="sp-notes" rows={3} style={{ ...input, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Entregar en almacén B, preguntar por el residente." />
        </div>
      </div>

      <button
        type="button"
        className="sp-ghost"
        onClick={saveData}
        disabled={saving}
        style={{
          width: '100%', background: 'transparent', border: `1px solid ${D.inputBorder}`, borderRadius: 9,
          padding: '10px 14px', color: saved ? '#3fbf8f' : '#B4B4B9', fontSize: 13, fontWeight: 700,
          fontFamily: 'inherit', cursor: saving ? 'wait' : 'pointer',
        }}
      >
        {saved ? '✓ Datos guardados' : saving ? 'Guardando…' : 'Guardar datos de envío'}
      </button>

      {/* --- Avanzar el flujo: esto SÍ le avisa al cliente --- */}
      <div style={{ borderTop: `1px solid ${D.cardBorder}`, margin: '20px 0 0', paddingTop: 18 }}>
        <span style={label}>Estado del envío</span>
        {canceled ? (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#f55', fontWeight: 600 }}>Este pedido está cancelado.</p>
        ) : next ? (
          <button
            type="button"
            className="sp-btn"
            onClick={() => move(next)}
            disabled={saving}
            style={{
              width: '100%', background: D.amber, border: 'none', borderRadius: 9, padding: '12px 14px',
              color: 'var(--color-primary-fg)', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            Marcar como “{nextStep?.label}” →
          </button>
        ) : (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#3fbf8f', fontWeight: 600 }}>El pedido ya está cerrado.</p>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#5C5C61', lineHeight: 1.5 }}>
          Al cambiar el estado, el cliente recibe el aviso al instante y queda registrado en el historial.
        </p>

        {/* Corregir un paso: seguir la escalera es lo normal, pero la realidad no siempre coopera. */}
        <details style={{ marginTop: 14 }}>
          <summary style={{ fontSize: 12, color: '#7A7A7F', cursor: 'pointer', fontWeight: 600 }}>Corregir a otro estado</summary>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {[...flow, 'cancelado' as Fulfillment].map((s) => {
              const on = s === shipping.state;
              const c = stateColor(s);
              return (
                <button
                  key={s}
                  type="button"
                  className="sp-ghost"
                  onClick={() => move(s)}
                  disabled={saving || on}
                  style={{
                    fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: on ? 'default' : 'pointer',
                    background: on ? `color-mix(in srgb, ${c} 14%, transparent)` : 'transparent',
                    border: `1px solid color-mix(in srgb, ${c} ${on ? 40 : 18}%, transparent)`,
                    color: c, borderRadius: 20, padding: '5px 10px', opacity: on ? 1 : 0.75,
                  }}
                >
                  {fulfillmentStep(s, method).label}
                </button>
              );
            })}
          </div>
        </details>
      </div>

      {error ? (
        <p role="alert" style={{ margin: '14px 0 0', fontSize: 12.5, color: '#f55', fontWeight: 600 }}>{error}</p>
      ) : null}
    </div>
  );
}
