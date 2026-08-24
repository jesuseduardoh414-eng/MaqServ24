import type { Theme } from '@maqserv/config';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

export interface LegalSection { h: string; body: string }

/** Layout de páginas legales (Términos, Privacidad): hero + secciones numeradas. */
export function LegalPage({ theme, eyebrow, title, updated, intro, sections }: {
  theme: Theme; eyebrow: string; title: string; updated: string; intro?: string; sections: LegalSection[];
}) {
  return (
    <>
      <SiteHeader theme={theme} />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 72px', background: 'var(--color-bg)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 30, marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ width: 30, height: 4, background: 'var(--color-primary)', borderRadius: 2 }} />
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.24em', color: 'var(--color-text-muted)' }}>{eyebrow}</span>
          </div>
          <h1 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 48, lineHeight: 1.02, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text)' }}>{title}</h1>
          <p style={{ margin: '16px 0 0', fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>ÚLTIMA ACTUALIZACIÓN · {updated}</p>
        </div>

        {intro ? <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>{intro}</p> : null}

        {sections.map((s, i) => (
          <section key={i} style={{ marginTop: 34 }}>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px', color: 'var(--color-text)' }}>
              <span style={{ color: 'var(--color-primary)' }}>{String(i + 1).padStart(2, '0')}.</span> {s.h}
            </h2>
            {s.body.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((para, j) => (
              <p key={j} style={{ fontSize: 16, lineHeight: 1.75, color: 'color-mix(in srgb, var(--color-text) 82%, transparent)', margin: '0 0 14px' }}>{para}</p>
            ))}
          </section>
        ))}

        <p style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          Este documento es un modelo general. Te recomendamos revisarlo con un asesor legal antes de su publicación definitiva para adaptarlo a tu operación y a la normativa vigente.
        </p>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
