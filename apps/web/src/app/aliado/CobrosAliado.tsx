'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CobroAliado {
  folio: string;
  servicio: string | null;
  monto: number;
  /** Antes de IVA: lo que dice "Te pagamos … + IVA" en sus solicitudes. */
  base?: number;
  conIva: boolean;
  estado: 'falta-factura' | 'esperando-cliente' | 'programado' | 'pagado';
  pagarEl: string | null;
  pagadoAt: string | null;
}

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const fecha = (iso: string, conDia = false) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { ...(conDia ? { weekday: 'long' } : {}), day: 'numeric', month: 'long' });

/**
 * SUS COBROS (2026-10-22, Fase A). Lo que tiene que facturarle a MAQSER24 y
 * cuándo se le paga. Lo único que hace aquí: subir su factura. El pago se
 * programa solo en cuanto el cliente pagó y está su factura.
 */
export function CobrosAliado({ cobros }: { cobros: CobroAliado[] }) {
  return (
    <div className="ms-panel" style={{ display: 'grid', gap: 0, padding: 0, overflow: 'hidden' }}>
      <style>{CSS}</style>
      {cobros.map((c) => <Fila key={c.folio} c={c} />)}
    </div>
  );
}

function Fila({ c }: { c: CobroAliado }) {
  const router = useRouter();
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir() {
    if (!pdf && !xml) { setError('Elige el PDF o el XML de tu factura.'); return; }
    setEnviando(true); setError(null);
    const fd = new FormData();
    if (pdf) fd.set('pdf', pdf);
    if (xml) fd.set('xml', xml);
    const r = await fetch(`/api/proxy/aliado/facturas/${encodeURIComponent(c.folio)}`, { method: 'POST', body: fd }).catch(() => null);
    setEnviando(false);
    if (!r?.ok) { setError((await r?.json().catch(() => null))?.message ?? 'No se pudo subir. Intenta otra vez.'); return; }
    router.refresh();
  }

  const estado =
    c.estado === 'pagado' ? <span className="cob-ok">Pagado el {fecha(c.pagadoAt ?? '')}</span>
      : c.estado === 'programado' ? <span className="cob-ok">Te pagamos el {fecha(c.pagarEl ?? '', true)}</span>
        : c.estado === 'esperando-cliente' ? <span className="cob-muted">Tu factura ya está. Te pagamos cuando el cliente pague.</span>
          : <span className="cob-warn">Sube tu factura para que te paguemos</span>;

  return (
    <div className="cob-fila">
      <div className="cob-top">
        <div style={{ minWidth: 0 }}>
          <div className="cob-folio">{c.folio}</div>
          {c.servicio ? <div className="cob-sub">{c.servicio}</div> : null}
        </div>
        {/* Una sola forma (2026-10-28): antes aquí salía el total con IVA y en Solicitudes la cifra + IVA, y parecían dos pagos distintos. */}
        <div className="cob-monto">
          {c.conIva && c.base !== undefined ? <>{dinero(c.base)} + IVA<span className="cob-sub">total con IVA {dinero(c.monto)}</span></> : <>{dinero(c.monto)}<span className="cob-sub">sin IVA</span></>}
        </div>
      </div>
      <div style={{ fontSize: 13.5 }}>{estado}</div>
      {c.estado === 'falta-factura' ? (
        <div className="cob-subir">
          <label className="cob-archivo"><span>PDF</span><input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} /></label>
          <label className="cob-archivo"><span>XML</span><input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setXml(e.target.files?.[0] ?? null)} /></label>
          <button type="button" className="ms-btn ms-btn-sm" disabled={enviando} onClick={() => void subir()}>{enviando ? 'Subiendo…' : 'Subir factura'}</button>
          {error ? <div role="alert" className="ms-alert ms-alert-bad" style={{ fontSize: 13, width: '100%' }}>{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/* Estilos propios (prefijo `cob-`). Lo común sale de `ms-*`. */
const CSS = `
.cob-fila{ display:grid; gap:8px; padding:14px 16px; border-top:1px solid var(--color-border); }
.cob-fila:first-child{ border-top:0; }
.cob-top{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
.cob-folio{ font-weight:600; font-variant-numeric:tabular-nums; }
.cob-sub{ display:block; font-size:12.5px; color:var(--color-text-muted); }
.cob-monto{ text-align:right; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
.cob-ok{ color:var(--color-success, var(--color-text)); }
.cob-warn{ color:var(--color-warning, var(--color-text)); font-weight:600; }
.cob-muted{ color:var(--color-text-muted); }
.cob-subir{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.cob-archivo{ display:inline-flex; align-items:center; gap:6px; font-size:13px; border:1px solid var(--color-border); border-radius:8px; padding:4px 8px; max-width:100%; }
.cob-archivo input{ font-size:12.5px; max-width:190px; }
`;
