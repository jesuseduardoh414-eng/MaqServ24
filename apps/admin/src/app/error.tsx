'use client';

import { Btn } from '@/components/ui';

/**
 * Error boundary del panel. La causa más común aquí es la API de Render
 * dormida o la base sin responder — se dice claro, en vez de la pantalla genérica
 * de Next o (peor) un rebote al login que parece problema de credenciales.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--adm-page)', color: 'var(--adm-text)', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div className="adm-eyebrow" style={{ justifyContent: 'center', marginBottom: 12 }}>Panel MAQSER24</div>
        <h1 className="adm-title" style={{ fontSize: 24, marginBottom: 10 }}>No pudimos cargar esta vista</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--adm-muted)', lineHeight: 1.6, fontSize: 14 }}>
          Lo más probable es que el servidor (Render) esté despertando — tarda hasta un minuto tras un rato sin uso — o que la base de datos esté pausada. Reintenta en unos segundos.
        </p>
        <Btn variant="primary" icon="ph-arrow-clockwise" onClick={reset}>
          Reintentar
        </Btn>
      </div>
    </div>
  );
}
