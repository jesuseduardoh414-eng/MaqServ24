'use client';

import { useState } from 'react';

/**
 * Bloque de novedades del footer (variante oscura, en fila) del diseño SEGAshop.
 * Reusa el mismo endpoint /api/suscribir. Textos y colores desde copys/tokens.
 */
export function FooterNewsletter({
  labels,
}: {
  labels: { title: string; subtitle: string; placeholder: string; submit: string; success: string; error: string };
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/suscribir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(form.get('email') ?? '') }),
    });
    setState(res.ok ? 'ok' : 'error');
    if (res.ok) (e.target as HTMLFormElement).reset();
  }

  return (
    <div
      className="nl-box"
      style={{
        background: 'color-mix(in srgb, var(--color-secondary) 88%, white)',
        border: '1px solid color-mix(in srgb, white 8%, transparent)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(28px, 4vw, 44px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: 30,
        alignItems: 'center',
        marginBottom: 56,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '-6%',
          top: '-40%',
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent 62%)',
          borderRadius: '50%',
        }}
      />
      <div style={{ position: 'relative' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', color: '#fff', margin: '0 0 10px', textTransform: 'uppercase' }}>
          {labels.title}
        </h2>
        <p style={{ fontSize: '14.5px', margin: 0, maxWidth: 400, lineHeight: 1.55, color: 'rgba(255,255,255,.66)', fontWeight: 300 }}>
          {labels.subtitle}
        </p>
      </div>
      <form className="nl-form" onSubmit={onSubmit} style={{ position: 'relative', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          name="email"
          type="email"
          required
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          style={{
            flex: 1,
            minWidth: 200,
            border: '1px solid rgba(255,255,255,.14)',
            background: 'rgba(255,255,255,.06)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            padding: '15px 17px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14.5px',
          }}
        />
        <button
          type="submit"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-primary-fg)',
            border: 'none',
            fontWeight: 700,
            fontSize: '14.5px',
            padding: '15px 26px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {labels.submit}
        </button>
        {state === 'ok' ? (
          <p role="status" style={{ width: '100%', margin: 0, color: 'var(--color-success)', fontSize: '13px' }}>{labels.success}</p>
        ) : null}
        {state === 'error' ? (
          <p role="alert" style={{ width: '100%', margin: 0, color: 'var(--color-error)', fontSize: '13px' }}>{labels.error}</p>
        ) : null}
      </form>
    </div>
  );
}
