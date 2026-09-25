'use client';

import { useEffect, type ReactNode } from 'react';
import { D } from '@/components/design-tokens';

/**
 * MODAL DEL PANEL (2026-09-25).
 *
 * "Quiero cambiar la manera de registros: en lugar de que aparezca en la
 * misma página, que salga un modal." Los altas de cada módulo (aliado,
 * cliente, administrador, categoría…) se abrían como un bloque encima de la
 * lista y la empujaban hacia abajo; se perdía de vista qué se estaba dando de
 * alta y dónde quedaba. Todos pasan por este modal: se cierra con Esc, con
 * la X o tocando fuera, y el contenido hace scroll dentro si es largo.
 */
export function Modal({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  children,
  ancho = 760,
  pie,
}: {
  abierto: boolean;
  titulo: string;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
  /** Botones al pie (Guardar / Cancelar). Quedan fijos aunque el cuerpo haga scroll. */
  pie?: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', alTeclear); document.body.style.overflow = overflow; };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 300 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18, width: `min(${ancho}px, 100%)`,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 22px 14px', borderBottom: `1px solid ${D.cardBorder}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: D.text, letterSpacing: '-0.01em' }}>{titulo}</h2>
            {subtitulo ? <div style={{ marginTop: 4, fontSize: 13, color: D.muted2, lineHeight: 1.5 }}>{subtitulo}</div> : null}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: D.muted2, fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: 2 }}>×</button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
        {pie ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: `1px solid ${D.cardBorder}` }}>{pie}</div>
        ) : null}
      </div>
    </div>
  );
}
