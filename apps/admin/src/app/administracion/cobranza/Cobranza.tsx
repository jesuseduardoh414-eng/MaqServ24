'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Modal } from '@/components/Modal';
import { Btn, EmptyState, FormField, Note, PageHeader, Panel, Stat, Stats, StatusText } from '@/components/ui';
import { CREDITOS, FORMAS, cuando, dinero, enviar, fechaCorta, hoyLocal } from '../formato';

export interface CuentaCobro {
  quoteId: number;
  folio: string;
  cliente: string;
  contacto: { nombre: string | null; telefono: string | null; correo: string | null };
  clienteId: number | null;
  creditoDias: number;
  servicio: string | null;
  obra: string | null;
  cerrado: string | null;
  vence: string;
  diasVencida: number;
  total: number;
  cobrado: number;
  saldo: number;
  facturaCliente: string | null;
  cobradoAt: string | null;
  movimientos: Array<{ fecha: string; monto: number; forma: string | null; referencia: string | null }>;
}

/**
 * COBRANZA (2026-10-22, Fase A). Solo lo que falta cobrar, lo vencido arriba.
 * La cuenta nace sola al cerrar el servicio y el cliente recibe sus
 * recordatorios solo; aquí lo único que se hace es marcar "Cobrado".
 */
export function Cobranza({ datos, cobradas }: { datos: { porCobrar: number; vencido: number; cuentas: CuentaCobro[] }; cobradas: boolean }) {
  const [abierta, setAbierta] = useState<CuentaCobro | null>(null);
  const vencidas = datos.cuentas.filter((c) => c.diasVencida > 0 && !c.cobradoAt);

  return (
    <div>
      <style>{`
        .cb-row { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1.3fr) 120px 130px 112px; gap: 16px; align-items: center; }
        .cb-num { text-align: right; font-variant-numeric: tabular-nums; }
        @media (max-width: 900px) {
          .cb-thead { display: none !important; }
          .cb-row { display: flex; flex-wrap: wrap; gap: 6px 16px; }
          .cb-row > :nth-child(1), .cb-row > :nth-child(2) { flex: 1 1 100%; }
          .cb-num { text-align: left; }
        }
      `}</style>
      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Cobranza"
        subtitle={cobradas ? 'Lo cobrado en los últimos 60 días.' : 'Lo que falta cobrar, lo vencido arriba. Montos con IVA. Los recordatorios al cliente salen solos.'}
        actions={<Btn href={cobradas ? '/administracion/cobranza' : '/administracion/cobranza?cobradas=1'} variant="ghost">{cobradas ? 'Ver lo pendiente' : 'Ver cobradas'}</Btn>}
      />

      {!cobradas ? (
        <Stats>
          <Stat label="Por cobrar" icon="ph-hourglass-medium" tone="info" value={dinero(datos.porCobrar)} hint={`${datos.cuentas.length} servicio${datos.cuentas.length === 1 ? '' : 's'}`} />
          <Stat label="Vencido" icon="ph-warning-circle" tone={datos.vencido > 0 ? 'bad' : 'muted'} valueTone={datos.vencido > 0 ? 'bad' : undefined} value={dinero(datos.vencido)} hint={vencidas.length ? `${vencidas.length} con atraso` : 'nadie atrasado'} />
        </Stats>
      ) : null}

      <Panel flush clip>
        <div className="adm-thead cb-row cb-thead">
          <div>Servicio</div><div>Cliente</div><div className="cb-num">{cobradas ? 'Total' : 'Saldo'}</div><div>{cobradas ? 'Pagó' : 'Vence'}</div><div />
        </div>
        {datos.cuentas.length === 0 ? (
          <EmptyState icon="ph-check-circle" title={cobradas ? 'Nada cobrado en 60 días' : 'No hay nada por cobrar'} sub={cobradas ? undefined : 'Cuando se cierre un servicio, su cobro aparece aquí solo.'} />
        ) : datos.cuentas.map((c) => (
          <div key={c.quoteId} className="adm-trow cb-row" role="button" tabIndex={0} onClick={() => setAbierta(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierta(c); } }} style={{ cursor: 'pointer' }}>
            <div style={{ minWidth: 0 }}>
              <div className="adm-mono" style={{ fontSize: 13, fontWeight: 600 }}>{c.folio}</div>
              <div className="adm-cell-sub adm-ellipsis">{c.servicio ?? '—'}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="adm-cell-title adm-ellipsis">{c.cliente}</div>
              <div className="adm-cell-sub adm-ellipsis">{c.creditoDias ? `Crédito a ${c.creditoDias} días` : 'Paga al cerrar'}{c.facturaCliente ? ` · Factura ${c.facturaCliente}` : ''}</div>
            </div>
            <div className="cb-num" style={{ fontSize: 13.5, fontWeight: 600, color: !cobradas && c.diasVencida > 0 ? 'var(--adm-bad)' : 'var(--adm-text)' }}>{dinero(cobradas ? c.total : c.saldo)}</div>
            <div style={{ fontSize: 13 }}>
              {cobradas ? (
                <span style={{ color: 'var(--adm-muted)' }}>{c.movimientos.length ? fechaCorta(c.movimientos[c.movimientos.length - 1].fecha) : '—'}</span>
              ) : (
                <>
                  <div>{fechaCorta(c.vence)}</div>
                  <div className="adm-cell-sub" style={c.diasVencida > 0 ? { color: 'var(--adm-bad)' } : undefined}>{c.diasVencida > 0 ? `vencida ${cuando(c.diasVencida)}` : `vence ${cuando(c.diasVencida)}`}</div>
                </>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {cobradas ? <StatusText tone="ok">Cobrada</StatusText> : <Btn size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); setAbierta(c); }}>Cobrado</Btn>}
            </div>
          </div>
        ))}
      </Panel>

      {abierta ? <Cuenta c={abierta} onCerrar={() => setAbierta(null)} /> : null}
    </div>
  );
}

function Cuenta({ c, onCerrar }: { c: CuentaCobro; onCerrar: () => void }) {
  const router = useRouter();
  const [monto, setMonto] = useState(String(c.saldo));
  const [forma, setForma] = useState(FORMAS[0]);
  const [fecha, setFecha] = useState(hoyLocal());
  const [referencia, setReferencia] = useState('');
  const [factura, setFactura] = useState(c.facturaCliente ?? '');
  const [credito, setCredito] = useState(c.creditoDias);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guardar(conCobro: boolean) {
    setBusy(true); setError(null);
    const cambios: Record<string, unknown> = {};
    if (factura.trim() !== (c.facturaCliente ?? '')) cambios.facturaCliente = factura.trim();
    if (credito !== c.creditoDias && c.clienteId) cambios.creditoDias = credito;
    let fallo = Object.keys(cambios).length ? await enviar(`/api/admin/dinero/cobranza/${c.quoteId}`, 'PATCH', cambios) : null;
    if (!fallo && conCobro) {
      const n = Number(monto);
      fallo = await enviar(`/api/admin/dinero/cobranza/${c.quoteId}/cobro`, 'POST', {
        ...(Number.isFinite(n) && n > 0 ? { monto: n } : {}), forma, fecha, ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
      });
    }
    setBusy(false);
    if (fallo) { setError(fallo); return; }
    mostrarResultado(conCobro ? (Number(monto) >= c.saldo ? `${c.folio} quedó cobrado` : `Se registró el pago de ${c.folio}`) : 'Guardado', 'ok');
    onCerrar();
    router.refresh();
  }

  const fila = (t: string, v: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderTop: '1px solid var(--adm-border)', fontSize: 13.5 }}>
      <span style={{ color: 'var(--adm-muted)' }}>{t}</span><span className="adm-num" style={{ color: 'var(--adm-text)' }}>{v}</span>
    </div>
  );

  return (
    <Modal
      abierto
      titulo={`${c.folio} · ${c.cliente}`}
      subtitulo={c.servicio ?? undefined}
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          {c.cobradoAt ? <Btn disabled={busy} onClick={() => void guardar(false)}>Guardar</Btn> : (
            <>
              <Btn disabled={busy} onClick={() => void guardar(false)}>Solo guardar</Btn>
              <Btn variant="primary" disabled={busy} onClick={() => void guardar(true)}>{busy ? 'Guardando…' : 'Registrar cobro'}</Btn>
            </>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {error ? <Note tone="bad">{error}</Note> : null}
        {!c.cobradoAt ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <FormField label="Cuánto pagó"><input className="adm-input" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Monto cobrado" /></FormField>
            <FormField label="Cómo"><select className="adm-input" value={forma} onChange={(e) => setForma(e.target.value)} aria-label="Forma de pago">{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></FormField>
            <FormField label="Cuándo"><input className="adm-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha del pago" /></FormField>
            <FormField label="Referencia" help="Opcional"><input className="adm-input" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="SPEI, cheque…" aria-label="Referencia" /></FormField>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <FormField label="Folio de la factura" help="La hace el contador; aquí solo se anota."><input className="adm-input" value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="A-1047" aria-label="Folio de la factura" /></FormField>
          {c.clienteId ? (
            <FormField label="Cómo paga este cliente" help="Vale para sus demás servicios.">
              <select className="adm-input" value={credito} onChange={(e) => setCredito(Number(e.target.value))} aria-label="Crédito del cliente">{CREDITOS.map((x) => <option key={x.dias} value={x.dias}>{x.texto}</option>)}</select>
            </FormField>
          ) : null}
        </div>
        <section>
          {fila('Total con IVA', dinero(c.total))}
          {fila('Ya pagó', dinero(c.cobrado))}
          {fila('Saldo', c.saldo > 0 ? dinero(c.saldo) : 'Liquidado')}
          {fila('Vence', fechaCorta(c.vence))}
          {c.contacto.telefono || c.contacto.correo ? fila('Contacto', [c.contacto.nombre, c.contacto.telefono, c.contacto.correo].filter(Boolean).join(' · ')) : null}
          {c.movimientos.map((m, i) => <div key={i}>{fila(`Pago ${fechaCorta(m.fecha)}`, `${dinero(m.monto)} · ${m.forma ?? ''}${m.referencia ? ` · ${m.referencia}` : ''}`)}</div>)}
        </section>
      </div>
    </Modal>
  );
}
