import type { Metadata } from 'next';
import { getTheme, t } from '@/lib/theme';
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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg, #07090C)', color: 'var(--color-text, #F5F7FA)', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {/* Logo LOCAL (no el de la BD): es lo único que seguro está en caché. */}
        <img src="/brand/maqser24-logo.png" alt={t(theme, 'site.name')} width={151} height={36} style={{ height: 36, width: 'auto', marginBottom: 36 }} />
        <p style={{ fontFamily: 'var(--font-sans, Inter, sans-serif)', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted, #A9B0B7)', margin: '0 0 14px' }}>
          {t(theme, 'pwa.offline.title')}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display, Inter, sans-serif)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          {t(theme, 'pwa.offline.title')}
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted, #A9B0B7)', lineHeight: 1.6 }}>
          {t(theme, 'pwa.offline.text')}
        </p>
        <Reintentar label={t(theme, 'pwa.offline.retry')} />
      </div>
    </main>
  );
}
