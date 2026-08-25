'use client';

import { useState } from 'react';
import { D, FONT } from '@/components/editor-kit';

/**
 * ¿QUIÉN PUEDE ATENDER ESTA SOLICITUD? (documento, secciones 16 y 17).
 *
 * Hasta ahora esta pregunta se contestaba de memoria: quien cotizaba tenía que
 * acordarse de a quién llamar. Aquí el sistema propone, en orden, a los aliados
 * que atienden esa línea de servicio, y —esto es lo importante— explica en
 * palabras por qué puso a cada uno donde lo puso.
 *
 * La lista NO decide. Quien cotiza sigue eligiendo, y por eso ve tanto lo que
 * juega a favor como lo que hay que tomar en cuenta antes de asignar.
 */

interface Match {
  providerId: number;
  name: string;
  level: string;
  verified: boolean;
  phone: string | null;
  contactName: string | null;
  responseMinutes: number | null;
  coverage: string[];
  score: number;
  reasons: string[];
  warnings: string[];
  availableEquipment: number;
  equipment: Array<{ id: number; name: string; state: string; location: string | null }>;
}

interface Respuesta {
  quoteNumber: string;
  categoria: string | null;
  zona: string | null;
  total: number;
  motivo: string | null;
  matches: Match[];
}

const NIVEL: Record<string, string> = {
  preferente: 'Preferente',
  activo: 'Activo',
  validado: 'Validado',
  registrado: 'Registrado',
};

export function QuoteMatches({ quoteId }: { quoteId: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    setOpen(true);
    if (data) return;
    setError(null);
    try {
      const r = await fetch(`/api/admin/quotes/${quoteId}/matches`);
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setError('No se pudo consultar la red de aliados. Intenta de nuevo.');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Ver qué aliados pueden atender esta solicitud"
        style={{
          border: `1px solid ${D.inputBorder}`, background: 'transparent', color: '#B4B4B9',
          borderRadius: 9, padding: '8px 12px', fontWeight: 600, fontSize: 12.5,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        ¿Quién puede?
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aliados que pueden atender"
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200, fontFamily: FONT }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18,
          padding: 24, width: 'min(620px, 100%)', textAlign: 'left',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)',
          // La lista crece con el número de aliados: sin tope, el modal se sale
          // de la pantalla y no hay forma de llegar al final.
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>
          Quién puede atender esto
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: D.muted, lineHeight: 1.55 }}>
          {data
            ? `${data.categoria ?? 'Sin línea de servicio'}${data.zona ? ` · ${data.zona}` : ''}`
            : 'Consultando la red…'}
        </p>

        {error ? (
          <div style={{ fontSize: 13, color: D.warn, padding: '14px 0' }}>{error}</div>
        ) : null}

        {data && data.matches.length === 0 ? (
          <div style={{ padding: '26px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#B4B4B9' }}>Nadie en la red cubre esto todavía</div>
            <div style={{ fontSize: 13, color: D.muted, marginTop: 7, lineHeight: 1.6 }}>{data.motivo}</div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {(data?.matches ?? []).map((m, i) => (
            <div
              key={m.providerId}
              style={{
                border: `1px solid ${i === 0 ? 'color-mix(in srgb, var(--color-primary) 34%, transparent)' : D.cardBorder}`,
                borderRadius: 13, padding: '14px 16px',
                background: i === 0 ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: D.text }}>{m.name}</span>
                  {m.verified ? (
                    <span title="Expediente completo y vigente" style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: D.amber }}>✓ VERIFICADO</span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11.5, color: D.muted2, whiteSpace: 'nowrap' }}>
                  {NIVEL[m.level] ?? m.level}
                  {/* El puntaje se muestra en chico y al final: es para ordenar,
                      no para que nadie decida con él. Lo que se lee son las razones. */}
                  <span style={{ opacity: 0.5 }}> · {m.score} pts</span>
                </span>
              </div>

              <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {m.reasons.map((r) => (
                  <li key={r} style={{ fontSize: 12.5, color: '#9A9A9F', lineHeight: 1.5 }}>
                    <span style={{ color: D.amber, marginRight: 7 }}>+</span>{r}
                  </li>
                ))}
                {m.warnings.map((w) => (
                  <li key={w} style={{ fontSize: 12.5, color: '#8A8A90', lineHeight: 1.5 }}>
                    <span style={{ color: D.warn, marginRight: 7 }}>!</span>{w}
                  </li>
                ))}
              </ul>

              {m.phone || m.contactName ? (
                <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${D.cardBorder}`, fontSize: 12.5, color: D.muted2 }}>
                  {m.contactName ? <span>{m.contactName}</span> : null}
                  {m.contactName && m.phone ? ' · ' : ''}
                  {m.phone ? (
                    <a href={`tel:${m.phone}`} style={{ color: D.amber, textDecoration: 'none', fontWeight: 600 }}>{m.phone}</a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ marginTop: 20, width: '100%', border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 11, padding: '11px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
