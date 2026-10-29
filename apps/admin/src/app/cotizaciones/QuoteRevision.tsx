'use client';

import { useCallback, useEffect, useState } from 'react';
import { Note } from '@/components/ui';

/**
 * LOS AVISOS DE UNA SOLICITUD (2026-10-23).
 *
 * Nada se aprueba solo: todo llega con un precio ESTIMADO y alguien lo revisa.
 * Arriba del detalle van los avisos que antes decidían la aprobación
 * automática (total alto, obra fuera de zona, cliente con pagos vencidos,
 * ningún aliado llega). Cómo se calculó cada renglón, con el lápiz, está en la
 * ficha de la cotización («Volver a cotizar», cotizaciones/[id]).
 */

interface Revision {
  avisos: string[];
}

/** Lo que el detalle necesita de la API; `recargar` después de cada cambio. */
export function useRevision(quoteId: number, activa: boolean) {
  const [datos, setDatos] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    const r = await fetch(`/api/admin/quotes/${quoteId}/revision`).catch(() => null);
    const b = await r?.json().catch(() => null);
    if (!r?.ok) { setError(b?.message ?? 'No se pudieron leer los avisos.'); return; }
    setError(null);
    setDatos(b as Revision);
  }, [quoteId]);
  useEffect(() => {
    if (!activa) return;
    setDatos(null);
    void recargar();
  }, [activa, recargar]);
  return { datos, error, recargar };
}

/** Los avisos, arriba del detalle. Sin avisos, una línea que lo dice. */
export function AvisosRevision({ datos }: { datos: Revision | null }) {
  if (!datos) return null;
  if (!datos.avisos.length) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--adm-ok)' }}>
        <i className="ph ph-check-circle" aria-hidden />
        Sin avisos: obra en zona con servicio, aliados que llegan y cliente al corriente.
      </div>
    );
  }
  return (
    <Note tone="warn" icon="ph-warning">
      <div style={{ display: 'grid', gap: 4 }}>
        <strong style={{ fontWeight: 600 }}>Revisa antes de mandarle el precio</strong>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2 }}>
          {datos.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </div>
    </Note>
  );
}
