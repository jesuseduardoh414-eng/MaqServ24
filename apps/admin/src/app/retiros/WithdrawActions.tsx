'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

/**
 * Pagar o rechazar un retiro. Ambas acciones mueven dinero, así que ninguna es de
 * un solo clic: pagar confirma y rechazar EXIGE un motivo (se le devuelve el saldo
 * al vendedor y se le avisa con esa razón).
 */
export function WithdrawActions({
  withdrawId,
  amount,
  vendor,
}: {
  withdrawId: number;
  amount: string;
  vendor: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!asking) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setAsking(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [asking]);

  async function send(status: 'completed' | 'rejected', reason?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/withdraws/${withdrawId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: reason || undefined }),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo procesar');
      setAsking(false);
      setNote('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <style>{`
        .wd-solid:hover:not(:disabled){ filter: brightness(1.12); }
        .wd-ghost:hover:not(:disabled){ background: rgba(255,255,255,0.06); }
      `}</style>

      <button
        type="button"
        className="wd-solid"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`¿Confirmas que ya le transferiste ${amount} a ${vendor}?\n\nSu saldo ya está descontado; esto solo cierra el retiro.`)) {
            void send('completed');
          }
        }}
        style={{ fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8, padding: '7px 14px', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        Marcar pagado
      </button>

      <button
        type="button"
        className="wd-ghost"
        disabled={busy}
        onClick={() => setAsking((v) => !v)}
        style={{ fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8, padding: '7px 14px', background: 'transparent', color: '#f55', border: '1px solid rgba(255,85,85,0.3)', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        Rechazar
      </button>

      {asking ? (
        <div
          ref={box}
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 320, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 16, boxShadow: '0 18px 44px -14px rgba(0,0,0,0.75)', textAlign: 'left' }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#FBFBFA', marginBottom: 6 }}>Rechazar {amount}</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#8A8A8F', lineHeight: 1.5 }}>
            Se le regresan {amount} a su saldo y se le avisa con este motivo.
          </p>
          <label htmlFor={`wd-note-${withdrawId}`} style={{ display: 'block', fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', marginBottom: 6 }}>
            MOTIVO
          </label>
          <textarea
            id={`wd-note-${withdrawId}`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Ej. La CLABE no coincide con el titular."
            style={{ width: '100%', background: D.inputBg, border: `1px solid ${D.inputBorder}`, borderRadius: 8, padding: '9px 11px', color: D.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              disabled={busy || note.trim().length < 3}
              onClick={() => void send('rejected', note.trim())}
              style={{ flex: 1, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8, padding: '9px 12px', background: '#f55', color: '#1A0606', border: 'none', cursor: busy ? 'wait' : note.trim().length < 3 ? 'not-allowed' : 'pointer', opacity: busy || note.trim().length < 3 ? 0.45 : 1 }}
            >
              Rechazar y reembolsar
            </button>
            <button
              type="button"
              className="wd-ghost"
              onClick={() => setAsking(false)}
              style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', borderRadius: 8, padding: '9px 12px', background: 'transparent', color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {error ? <span role="alert" style={{ fontSize: 11.5, color: '#f55', fontWeight: 600, width: '100%', textAlign: 'right' }}>{error}</span> : null}
    </div>
  );
}
