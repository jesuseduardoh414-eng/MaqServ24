import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseProductSlug } from '@maqserv/config';
import type { StrategicSectorDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getSector, rutaCatalogo } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

type Params = { slug: string };

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
  return paginaSeo(theme, {
    ruta: `/sectores/${sector.slug}`,
    // "Maquinaria y servicios para Infraestructura": el nombre solo quedaba en 26 caracteres.
    titulo: t(theme, 'seo.sector.title').replace('{sector}', sector.title),
    descripcion: sector.description ? strip(sector.description).slice(0, 160) : undefined,
    imagen: sector.image,
  });
}

/** Bloque de texto largo del sector (legacy: HTML libre). Solo se muestra si hay contenido. */
function Block({ title, html }: { title: string; html: string | null }) {
  if (!html || !strip(html)) return null;
  return (
    <section className="ms-section" style={{ marginTop: 36 }}>
      <h2 className="ms-h2" style={{ marginBottom: 12 }}>{title}</h2>
      <div className="sector-rich sc-rich" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

/**
 * Estilos propios de la página (prefijo `sc-`). Lo común —contenedor,
 * títulos, tarjetas, botones— sale del sistema `ms-*` (EstilosSistema.tsx).
 * `.sector-rich` (párrafos del HTML del panel) sigue en globals.css.
 */
const CSS = `
.sc-hero{ position:relative; min-height:420px; background:var(--band); overflow:hidden; border-bottom:1px solid var(--color-border); }
.sc-hero-in{ position:relative; max-width:1180px; margin:0 auto; min-height:420px; padding:40px 32px 44px; display:flex; flex-direction:column; justify-content:flex-end; }
.sc-hero .ms-hero-title{ color:#fff; text-shadow:0 2px 24px rgba(0,0,0,.35); }
.sc-hero .ms-hero-desc{ color:rgba(255,255,255,.9); text-shadow:0 1px 14px rgba(0,0,0,.55); }
.sc-hero .ms-kicker{ color:color-mix(in srgb, var(--color-primary) 65%, #fff); }
.sc-body{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:48px; align-items:start; }
.sc-rich{ font-size:16px; line-height:1.7; color:var(--color-text-muted); }
.sc-lead{ font-size:16.5px; }
.sc-list{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap:10px; }
.sc-list > div{ display:flex; align-items:center; gap:12px; padding:14px 16px; }
.sc-list .ms-ico{ width:30px; height:30px; border-radius:8px; }
.sc-aside{ position:sticky; top:100px; }
.sc-cta{ display:flex; align-items:center; justify-content:space-between; gap:24px 40px; flex-wrap:wrap; background:var(--band); }
.sc-cta .ms-h2{ color:#fff; font-size:26px; }
@media (max-width: 900px){
  .sc-body{ grid-template-columns:minmax(0,1fr); gap:32px; }
  .sc-aside{ position:static; }
}
@media (max-width: 640px){
  .sc-hero, .sc-hero-in{ min-height:340px; }
  .sc-hero-in{ padding:32px 16px 32px; }
}
`;

export default async function SectorPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [theme, sector, catalogo] = await Promise.all([getTheme(), fetchBySlug(slug), rutaCatalogo()]);
  if (!sector) notFound();

  const teaser = sector.description ? strip(sector.description).slice(0, 170) : '';

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: sector.title }])} />
      <style>{CSS}</style>
      <div className="ms-page">
        {/* ===== ENCABEZADO (foto a sangre + degradado) ===== */}
        <section className="sc-hero">
          {sector.image ? (
            <Image src={sector.image} alt={sector.title} fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          ) : (
            <span className="ph" aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
          )}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,14,20,.06) 0%, rgba(10,14,20,.2) 44%, rgba(10,14,20,.66) 78%, rgba(10,14,20,.88) 100%)' }} />
          <div className="sc-hero-in">
            <h1 className="ms-hero-title">{sector.title}</h1>
            {teaser ? <p className="ms-hero-desc">{teaser}</p> : null}
          </div>
        </section>

        <main className="ms-wrap">
          {/* ===== CONTENIDO + TARJETA DE COTIZACIÓN (solo datos de BD) ===== */}
          <div className="sc-body">
            <div style={{ minWidth: 0 }}>
              <p className="ms-kicker">{t(theme, 'sector.about')}</p>
              {sector.description ? (
                <div className="sector-rich sc-rich sc-lead" dangerouslySetInnerHTML={{ __html: sector.description }} />
              ) : null}

              <Block title="Trayectoria" html={sector.trayectoria} />
              <Block title="Esencia" html={sector.esencia} />
              <Block title="Servicios" html={sector.servicios} />
              <Block title="Excelencia" html={sector.excelencia} />

              {sector.serviciosLista.length > 0 ? (
                <section className="ms-section" style={{ marginTop: 36 }}>
                  <div className="ms-sec-head"><h2 className="ms-h2">{t(theme, 'sector.services.title')}</h2></div>
                  <div className="sc-list">
                    {sector.serviciosLista.map((item) => (
                      <div key={item} className="ms-panel">
                        <span className="ms-ico" aria-hidden><Icon name="check" size={15} /></span>
                        <span style={{ fontSize: '15px', fontWeight: 600, minWidth: 0 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="sc-aside">
              <div className="ms-panel ms-panel-lg">
                <h2 className="ms-h2" style={{ marginBottom: 8 }}>{t(theme, 'sector.cta.title')}</h2>
                <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{t(theme, 'sector.cta.body')}</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Link href="/contacto" className="ms-btn ms-btn-block">{t(theme, 'sector.cta.quote')}</Link>
                  <Link href={catalogo} className="ms-btn ms-btn-sec ms-btn-block">{t(theme, 'sector.cta.catalog')}</Link>
                </div>
              </div>
            </aside>
          </div>

          {/* ===== CTA FINAL ===== */}
          <section className="ms-section" style={{ marginTop: 64 }}>
            <div className="ms-panel ms-panel-lg sc-cta">
              <div style={{ maxWidth: 600, minWidth: 0 }}>
                <h2 className="ms-h2">{t(theme, 'sector.band.title')}</h2>
                <p style={{ margin: '8px 0 0', fontSize: '15.5px', lineHeight: 1.6, color: 'rgba(255,255,255,.78)' }}>{t(theme, 'sector.band.body')}</p>
              </div>
              <div className="ms-hero-acts" style={{ marginTop: 0 }}>
                <Link href="/contacto" className="ms-btn ms-btn-lg">{t(theme, 'sector.cta.quote')}</Link>
                <Link href="/" className="ms-btn ms-btn-lg ms-btn-sec" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>{t(theme, 'sector.band.others')}</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
