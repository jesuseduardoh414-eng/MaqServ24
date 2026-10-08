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
    // Un desplegable de Radix abierto (AdminSelect) atiende su propio Esc y lo
    // marca con preventDefault: ese Esc cierra el desplegable, no el modal.
    // Sin esto se cerraban los dos y se perdía lo escrito en el formulario.
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onCerrar(); };
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, width: `min(${ancho}px, 100%)`,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)',
          animation: 'fadeIn .18s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '18px 22px 14px', borderBottom: `1px solid ${D.cardBorder}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: D.text, letterSpacing: '-0.01em', fontFamily: 'inherit' }}>{titulo}</h2>
            {subtitulo ? <div style={{ marginTop: 4, fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.5 }}>{subtitulo}</div> : null}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="adm-ibtn is-plain" style={{ marginTop: -4, marginRight: -6 }}>
            <i className="ph ph-x" aria-hidden />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
        {pie ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 22px', borderTop: `1px solid ${D.cardBorder}` }}>{pie}</div>
        ) : null}
      </div>
    </div>
  );
}
