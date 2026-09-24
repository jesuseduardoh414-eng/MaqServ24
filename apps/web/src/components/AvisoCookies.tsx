'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ANALITICA_ACTIVA, EVENTO_ABRIR_AVISO, guardarConsentimiento, leerConsentimiento } from '@/lib/analitica';

type Labels = { title: string; text: string; accept: string; reject: string; link: string };

/**
 * Aviso de cookies. Solo existe si hay analítica configurada: sin GTM no hay
 * cookies de terceros que consentir. Aparece hasta que el visitante decide;
 * el enlace "Cookies" del pie lo vuelve a abrir para cambiar de opinión.
 */
export function AvisoCookies({ labels }: { labels: Labels }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!ANALITICA_ACTIVA) return;
    if (leerConsentimiento() === null) setAbierto(true);
    const abrir = () => setAbierto(true);
    window.addEventListener(EVENTO_ABRIR_AVISO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AVISO, abrir);
  }, []);

  if (!abierto) return null;

  const decidir = (valor: 'aceptado' | 'rechazado') => {
    guardarConsentimiento(valor);
    setAbierto(false);
  };

  return (
    <aside
      role="dialog"
      aria-label={labels.title}
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 520, zIndex: 85, padding: '18px 20px',
        background: 'var(--color-surface)', color: 'var(--color-text)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 12px 40px rgba(0,0,0,.35)', fontFamily: 'var(--font-sans)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{labels.title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
        {labels.text}{' '}
        <Link href="/privacidad" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{labels.link}</Link>
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => decidir('aceptado')}
          style={{ font: 'inherit', fontWeight: 700, fontSize: 14, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '10px 18px', borderRadius: 'var(--radius-button, 6px)', cursor: 'pointer' }}
        >
          {labels.accept}
        </button>
        <button
          type="button"
          onClick={() => decidir('rechazado')}
          style={{ font: 'inherit', fontWeight: 600, fontSize: 14, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: 'var(--radius-button, 6px)', cursor: 'pointer' }}
        >
          {labels.reject}
        </button>
      </div>
    </aside>
  );
}

/** Enlace del pie que reabre el aviso. No se pinta si no hay analítica. */
export function CookiesPreferencias({ label }: { label: string }) {
  if (!ANALITICA_ACTIVA) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AVISO))}
      style={{ font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textDecoration: 'underline' }}
    >
      {label}
    </button>
  );
}
