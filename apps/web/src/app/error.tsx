'use client';

/**
 * Error boundary global del sitio público. Sin este archivo, cualquier
 * excepción de un server component (API caída, Supabase pausado) mostraba la
 * pantalla genérica de Next en inglés, sin marca y sin botón de reintento.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg, #07090C)', color: 'var(--color-text, #E8EDF2)', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted, #8A96A3)', margin: '0 0 14px' }}>
          Algo salió mal
        </p>
        <h1 style={{ fontFamily: 'var(--font-display, Inter, sans-serif)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          No pudimos cargar esta página
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted, #8A96A3)', lineHeight: 1.6 }}>
          Puede ser un problema temporal de conexión con nuestro servidor. Intenta de nuevo en unos segundos.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontWeight: 700, fontSize: 15, background: 'var(--color-primary, #008CFF)', color: 'var(--color-primary-fg, #0a0a0b)', border: 'none', padding: '13px 26px', borderRadius: 'var(--radius-md, 6px)', cursor: 'pointer' }}
          >
            Reintentar
          </button>
          <a
            href="/"
            style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontWeight: 600, fontSize: 15, color: 'var(--color-text, #E8EDF2)', border: '1px solid var(--color-border, #1E2630)', padding: '13px 26px', borderRadius: 'var(--radius-md, 6px)', textDecoration: 'none' }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
