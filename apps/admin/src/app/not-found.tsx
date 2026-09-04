import Link from 'next/link';

/** 404 del panel, en español y con el cromo del admin. */
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0d0d0f', color: '#e7e7ea', padding: '60px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8b93a1', margin: '0 0 14px' }}>Error 404</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>Esta vista no existe</h1>
        <p style={{ margin: '0 0 26px', color: '#8b93a1', lineHeight: 1.6, fontSize: 14.5 }}>Revisa la dirección o vuelve al tablero.</p>
        <Link href="/" style={{ fontWeight: 700, fontSize: 14.5, background: 'var(--adm-accent, #008CFF)', color: '#0a0a0b', padding: '12px 24px', borderRadius: 8, textDecoration: 'none' }}>
          Ir al tablero
        </Link>
      </div>
    </div>
  );
}
