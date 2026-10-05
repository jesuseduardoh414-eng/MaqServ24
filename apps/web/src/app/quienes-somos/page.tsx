import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import Link from 'next/link';
import Image from 'next/image';
import { defaultTheme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getWhyChooseUs } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { CountUp } from '@/components/CountUp';
import { Icon, type IconName } from '@/components/Icon';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

interface InfSitio {
  frase: string | null; titulo: string | null; descripcion: string | null;
  mision: string | null; vision: string | null; objetivos: string | null; imagenes: string[];
}

async function getInfSitio(): Promise<InfSitio | null> {
  return fetch(`${API_URL}/content/inf-sitio`, { next: { revalidate: 60 } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/quienes-somos', titulo: t(theme, 'seo.about.title'), descripcion: t(theme, 'seo.about.description') });
}

/** Iconos por defecto para las razones (se rota la lista). Del set de `Icon`. */
const FEATURE_ICONS: IconName[] = ['shield', 'truck', 'chat', 'users', 'calculator', 'specs'];

/**
 * Estilos propios de la página (prefijo `qs2-`). Lo común —contenedor,
 * encabezado, títulos, tarjetas, botones, cifras— sale del sistema `ms-*`
 * (EstilosSistema.tsx, 2026-09-30). Las clases `qs-lead`/`qs-body` (párrafos
 * del HTML del panel) siguen viniendo de globals.css.
 */
const CSS = `
.qs2-hero{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:48px; align-items:center; }
.qs2-lead{ margin:14px 0 0; font-size:16.5px; line-height:1.6; color:var(--color-text-muted); max-width:60ch; }
.qs2-media{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); grid-template-rows:180px 180px; gap:12px; }
.qs2-media > div{ position:relative; overflow:hidden; border-radius:12px; background:var(--color-surface); border:1px solid var(--color-border); }
.qs2-media .qs2-tall{ grid-row:span 2; }
.qs2-dato{ display:flex; flex-direction:column; justify-content:center; padding:20px; }
.qs2-center{ text-align:center; display:grid; justify-items:center; }
.qs2-center .ms-h2-desc{ margin-left:auto; margin-right:auto; }
.qs2-fit{ grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
.qs2-values{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap:12px; }
.qs2-value{ display:flex; align-items:center; gap:14px; padding:18px; }
.qs2-tl{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap:12px; }
.qs2-year{ font-family:var(--font-display); font-size:22px; font-weight:700; letter-spacing:-.02em; color:var(--color-primary); font-variant-numeric:tabular-nums; }
.qs2-brands{ overflow:hidden; -webkit-mask-image:linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image:linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
.qs2-brand{ flex:0 0 auto; font-family:var(--font-display); font-size:22px; font-weight:700; letter-spacing:-.01em; color:color-mix(in srgb, var(--color-text-muted) 75%, transparent); }
.qs2-cta{ display:flex; align-items:center; justify-content:space-between; gap:24px 40px; flex-wrap:wrap; background:var(--band); }
.qs2-cta .ms-h2{ color:#fff; font-size:26px; }
@media (max-width: 900px){
  .qs2-hero{ grid-template-columns:minmax(0,1fr); gap:32px; }
}
@media (max-width: 640px){
  .qs2-media{ grid-template-rows:140px 140px; }
}
`;

export default async function AboutPage() {
  const [theme, info, allReasons] = await Promise.all([getTheme(), getInfSitio(), getWhyChooseUs().catch(() => [])]);
  // Solo las razones marcadas para esta página (o ambas); las de 'home' se omiten.
  const reasons = allReasons.filter((r) => r.placement !== 'home');
  // Fallback defensivo: si la API aún sirve un tema sin el token nuevo, usa los defaults.
  const qs = theme.tokens.quienesSomos ?? defaultTheme.tokens.quienesSomos;
  // Misma lista que la banda del home: antes esta página tenía la suya y decían
  // marcas distintas.
  const brands = theme.tokens.brands ?? defaultTheme.tokens.brands;

  const heroTitle = info?.titulo || 'Quiénes somos';
  const imgs = info?.imagenes ?? [];
  const purpose: Array<{ title: string; html: string | null | undefined; icon: IconName }> = [
    { title: 'Misión', html: info?.mision, icon: 'diamond' },
    { title: 'Visión', html: info?.vision, icon: 'search' },
    { title: 'Objetivos', html: info?.objetivos, icon: 'star' },
  ];
  const purposeOk = purpose.filter((p) => p.html);

  return (
    <>
      <SiteHeader theme={theme} />
      <style>{CSS}</style>
      <div className="ms-page">
        <main className="ms-wrap">
          {/* ===== ENCABEZADO ===== */}
          <header className="ms-hero qs2-hero" style={{ paddingTop: 16 }}>
            <div style={{ minWidth: 0 }}>
              <p className="ms-kicker">{info?.frase || 'Quiénes somos'}</p>
              <h1 className="ms-hero-title">{heroTitle}</h1>
              {info?.descripcion ? (
                <div className="qs-lead qs2-lead" dangerouslySetInnerHTML={{ __html: info.descripcion }} />
              ) : null}
              <div className="ms-hero-acts">
                <Link href={qs.heroCtaLink} className="ms-btn ms-btn-lg">{qs.heroCta}</Link>
                <Link href={qs.heroCta2Link} className="ms-btn ms-btn-lg ms-btn-sec">{qs.heroCta2}</Link>
              </div>
            </div>
            {/* Mosaico de imágenes */}
            <div className="qs2-media">
              <div className="qs2-tall">
                {imgs[0] ? <Image src={imgs[0]} alt="" fill sizes="(max-width:900px) 50vw, 30vw" style={{ objectFit: 'cover' }} /> : <span className="ph" style={{ position: 'absolute', inset: 0 }} />}
              </div>
              <div>
                {imgs[1] ? <Image src={imgs[1]} alt="" fill sizes="(max-width:900px) 50vw, 30vw" style={{ objectFit: 'cover' }} /> : <span className="ph" style={{ position: 'absolute', inset: 0 }} />}
              </div>
              {/* Decía '24/7 · Soporte y disponibilidad', escrito fijo en la página.
                  Es el ejemplo que el manual pone como prohibido mientras la red no
                  pueda garantizarlo. Se cambia por las líneas de servicio, que sí
                  son un hecho de la arquitectura de marca. Cinco desde el 2026-09-21
                  (renta de maquinaria pesada, transporte y servicios de obra,
                  triturados, materiales para construcción y soluciones asfálticas). */}
              <div className="qs2-dato">
                <span className="ms-stat-n" style={{ color: 'var(--color-primary)' }}>5</span>
                <span className="ms-stat-l">Categorías de servicio</span>
              </div>
            </div>
          </header>

          {/* ===== CIFRAS ===== */}
          {qs.stats.length > 0 ? (
            <section className="ms-section" aria-label="Cifras">
              <div className="ms-stats">
                {qs.stats.map((s, i) => (
                  <div key={i} className="ms-panel">
                    <span className="ms-stat-n" style={{ color: 'var(--color-primary)' }}><CountUp value={s.num} /></span>
                    <span className="ms-stat-l">{s.label}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ===== PROPÓSITO (misión/visión/objetivos) ===== */}
          {purposeOk.length > 0 ? (
            <section className="ms-section" style={{ marginTop: 64 }}>
              <div className="ms-sec-head">
                <div>
                  <p className="ms-kicker">{qs.propositoEyebrow}</p>
                  <h2 className="ms-h2">{qs.propositoTitle}</h2>
                </div>
              </div>
              <div className="ms-cards qs2-fit">
                {purposeOk.map((p) => (
                  <article key={p.title} className="ms-panel">
                    <span className="ms-ico ms-ico-lg" aria-hidden><Icon name={p.icon} size={20} /></span>
                    <h3 className="ms-h3" style={{ fontSize: 18, margin: '16px 0 8px' }}>{p.title}</h3>
                    <div className="qs-body" style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--color-text-muted)' }} dangerouslySetInnerHTML={{ __html: p.html as string }} />
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* ===== VALORES ===== */}
          {qs.values.length > 0 ? (
            <section className="ms-section" aria-label="Valores">
              <div className="qs2-values">
                {qs.values.map((v, i) => (
                  <div key={i} className="ms-panel qs2-value">
                    <span className="ms-ico" aria-hidden><Icon name="check" size={18} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 600 }}>{v.title}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ===== TRAYECTORIA ===== */}
          {qs.timeline.length > 0 ? (
            <section className="ms-section" style={{ marginTop: 64 }}>
              <div className="ms-sec-head">
                <div>
                  <p className="ms-kicker">{qs.timelineEyebrow}</p>
                  <h2 className="ms-h2">{qs.timelineTitle}</h2>
                </div>
              </div>
              <ol className="qs2-tl">
                {qs.timeline.map((m, i) => (
                  <li key={i} className="ms-panel">
                    <div className="qs2-year">{m.year}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, margin: '6px 0 4px' }}>{m.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{m.desc}</div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* ===== POR QUÉ ELEGIRNOS (razones) ===== */}
          {reasons.length > 0 ? (
            <section className="ms-section" style={{ marginTop: 64 }}>
              <div className="ms-sec-head">
                <div>
                  <p className="ms-kicker">{qs.ventajasEyebrow}</p>
                  <h2 className="ms-h2">{qs.ventajasTitle}</h2>
                </div>
              </div>
              <div className="ms-cards">
                {reasons.map((f, i) => (
                  <article key={f.id} className="ms-panel">
                    <span className="ms-ico" aria-hidden><Icon name={FEATURE_ICONS[i % FEATURE_ICONS.length]} size={18} /></span>
                    <h3 className="ms-h3" style={{ fontSize: 17, margin: '14px 0 6px' }}>{f.title}</h3>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{f.description}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* ===== MARCAS ===== */}
          {brands.list.length > 0 ? (
            <section className="ms-section" style={{ marginTop: 64, borderTop: '1px solid var(--color-border)', paddingTop: 40 }}>
              <p className="ms-muted" style={{ margin: '0 0 24px', fontSize: 14, fontWeight: 500, textAlign: 'center' }}>{brands.eyebrow}</p>
              {/*
                UNA SOLA FILA, EN MOVIMIENTO. La lista va DUPLICADA a propósito:
                la animación desplaza el carril un 50 % exacto y el bucle no tiene
                costura. `marquee-track` (globals.css) pausa al pasar el cursor y
                se apaga con `prefers-reduced-motion`.
              */}
              <div className="marquee-mask qs2-brands">
                <div className="marquee-track" style={{ display: 'flex', alignItems: 'center', gap: 56, whiteSpace: 'nowrap' }}>
                  {[...brands.list, ...brands.list].map((b, i) => (
                    // La segunda copia se oculta a los lectores de pantalla.
                    <span key={i} aria-hidden={i >= brands.list.length} className="qs2-brand">{b}</span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* ===== CTA ===== */}
          <section className="ms-section" style={{ marginTop: 64 }}>
            <div className="ms-panel ms-panel-lg qs2-cta">
              <div style={{ maxWidth: 620, minWidth: 0 }}>
                <h2 className="ms-h2">{qs.ctaTitle}</h2>
                {qs.ctaSubtitle ? <p style={{ margin: '8px 0 0', fontSize: 15.5, lineHeight: 1.6, color: 'rgba(255,255,255,.78)' }}>{qs.ctaSubtitle}</p> : null}
              </div>
              <div className="ms-hero-acts" style={{ marginTop: 0 }}>
                <Link href={qs.ctaPrimaryLink} className="ms-btn ms-btn-lg">{qs.ctaPrimary}</Link>
                <Link href={qs.ctaSecondaryLink} className="ms-btn ms-btn-lg ms-btn-sec" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>{qs.ctaSecondary}</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
