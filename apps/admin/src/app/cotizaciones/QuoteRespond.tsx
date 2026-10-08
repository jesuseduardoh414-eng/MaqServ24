'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { Btn, FormField } from '@/components/ui';

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Vigencia sugerida. El mismo plazo por defecto que aplica la API si se deja vacía. */
function enQuinceDias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

/**
 * Responder cotización: flete/impuesto/condiciones → status completed.
 *
 * `principal` pinta el botón como acción principal. En la lista va en cada
 * fila y ahí NO lo es: diez botones de acento seguidos dejan de decir nada.
 * En el detalle de una solicitud sí.
 */
export function QuoteRespond({ quoteId, subtotal, principal }: { quoteId: number; subtotal: number; principal?: boolean }) {
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

  const cerrar = () => { if (!loading) setOpen(false); };
  const formId = useId();
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 13.5, color: 'var(--adm-muted)' };
  const cifra: React.CSSProperties = { color: 'var(--adm-text)', fontWeight: 500 };

  return (
    <>
      <Btn size="sm" variant={principal ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
        Responder
      </Btn>

      {/* El Modal del kit deja los botones fijos al pie mientras el cuerpo hace
          scroll: al agregar vigencia e inclusiones el formulario creció más que
          la pantalla y tener que buscar "Enviar" hasta abajo era fricción pura.
          El botón de enviar vive en el pie, fuera del <form>, y se liga a él con
          el atributo `form` para que Enter siga enviando. */}
      <Modal
        abierto={open}
        titulo="Responder cotización"
        subtitulo="Al enviarla, el cliente la verá como “Cotizada” en su cuenta."
        onCerrar={cerrar}
        ancho={460}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Btn>
            <Btn variant="primary" type="submit" form={formId} disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar cotización'}
            </Btn>
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="adm-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <FormField label="Flete / traslado ($)">
                <input className="adm-input" type="number" step="0.01" min={0} value={freight || ''} onChange={(e) => setFreight(Math.max(0, Number(e.target.value) || 0))} placeholder="0.00" />
              </FormField>
              <FormField label="Impuesto ($)">
                <input className="adm-input" type="number" step="0.01" min={0} value={tax || ''} onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))} placeholder="0.00" />
              </FormField>
            </div>
            <FormField label="El precio vale hasta" help="Pasada esta fecha el cliente ya no puede aceptarla y se marca como vencida.">
              <input
                className="adm-input"
                type="date"
                value={validUntil}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </FormField>
            <FormField label="Qué SÍ incluye">
              <textarea
                className="adm-textarea"
                value={included}
                onChange={(e) => setIncluded(e.target.value)}
                rows={2}
                placeholder="Traslado de ida y vuelta, operador, mantenimiento"
              />
            </FormField>
            <FormField label="Qué NO incluye" help="Este es el campo que evita la discusión cuando llega la factura.">
              <textarea
                className="adm-textarea"
                value={excluded}
                onChange={(e) => setExcluded(e.target.value)}
                rows={2}
                placeholder="Combustible, maniobras especiales, tiempos de espera"
              />
            </FormField>
            <FormField label="Otras condiciones (opcional)">
              <textarea
                className="adm-textarea"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                rows={2}
                placeholder="Cancelación, horarios, requisitos de acceso"
              />
            </FormField>
          </div>

          {/* Desglose en vivo: lo que verá el cliente. */}
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--adm-border)' }}>
            <div style={row}><span>Subtotal</span><span className="adm-num" style={cifra}>{money(subtotal)}</span></div>
            {freight > 0 ? <div style={row}><span>Traslado</span><span className="adm-num" style={cifra}>{money(freight)}</span></div> : null}
            {tax > 0 ? <div style={row}><span>Impuesto</span><span className="adm-num" style={cifra}>{money(tax)}</span></div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--adm-border)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>Total al cliente</span>
              <strong className="adm-num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--adm-text)' }}>{money(total)}</strong>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
