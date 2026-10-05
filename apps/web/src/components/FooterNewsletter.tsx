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
        // Sistema 2026-09-30: nada de gunmetal de fondo; la caja es la propia
        // banda con un velo blanco mínimo y borde de 1 px, radio 14.
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 14,
        padding: 'clamp(22px, 4vw, 40px)',
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
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 62%)',
          borderRadius: '50%',
        }}
      />
      <div style={{ position: 'relative' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(21px, 2.6vw, 26px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, color: '#fff', margin: '0 0 8px' }}>
          {labels.title}
        </h2>
        <p style={{ fontSize: '14.5px', margin: 0, maxWidth: 420, lineHeight: 1.55, color: 'rgba(255,255,255,.7)' }}>
          {labels.subtitle}
        </p>
      </div>
      <form className="nl-form" onSubmit={onSubmit} style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        {/* Campo y botón del sistema (`ms-input`/`ms-btn`), adaptados a la banda oscura. */}
        <input
          name="email"
          type="email"
          required
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="ms-input"
          style={{
            flex: 1,
            minWidth: 200,
            borderColor: 'rgba(255,255,255,.16)',
            background: 'rgba(255,255,255,.05)',
            color: '#fff',
          }}
        />
        <button type="submit" className="ms-btn">
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
