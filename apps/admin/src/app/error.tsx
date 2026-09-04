'use client';

/**
 * Error boundary del panel. La causa más común aquí es la API de Render
 * dormida o Supabase pausado — se dice claro, en vez de la pantalla genérica
 * de Next o (peor) un rebote al login que parece problema de credenciales.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0d0d0f', color: '#e7e7ea', padding: '60px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8b93a1', margin: '0 0 14px' }}>Panel MAQSER24</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>No pudimos cargar esta vista</h1>
        <p style={{ margin: '0 0 26px', color: '#8b93a1', lineHeight: 1.6, fontSize: 14.5 }}>
          Lo más probable es que el servidor (Render) esté despertando — tarda hasta un minuto tras un rato sin uso — o que la base de datos esté pausada. Reintenta en unos segundos.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ fontWeight: 700, fontSize: 14.5, background: 'var(--adm-accent, #008CFF)', color: '#0a0a0b', border: 'none', padding: '12px 24px', borderRadius: 8, cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
