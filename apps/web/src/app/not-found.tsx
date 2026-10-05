import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** 404 del sitio público con marca y en español (antes salía el default de Next en inglés). */
export default function NotFound() {
  return (
    <main className="ms-page" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg, #07090C)', color: 'var(--color-text, #E8EDF2)' }}>
      <div className="ms-wrap-narrow" style={{ width: '100%', boxSizing: 'border-box' }}>
        <div className="ms-empty" style={{ maxWidth: 560, margin: '0 auto' }}>
          <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="search" size={22} /></span>
          <p className="ms-small ms-muted" style={{ margin: '10px 0 0' }}>Error 404</p>
          <h1 className="ms-empty-t" style={{ marginTop: 2 }}>Esta página no existe</h1>
          <p className="ms-empty-p">Puede que el enlace esté vencido o que el contenido se haya movido.</p>
          <div className="ms-empty-acts">
            <Link href="/" className="ms-btn">Ir al inicio</Link>
            <Link href="/productos" className="ms-btn ms-btn-sec">Ver catálogo</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
