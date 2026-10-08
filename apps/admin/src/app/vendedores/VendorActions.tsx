'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '@/components/ui';

/**
 * Cambia el estado de un vendedor (is_vendor 0|1|2).
 *
 * Las etiquetas dependen del estado actual: a un PENDIENTE se le "Rechaza" (no hay
 * nada que revocar todavía) y a un APROBADO se le "Revoca". Antes ambos decían
 * "Revocar", que en una solicitud nueva no significaba nada.
 *
 * `size="md"` es la ficha del vendedor: ahí Aprobar/Reactivar es LA acción de la
 * página y va como primaria. En la lista (`sm`) hay una por fila, así que va
 * como secundaria para no llenar la tabla de botones de color.
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

  const principal = size === 'md' ? 'primary' : 'secondary';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {status === 1 ? (
        <>
          <Btn size={size} variant={principal} icon="ph-check" disabled={busy} onClick={() => set(2)}>
            Aprobar
          </Btn>
          <Btn
            size={size} variant="danger" disabled={busy}
            onClick={() => set(0, '¿Rechazar esta solicitud? El usuario seguirá siendo cliente.')}
          >
            Rechazar
          </Btn>
        </>
      ) : null}

      {status === 2 ? (
        <Btn
          size={size} variant="danger" disabled={busy}
          onClick={() => set(0, '¿Revocar el acceso de vendedor? Sus productos seguirán publicados hasta que los desactives.')}
        >
          Revocar acceso
        </Btn>
      ) : null}

      {/* Un revocado ya no desaparece: se puede reactivar sin volver a solicitar. */}
      {status !== 1 && status !== 2 ? (
        <Btn size={size} variant={principal} disabled={busy} onClick={() => set(2)}>
          Reactivar
        </Btn>
      ) : null}

      {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 500 }}>{error}</span> : null}
    </div>
  );
}
