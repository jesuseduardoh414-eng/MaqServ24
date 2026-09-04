import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { defaultTheme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getWhyChooseUs } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { CountUp } from '@/components/CountUp';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };

// Eyebrow dorado (oscurece el primario para leerse sobre fondo claro, sin salir del token).
// Acento ACLARADO: la página vive sobre la banda oscura y el mix con #000
// (pensado para fondos claros) daba ~3.9:1 en 13px — reprobaba AA.
const GOLD = 'color-mix(in srgb, var(--color-primary) 65%, #fff)';
const INK = 'var(--band)'; // fondo de las bandas oscuras (negro en modo oscuro)
const CHIP = 'var(--color-secondary)'; // gunmetal: SOLO piezas pequeñas sobre fondo claro

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
  const [theme, info] = await Promise.all([getTheme(), getInfSitio()]);
  return {
    title: `${info?.titulo ?? t(theme, 'nav.about')} — ${t(theme, 'site.name')}`,
    description: info?.frase ?? undefined,
  };
}

const Eyebrow = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: GOLD, textAlign: center ? 'center' : 'left' }}>{children}</p>
);
const H2: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--color-text)' };

/** Íconos por defecto para las razones (se rota la lista). */
const FEATURE_ICONS = [
  '<path d="M9 12l2 2 4-4"></path><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"></path>',
  '<rect x="1" y="6" width="13" height="10" rx="1"></rect><path d="M14 9h4l3 3v4h-7z"></path><circle cx="6" cy="18" r="1.6"></circle><circle cx="17" cy="18" r="1.6"></circle>',
  '<path d="M4 12a8 8 0 0 1 16 0"></path><rect x="2" y="12" width="4" height="7" rx="1.5"></rect><rect x="18" y="12" width="4" height="7" rx="1.5"></rect>',
  '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>',
  '<path d="M12 1v22"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
  '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.7-.7-.7-2.7z"></path>',
];
const svg = (paths: string, stroke = 'var(--color-primary)') =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const PURPOSE_ICONS = [
  '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle><circle cx="12" cy="12" r="0.6" fill="var(--color-primary)"></circle>', // misión (target)
  '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle>', // visión (ojo)
  '<polygon points="12 2 15.1 8.6 22 9.3 16.8 14.1 18.2 21 12 17.5 5.8 21 7.2 14.1 2 9.3 8.9 8.6"></polygon>', // objetivos (estrella)
];

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
  const purpose = [
    { title: 'Misión', html: info?.mision, icon: PURPOSE_ICONS[0] },
    { title: 'Visión', html: info?.vision, icon: PURPOSE_ICONS[1] },
    { title: 'Objetivos', html: info?.objetivos, icon: PURPOSE_ICONS[2] },
  ].filter((p) => p.html);

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)' }}>
        {/* ===== HERO ===== */}
        <section style={{ ...CONTAINER, paddingTop: 64, paddingBottom: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="qs-hero">
          <div>
            <Eyebrow>{info?.frase || 'Quiénes somos'}</Eyebrow>
            <h1 style={{ margin: '0 0 22px', fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', lineHeight: 1.03, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{heroTitle}</h1>
            {info?.descripcion ? (
              <div className="qs-lead" style={{ fontSize: '17px', lineHeight: 1.65, color: 'var(--color-text-muted)', marginBottom: 32 }} dangerouslySetInnerHTML={{ __html: info.descripcion }} />
            ) : null}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href={qs.heroCtaLink} style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)', fontSize: 15, fontWeight: 700, padding: '14px 26px', borderRadius: 'var(--radius-md)', textDecoration: 'none', boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>{qs.heroCta}</Link>
              <Link href={qs.heroCta2Link} style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 15, fontWeight: 700, padding: '14px 26px', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>{qs.heroCta2}</Link>
            </div>
          </div>
          {/* mosaico de imágenes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '180px 180px', gap: 16 }} className="qs-hero-media">
            <div style={{ gridRow: 'span 2', borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative', background: 'var(--surface-2)' }}>
              {imgs[0] ? <Image src={imgs[0]} alt="" fill sizes="30vw" style={{ objectFit: 'cover' }} /> : <span className="ph" style={{ position: 'absolute', inset: 0 }} />}
            </div>
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative', background: 'var(--surface-2)' }}>
              {imgs[1] ? <Image src={imgs[1]} alt="" fill sizes="30vw" style={{ objectFit: 'cover' }} /> : <span className="ph" style={{ position: 'absolute', inset: 0 }} />}
            </div>
            <div style={{ borderRadius: 'var(--radius-lg)', background: INK, border: '1px solid var(--color-border)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 22 }}>
              {/* Decia '24/7 · Soporte y disponibilidad', escrito fijo en la pagina.
                  Es el ejemplo que el manual pone como prohibido mientras la red no
                  pueda garantizarlo. Se cambia por las seis lineas de servicio, que si
                  son un hecho de la arquitectura de marca. */}
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 38, fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1 }}>6</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>Categorías de servicio</span>
            </div>
          </div>
        </section>

        {/* ===== STATS ===== */}
        {qs.stats.length > 0 ? (
          <section style={{ background: INK, borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ ...CONTAINER, paddingTop: 52, paddingBottom: 52, display: 'grid', gridTemplateColumns: `repeat(${qs.stats.length}, 1fr)`, gap: 24 }} className="qs-stats">
              {qs.stats.map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '0 12px', borderRight: i < qs.stats.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                  <CountUp value={s.num} style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.4rem, 4vw, 3.25rem)', fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1, display: 'block' }} />
                  <div style={{ marginTop: 10, fontSize: 15, color: 'rgba(255,255,255,0.78)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ===== PROPÓSITO (misión/visión/objetivos) ===== */}
        {purpose.length > 0 ? (
          <section style={{ ...CONTAINER, paddingTop: 80, paddingBottom: 40 }}>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
              <Eyebrow center>{qs.propositoEyebrow}</Eyebrow>
              <h2 style={H2}>{qs.propositoTitle}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${purpose.length}, 1fr)`, gap: 24 }} className="qs-cards-3">
              {purpose.map((p) => (
                <div key={p.title} style={{ background: 'var(--surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '36px 32px' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: CHIP, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }} dangerouslySetInnerHTML={{ __html: svg(p.icon) }} />
                  <h3 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>{p.title}</h3>
                  <div className="qs-body" style={{ margin: 0, fontSize: '15.5px', lineHeight: 1.65, color: 'var(--color-text-muted)' }} dangerouslySetInnerHTML={{ __html: p.html as string }} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ===== VALORES ===== */}
        {qs.values.length > 0 ? (
          <section style={{ ...CONTAINER, paddingTop: 40, paddingBottom: 80 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(qs.values.length, 4)}, 1fr)`, gap: 16 }} className="qs-cards-4">
              {qs.values.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '22px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>{v.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{v.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ===== TRAYECTORIA (timeline) ===== */}
        {qs.timeline.length > 0 ? (
          <section style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ ...CONTAINER, paddingTop: 80, paddingBottom: 80 }}>
              <div style={{ maxWidth: 640, marginBottom: 52 }}>
                <Eyebrow>{qs.timelineEyebrow}</Eyebrow>
                <h2 style={H2}>{qs.timelineTitle}</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${qs.timeline.length}, 1fr)`, gap: 0, position: 'relative' }} className="qs-timeline">
                <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 15, height: 2, background: 'var(--color-border)' }} />
                {qs.timeline.map((m, i) => (
                  <div key={i} style={{ position: 'relative', paddingRight: 24 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: CHIP, border: '4px solid var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 900, color: GOLD, marginBottom: 6 }}>{m.year}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>{m.title}</div>
                    <div style={{ fontSize: '13.5px', lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ===== POR QUÉ ELEGIRNOS (razones) ===== */}
        {reasons.length > 0 ? (
          <section style={{ ...CONTAINER, paddingTop: 80, paddingBottom: 80 }}>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
              <Eyebrow center>{qs.ventajasEyebrow}</Eyebrow>
              <h2 style={H2}>{qs.ventajasTitle}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }} className="qs-cards-3">
              {reasons.map((f, i) => (
                <div key={f.id} className="qs-feature" style={{ padding: '30px 28px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }} dangerouslySetInnerHTML={{ __html: svg(FEATURE_ICONS[i % FEATURE_ICONS.length], GOLD) }} />
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>{f.title}</h3>
                  <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ===== MARCAS ===== */}
        {brands.list.length > 0 ? (
          <section style={{ borderTop: '1px solid var(--color-border)' }}>
            <div style={{ ...CONTAINER, paddingTop: 52, paddingBottom: 52, textAlign: 'center' }}>
              <p style={{ margin: '0 0 30px', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{brands.eyebrow}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 56, flexWrap: 'wrap' }}>
                {brands.list.map((b, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 900, letterSpacing: '.04em', color: 'color-mix(in srgb, var(--color-text-muted) 70%, transparent)' }}>{b}</span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ===== CTA ===== */}
        <section style={{ ...CONTAINER, paddingTop: 20, paddingBottom: 80 }}>
          <div style={{ background: INK, border: '1px solid var(--color-border)', borderRadius: 26, padding: '60px 56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, position: 'relative', overflow: 'hidden' }} className="qs-cta">
            <div aria-hidden style={{ position: 'absolute', right: -60, top: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 22%, transparent), transparent 70%)' }} />
            <div style={{ position: 'relative', maxWidth: 640 }}>
              <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{qs.ctaTitle}</h2>
              {qs.ctaSubtitle ? <p style={{ margin: 0, fontSize: '16.5px', lineHeight: 1.6, color: 'rgba(255,255,255,0.78)' }}>{qs.ctaSubtitle}</p> : null}
            </div>
            <div style={{ position: 'relative', display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
              <Link href={qs.ctaPrimaryLink} style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)', fontSize: 16, fontWeight: 700, padding: '16px 30px', borderRadius: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>{qs.ctaPrimary}</Link>
              <Link href={qs.ctaSecondaryLink} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 700, padding: '16px 30px', borderRadius: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>{qs.ctaSecondary}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
