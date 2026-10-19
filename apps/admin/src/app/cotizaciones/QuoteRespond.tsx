'use client';

import { useId, useState } from 'react';
import { AdminDatePicker } from '@/components/AdminFecha';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { Btn, FormField, Note } from '@/components/ui';

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Vigencia sugerida. El mismo plazo por defecto que aplica la API si se deja vacía. */
function enQuinceDias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

/**
 * Responder cotización: importes, vigencia y condiciones → status completed.
 *
 * Dos casos (2026-10-15):
 *   · Cotizada con el tabulador (`documento`): los importes son los del
 *     documento y no se tocan aquí; solo se responden vigencia y condiciones.
 *   · Sin documento: se captura el PRECIO de lo que pidió, más flete e
 *     impuesto. Antes solo había flete e impuesto, y un equipo sin precio en
 *     el catálogo le llegaba al cliente en $0.
 *
 * `principal` pinta el botón como acción principal. En la lista va en cada
 * fila y ahí NO lo es: diez botones de acento seguidos dejan de decir nada.
 * En el detalle de una solicitud sí.
 */
export function QuoteRespond({
  quoteId,
  subtotal: subtotalActual,
  freight: freightActual = 0,
  tax: taxActual = 0,
  documento,
  cotizarHref,
  principal,
}: {
  quoteId: number;
  subtotal: number;
  freight?: number;
  tax?: number;
  /** Folio del documento del cotizador ligado a la solicitud. */
  documento?: string | null;
  /** Dónde se cotiza con el tabulador, si la línea tiene cotizador. */
  cotizarHref?: string | null;
  principal?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtotal, setSubtotal] = useState(subtotalActual);
  const [freight, setFreight] = useState(freightActual);
  const [tax, setTax] = useState(taxActual);
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

  // Con documento manda lo que dice el documento, no lo que se teclee.
  const sub = documento ? subtotalActual : subtotal;
  const fle = documento ? freightActual : freight;
  const imp = documento ? taxActual : tax;
  const total = sub + fle + imp;
  const sinPrecio = total <= 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sinPrecio) { setError('La cotización no tiene precio: captúralo o cotízala con el tabulador.'); return; }
    setLoading(true);
    setError(null);
    const r = await fetch(`/api/admin/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(documento ? {} : { subtotal, freightCost: freight, tax }),
        conditions: conditions.trim() || undefined,
        validUntil: validUntil || undefined,
        included: included.trim() || undefined,
        excluded: excluded.trim() || undefined,
        status: 'completed',
      }),
    }).catch(() => null);
    setLoading(false);
    if (!r?.ok) {
      const b = await r?.json().catch(() => null);
      setError(b?.message ?? 'No se pudo enviar la cotización. Inténtalo de nuevo.');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const cerrar = () => { if (!loading) setOpen(false); };
  const formId = useId();
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 13.5, color: 'var(--adm-muted)' };
  const cifra: React.CSSProperties = { color: 'var(--adm-text)', fontWeight: 500 };
  const numero = (v: number, set: (n: number) => void) => ({
    className: 'adm-input', type: 'number', step: '0.01', min: 0, value: v || '', placeholder: '0.00',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(Math.max(0, Number(e.target.value) || 0)),
  });

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
        ancho={480}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Btn>
            <Btn variant="primary" type="submit" form={formId} disabled={loading || sinPrecio}>
              {loading ? 'Enviando…' : 'Enviar cotización'}
            </Btn>
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            {documento ? (
              <Note tone="info" icon="ph-file-text">
                Los importes son los del documento <strong className="adm-mono">{documento}</strong>. Para cambiarlos, vuelve a cotizarla con el tabulador.
              </Note>
            ) : (
              <>
                {cotizarHref ? (
                  <Note tone="info" icon="ph-calculator">
                    ¿Con documento y precios del tabulador? <a href={cotizarHref} className="adm-link">Cotízala con el tabulador</a>: sale con folio y el cliente la puede imprimir.
                  </Note>
                ) : null}
                <div className="adm-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  <FormField label="Precio de lo que pide ($)">
                    <input {...numero(subtotal, setSubtotal)} />
                  </FormField>
                  <FormField label="Flete / traslado ($)">
                    <input {...numero(freight, setFreight)} />
                  </FormField>
                  <FormField label="Impuesto ($)">
                    <input {...numero(tax, setTax)} />
                  </FormField>
                </div>
              </>
            )}
            <FormField label="El precio vale hasta" help="Pasada esta fecha el cliente ya no puede aceptarla y se marca como vencida.">
              <AdminDatePicker
                value={validUntil}
                min={new Date().toISOString().slice(0, 10)}
                onChange={setValidUntil}
                placeholder="Sin vencimiento"
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
            <div style={row}><span>Subtotal</span><span className="adm-num" style={cifra}>{money(sub)}</span></div>
            {fle > 0 ? <div style={row}><span>Traslado</span><span className="adm-num" style={cifra}>{money(fle)}</span></div> : null}
            {imp > 0 ? <div style={row}><span>{documento ? 'IVA' : 'Impuesto'}</span><span className="adm-num" style={cifra}>{money(imp)}</span></div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--adm-border)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>Total al cliente</span>
              <strong className="adm-num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--adm-text)' }}>{money(total)}</strong>
            </div>
            {sinPrecio ? <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--adm-warn)' }}>Sin precio no se puede enviar.</div> : null}
          </div>
          {error ? <div style={{ marginTop: 12 }}><Note tone="bad" icon="ph-warning">{error}</Note></div> : null}
        </form>
      </Modal>
    </>
  );
}
