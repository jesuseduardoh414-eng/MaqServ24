import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import { parseProductSlug } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getCategories, getProduct } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { QuoteGate } from '../cotizar/QuoteGate';
import { CotizadorGuiado } from './CotizadorGuiado';

/** Siempre en servidor: el catálogo y la sesión no se hornean. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/cotizador', titulo: t(theme, 'seo.quoter.title'), descripcion: t(theme, 'seo.quoter.description') });
}

type Search = { linea?: string; producto?: string };

/**
 * COTIZADOR GUIADO (decisión del cliente, 2026-09-25).
 *
 * Sustituye a los dos cotizadores por tipo (maquinaria y triturados, herencia
 * de PUCSA). Aquí el cliente dice qué necesita, dónde y cuándo, y elige entre
 * máquinas REALES del catálogo, con precio y traslado. Ver `CotizadorGuiado`.
 *
 * Llega con `?linea=` desde las categorías y con `?producto=` desde la tarjeta
 * de un equipo: en ese caso la máquina va preseleccionada y el flujo arranca
 * en los requisitos.
 */
export default async function CotizadorPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [theme, user, categorias] = await Promise.all([getTheme(), getSessionUser(), getCategories().catch(() => [])]);

  let producto: { id: number; name: string; slug: string; categorySlug: string | null } | null = null;
  if (sp.producto) {
    const id = /^\d+$/.test(sp.producto) ? Number(sp.producto) : parseProductSlug(sp.producto);
    if (id) {
      const p = await getProduct(id).catch(() => null);
      if (p) producto = { id: p.id, name: p.name, slug: p.slug, categorySlug: p.categorySlug };
    }
  }
  const next = sp.producto ? `/cotizador?producto=${encodeURIComponent(sp.producto)}` : sp.linea ? `/cotizador?linea=${encodeURIComponent(sp.linea)}` : '/cotizador';
  const lineas = categorias.map((c) => ({ slug: c.slug, name: c.name, description: c.description }));

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '60vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '38px clamp(16px, 4vw, 26px) 60px' }}>
          <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 10 }}>
            Cotizador en línea
          </span>
          <h1 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 'clamp(30px, 5vw, 44px)', letterSpacing: '-0.035em', lineHeight: 1.05, textTransform: 'uppercase' }}>
            Dinos qué necesitas y <span style={{ color: 'var(--color-primary)' }}>elige tu máquina</span>
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '12px 0 28px', fontSize: 15.5, maxWidth: '64ch', lineHeight: 1.6 }}>
            Te enseñamos solo las máquinas que sirven para tu obra, libres en tus fechas y cerca de ti, con precio y traslado al momento.
          </p>
          {!user ? (
            <QuoteGate theme={theme} next={next} />
          ) : (
            <CotizadorGuiado user={user} lineas={lineas} inicial={{ linea: sp.linea ?? null, producto }} />
          )}
        </div>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
