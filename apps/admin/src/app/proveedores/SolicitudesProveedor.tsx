'use client';

import { useState } from 'react';

type Colores = Record<'panel' | 'panel2' | 'line' | 'line2' | 'ink' | 'muted' | 'dim' | 'accent' | 'accentInk' | 'warn' | 'ok' | 'bad', string>;

export interface SolicitudRow {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  categoryLabels?: string[];
}

/**
 * SOLICITUDES DE PROVEEDORES (2026-10-06).
 *
 * Lo que llega por "Regístrate como proveedor" en el sitio: aliados con
 * `status = 2`. No reciben ofertas ni entran al cotizador hasta aceptarlos.
 * Aceptar los pasa a la red (status 1) con los datos que mandaron; después se
 * revisa qué ofrecen en su expediente y se les manda su enlace. Descartar borra
 * la ficha (no tiene historial).
 */
export function SolicitudesProveedor({ solicitudes, colores: C, onCambio }: { solicitudes: SolicitudRow[]; colores: Colores; onCambio: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  if (solicitudes.length === 0) return null;

  async function aceptar(s: SolicitudRow) {
    if (!window.confirm(`¿Aceptar a «${s.name}» en la red de aliados?`)) return;
    setOcupado(s.id);
    const r = await fetch(`/api/admin/providers/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 1 }) });
    setOcupado(null);
    onCambio(r.ok ? `«${s.name}» ya está en la red. Abre su expediente para revisar qué ofrece y mandarle su enlace de acceso.` : 'No se pudo aceptar. Inténtalo de nuevo.');
  }

  async function descartar(s: SolicitudRow) {
    if (!window.confirm(`¿Descartar la solicitud de «${s.name}»? Se borra y no se le avisa.`)) return;
    setOcupado(s.id);
    const r = await fetch(`/api/admin/providers/${s.id}`, { method: 'DELETE' });
    setOcupado(null);
    onCambio(r.ok ? `Se descartó la solicitud de «${s.name}».` : 'No se pudo descartar. Inténtalo de nuevo.');
  }

  const btn = (color: string, relleno: boolean) => ({
    background: relleno ? color : 'transparent', color: relleno ? C.accentInk : color,
    border: relleno ? 'none' : `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
    borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  });
  const dato = (etiqueta: string, valor: React.ReactNode) =>
    valor ? <div><div style={{ fontSize: 11.5, color: C.dim }}>{etiqueta}</div><div style={{ fontSize: 13.5, color: C.ink, marginTop: 2, overflowWrap: 'anywhere' }}>{valor}</div></div> : null;

  return (
    <section style={{ marginBottom: 22 }} aria-labelledby="sol-prov-t">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h2 id="sol-prov-t" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Solicitudes de proveedores</h2>
        <span style={{ fontSize: 12.5, color: C.warn, fontWeight: 700 }}>{solicitudes.length} por revisar</span>
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 12px' }}>
        Llegan desde «Regístrate como proveedor» en el sitio. No reciben ofertas hasta que los aceptes.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {solicitudes.map((s) => (
          <div key={s.id} style={{ background: C.panel, border: `1px solid color-mix(in srgb, ${C.warn} 35%, transparent)`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 16 }}>{s.name}</strong>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', padding: '3px 9px', borderRadius: 6, color: C.warn, border: `1px solid color-mix(in srgb, ${C.warn} 40%, transparent)`, background: `color-mix(in srgb, ${C.warn} 12%, transparent)` }}>POR REVISAR</span>
              {(s.categoryLabels ?? []).map((c) => (
                <span key={c} style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, border: `1px solid ${C.line2}`, borderRadius: 999, padding: '3px 10px' }}>{c}</span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginTop: 14 }}>
              {dato('Contacto', s.contactName)}
              {dato('Teléfono', s.phone ? <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} style={{ color: C.ink }}>{s.phone}</a> : null)}
              {dato('Correo', s.email ? <a href={`mailto:${s.email}`} style={{ color: C.ink }}>{s.email}</a> : null)}
              {dato('Ubicación', [s.city, s.state].filter(Boolean).join(', '))}
            </div>
            {s.notes ? (
              <div style={{ marginTop: 14, padding: '12px 14px', background: C.panel2, borderRadius: 10, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: C.ink }}>{s.notes}</div>
            ) : null}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" disabled={ocupado === s.id} onClick={() => descartar(s)} style={btn(C.bad, false)}>Descartar</button>
              <button type="button" disabled={ocupado === s.id} onClick={() => aceptar(s)} style={btn(C.accent, true)}>{ocupado === s.id ? 'Guardando…' : 'Aceptar en la red'}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
