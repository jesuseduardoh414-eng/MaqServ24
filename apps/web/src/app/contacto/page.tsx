import type { Metadata } from 'next';
import { defaultTheme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { ContactForm } from './ContactForm';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  const c = theme.tokens.contact ?? defaultTheme.tokens.contact;
  return { title: `${c.title} — ${t(theme, 'site.name')}` };
}

const telHref = (v: string) => `tel:${v.replace(/[^\d+]/g, '')}`;
const waHref = (v: string) => `https://wa.me/${v.replace(/\D/g, '').replace(/^0+/, '') ? `52${v.replace(/\D/g, '')}` : ''}`;

function SectionHead({ title, tag }: { title: string; tag: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--color-text)', paddingBottom: 16, marginBottom: 32 }}>
      <h2 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{title}</h2>
      <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}>{tag}</span>
    </div>
  );
}

// Tintes de las tarjetas de canal. Eran cuatro pasteles claros del diseño
// anterior; sobre el fondo oscuro de MAQSER24 se leían como parches. Ahora son
// velos del acento y del acero sobre la superficie, casi imperceptibles.
const TINTS = [
  'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))',
  'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))',
  'color-mix(in srgb, var(--color-success) 9%, var(--color-surface))',
  'color-mix(in srgb, var(--color-text) 6%, var(--color-surface))',
];

export default async function ContactPage() {
  const theme = await getTheme();
  const c = theme.tokens.contact ?? defaultTheme.tokens.contact;

  // Título: resalta la última palabra (como el diseño "Hablemos de tu obra").
  const words = c.title.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words.pop() : '';
  const head = words.join(' ');

  const channels: Array<{ label: string; value: string; href?: string }> = [
    { label: 'Teléfono', value: c.phone, href: c.phone ? telHref(c.phone) : undefined },
    { label: 'WhatsApp', value: c.whatsapp, href: c.whatsapp ? waHref(c.whatsapp) : undefined },
    { label: 'Correo', value: c.email, href: c.email ? `mailto:${c.email}` : undefined },
    { label: 'Horario', value: c.hours },
  ].filter((x) => x.value);

  return (
    <>
      <SiteHeader theme={theme} />
      <style>{`
        @media (max-width: 900px){
          .ct-hero, .ct-main, .ct-branches { grid-template-columns: 1fr !important; }
          .ct-container { padding-left: 22px !important; padding-right: 22px !important; }
          .ct-title { font-size: 52px !important; }
        }
        @media (max-width: 560px){ .ct-row { grid-template-columns: 1fr !important; } .ct-title { font-size: 40px !important; } }
      `}</style>

      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        {/* HERO */}
        <section className="ct-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 40px 48px' }}>
          <div className="ct-hero" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, alignItems: 'end', borderBottom: '1px solid var(--color-border)', paddingBottom: 44 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ width: 30, height: 4, background: 'var(--color-primary)', borderRadius: 2 }} />
                <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.24em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{c.eyebrow}</span>
              </div>
              <h1 className="ct-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 80, lineHeight: 0.9, fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--color-text)' }}>
                {head}{lastWord ? ' ' : ''}
                {lastWord ? <span style={{ background: 'linear-gradient(180deg, transparent 62%, var(--color-primary) 62%)' }}>{lastWord}</span> : null}
              </h1>
              <p style={{ margin: '26px 0 0', fontSize: 18, lineHeight: 1.55, color: 'var(--color-text-muted)', maxWidth: '48ch' }}>{c.subtitle}</p>
            </div>
            {c.stats.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 24px' }}>
                {c.stats.map((s, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--color-text)' }}>{s.value}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginTop: 8, textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* FORM + CONTACTO DIRECTO */}
        <main className="ct-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 40px 40px' }}>
          <div className="ct-main" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 72, alignItems: 'start' }}>
            <div>
              <SectionHead title="Cuéntanos qué necesitas" tag="01 / FORMULARIO" />
              <ContactForm needs={c.needs} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionHead title="Contacto directo" tag="02" />
              {channels.map((ch) => {
                const inner = (
                  <>
                    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: 'var(--color-text-muted)', width: 96, flexShrink: 0, textTransform: 'uppercase' }}>{ch.label}</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{ch.value}</span>
                  </>
                );
                const st: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16, padding: '22px 0', borderBottom: '1px solid var(--color-border)', textDecoration: 'none' };
                return ch.href
                  ? <a key={ch.label} href={ch.href} style={st}>{inner}</a>
                  : <div key={ch.label} style={st}>{inner}</div>;
              })}

              {c.urgent.show ? (
                <div style={{ marginTop: 26, background: 'var(--band)', border: '1px solid var(--color-border)', color: '#fff', borderRadius: 6, padding: 32, position: 'relative', overflow: 'hidden' }}>
                  <div aria-hidden style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'var(--color-primary)', opacity: 0.16, borderRadius: '50%' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: 'var(--color-primary)', marginBottom: 12, textTransform: 'uppercase' }}>{c.urgent.eyebrow}</div>
                    <p style={{ margin: '0 0 20px', fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{c.urgent.title}</p>
                    {c.phone ? (
                      <a href={telHref(c.phone)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, padding: '13px 24px', borderRadius: 'var(--radius-button)', textDecoration: 'none' }}>{c.urgent.ctaLabel}<Icon name="arrowRight" size={15} /></a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* SUCURSALES */}
          {c.branches.length > 0 ? (
            <div style={{ marginTop: 96 }}>
              <SectionHead title="Nuestras sucursales" tag="03 / COBERTURA" />
              <div className="ct-branches" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
                {c.branches.map((b, i) => (
                  <div key={i} style={{ background: 'var(--color-bg)' }}>
                    {b.image ? (
                      <div style={{ height: 150, overflow: 'hidden' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.image} alt={b.city} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ height: 150, background: TINTS[i % TINTS.length], backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, rgba(0,0,0,0) 1px 22px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0 1px, rgba(0,0,0,0) 1px 22px)', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.82)', padding: '5px 9px', borderRadius: 4, letterSpacing: '0.04em' }}>mapa: {b.city}</span>
                      </div>
                    )}
                    <div style={{ padding: '26px 24px 30px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <h3 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{b.city}</h3>
                        {b.isNew ? <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', padding: '3px 8px', borderRadius: 'var(--radius-button)', fontWeight: 700 }}>NUEVA</span> : null}
                      </div>
                      <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{b.address}</p>
                      {b.phone ? <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text)' }}>{b.phone}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <SiteFooter theme={theme} />
    </>
  );
}
