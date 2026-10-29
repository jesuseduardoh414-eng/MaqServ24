'use client';

import { useState, type ReactNode } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { fechaCorta, hoyLocal, pedir } from './formato';

/**
 * "Recordarle" (2026-10-27): le llega ya el correo de recordatorio, el mismo
 * que manda la corrida automática. Al aliado, con lo que le falta facturar y
 * el botón a su portal; al cliente, con lo que debe. Va chico, debajo del
 * estado de su renglón en Cobros y pagos. Sin correo, su teléfono.
 */
export function Recordarle({ url, aviso, correo, telefono, recordadoEl, sinCorreo }: {
  /** `/pagos/:aliado/recordar` (factura) o `/cobranza/:servicio/recordar` (cobro). */
  url: string;
  /** El aviso al mandarlo: "A Prueba Rentas Norte le llegó el correo…". */
  aviso: string;
  correo: boolean;
  telefono: string | null;
  recordadoEl?: string | null;
  /** Qué más enseñar si no tiene correo, p. ej. el enlace "Agregar su correo". */
  sinCorreo?: ReactNode;
}) {
  const [estado, setEstado] = useState<'listo' | 'mandando' | 'mandado' | 'sin_correo'>(correo ? 'listo' : 'sin_correo');
  const hoy = hoyLocal();

  async function mandar() {
    setEstado('mandando');
    const r = await pedir<{ estado: 'enviado' | 'sin_correo' }>(url, 'POST', {});
    if (r.error) { setEstado('listo'); mostrarResultado(r.error, 'bad'); return; }
    if (r.datos?.estado === 'sin_correo') { setEstado('sin_correo'); return; }
    setEstado('mandado');
    mostrarResultado(aviso, 'ok');
  }

  if (estado === 'sin_correo') {
    return (
      <span className="adm-cell-sub">
        {telefono ? `Sin correo · ${telefono}` : 'Sin correo ni teléfono'}
        {sinCorreo ? <> · {sinCorreo}</> : null}
      </span>
    );
  }
  if (estado === 'mandado') return <span className="adm-cell-sub" style={{ color: 'var(--adm-ok)' }}>Recordado hoy</span>;
  const cuando = recordadoEl ? (recordadoEl === hoy ? 'hoy' : `el ${fechaCorta(recordadoEl)}`) : null;
  return (
    <span className="adm-cell-sub">
      <button type="button" className="adm-link" disabled={estado === 'mandando'} onClick={() => void mandar()}
        style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}>
        {estado === 'mandando' ? 'Mandando…' : 'Recordarle'}
      </button>
      {cuando ? ` · recordado ${cuando}` : null}
    </span>
  );
}
