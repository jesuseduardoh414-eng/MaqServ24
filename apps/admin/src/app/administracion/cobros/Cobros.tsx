'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Modal } from '@/components/Modal';
import { Btn, EmptyState, FormField, Note, PageHeader, Panel, Segmented, Stat, Stats, StatusText } from '@/components/ui';
import { cuando, dinero, enviar, fechaCorta, fechaLarga, hoyLocal } from '../formato';
import { Recordarle } from '../Recordarle';
import { Cuenta, type CuentaCobro } from './Cuenta';

/** Un servicio cerrado: lo del cliente (CuentaCobro) más lo del aliado. */
export interface CuentaFila extends CuentaCobro {
  clienteCorreo: boolean;
  cobroRecordadoEl: string | null;
  aliado: { id: number; nombre: string; telefono: string | null; correo: boolean; recordadoEl: string | null } | null;
  /** Lo que se le paga al aliado, con IVA (lo que factura). */
  pagoAliado: number;
  facturaPdf: boolean;
  facturaXml: boolean;
  pagarEl: string | null;
  pagadoAt: string | null;
  pagoRef: string | null;
}
export interface DatosCobros {
  diaDePago: number;
  porCobrar: number;
  vencido: number;
  porPagar: number;
  listoParaPagar: number;
  cuentas: CuentaFila[];
}
export type Filtro = 'todos' | 'cobrar' | 'pagar';

const faltaCobrar = (c: CuentaFila) => !c.cobradoAt;
const faltaPagar = (c: CuentaFila) => !!c.aliado && !c.pagadoAt;
const conFactura = (c: CuentaFila) => c.facturaPdf || c.facturaXml;
/** Lo que pide algo va arriba: vencidos, listos para pagar, por cobrar, esperando factura; lo terminado al final. */
const peso = (c: CuentaFila) =>
  faltaCobrar(c) && c.diasVencida > 0 ? 0 : c.pagarEl && !c.pagadoAt ? 1 : faltaCobrar(c) ? 2 : faltaPagar(c) ? 3 : 4;

/**
 * COBROS Y PAGOS (2026-10-27). Decisión del dueño, al revisar Administración:
 * "no creo que sea tan necesario tanto proceso; que solo aparezca el total y
 * diga si pagó o no, además de la factura". Reemplaza a Cobranza a clientes y
 * Pagos a aliados (sus direcciones traen aquí).
 *
 * Un renglón por servicio cerrado: el total que paga el cliente y si ya pagó
 * (botón "Pagó"), la factura del aliado (sí / falta) y si ya se le pagó (botón
 * "Pagar" en cuanto se puede: el cliente pagó y está su factura). La regla de
 * no pagarle al aliado antes sigue igual; solo que ahora se lee en el renglón.
 */
export function Cobros({ datos, filtroInicial, puedeProveedores }: { datos: DatosCobros; filtroInicial: Filtro; puedeProveedores: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [cobrando, setCobrando] = useState<CuentaFila | null>(null);
  const [pagando, setPagando] = useState<CuentaFila | null>(null);
  const hoy = hoyLocal();

  const todas = [...datos.cuentas].sort((a, b) => peso(a) - peso(b) || (peso(a) === 0 ? b.diasVencida - a.diasVencida : peso(a) === 4 ? b.folio.localeCompare(a.folio) : a.vence.localeCompare(b.vence)));
  const nCobrar = todas.filter(faltaCobrar).length;
  const nPagar = todas.filter(faltaPagar).length;
  const visibles = todas.filter((c) => (filtro === 'cobrar' ? faltaCobrar(c) : filtro === 'pagar' ? faltaPagar(c) : true));

  return (
    <div>
      <style>{`
        .cy-row { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) 96px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.15fr); gap: 14px; align-items: start; }
        .cy-num { text-align: right; font-variant-numeric: tabular-nums; }
        .cy-cel { display: grid; gap: 4px; min-width: 0; justify-items: start; }
        .cy-cel.cy-num { justify-items: end; }
        .cy-acc { margin-top: 4px; }
        @media (max-width: 1000px) {
          .cy-thead { display: none !important; }
          .cy-row { grid-template-columns: 1fr 1fr; gap: 12px 16px; }
          .cy-row > :nth-child(1), .cy-row > :nth-child(2) { grid-column: 1 / -1; }
          .cy-num, .cy-cel.cy-num { text-align: left; justify-items: start; }
          .cy-cel[data-l]::before { content: attr(data-l); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--adm-faint); }
        }
      `}</style>
      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Cobros y pagos"
        subtitle="Cada servicio terminado: lo que paga el cliente y si ya pagó, la factura del aliado y si ya se le pagó. Montos con IVA."
      />

      <Stats>
        <Stat label="Por cobrar" icon="ph-hourglass-medium" tone="info" value={dinero(datos.porCobrar)}
          hint={datos.vencido > 0 ? `${dinero(datos.vencido)} vencido` : 'nadie atrasado'} hintTone={datos.vencido > 0 ? 'bad' : undefined} />
        <Stat label="Por pagar a aliados" icon="ph-hand-coins" tone="accent" value={dinero(datos.porPagar)}
          hint={datos.listoParaPagar > 0 ? `${dinero(datos.listoParaPagar)} ya se puede pagar` : 'nada listo todavía'} hintTone={datos.listoParaPagar > 0 ? 'ok' : undefined} />
      </Stats>

      <div style={{ marginBottom: 14 }}>
        <Segmented<Filtro>
          ariaLabel="Qué ver"
          value={filtro}
          onChange={setFiltro}
          items={[
            { key: 'todos', label: 'Todos', count: todas.length },
            { key: 'cobrar', label: 'Falta cobrar', count: nCobrar },
            { key: 'pagar', label: 'Falta pagar al aliado', count: nPagar },
          ]}
        />
      </div>

      <Panel flush clip>
        <div className="adm-thead cy-row cy-thead">
          <div>Servicio</div><div>Cliente</div><div className="cy-num">Total</div><div>¿Pagó?</div><div>Factura del aliado</div><div>Aliado</div>
        </div>
        {visibles.length === 0 ? (
          <EmptyState icon="ph-check-circle"
            title={filtro === 'cobrar' ? 'Nadie debe nada' : filtro === 'pagar' ? 'No se le debe nada a ningún aliado' : 'Todavía no hay servicios cerrados'}
            sub={filtro === 'todos' ? 'Cuando se cierre un servicio, aparece aquí solo.' : undefined} />
        ) : visibles.map((c) => {
          const vencida = faltaCobrar(c) && c.diasVencida > 0;
          return (
            <div key={c.quoteId} className="adm-trow cy-row">
              {/* Servicio */}
              <div style={{ minWidth: 0 }}>
                <div className="adm-mono" style={{ fontSize: 13, fontWeight: 600 }}>{c.folio}</div>
                <div className="adm-cell-sub adm-ellipsis" title={c.servicio ?? undefined}>{c.servicio ?? '—'}</div>
              </div>

              {/* Cliente */}
              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title adm-ellipsis">{c.cliente}</div>
                <div className="adm-cell-sub">{c.creditoDias ? `Crédito a ${c.creditoDias} días` : 'Paga al cerrar'}</div>
              </div>

              {/* Total */}
              <div className="cy-num cy-cel" data-l="Total">
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{dinero(c.total)}</span>
              </div>

              {/* ¿Pagó? */}
              <div className="cy-cel" data-l="¿Pagó?">
                {c.cobradoAt ? (
                  <>
                    <StatusText tone="ok">Pagó</StatusText>
                    <span className="adm-cell-sub">{c.movimientos.length ? fechaCorta(c.movimientos[c.movimientos.length - 1].fecha) : ''}</span>
                  </>
                ) : (
                  <>
                    <StatusText tone={c.cobrado > 0 ? 'warn' : vencida ? 'bad' : 'muted'}>{c.cobrado > 0 ? 'Pagó una parte' : 'No ha pagado'}</StatusText>
                    <span className="adm-cell-sub" style={vencida ? { color: 'var(--adm-bad)' } : undefined}>
                      {c.cobrado > 0 ? `Faltan ${dinero(c.saldo)} · ` : ''}{vencida ? `vencido ${cuando(c.diasVencida)}` : `vence ${cuando(c.diasVencida)}`}
                    </span>
                    <span className="cy-acc" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Btn size="sm" variant="primary" onClick={() => setCobrando(c)}>Pagó</Btn>
                      <Recordarle
                        url={`/api/admin/dinero/cobranza/${c.quoteId}/recordar`}
                        aviso={`A ${c.cliente} le llegó el recordatorio de pago de ${c.folio}.`}
                        correo={c.clienteCorreo} telefono={c.contacto.telefono} recordadoEl={c.cobroRecordadoEl}
                      />
                    </span>
                  </>
                )}
              </div>

              {/* Factura del aliado */}
              <div className="cy-cel" data-l="Factura del aliado">
                {!c.aliado ? <span className="adm-cell-sub">—</span> : conFactura(c) ? (
                  <>
                    <StatusText tone="ok">Sí</StatusText>
                    <span className="adm-cell-sub" style={{ display: 'inline-flex', gap: 10 }}>
                      {c.facturaPdf ? <a className="adm-link" href={`/api/admin/dinero/pagos/${c.quoteId}/factura`} target="_blank" rel="noreferrer">Ver PDF</a> : null}
                      {c.facturaXml ? <a className="adm-link" href={`/api/admin/dinero/pagos/${c.quoteId}/factura?xml=1`} target="_blank" rel="noreferrer">XML</a> : null}
                    </span>
                  </>
                ) : c.pagadoAt ? <span className="adm-cell-sub">—</span> : (
                  <>
                    <StatusText tone="warn">Falta</StatusText>
                    <Recordarle
                      url={`/api/admin/dinero/pagos/${c.aliado.id}/recordar`}
                      aviso={`A ${c.aliado.nombre} le llegó el correo para subir su factura.`}
                      correo={c.aliado.correo} telefono={c.aliado.telefono} recordadoEl={c.aliado.recordadoEl}
                      sinCorreo={puedeProveedores ? <a className="adm-link" href={`/proveedores?ver=${c.aliado.id}&dato=correo`}>Agregar su correo</a> : null}
                    />
                  </>
                )}
              </div>

              {/* Aliado */}
              <div className="cy-cel" data-l="Aliado">
                {!c.aliado ? <span className="adm-cell-sub">Sin aliado</span> : (
                  <>
                    <span className="adm-ellipsis" style={{ fontSize: 13, color: 'var(--adm-text-2)', maxWidth: '100%' }}>{c.aliado.nombre}</span>
                    {c.pagadoAt ? (
                      <>
                        <StatusText tone="ok">Pagado</StatusText>
                        <span className="adm-cell-sub">{dinero(c.pagoAliado)} · {fechaCorta(c.pagadoAt.slice(0, 10))}</span>
                      </>
                    ) : c.pagarEl ? (
                      <>
                        <Btn size="sm" variant="primary" onClick={() => setPagando(c)}>Pagar {dinero(c.pagoAliado)}</Btn>
                        <span className="adm-cell-sub" style={c.pagarEl < hoy ? { color: 'var(--adm-bad)' } : undefined}>
                          {c.pagarEl < hoy ? `Se debía pagar el ${fechaCorta(c.pagarEl)}` : c.pagarEl === hoy ? 'Toca hoy' : `Toca el ${fechaLarga(c.pagarEl)}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{dinero(c.pagoAliado)}</span>
                        <span className="adm-cell-sub">
                          {faltaCobrar(c) && !conFactura(c) ? 'Falta que pague el cliente y su factura' : faltaCobrar(c) ? 'Falta que pague el cliente' : 'Falta su factura'}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Panel>

      {cobrando ? <Cuenta c={cobrando} onCerrar={() => setCobrando(null)} /> : null}
      {pagando ? <PagarAliado c={pagando} onCerrar={() => setPagando(null)} /> : null}
    </div>
  );
}

/** "Pagar": se le pagó al aliado este servicio. Le llega el aviso por correo. */
function PagarAliado({ c, onCerrar }: { c: CuentaFila; onCerrar: () => void }) {
  const router = useRouter();
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = c.aliado;
  if (!a) return null;
  async function confirmar() {
    setBusy(true); setError(null);
    const fallo = await enviar(`/api/admin/dinero/cuentas/${c.quoteId}/pagado`, 'POST', referencia.trim() ? { referencia: referencia.trim() } : {});
    setBusy(false);
    if (fallo) { setError(fallo); return; }
    mostrarResultado(`${c.folio}: pagado a ${a?.nombre}.${a?.correo ? ' Le llegó el aviso por correo.' : ''}`, 'ok');
    onCerrar();
    router.refresh();
  }
  return (
    <Modal abierto titulo={`Pagar a ${a.nombre}`} subtitulo={`${c.folio} · ${dinero(c.pagoAliado)} con IVA`} onCerrar={onCerrar} ancho={460}
      pie={<><Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn><Btn variant="primary" disabled={busy} onClick={() => void confirmar()}>{busy ? 'Guardando…' : 'Ya le pagué'}</Btn></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {error ? <Note tone="bad">{error}</Note> : null}
        <FormField label="Referencia del pago" help="Opcional. Va en el aviso que le llega al aliado.">
          <input className="adm-input" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="SPEI 7781" aria-label="Referencia del pago" />
        </FormField>
      </div>
    </Modal>
  );
}
