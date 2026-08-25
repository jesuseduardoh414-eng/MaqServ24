'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D, FONT, inputStyle, smallLabel } from '@/components/editor-kit';

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Vigencia sugerida. El mismo plazo por defecto que aplica la API si se deja vacía. */
function enQuinceDias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

/** Responder cotización: flete/impuesto/condiciones → status completed. */
export function QuoteRespond({ quoteId, subtotal }: { quoteId: number; subtotal: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [freight, setFreight] = useState(0);
  const [tax, setTax] = useState(0);
  const [conditions, setConditions] = useState('');
  /**
   * Vigencia, qué incluye y qué no (documento, sección 22). Antes esto se
   * escribía suelto en "Condiciones" —el propio ejemplo del campo decía
   * "Precio vigente 15 días. No incluye combustible ni operador"—, así que el
   * sistema no podía saber si una cotización seguía viva ni el cliente ver de
   * un vistazo qué le van a cobrar aparte.
   */
  const [validUntil, setValidUntil] = useState(enQuinceDias());
  const [included, setIncluded] = useState('');
  const [excluded, setExcluded] = useState('');

  // El admin capturaba flete e impuesto sin ver el total que le llega al cliente.
  const total = subtotal + freight + tax;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/admin/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        freightCost: freight,
        tax,
        conditions: conditions.trim() || undefined,
        validUntil: validUntil || undefined,
        included: included.trim() || undefined,
        excluded: excluded.trim() || undefined,
        status: 'completed',
      }),
    });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      >
        Responder
      </button>
    );
  }

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 13, color: D.muted2 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Responder cotización"
      onClick={() => !loading && setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200, fontFamily: FONT }}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18,
          padding: 24, width: 'min(460px, 100%)', textAlign: 'left',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)',
          // Al agregar vigencia e inclusiones el formulario creció más que la
          // pantalla: quedaba cortado y el botón de enviar era inalcanzable,
          // porque el modal está fijo y el fondo no arrastra.
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          // El botón queda pegado abajo mientras se llena el formulario: es la
          // acción de la pantalla y no debería haber que buscarla.
          display: 'flex', flexDirection: 'column',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>Responder cotización</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: D.muted }}>Al enviarla, el cliente la verá como “Cotizada” en su cuenta.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={smallLabel}>Flete / traslado ($)</span>
            <input type="number" step="0.01" min={0} value={freight || ''} onChange={(e) => setFreight(Math.max(0, Number(e.target.value) || 0))} placeholder="0.00" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={smallLabel}>Impuesto ($)</span>
            <input type="number" step="0.01" min={0} value={tax || ''} onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))} placeholder="0.00" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={smallLabel}>El precio vale hasta</span>
            <input
              type="date"
              value={validUntil}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setValidUntil(e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: 11.5, color: D.muted2, lineHeight: 1.5 }}>
              Pasada esta fecha el cliente ya no puede aceptarla y se marca como vencida.
            </span>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={smallLabel}>Qué SÍ incluye</span>
            <textarea
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
              rows={2}
              placeholder="Traslado de ida y vuelta, operador, mantenimiento"
              style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={smallLabel}>Qué NO incluye</span>
            <textarea
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              rows={2}
              placeholder="Combustible, maniobras especiales, tiempos de espera"
              style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <span style={{ fontSize: 11.5, color: D.muted2, lineHeight: 1.5 }}>
              Este es el campo que evita la discusión cuando llega la factura.
            </span>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={smallLabel}>Otras condiciones (opcional)</span>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={2}
              placeholder="Cancelación, horarios, requisitos de acceso"
              style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
        </div>

        {/* Desglose en vivo: lo que verá el cliente. */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${D.cardBorder}` }}>
          <div style={row}><span>Subtotal</span><span style={{ color: D.text, fontWeight: 600 }}>{money(subtotal)}</span></div>
          {freight > 0 ? <div style={row}><span>Traslado</span><span style={{ color: D.text, fontWeight: 600 }}>{money(freight)}</span></div> : null}
          {tax > 0 ? <div style={row}><span>Impuesto</span><span style={{ color: D.text, fontWeight: 600 }}>{money(tax)}</span></div> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 10, marginTop: 6, borderTop: `1px solid ${D.cardBorder}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: D.text }}>Total al cliente</span>
            <strong style={{ fontSize: 22, fontWeight: 800, color: D.amber, letterSpacing: '-0.02em' }}>{money(total)}</strong>
          </div>
        </div>

        <div
          style={{
            display: 'flex', gap: 10, marginTop: 20,
            // Pegado al fondo del modal: con el formulario largo, tener que
            // desplazarse hasta abajo para encontrar "Enviar" es fricción pura.
            position: 'sticky', bottom: -24, background: D.card,
            paddingTop: 14, paddingBottom: 4, marginBottom: -4,
          }}
        >
          <button type="button" onClick={() => setOpen(false)} disabled={loading} style={{ flex: 1, border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 11, padding: '11px 16px', fontWeight: 600, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 2, border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}>
            {loading ? 'Enviando…' : 'Enviar cotización'}
          </button>
        </div>
      </form>
    </div>
  );
}
