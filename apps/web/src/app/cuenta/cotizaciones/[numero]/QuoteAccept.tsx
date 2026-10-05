'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuoteDetail } from '@maqserv/types';
import { Icon } from '@/components/Icon';

/**
 * Aceptar la cotización (documento institucional, sección 22).
 *
 * Es el momento en que un precio deja de ser una propuesta y se vuelve un
 * compromiso, así que se pide confirmación explícita: un clic accidental sobre
 * una cifra de seis dígitos no debería comprometer a nadie.
 *
 * El servidor vuelve a comprobar la vigencia. Este botón puede quedarse abierto
 * en una pestaña durante días, y para entonces el precio ya no se sostiene.
 */
export function QuoteAccept({
  quoteNumber,
  canAccept,
  state,
}: {
  quoteNumber: string;
  canAccept: boolean;
  state: QuoteDetail['state'];
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === 'aceptada') {
    return (
      <div className="ms-alert ms-alert-ok" role="status">
        <span style={{ color: 'var(--color-success)', display: 'flex', paddingTop: 2 }}><Icon name="check" size={16} /></span>
        <span>Aceptaste esta cotización. Nos comunicamos contigo para coordinar el servicio.</span>
      </div>
    );
  }

  if (state === 'vencida') {
    return (
      <div className="ms-alert ms-alert-warn">
        <span style={{ color: 'var(--color-warning)', display: 'flex', paddingTop: 2 }}><Icon name="clock" size={16} /></span>
        <span>
          Esta cotización ya venció, así que no se puede aceptar. Escríbenos y te
          preparamos una actualizada con los precios de hoy.
        </span>
      </div>
    );
  }

  if (!canAccept) return null;

  async function aceptar() {
    setEnviando(true);
    setError(null);
    const r = await fetch(`/api/proxy/quotes/${encodeURIComponent(quoteNumber)}/accept`, { method: 'POST' });
    setEnviando(false);
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setError(typeof d?.message === 'string' ? d.message : 'No pudimos registrar tu aceptación');
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error ? (
        <div className="ms-alert ms-alert-bad" role="alert">
          <span style={{ color: 'var(--color-error)', display: 'flex', paddingTop: 2 }}><Icon name="warning" size={16} /></span>
          <span>{error}</span>
        </div>
      ) : null}

      {confirmando ? (
        <div className="ms-panel" style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>
            Al aceptar confirmas el precio y las condiciones de arriba, incluido lo que no
            está incluido. ¿Seguimos?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={aceptar} disabled={enviando} className="ms-btn">
              {enviando ? 'Registrando…' : 'Sí, acepto'}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="ms-btn ms-btn-sec">
              Todavía no
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="ms-btn ms-btn-lg ms-btn-block">
          Aceptar cotización
        </button>
      )}
    </div>
  );
}
