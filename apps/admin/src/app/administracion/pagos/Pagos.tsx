'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Modal } from '@/components/Modal';
import { Btn, EmptyState, FormField, Note, PageHeader, Panel, Stat, Stats } from '@/components/ui';
import { dinero, enviar, fechaCorta, fechaLarga, hoyLocal } from '../formato';

interface Servicio {
  quoteId: number;
  folio: string;
  servicio: string | null;
  monto: number;
  factura: boolean;
  clientePago: boolean;
  pagarEl: string | null;
  pagadoAt: string | null;
  referencia: string | null;
}
export interface AliadoPago {
  providerId: number;
  aliado: string;
  contacto: string | null;
  telefono: string | null;
  listas: Servicio[];
  totalListo: number;
  pagarEl: string | null;
  esperandoFactura: Servicio[];
  esperandoCliente: Servicio[];
  pagadas: Servicio[];
}

/**
 * PAGOS A ALIADOS (2026-10-22, Fase A). Arriba, solo lo que ya se puede
 * pagar: el cliente pagó y el aliado subió su factura; el pago se programó
 * solo para el día de pago. Un botón por aliado. Lo que espera se cuenta abajo,
 * sin pedir nada: los recordatorios al aliado salen solos.
 */
export function Pagos({ datos, pagados }: { datos: { paraPagar: AliadoPago[]; esperando: AliadoPago[]; pagados: AliadoPago[] }; pagados: boolean }) {
  const [pagando, setPagando] = useState<AliadoPago | null>(null);
  const hoy = hoyLocal();
  const total = datos.paraPagar.reduce((a, x) => a + x.totalListo, 0);
  const esperan = datos.esperando.reduce((a, x) => a + x.esperandoFactura.length + x.esperandoCliente.length, 0);

  const enlaces = (s: Servicio) => s.factura ? (
    <span style={{ display: 'inline-flex', gap: 10, fontSize: 12.5 }}>
      <a className="adm-link" href={`/api/admin/dinero/pagos/${s.quoteId}/factura`} target="_blank" rel="noreferrer">Factura</a>
      <a className="adm-link" href={`/api/admin/dinero/pagos/${s.quoteId}/factura?xml=1`} target="_blank" rel="noreferrer">XML</a>
    </span>
  ) : null;

  return (
    <div>
      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Pagos a aliados"
        subtitle={pagados ? 'Lo pagado en los últimos 60 días.' : 'Lo que ya se puede pagar: el cliente pagó y el aliado subió su factura. Montos con IVA.'}
        actions={<Btn href={pagados ? '/administracion/pagos' : '/administracion/pagos?pagados=1'} variant="ghost">{pagados ? 'Ver lo pendiente' : 'Ver pagados'}</Btn>}
      />

      {pagados ? (
        <Panel flush clip>
          {datos.pagados.length === 0 ? <EmptyState icon="ph-hand-coins" title="Nada pagado en 60 días" /> : datos.pagados.flatMap((a) => a.pagadas.map((s) => (
            <div key={s.quoteId} className="adm-trow" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div><div className="adm-cell-title">{a.aliado}</div><div className="adm-cell-sub">{s.folio}{s.referencia ? ` · ${s.referencia}` : ''}</div></div>
              <div style={{ textAlign: 'right' }}><div className="adm-num" style={{ fontWeight: 600 }}>{dinero(s.monto)}</div><div className="adm-cell-sub">{s.pagadoAt ? fechaCorta(s.pagadoAt.slice(0, 10)) : ''}</div></div>
            </div>
          )))}
        </Panel>
      ) : (
        <>
          <Stats>
            <Stat label="Para pagar" icon="ph-hand-coins" tone="info" value={dinero(total)} hint={`${datos.paraPagar.length} aliado${datos.paraPagar.length === 1 ? '' : 's'}`} />
            <Stat label="Esperando" icon="ph-hourglass-medium" tone="muted" value={String(esperan)} hint="servicios sin factura o sin pago del cliente" />
          </Stats>

          {datos.paraPagar.length === 0 ? (
            <Panel><EmptyState icon="ph-check-circle" title="No hay pagos listos" sub="Un pago aparece aquí cuando el cliente ya pagó y el aliado subió su factura." /></Panel>
          ) : (
            <div className="pg-lista" style={{ display: 'grid', gap: 12 }}>
              <style>{'.pg-lista > .adm-panel { margin-top: 0; }'}</style>
              {datos.paraPagar.map((a) => {
                const atrasado = a.pagarEl !== null && a.pagarEl < hoy;
                const esHoy = a.pagarEl === hoy;
                return (
                  <Panel key={a.providerId}
                    title={a.aliado}
                    desc={a.pagarEl ? (atrasado ? `Se debía pagar el ${fechaLarga(a.pagarEl)}` : esHoy ? 'Se paga hoy' : `Se paga el ${fechaLarga(a.pagarEl)}`) : undefined}
                    action={<Btn variant="primary" onClick={() => setPagando(a)}>Pagado · {dinero(a.totalListo)}</Btn>}
                  >
                    <div style={{ display: 'grid', gap: 6 }}>
                      {a.listas.map((s) => (
                        <div key={s.quoteId} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13.5, flexWrap: 'wrap' }}>
                          <span><span className="adm-mono">{s.folio}</span>{s.servicio ? <span style={{ color: 'var(--adm-muted)' }}> · {s.servicio}</span> : null}</span>
                          <span style={{ display: 'inline-flex', gap: 14, alignItems: 'center' }}>{enlaces(s)}<span className="adm-num" style={{ fontWeight: 600 }}>{dinero(s.monto)}</span></span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}

          {datos.esperando.length ? (
            <details style={{ marginTop: 18 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13.5, color: 'var(--adm-muted)' }}>Qué está esperando ({esperan})</summary>
              <Panel flush clip style={{ marginTop: 10 }}>
                {datos.esperando.map((a) => (
                  <div key={a.providerId} className="adm-trow" style={{ display: 'grid', gap: 4 }}>
                    <div className="adm-cell-title">{a.aliado}</div>
                    {a.esperandoFactura.length ? <div className="adm-cell-sub">Falta su factura: {a.esperandoFactura.map((s) => s.folio).join(', ')} (se le recuerda solo cada semana)</div> : null}
                    {a.esperandoCliente.length ? <div className="adm-cell-sub">Falta que pague el cliente: {a.esperandoCliente.map((s) => s.folio).join(', ')}</div> : null}
                  </div>
                ))}
              </Panel>
            </details>
          ) : null}
        </>
      )}

      {pagando ? <Pagar a={pagando} onCerrar={() => setPagando(null)} /> : null}
    </div>
  );
}

function Pagar({ a, onCerrar }: { a: AliadoPago; onCerrar: () => void }) {
  const router = useRouter();
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function confirmar() {
    setBusy(true); setError(null);
    const fallo = await enviar(`/api/admin/dinero/pagos/${a.providerId}/pagado`, 'POST', referencia.trim() ? { referencia: referencia.trim() } : {});
    setBusy(false);
    if (fallo) { setError(fallo); return; }
    mostrarResultado(`Pagado a ${a.aliado}. Le llegó el aviso por correo.`, 'ok');
    onCerrar();
    router.refresh();
  }
  return (
    <Modal abierto titulo={`Pagar a ${a.aliado}`} subtitulo={`${dinero(a.totalListo)} por ${a.listas.length} servicio${a.listas.length === 1 ? '' : 's'}`} onCerrar={onCerrar} ancho={460}
      pie={<><Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn><Btn variant="primary" disabled={busy} onClick={() => void confirmar()}>{busy ? 'Guardando…' : 'Ya le pagué'}</Btn></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {error ? <Note tone="bad">{error}</Note> : null}
        <FormField label="Referencia del pago" help="Opcional. Va en el aviso que le llega al aliado."><input className="adm-input" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="SPEI 7781" aria-label="Referencia del pago" /></FormField>
      </div>
    </Modal>
  );
}
