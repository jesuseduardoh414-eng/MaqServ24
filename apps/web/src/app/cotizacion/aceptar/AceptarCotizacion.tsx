'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export interface DatosAceptar {
  folio: string;
  cliente: string;
  obra: string | null;
  municipio: string | null;
  renglones: Array<{ concepto: string; cantidad: string; importe: number }>;
  subtotal: number;
  iva: number;
  total: number;
  /** 'pendiente' se puede aceptar; las otras dos solo se informan. */
  estado: 'pendiente' | 'aceptada' | 'cancelada';
}

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/**
 * La cotización en una pantalla de teléfono y un solo botón. Lo que importa
 * es que el cliente vea QUÉ acepta (partidas y total) antes de apretarlo.
 */
export function AceptarCotizacion({ token, datos }: { token: string; datos: DatosAceptar }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aceptada, setAceptada] = useState(datos.estado === 'aceptada');

  async function aceptar() {
    setEnviando(true); setError(null);
    try {
      const r = await fetch('/api/cotizacion/aceptar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'No se pudo aceptar. Inténtalo de nuevo.');
      setAceptada(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (aceptada) {
    return (
      <div className="ms-panel ms-panel-lg ac-card">
        <style>{CSS}</style>
        <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="check" size={22} /></span>
        <h1 className="ac-title">Cotización {datos.folio} aceptada</h1>
        <p className="ms-desc ac-desc">
          Gracias{datos.cliente ? `, ${datos.cliente}` : ''}. Ya estamos asignando al proveedor y te avisamos por correo quién va y cuándo.
        </p>
        <Link href="/servicios" className="ms-btn ms-btn-sec ms-btn-block">Ver servicios de MAQSER24</Link>
      </div>
    );
  }

  return (
    <div className="ms-panel ms-panel-lg ac-card">
      <style>{CSS}</style>
      <h1 className="ac-title ac-title-first">Cotización {datos.folio}</h1>
      <p className="ms-desc ac-desc">
        {[datos.cliente, datos.obra, datos.municipio].filter(Boolean).join(' · ')}
      </p>

      <table className="ac-tabla">
        <tbody>
          {datos.renglones.map((r, i) => (
            <tr key={i}>
              <td>{r.concepto}<span className="ac-cant">{r.cantidad}</span></td>
              <td className="ac-imp">{dinero(r.importe)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>Subtotal</td><td className="ac-imp">{dinero(datos.subtotal)}</td></tr>
          {datos.iva > 0 ? <tr><td>I.V.A.</td><td className="ac-imp">{dinero(datos.iva)}</td></tr> : null}
          <tr className="ac-total"><td>Total</td><td className="ac-imp">{dinero(datos.total)}</td></tr>
        </tfoot>
      </table>

      {datos.estado === 'cancelada' ? (
        <div role="alert" className="ms-alert ms-alert-bad ac-alert">Esta cotización se canceló. Escríbenos y la actualizamos.</div>
      ) : (
        <>
          {error ? <div role="alert" className="ms-alert ms-alert-bad ac-alert">{error}</div> : null}
          <button type="button" className="ms-btn ms-btn-block" onClick={() => void aceptar()} disabled={enviando}>
            {enviando ? 'Aceptando…' : 'Acepto la cotización'}
          </button>
          <p className="ac-nota">Al aceptarla asignamos al proveedor. Si algo no cuadra, contesta el correo de la cotización antes de aceptar.</p>
        </>
      )}
    </div>
  );
}

/* Estilos propios de esta página (prefijo `ac-`). Lo común sale de `ms-*`. */
const CSS = `
.ac-card{ width:100%; max-width:520px; margin:0 auto; box-sizing:border-box; display:grid; gap:16px; }
.ac-title{ margin:0; font-family:var(--font-display); font-size:28px; font-weight:700; letter-spacing:-.025em; line-height:1.15; text-wrap:balance; }
.ac-desc{ margin:-6px 0 0; }
.ac-tabla{ width:100%; border-collapse:collapse; font-size:14.5px; }
.ac-tabla td{ padding:9px 0; border-bottom:1px solid var(--color-border); vertical-align:top; color:var(--color-text); }
.ac-cant{ display:block; font-size:13px; color:var(--color-text-muted); }
.ac-imp{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; padding-left:12px !important; }
.ac-tabla tfoot td{ color:var(--color-text-muted); }
.ac-total td{ font-weight:700; color:var(--color-text) !important; border-bottom:none; font-size:16px; }
.ac-alert{ font-size:13.5px; }
.ac-nota{ margin:0; font-size:13px; color:var(--color-text-muted); }
@media (max-width: 640px){ .ac-title{ font-size:24px; } }
`;
