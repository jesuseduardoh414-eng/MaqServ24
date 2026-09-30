import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ESTADOS_OPERACION, MUNICIPIOS_NORTE } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import { categoryHref } from '@/lib/category-link';
import { LANDINGS, landingPorRuta, type Landing } from '@/lib/landings';
import { paginaSeo, migas, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };
// Sobre la banda oscura el acento va aclarado (mismo criterio que /sectores).
const GOLD = 'color-mix(in srgb, var(--color-primary) 65%, #fff)';
const H2: React.CSSProperties = { fontFamily: 'var(--font-display)', margin: '0 0 20px', fontSize: 'clamp(22px, 3.2vw, 28px)', letterSpacing: '-0.03em', textTransform: 'uppercase', color: 'var(--color-text)' };

/** Municipios por estado, sin el sufijo ", Coah." / ", Chih." (solo desambigua en el cotizador). */
function municipiosDe(estado: (typeof ESTADOS_OPERACION)[number]): string[] {
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
      areaServed: ESTADOS_OPERACION.map((e) => ({ '@type': 'State', name: e, containedInPlace: { '@type': 'Country', name: 'México' } })),
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
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        {/* ===== HERO ===== */}
        <section style={{ background: 'var(--band)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ ...CONTAINER, paddingTop: 56, paddingBottom: 52, display: 'grid', gridTemplateColumns: categoria?.image ? 'minmax(0,1.2fr) minmax(0,.8fr)' : '1fr', gap: 40, alignItems: 'center' }} className="sector-grid">
            <div>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: GOLD, marginBottom: 14 }}>{l.eyebrow}</span>
              <h1 style={{ fontFamily: 'var(--font-display)', margin: 0, color: '#fff', fontSize: 'clamp(30px, 5.2vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.04em', textTransform: 'uppercase', maxWidth: '20ch' }}>{l.h1}</h1>
              <p style={{ color: 'rgba(255,255,255,.78)', margin: '18px 0 0', fontSize: 16.5, maxWidth: '60ch', lineHeight: 1.65, fontWeight: 300 }}>{l.intro[0]}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
                <Link href={l.cotizar.href} data-evento="landing_cotizar" data-etiqueta={l.ruta} style={botonPrimario}>
                  {l.cotizar.texto}<Icon name="arrowRight" size={16} />
                </Link>
                {catalogo ? (
                  <Link href={catalogo} data-evento="landing_catalogo" data-etiqueta={l.ruta} style={botonSecundario}>
                    Ver equipos disponibles
                  </Link>
                ) : null}
              </div>
            </div>
            {categoria?.image ? (
              <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                <Image src={categoria.image} alt={l.nombre} fill priority sizes="(max-width:980px) 100vw, 480px" style={{ objectFit: 'contain', padding: 24 }} />
              </div>
            ) : null}
          </div>
        </section>

        {/* ===== CONTENIDO + CTA ===== */}
        <section style={{ ...CONTAINER, paddingTop: 56, paddingBottom: 40, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48, alignItems: 'start' }} className="sector-grid">
          <div style={{ minWidth: 0 }}>
            {l.intro.slice(1).map((p) => (
              <p key={p} style={{ margin: '0 0 28px', fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{p}</p>
            ))}

            <h2 style={H2}>{l.incluye.titulo}</h2>
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, listStyle: 'none', margin: '0 0 40px', padding: 0 }}>
              {l.incluye.items.map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 600 }}>
                  <span aria-hidden style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <h2 style={H2}>Para qué tipo de obra</h2>
            <p style={{ margin: '0 0 40px', fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{l.usos.join(' · ')}</p>

            <h2 style={H2}>Zonas de servicio</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 40 }}>
              {ESTADOS_OPERACION.map((estado) => (
                <div key={estado} style={{ borderTop: '2px solid var(--color-primary)', paddingTop: 14 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>{estado}</h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-muted)' }}>{municipiosDe(estado).join(', ')} y más.</p>
                </div>
              ))}
            </div>

            <h2 style={H2}>Preguntas frecuentes</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {l.faqs.map((f) => (
                <details key={f.pregunta} name="landing-faq" className="faq" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', cursor: 'pointer', fontWeight: 700, fontSize: 15.5 }}>
                    {f.pregunta}
                    <span className="faq-plus" aria-hidden style={{ flexShrink: 0, fontSize: 22, lineHeight: 1, color: 'var(--color-primary)' }}>+</span>
                  </summary>
                  <p style={{ margin: 0, padding: '0 22px 20px', fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{f.respuesta}</p>
                </details>
              ))}
            </div>
          </div>

          <aside style={{ position: 'sticky', top: 100, background: 'var(--band)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '30px 26px', color: '#fff' }} className="sector-cta">
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800 }}>¿Listo para cotizar?</h2>
            <p style={{ margin: '0 0 22px', fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,.78)' }}>
              Te respondemos con la propuesta y MAQSER24 coordina al proveedor hasta que termina el servicio.
            </p>
            <Link href={l.cotizar.href} data-evento="landing_cotizar" data-etiqueta={l.ruta} style={{ ...botonPrimario, display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              {l.cotizar.texto}
            </Link>
            <Link href="/contacto" data-evento="landing_contacto" data-etiqueta={l.ruta} style={{ ...botonSecundario, display: 'flex', justifyContent: 'center' }}>
              Hablar con un asesor
            </Link>
          </aside>
        </section>

        {/* ===== OTROS SERVICIOS (enlazado interno) ===== */}
        <section style={{ ...CONTAINER, paddingTop: 12, paddingBottom: 72 }}>
          <h2 style={H2}>Otros servicios</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {otras.map((o) => (
              <Link key={o.ruta} href={o.ruta} className="lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'var(--color-text)', fontWeight: 700, fontSize: 15 }}>
                {o.nombre}
                <Icon name="arrowRight" size={15} />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}

const botonPrimario = {
  display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 24px',
  borderRadius: 'var(--radius-button)', background: 'var(--color-primary)',
  color: 'var(--color-primary-fg)', fontWeight: 700, textDecoration: 'none', fontSize: 15,
} as const;

const botonSecundario = {
  display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 24px',
  borderRadius: 'var(--radius-button)', background: 'transparent', border: '1px solid rgba(255,255,255,.3)',
  color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15,
} as const;
