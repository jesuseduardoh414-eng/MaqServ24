import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ESTADOS_COBERTURA, MUNICIPIOS_NORTE } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import { categoryHref } from '@/lib/category-link';
import { LANDINGS, landingPorRuta, type Landing } from '@/lib/landings';
import { paginaSeo, migas, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

/**
 * Estilos propios de la landing (prefijo `ls-`). Lo común —contenedor,
 * encabezado, títulos, tarjetas, botones— sale del sistema `ms-*`
 * (EstilosSistema.tsx, 2026-09-30).
 */
const CSS = `
.ls-hero{ display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr); gap:40px; align-items:center; }
.ls-hero-solo{ grid-template-columns:minmax(0,1fr); }
.ls-media{ position:relative; aspect-ratio:4/3; border-radius:14px; background:var(--color-surface); border:1px solid var(--color-border); overflow:hidden; }
.ls-body{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:48px; align-items:start; }
.ls-p{ margin:0 0 20px; font-size:16.5px; line-height:1.7; color:var(--color-text-muted); max-width:68ch; }
.ls-list{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap:10px; }
.ls-list li{ display:flex; align-items:center; gap:12px; padding:14px 16px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; font-size:15px; font-weight:600; min-width:0; }
.ls-list .ms-ico{ width:30px; height:30px; border-radius:8px; }
.ls-zonas{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap:12px; }
.ls-faq{ display:grid; gap:10px; }
.ls-faq details{ background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; overflow:hidden; }
.ls-faq summary{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 22px; cursor:pointer; font-weight:600; font-size:15.5px; }
.ls-faq summary:focus-visible{ outline:2px solid var(--color-primary); outline-offset:-2px; }
.ls-faq details p{ margin:0; padding:0 22px 20px; font-size:15px; line-height:1.7; color:var(--color-text-muted); }
.ls-aside{ position:sticky; top:100px; display:grid; gap:10px; }
.ls-otras{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap:10px; }
.ls-otras .ms-row{ font-weight:600; font-size:15px; }
@media (max-width: 900px){
  .ls-hero, .ls-body{ grid-template-columns:minmax(0,1fr); gap:28px; }
  .ls-aside{ position:static; }
  .ls-media{ max-width:440px; width:100%; aspect-ratio:16/10; }
}
`;

/** Municipios por estado, sin el sufijo ", Coah." / ", Chih." (solo desambigua en el cotizador). */
function municipiosDe(estado: string): string[] {
  const sufijo = estado === 'Coahuila' ? ', Coah.' : estado === 'Chihuahua' ? ', Chih.' : null;
  return MUNICIPIOS_NORTE.filter((m) => (sufijo ? m.endsWith(sufijo) : !/, (Coah|Chih)\.$/.test(m)))
    .map((m) => (sufijo ? m.slice(0, -sufijo.length) : m))
    .slice(0, 12);
}

export async function landingMetadata(ruta: string): Promise<Metadata> {
  const l = landingPorRuta(ruta);
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: l.ruta, titulo: t(theme, `seo.landing.${l.clave}.title`), descripcion: t(theme, `seo.landing.${l.clave}.description`) });
}

function datosEstructurados(l: Landing, sitio: string, descripcion: string, inicio: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: l.nombre,
      serviceType: l.eyebrow,
      description: descripcion,
      url: `${SITE_URL}${l.ruta}`,
      provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: sitio, url: SITE_URL },
      areaServed: ESTADOS_COBERTURA.map((e) => ({ '@type': 'State', name: e, containedInPlace: { '@type': 'Country', name: 'México' } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: l.faqs.map((f) => ({ '@type': 'Question', name: f.pregunta, acceptedAnswer: { '@type': 'Answer', text: f.respuesta } })),
    },
    migas([{ nombre: inicio, ruta: '/' }, { nombre: l.nombre }]),
  ];
}

/**
 * Página de aterrizaje de una línea de servicio (ver lib/landings.ts).
 * Los botones llevan `data-evento` + `data-etiqueta` = ruta: en GA4 llegan como
 * `landing_cotizar` / `landing_catalogo` con la página de origen.
 */
export async function LandingServicio({ ruta }: { ruta: string }) {
  const l = landingPorRuta(ruta);
  const [theme, categorias] = await Promise.all([getTheme(), getCategories().catch(() => [])]);
  const categoria = categorias.find((c) => c.slug === l.categoria);
  const sitio = t(theme, 'site.name');
  const descripcion = t(theme, `seo.landing.${l.clave}.description`);
  // Solo si la categoría tiene equipos publicados; si no, "Ver catálogo" llevaría al formulario otra vez.
  const catalogo = categoria && categoria.productCount > 0 ? categoryHref(categoria) : null;
  const otras = LANDINGS.filter((x) => x.ruta !== l.ruta);

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={datosEstructurados(l, sitio, descripcion, t(theme, 'nav.home'))} />
      <style>{CSS}</style>
      <div className="ms-page">
        <main className="ms-wrap">
          {/* ===== ENCABEZADO ===== */}
          <header className={`ms-hero ls-hero${categoria?.image ? '' : ' ls-hero-solo'}`} style={{ paddingTop: 16 }}>
            <div style={{ minWidth: 0 }}>
              <p className="ms-kicker">{l.eyebrow}</p>
              <h1 className="ms-hero-title">{l.h1}</h1>
              <p className="ms-hero-desc">{l.intro[0]}</p>
              <div className="ms-hero-acts">
                <Link href={l.cotizar.href} data-evento="landing_cotizar" data-etiqueta={l.ruta} className="ms-btn ms-btn-lg">
                  {l.cotizar.texto}<Icon name="arrowRight" size={16} />
                </Link>
                {catalogo ? (
                  <Link href={catalogo} data-evento="landing_catalogo" data-etiqueta={l.ruta} className="ms-btn ms-btn-lg ms-btn-sec">
                    Ver equipos disponibles
                  </Link>
                ) : null}
              </div>
            </div>
            {categoria?.image ? (
              <div className="ls-media">
                <Image src={categoria.image} alt={l.nombre} fill priority sizes="(max-width:900px) 100vw, 440px" style={{ objectFit: 'contain', padding: 24 }} />
              </div>
            ) : null}
          </header>

          {/* ===== CONTENIDO + CTA ===== */}
          <div className="ls-body">
            <div style={{ minWidth: 0 }}>
              {l.intro.slice(1).map((p) => (
                <p key={p} className="ls-p">{p}</p>
              ))}

              <section className="ms-section" style={{ marginTop: l.intro.length > 1 ? 32 : 0 }}>
                <div className="ms-sec-head"><h2 className="ms-h2">{l.incluye.titulo}</h2></div>
                <ul className="ls-list">
                  {l.incluye.items.map((item) => (
                    <li key={item}>
                      <span className="ms-ico" aria-hidden><Icon name="check" size={15} /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="ms-section">
                <div className="ms-sec-head"><h2 className="ms-h2">Para qué tipo de obra</h2></div>
                <p className="ls-p" style={{ margin: 0 }}>{l.usos.join(' · ')}</p>
              </section>

              <section className="ms-section">
                <div className="ms-sec-head"><h2 className="ms-h2">Zonas de servicio</h2></div>
                <div className="ls-zonas">
                  {ESTADOS_COBERTURA.map((estado) => (
                    <div key={estado} className="ms-panel" style={{ padding: 18 }}>
                      <h3 className="ms-h3" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Icon name="mapPin" size={16} style={{ color: 'var(--color-primary)' }} />{estado}
                      </h3>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-muted)' }}>{municipiosDe(estado).join(', ')} y más.</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ms-section">
                <div className="ms-sec-head"><h2 className="ms-h2">Preguntas frecuentes</h2></div>
                <div className="ls-faq">
                  {l.faqs.map((f) => (
                    <details key={f.pregunta} name="landing-faq" className="faq">
                      <summary>
                        {f.pregunta}
                        <span className="faq-plus" aria-hidden style={{ flexShrink: 0, fontSize: 22, lineHeight: 1, color: 'var(--color-primary)' }}>+</span>
                      </summary>
                      <p>{f.respuesta}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>

            <aside className="ls-aside">
              <div className="ms-panel ms-panel-lg">
                <h2 className="ms-h2" style={{ marginBottom: 8 }}>¿Listo para cotizar?</h2>
                <p style={{ margin: '0 0 20px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                  Te respondemos con la propuesta y MAQSER24 coordina al proveedor hasta que termina el servicio.
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Link href={l.cotizar.href} data-evento="landing_cotizar" data-etiqueta={l.ruta} className="ms-btn ms-btn-block">
                    {l.cotizar.texto}
                  </Link>
                  <Link href="/contacto" data-evento="landing_contacto" data-etiqueta={l.ruta} className="ms-btn ms-btn-sec ms-btn-block">
                    Hablar con un asesor
                  </Link>
                </div>
              </div>
            </aside>
          </div>

          {/* ===== OTROS SERVICIOS (enlazado interno) ===== */}
          <section className="ms-section" style={{ marginTop: 64 }}>
            <div className="ms-sec-head"><h2 className="ms-h2">Otros servicios</h2></div>
            <div className="ls-otras">
              {otras.map((o) => (
                <Link key={o.ruta} href={o.ruta} className="ms-row">
                  <span style={{ minWidth: 0 }}>{o.nombre}</span>
                  <Icon name="arrowRight" size={15} />
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
