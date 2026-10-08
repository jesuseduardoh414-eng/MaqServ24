'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '@/components/ui';

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
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <Btn
        size="sm"
        icon="ph-check"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`¿Confirmas que ya le transferiste ${amount} a ${vendor}?\n\nSu saldo ya está descontado; esto solo cierra el retiro.`)) {
            void send('completed');
          }
        }}
      >
        Marcar pagado
      </Btn>

      <Btn size="sm" variant="danger" disabled={busy} onClick={() => setAsking((v) => !v)} aria-expanded={asking}>
        Rechazar
      </Btn>

      {asking ? (
        <div
          ref={box}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 'min(320px, calc(100vw - 40px))',
            background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', borderRadius: 12, padding: 16,
            boxShadow: '0 20px 50px -20px rgba(0,0,0,0.85)', textAlign: 'left',
          }}
        >
          <div className="adm-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)', marginBottom: 4 }}>Rechazar {amount}</div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
            Se le regresan {amount} a su saldo y se le avisa con este motivo.
          </p>
          <label htmlFor={`wd-note-${withdrawId}`} className="adm-label" style={{ display: 'block', marginBottom: 6 }}>
            Motivo
          </label>
          <textarea
            id={`wd-note-${withdrawId}`}
            className="adm-textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Ej. La CLABE no coincide con el titular."
            style={{ fontSize: 13.5 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Btn size="sm" variant="ghost" onClick={() => setAsking(false)}>
              Cancelar
            </Btn>
            <Btn size="sm" variant="danger" disabled={busy || note.trim().length < 3} onClick={() => void send('rejected', note.trim())}>
              Rechazar y reembolsar
            </Btn>
          </div>
        </div>
      ) : null}

      {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 500, width: '100%', textAlign: 'right' }}>{error}</span> : null}
    </div>
  );
}
