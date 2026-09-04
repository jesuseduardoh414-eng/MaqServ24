import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseProductSlug } from '@maqserv/config';
import type { StrategicSectorDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getSector } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';

type Params = { slug: string };

const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };
// La banda es OSCURA (var(--band)): el acento va ACLARADO, no oscurecido.
// El mix con #000 venía del diseño para fondos claros y sobre negro daba
// ~3.9:1 en textos de 13px — reprobaba AA.
const GOLD = 'color-mix(in srgb, var(--color-primary) 65%, #fff)';
const INK = 'var(--band)';

const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchBySlug(slug: string): Promise<StrategicSectorDetail | null> {
  const id = parseProductSlug(slug);
  if (!id) return null;
  try {
    return await getSector(id);
  } catch (err) {
    // 404 real → notFound(); API caída → error boundary (no un 404 indexable).
    if (err instanceof Error && /→ 404/.test(err.message)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [theme, sector] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!sector) return { title: t(theme, 'site.name') };
  return {
    title: `${sector.title} — ${t(theme, 'site.name')}`,
    description: sector.description ? strip(sector.description).slice(0, 160) : undefined,
    alternates: { canonical: `/sectores/${sector.slug}` },
  };
}

/** Bloque de texto largo del sector (legacy: HTML libre). Solo se muestra si hay contenido. */
function Block({ title, html }: { title: string; html: string | null }) {
  if (!html || !strip(html)) return null;
  return (
    <div style={{ marginTop: 30 }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>{title}</h3>
      <div className="sector-rich" style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--color-text-muted)' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export default async function SectorPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [theme, sector] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!sector) notFound();

  const teaser = sector.description ? strip(sector.description).slice(0, 170) : '';

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)' }}>
        {/* ===== HERO (foto full-bleed + degradado) ===== */}
        <section style={{ position: 'relative', minHeight: 440, background: INK, overflow: 'hidden' }}>
          {sector.image ? (
            <Image src={sector.image} alt={sector.title} fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          ) : (
            <span className="ph" aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
          )}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,14,20,.06) 0%, rgba(10,14,20,.2) 44%, rgba(10,14,20,.62) 78%, rgba(10,14,20,.85) 100%)' }} />
          <div style={{ ...CONTAINER, position: 'relative', minHeight: 440, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: 40, paddingBottom: 48 }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.4rem, 6vw, 3.9rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.02, maxWidth: 820, textShadow: '0 2px 24px rgba(0,0,0,.35)' }}>{sector.title}</h1>
            {teaser ? (
              <p style={{ margin: '16px 0 0', fontSize: '18px', lineHeight: 1.5, color: 'rgba(255,255,255,.92)', maxWidth: 640, textShadow: '0 1px 14px rgba(0,0,0,.55)' }}>{teaser}</p>
            ) : null}
          </div>
        </section>

        {/* ===== CONTENIDO + SIDEBAR (solo datos de BD) ===== */}
        <section style={{ ...CONTAINER, paddingTop: 60, paddingBottom: 48, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, alignItems: 'start' }} className="sector-grid">
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: GOLD }}>{t(theme, 'sector.about')}</p>
            {sector.description ? (
              <div className="sector-rich" style={{ fontSize: '17px', lineHeight: 1.7, color: 'var(--color-text-muted)' }} dangerouslySetInnerHTML={{ __html: sector.description }} />
            ) : null}

            <Block title="Trayectoria" html={sector.trayectoria} />
            <Block title="Esencia" html={sector.esencia} />
            <Block title="Servicios" html={sector.servicios} />
            <Block title="Excelencia" html={sector.excelencia} />

            {sector.serviciosLista.length > 0 ? (
              <div style={{ marginTop: 34 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 20px' }}>{t(theme, 'sector.services.title')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="sector-list">
                  {sector.serviciosLista.map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', background: 'var(--surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Tarjeta de cotización (CTA, sticky) */}
          <aside style={{ position: 'sticky', top: 100, background: INK, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '32px 28px', color: '#fff' }} className="sector-cta">
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-heading)', fontSize: '23px', fontWeight: 800 }}>{t(theme, 'sector.cta.title')}</h3>
            <p style={{ margin: '0 0 24px', fontSize: '14.5px', lineHeight: 1.6, color: 'rgba(255,255,255,.78)' }}>{t(theme, 'sector.cta.body')}</p>
            <Link href="/contacto" style={{ display: 'block', textAlign: 'center', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', fontSize: '16px', fontWeight: 700, padding: '15px', borderRadius: 'var(--radius-md)', textDecoration: 'none', marginBottom: 10 }}>{t(theme, 'sector.cta.quote')}</Link>
            <Link href="/productos" style={{ display: 'block', textAlign: 'center', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.25)', fontSize: '16px', fontWeight: 700, padding: '15px', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>{t(theme, 'sector.cta.catalog')}</Link>
          </aside>
        </section>

        {/* ===== CTA FINAL ===== */}
        <section style={{ ...CONTAINER, paddingTop: 4, paddingBottom: 80 }}>
          <div style={{ background: INK, border: '1px solid var(--color-border)', borderRadius: 26, padding: '56px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, position: 'relative', overflow: 'hidden', flexWrap: 'wrap' }} className="sector-cta-band">
            <div aria-hidden style={{ position: 'absolute', right: -60, top: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 22%, transparent), transparent 70%)' }} />
            <div style={{ position: 'relative', maxWidth: 600 }}>
              <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.7rem, 3.2vw, 2.25rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{t(theme, 'sector.band.title')}</h2>
              <p style={{ margin: 0, fontSize: '16.5px', lineHeight: 1.6, color: 'rgba(255,255,255,.78)' }}>{t(theme, 'sector.band.body')}</p>
            </div>
            <div style={{ position: 'relative', display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
              <Link href="/contacto" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)', fontSize: '16px', fontWeight: 700, padding: '16px 30px', borderRadius: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>{t(theme, 'sector.cta.quote')}</Link>
              <Link href="/" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.3)', fontSize: '16px', fontWeight: 700, padding: '16px 30px', borderRadius: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>{t(theme, 'sector.band.others')}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
