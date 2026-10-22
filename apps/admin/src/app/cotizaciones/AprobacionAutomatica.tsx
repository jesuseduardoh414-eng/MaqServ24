'use client';

import { useEffect, useState } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { Switch } from '@/components/ui';

const TOPES = [100_000, 300_000, 1_000_000, 0];
const tope = (n: number) => (n === 0 ? 'sin tope' : `hasta ${n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}`);

/**
 * El interruptor de la aprobación automática (2026-10-22, Fase C). Encendida,
 * lo que llega del cotizador del sitio con todo en orden sale solo a los
 * aliados; lo demás se queda en "Por cotizar" con su motivo en la campana.
 */
export function AprobacionAutomatica() {
  const [regla, setRegla] = useState<{ activa: boolean; montoMaximo: number } | null>(null);
  useEffect(() => {
    void fetch('/api/admin/quotes-aprobacion').then((r) => (r.ok ? r.json() : null)).then((d) => d && setRegla(d)).catch(() => undefined);
  }, []);
  if (!regla) return null;

  async function guardar(nueva: { activa: boolean; montoMaximo: number }) {
    const antes = regla;
    setRegla(nueva);
    const r = await fetch('/api/admin/quotes-aprobacion', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nueva) }).catch(() => null);
    if (!r?.ok) { setRegla(antes); mostrarResultado('No se pudo guardar.', 'bad'); return; }
    mostrarResultado(nueva.activa ? `Aprobación automática encendida, ${tope(nueva.montoMaximo)}` : 'Aprobación automática apagada: todo espera revisión', 'ok');
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} title="Lo del cotizador con precio del tabulador, zona que se anuncia, aliados que llegan y cliente sin pagos vencidos se aprueba solo.">
      <Switch on={regla.activa} onClick={() => void guardar({ ...regla, activa: !regla.activa })} label="Aprobar solas las del cotizador" ariaLabel="Aprobar solas las solicitudes del cotizador" />
      {regla.activa ? (
        <select className="adm-input" style={{ width: 'auto', height: 32, fontSize: 13 }} value={regla.montoMaximo} onChange={(e) => void guardar({ ...regla, montoMaximo: Number(e.target.value) })} aria-label="Tope de la aprobación automática">
          {TOPES.map((t) => <option key={t} value={t}>{tope(t)}</option>)}
        </select>
      ) : null}
    </span>
  );
}
