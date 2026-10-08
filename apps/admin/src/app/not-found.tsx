import { Btn } from '@/components/ui';

/** 404 del panel, en español y con el cromo del admin. */
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--adm-page)', color: 'var(--adm-text)', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div className="adm-eyebrow" style={{ justifyContent: 'center', marginBottom: 12 }}>Error 404</div>
        <h1 className="adm-title" style={{ fontSize: 24, marginBottom: 10 }}>Esta vista no existe</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--adm-muted)', lineHeight: 1.6, fontSize: 14 }}>Revisa la dirección o vuelve al tablero.</p>
        <Btn variant="primary" icon="ph-house" href="/">
          Ir al tablero
        </Btn>
      </div>
    </div>
  );
}
