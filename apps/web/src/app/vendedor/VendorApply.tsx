'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VendorApplication } from '@maqserv/types';

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

/**
 * Solicitud para vender (`POST /vendor/apply` → is_vendor 1).
 *
 * `initial` la prellena: la usa quien vuelve a solicitar tras un rechazo o una
 * revocación — reescribir todo desde cero solo para corregir un dato es hostil.
 * `bare` omite el encabezado cuando la página ya puso uno.
 */
export function VendorApply({
  labels,
  initial,
  bare = false,
}: {
  labels: {
    title: string;
    subtitle: string;
    shopName: string;
    shopNumber: string;
    shopAddress: string;
    regNumber: string;
    message: string;
    submit: string;
  };
  initial: VendorApplication | null;
  bare?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/proxy/vendor/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: String(form.get('shopName') ?? ''),
        shopNumber: String(form.get('shopNumber') ?? '') || undefined,
        shopAddress: String(form.get('shopAddress') ?? '') || undefined,
        regNumber: String(form.get('regNumber') ?? '') || undefined,
        shopMessage: String(form.get('shopMessage') ?? '') || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(typeof data?.message === 'string' ? data.message : 'No pudimos enviar tu solicitud');
      return;
    }
    router.refresh(); // el servidor vuelve a leer /vendor/me y cambia de vista
  }

  const body = (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 18, maxWidth: 620 }}>
      <div>
        <label style={labelStyle} htmlFor="va-shopName">{labels.shopName}</label>
        <input id="va-shopName" name="shopName" required minLength={2} maxLength={190} defaultValue={initial?.shopName ?? ''} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
        <div>
          <label style={labelStyle} htmlFor="va-shopNumber">{labels.shopNumber}</label>
          <input id="va-shopNumber" name="shopNumber" maxLength={50} defaultValue={initial?.shopNumber ?? ''} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="va-regNumber">{labels.regNumber}</label>
          <input id="va-regNumber" name="regNumber" maxLength={100} defaultValue={initial?.regNumber ?? ''} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="va-shopAddress">{labels.shopAddress}</label>
        <input id="va-shopAddress" name="shopAddress" maxLength={250} defaultValue={initial?.shopAddress ?? ''} style={inputStyle} />
      </div>
      <div>
        {/* La API acepta 1000 caracteres: pedirlos en un input de una línea era absurdo. */}
        <label style={labelStyle} htmlFor="va-shopMessage">{labels.message}</label>
        <textarea id="va-shopMessage" name="shopMessage" rows={4} maxLength={1000} defaultValue={initial?.shopMessage ?? ''} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
      </div>

      {error ? (
        <p role="alert" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)', color: 'var(--color-error)', padding: '13px 16px', borderRadius: 10, fontSize: 14.5, fontWeight: 600 }}>
          <span style={{ fontSize: 17 }}>⚠</span> {error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={loading}
          style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '15px 34px', borderRadius: 100, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '…' : `${labels.submit} →`}
        </button>
      </div>
    </form>
  );

  if (bare) return body;

  return (
    <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '26px 28px' }}>
      <h2 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>{labels.title}</h2>
      <p style={{ margin: '0 0 24px', fontSize: 15.5, color: 'var(--color-text-muted)', lineHeight: 1.55, maxWidth: '58ch' }}>{labels.subtitle}</p>
      {body}
    </section>
  );
}
