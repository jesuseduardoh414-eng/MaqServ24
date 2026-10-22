import type { Metadata } from 'next';
import Link from 'next/link';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { AceptarCotizacion, type DatosAceptar } from './AceptarCotizacion';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  // Personal aunque no pida sesión: fuera de los buscadores.
  return { title: `Acepta tu cotización — ${t(theme, 'site.name')}`, robots: { index: false, follow: false } };
}

/**
 * ACEPTAR UNA COTIZACIÓN DEL PANEL (2026-10-22). Destino del botón "Acepto la
 * cotización" del correo (`/cotizacion/aceptar?t=…`). El enlace es el permiso,
 * como en /resena. Abrir la página no acepta nada: lo hace el botón.
 */
export default async function AceptarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const [theme, sp] = await Promise.all([getTheme(), searchParams]);
  const token = typeof sp.t === 'string' ? sp.t : '';

  let datos: DatosAceptar | null = null;
  let motivo = 'Este enlace está incompleto. Ábrelo tal como viene en el correo.';
  if (token) {
    // Por cabecera, como la reseña: el token no queda en los registros de la API.
    const res = await fetch(`${API_URL}/quoter/aceptar`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (res?.ok) datos = (await res.json()) as DatosAceptar;
    else motivo = res
      ? ((await res.json().catch(() => null))?.message ?? 'Este enlace ya no sirve.')
      : 'No pudimos abrir tu cotización. Inténtalo de nuevo en unos segundos.';
  }

  return (
    <>
      <SiteHeader theme={theme} />
      <main className="ms-wrap" style={{ paddingBlock: 'clamp(28px, 6vw, 64px)' }}>
        {datos ? (
          <AceptarCotizacion token={token} datos={datos} />
        ) : (
          <div className="ms-panel ms-panel-lg" style={{ maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>
            <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="link" size={22} /></span>
            <h1 style={{ margin: '14px 0 8px', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              No pudimos abrir tu cotización
            </h1>
            <p className="ms-desc" style={{ margin: '0 0 20px' }}>{motivo}</p>
            <Link href="/contacto" className="ms-btn ms-btn-block">Contactar a MAQSER24</Link>
          </div>
        )}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
