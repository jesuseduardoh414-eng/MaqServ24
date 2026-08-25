'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuoteDetail } from '@maqserv/types';

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
      <div
        style={{
          border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)',
          background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
          borderRadius: 'var(--radius-md)', padding: '16px 20px',
          fontSize: 14.5, color: 'var(--color-text)',
        }}
      >
        Aceptaste esta cotización. Nos comunicamos contigo para coordinar el servicio.
      </div>
    );
  }

  if (state === 'vencida') {
    return (
      <div
        style={{
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          padding: '16px 20px', fontSize: 14.5, color: 'var(--color-text-muted)', lineHeight: 1.6,
        }}
      >
        Esta cotización ya venció, así que no se puede aceptar. Escríbenos y te
        preparamos una actualizada con los precios de hoy.
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
    <div>
      {error ? (
        <p style={{ color: 'var(--color-error)', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
      ) : null}

      {confirmando ? (
        <div
          style={{
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            padding: '18px 20px', display: 'grid', gap: 14,
          }}
        >
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>
            Al aceptar confirmas el precio y las condiciones de arriba, incluido lo que no
            está incluido. ¿Seguimos?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={aceptar}
              disabled={enviando}
              style={{
                background: 'var(--color-primary)', color: 'var(--color-primary-fg)',
                border: 'none', borderRadius: 100, padding: '13px 26px',
                fontWeight: 700, fontSize: 15, cursor: enviando ? 'wait' : 'pointer',
                fontFamily: 'inherit', opacity: enviando ? 0.6 : 1,
              }}
            >
              {enviando ? 'Registrando…' : 'Sí, acepto'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              style={{
                background: 'transparent', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', borderRadius: 100,
                padding: '13px 22px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Todavía no
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          style={{
            width: '100%', background: 'var(--color-primary)', color: 'var(--color-primary-fg)',
            border: 'none', borderRadius: 100, padding: '16px 28px',
            fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Aceptar cotización
        </button>
      )}
    </div>
  );
}
