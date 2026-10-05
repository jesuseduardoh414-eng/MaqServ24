import type { Metadata } from 'next';
import { getTheme, t } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { Reintentar } from './Reintentar';

/**
 * Página que el service worker muestra cuando el visitante navega SIN red.
 *
 * Va sin cabecera ni pie a propósito: el service worker la guarda al instalarse
 * y la sirve desde caché, así que todo lo que dependa de la red (logo de la BD,
 * menú, sesión) saldría roto. Los estilos son en línea con valores de respaldo:
 * el `<style id="theme-tokens">` del layout sí viaja dentro del HTML, pero la
 * hoja global y las fuentes de Google no, y la página tiene que verse igual de
 * bien sin ellas.
 */
export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'pwa.offline.title')} — ${t(theme, 'site.name')}`, robots: { index: false, follow: false } };
}

export default async function SinConexionPage() {
  const theme = await getTheme();
  return (
    <main className="ms-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg, #07090C)', color: 'var(--color-text, #F5F7FA)', padding: '60px 16px', boxSizing: 'border-box' }}>
      {/* Las clases `ms-*` viajan en un <style> dentro del HTML del layout,
          así que también llegan a esta página servida desde caché. */}
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo LOCAL (no el de la BD): es lo único que seguro está en caché. */}
        <img src="/brand/maqser24-logo.png" alt={t(theme, 'site.name')} width={151} height={36} style={{ height: 36, width: 'auto', marginBottom: 28, display: 'block' }} />
        <div className="ms-empty">
          <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="link" size={22} /></span>
          <h1 className="ms-empty-t">{t(theme, 'pwa.offline.title')}</h1>
          <p className="ms-empty-p">{t(theme, 'pwa.offline.text')}</p>
          <div className="ms-empty-acts">
            <Reintentar label={t(theme, 'pwa.offline.retry')} />
          </div>
        </div>
      </div>
    </main>
  );
}
