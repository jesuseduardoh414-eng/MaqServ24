'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Modal } from '@/components/Modal';
import { Btn, FormField, Note } from '@/components/ui';
import { CREDITOS, DIAS_SEMANA, FORMAS, dinero, enviar, fechaCorta, fechaLarga, hoyLocal, pedir } from '../formato';

/** Lo del cliente en un renglón de Cobros y pagos: es lo que usa esta ventana. */
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

/** Lo que contesta la API al registrar un pago del cliente: con eso el aviso dice qué sigue. */
interface ResultadoCobro {
  monto: number;
  saldado: boolean;
  saldo: number;
  pagarEl: string | null;
  diaDePago: number;
  aliado: { nombre: string; factura: boolean } | null;
}

/**
 * "PAGÓ" (2026-10-22, Fase A; en Cobros y pagos desde el 2026-10-27). Se anota
 * cuánto pagó el cliente, cómo y cuándo; acepta pagos a medias. El aviso dice
 * en una línea qué sigue con el aliado: el renglón ya lo enseña.
 */
export function Cuenta({ c, onCerrar }: { c: CuentaCobro; onCerrar: () => void }) {
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
    let r: ResultadoCobro | null = null;
    if (!fallo && conCobro) {
      const n = Number(monto);
      const res = await pedir<ResultadoCobro>(`/api/admin/dinero/cobranza/${c.quoteId}/cobro`, 'POST', {
        ...(Number.isFinite(n) && n > 0 ? { monto: n } : {}), forma, fecha, ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
      });
      fallo = res.error;
      r = res.datos;
    }
    setBusy(false);
    if (fallo) { setError(fallo); return; }
    mostrarResultado(r ? queSigue(c, r) : 'Guardado', 'ok');
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
              <Btn variant="primary" disabled={busy} onClick={() => void guardar(true)}>{busy ? 'Guardando…' : 'Registrar pago'}</Btn>
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
          <FormField label="Folio de su factura" help="La que le hace el contador al cliente; aquí solo se anota."><input className="adm-input" value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="A-1047" aria-label="Folio de la factura" /></FormField>
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

/** El aviso al registrar: si quedó pagado y qué sigue con el aliado, en una línea. */
function queSigue(c: CuentaCobro, r: ResultadoCobro): string {
  if (!r.saldado) return `${c.folio}: se registró el pago de ${dinero(r.monto)}. Le falta pagar ${dinero(r.saldo)}.`;
  if (!r.aliado) return `${c.folio}: el cliente pagó todo.`;
  if (r.pagarEl) return `${c.folio}: el cliente pagó. Ya se le puede pagar a ${r.aliado.nombre} (toca el ${fechaLarga(r.pagarEl)}).`;
  return `${c.folio}: el cliente pagó. Falta la factura de ${r.aliado.nombre} para pagarle (se paga los ${DIAS_SEMANA[r.diaDePago]}).`;
}
