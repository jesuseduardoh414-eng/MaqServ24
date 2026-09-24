'use client';

/** Botón de la página sin conexión: recarga para volver a intentar la red. */
export function Reintentar({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontWeight: 700, fontSize: 15, background: 'var(--color-primary, #008CFF)', color: 'var(--color-primary-fg, #07090C)', border: 'none', padding: '13px 26px', borderRadius: 'var(--radius-md, 6px)', cursor: 'pointer' }}
    >
      {label}
    </button>
  );
}
