'use client';

import { useEffect, useState } from 'react';

const MONO = "'Inter', system-ui, sans-serif";

const iconStyle: React.CSSProperties = {
  width: 38, height: 38, border: '1px solid var(--color-border)', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
  color: 'var(--color-text)', textDecoration: 'none', background: 'transparent', cursor: 'pointer',
  fontFamily: 'inherit',
};

/** Fila "COMPARTIR" del artículo: X, LinkedIn y copiar enlace. */
export function BlogShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  // La URL se lee tras montar para que el HTML del servidor y el del cliente
  // coincidan (evita el error de hidratación de Next).
  const [url, setUrl] = useState('');
  useEffect(() => { setUrl(window.location.href); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard no disponible */
    }
  }

  const enc = encodeURIComponent;
  const x = `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`;
  const ln = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>
        {copied ? 'ENLACE COPIADO' : 'COMPARTIR'}
      </span>
      <a href={x} target="_blank" rel="noopener noreferrer" style={iconStyle} aria-label="Compartir en X">X</a>
      <a href={ln} target="_blank" rel="noopener noreferrer" style={iconStyle} aria-label="Compartir en LinkedIn">in</a>
      <button type="button" onClick={copy} style={iconStyle} aria-label="Copiar enlace">↗</button>
    </div>
  );
}
