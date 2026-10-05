'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

/**
 * Fila "Compartir" del artículo: X, LinkedIn y copiar enlace.
 * Sistema de diseño 2026-09-30: etiqueta en tipo oración (sin MAYÚSCULAS
 * espaciadas), botones cuadrados de radio 8 y el icono `link` de `Icon` en
 * vez del glifo ↗.
 */
const CSS = `
.bs-btn{ width:36px; height:36px; border:1px solid var(--color-border); border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:var(--color-text); text-decoration:none; background:transparent; cursor:pointer; font-family:inherit; transition:border-color .18s ease; }
.bs-btn:hover{ border-color:var(--color-text-muted); }
.bs-btn:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
`;

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
      <style>{CSS}</style>
      <span role="status" style={{ fontSize: 13.5, color: copied ? 'var(--color-success)' : 'var(--color-text-muted)', marginRight: 2 }}>
        {copied ? 'Enlace copiado' : 'Compartir'}
      </span>
      <a href={x} target="_blank" rel="noopener noreferrer" className="bs-btn" aria-label="Compartir en X">X</a>
      <a href={ln} target="_blank" rel="noopener noreferrer" className="bs-btn" aria-label="Compartir en LinkedIn">in</a>
      <button type="button" onClick={copy} className="bs-btn" aria-label="Copiar enlace"><Icon name="link" size={15} /></button>
    </div>
  );
}
