'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)',
  background: 'color-mix(in srgb, var(--color-text) 3%, var(--color-surface))',
  border: '1px solid var(--color-border)', borderRadius: 10, padding: '13px 15px', outline: 'none',
};

export function WithdrawForm({
  labels,
  balance,
}: {
  labels: { title: string; amount: string; method: string; reference: string; submit: string };
  /** El servidor es quien manda (rechaza si excede); aquí solo se evita el viaje en balde. */
  balance: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const noBalance = balance <= 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const res = await fetch('/api/proxy/vendor/withdraws', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(data.get('amount') ?? 0),
        method: String(data.get('method') ?? ''),
        reference: String(data.get('reference') ?? '') || undefined,
      }),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(typeof body?.message === 'string' ? body.message : 'No pudimos registrar el retiro');
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <>
      <h2 style={{ fontFamily: DISPLAY, margin: '0 0 20px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
        {labels.title}
      </h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 18, maxWidth: 560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
          <div>
            <label style={labelStyle} htmlFor="wd-amount">{labels.amount}</label>
            {/* `max` evita pedir más de lo que hay; el servidor lo vuelve a validar. */}
            <input id="wd-amount" name="amount" type="number" step="0.01" min={1} max={balance || undefined} required disabled={noBalance} style={{ ...inputStyle, fontFamily: MONO }} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="wd-method">{labels.method}</label>
            <input id="wd-method" name="method" required minLength={2} maxLength={100} disabled={noBalance} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle} htmlFor="wd-reference">{labels.reference}</label>
          <textarea id="wd-reference" name="reference" rows={2} maxLength={400} disabled={noBalance} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)', color: 'var(--color-error)', padding: '13px 16px', borderRadius: 10, fontSize: 14.5, fontWeight: 600 }}>
            <Icon name="warning" size={17} /> {error}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={loading || noBalance}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '15px 34px', borderRadius: 100, cursor: loading ? 'wait' : noBalance ? 'not-allowed' : 'pointer', opacity: loading || noBalance ? 0.5 : 1 }}
          >
            {loading ? '…' : <>{labels.submit}<Icon name="arrowRight" size={16} /></>}
          </button>
        </div>
      </form>
    </>
  );
}
