import Link from 'next/link';

/** 404 del sitio público con marca y en español (antes salía el default de Next en inglés). */
export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg, #07090C)', color: 'var(--color-text, #E8EDF2)', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted, #8A96A3)', margin: '0 0 14px' }}>
          Error 404
        </p>
        <h1 style={{ fontFamily: 'var(--font-display, Inter, sans-serif)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          Esta página no existe
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted, #8A96A3)', lineHeight: 1.6 }}>
          Puede que el enlace esté vencido o que el contenido se haya movido.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontWeight: 700, fontSize: 15, background: 'var(--color-primary, #008CFF)', color: 'var(--color-primary-fg, #0a0a0b)', padding: '13px 26px', borderRadius: 'var(--radius-md, 6px)', textDecoration: 'none' }}
          >
            Ir al inicio
          </Link>
          <Link
            href="/productos"
            style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontWeight: 600, fontSize: 15, color: 'var(--color-text, #E8EDF2)', border: '1px solid var(--color-border, #1E2630)', padding: '13px 26px', borderRadius: 'var(--radius-md, 6px)', textDecoration: 'none' }}
          >
            Ver catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
