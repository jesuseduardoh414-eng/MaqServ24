'use client';

import { Icon } from '@/components/Icon';

/**
 * Error boundary global del sitio público. Sin este archivo, cualquier
 * excepción de un server component (API caída, base de datos sin responder) mostraba la
 * pantalla genérica de Next en inglés, sin marca y sin botón de reintento.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="ms-page" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg, #07090C)', color: 'var(--color-text, #E8EDF2)' }}>
      <div className="ms-wrap-narrow" style={{ width: '100%', boxSizing: 'border-box' }}>
        <div className="ms-empty" style={{ maxWidth: 560, margin: '0 auto' }}>
          <span className="ms-ico ms-ico-lg" aria-hidden style={{ color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
            <Icon name="warning" size={22} />
          </span>
          <p className="ms-small ms-muted" style={{ margin: '10px 0 0' }}>Algo salió mal</p>
          <h1 className="ms-empty-t" style={{ marginTop: 2 }}>No pudimos cargar esta página</h1>
          <p className="ms-empty-p">Puede ser un problema temporal de conexión con nuestro servidor. Intenta de nuevo en unos segundos.</p>
          <div className="ms-empty-acts">
            <button type="button" onClick={reset} className="ms-btn">Reintentar</button>
            <a href="/" className="ms-btn ms-btn-sec">Ir al inicio</a>
          </div>
        </div>
      </div>
    </main>
  );
}
