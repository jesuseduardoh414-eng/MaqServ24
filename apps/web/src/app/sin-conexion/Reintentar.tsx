'use client';

/** Botón de la página sin conexión: recarga para volver a intentar la red. */
export function Reintentar({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className="ms-btn">
      {label}
    </button>
  );
}
