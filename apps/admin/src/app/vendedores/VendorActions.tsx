'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

type Variant = 'solid' | 'ghost' | 'danger';

/**
 * Cambia el estado de un vendedor (is_vendor 0|1|2).
 *
 * Las etiquetas dependen del estado actual: a un PENDIENTE se le "Rechaza" (no hay
 * nada que revocar todavía) y a un APROBADO se le "Revoca". Antes ambos decían
 * "Revocar", que en una solicitud nueva no significaba nada.
 */
export function VendorActions({
  vendorId,
  status,
  size = 'sm',
}: {
  vendorId: number;
  status: number;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: 0 | 1 | 2, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo actualizar');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(false);
    }
  }

  const pad = size === 'md' ? '9px 16px' : '6px 12px';
  const font = size === 'md' ? 13 : 12;
  const btn = (v: Variant): React.CSSProperties => ({
    fontSize: font, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8, padding: pad,
    cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap',
    background: v === 'solid' ? D.amber : 'transparent',
    color: v === 'solid' ? 'var(--color-primary-fg)' : v === 'danger' ? '#f55' : '#B4B4B9',
    border: v === 'solid' ? 'none' : `1px solid ${v === 'danger' ? 'rgba(255,85,85,0.3)' : D.inputBorder}`,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <style>{`
        .vd-btn:hover:not(:disabled){ filter: brightness(1.12); }
        .vd-ghost:hover:not(:disabled){ background: rgba(255,255,255,0.06); }
      `}</style>

      {status === 1 ? (
        <>
          <button type="button" className="vd-btn" disabled={busy} onClick={() => set(2)} style={btn('solid')}>
            Aprobar
          </button>
          <button
            type="button" className="vd-ghost" disabled={busy}
            onClick={() => set(0, '¿Rechazar esta solicitud? El usuario seguirá siendo cliente.')}
            style={btn('danger')}
          >
            Rechazar
          </button>
        </>
      ) : null}

      {status === 2 ? (
        <button
          type="button" className="vd-ghost" disabled={busy}
          onClick={() => set(0, '¿Revocar el acceso de vendedor? Sus productos seguirán publicados hasta que los desactives.')}
          style={btn('danger')}
        >
          Revocar acceso
        </button>
      ) : null}

      {/* Un revocado ya no desaparece: se puede reactivar sin volver a solicitar. */}
      {status !== 1 && status !== 2 ? (
        <button type="button" className="vd-btn" disabled={busy} onClick={() => set(2)} style={btn('solid')}>
          Reactivar
        </button>
      ) : null}

      {error ? <span role="alert" style={{ fontSize: 12, color: '#f55', fontWeight: 600 }}>{error}</span> : null}
    </div>
  );
}
