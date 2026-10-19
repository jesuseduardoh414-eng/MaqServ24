'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { Btn, Note } from '@/components/ui';

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * APROBAR Y MANDAR A PROVEEDORES (2026-10-15).
 *
 * Para lo que llega del cotizador del sitio: el cliente ya vio el precio y
 * pidió el servicio. Se revisa (obra, fechas, partidas) y con esto queda en
 * servicio y se ofrece sola a los aliados que llegan a la obra; el primero que
 * acepta se la queda y al cliente le llega su cotización autorizada.
 */
export function QuoteApprove({ quoteId, folio, total, principal }: { quoteId: number; folio: string | null; total: number; principal?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string[] | null>(null);

  async function aprobar() {
    setLoading(true);
    setError(null);
    const r = await fetch(`/api/admin/quotes/${quoteId}/aprobar`, { method: 'POST' }).catch(() => null);
    setLoading(false);
    const b = await r?.json().catch(() => null);
    if (!r?.ok) { setError(b?.message ?? 'No se pudo aprobar. Inténtalo de nuevo.'); return; }
    setHecho(b?.ofrecidos ?? []);
  }

  function cerrar() {
    if (loading) return;
    setOpen(false);
    if (hecho) { setHecho(null); router.refresh(); }
  }

  return (
    <>
      <Btn size="sm" variant={principal ? 'primary' : 'secondary'} icon="ph-paper-plane-tilt" onClick={() => setOpen(true)}>
        Aprobar y mandar a proveedores
      </Btn>
      <Modal
        abierto={open}
        titulo={hecho ? 'Mandada a los aliados' : 'Aprobar y mandar a proveedores'}
        subtitulo={folio ? `Cotización ${folio} · ${money(total)}` : money(total)}
        onCerrar={cerrar}
        ancho={480}
        pie={
          hecho ? (
            <Btn variant="primary" onClick={cerrar}>Listo</Btn>
          ) : (
            <>
              <Btn variant="ghost" onClick={cerrar} disabled={loading}>Cancelar</Btn>
              <Btn variant="primary" onClick={aprobar} disabled={loading}>{loading ? 'Mandando…' : 'Aprobar y mandar'}</Btn>
            </>
          )
        }
      >
        {hecho ? (
          hecho.length ? (
            <Note tone="ok" icon="ph-check-circle">
              Se le ofreció a <strong>{hecho.join(', ')}</strong>. El primero que acepte se la queda, y al cliente le llega su cotización autorizada con quién lo atiende.
            </Note>
          ) : (
            <Note tone="warn" icon="ph-warning">
              Quedó aprobada, pero ningún aliado llega a esa obra. Búscale uno en Servicios con «Buscar aliado».
            </Note>
          )
        ) : (
          <div style={{ display: 'grid', gap: 12, fontSize: 14, lineHeight: 1.55 }}>
            <p style={{ margin: 0 }}>
              El cliente ya vio este precio y pidió el servicio. Revisa la obra, las fechas y las partidas: al aprobar, queda en servicio y se le
              ofrece <strong>sola a los aliados que llegan a la obra</strong>. El primero que acepte se la queda.
            </p>
            <p style={{ margin: 0, color: 'var(--adm-muted)' }}>
              ¿Hay que cambiar algo del precio? Usa «Volver a cotizar»: entonces se le responde con la cotización nueva y la acepta él.
            </p>
            {error ? <Note tone="bad" icon="ph-warning">{error}</Note> : null}
          </div>
        )}
      </Modal>
    </>
  );
}
