import type { Theme } from '@maqserv/config';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';

export interface LegalSection { h: string; body: string }

/** Estilos propios de las páginas legales (prefijo `lg-`): solo la lectura larga. */
const CSS = `
.lg-intro{ margin:0; font-size:16.5px; line-height:1.7; color:var(--color-text-muted); text-wrap:pretty; }
.lg-sec{ margin-top:36px; }
.lg-sec .ms-h2{ margin-bottom:12px; }
.lg-n{ color:var(--color-text-muted); font-weight:600; margin-right:8px; font-variant-numeric:tabular-nums; }
.lg-p{ margin:0 0 14px; font-size:16px; line-height:1.75; color:color-mix(in srgb, var(--color-text) 84%, transparent); overflow-wrap:anywhere; }
`;

/** Layout de páginas legales (Términos, Privacidad): encabezado + secciones numeradas. */
export function LegalPage({ theme, eyebrow, title, updated, intro, sections }: {
  theme: Theme; eyebrow: string; title: string; updated: string; intro?: string; sections: LegalSection[];
}) {
  return (
    <>
      <SiteHeader theme={theme} />
      <style>{CSS}</style>
      <div className="ms-page">
        <main className="ms-wrap-narrow">
          <header className="ms-head" style={{ paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
            <div className="ms-head-txt">
              <p className="ms-kicker">{eyebrow}</p>
              <h1 className="ms-title">{title}</h1>
              <p className="ms-desc">Última actualización: {updated}</p>
            </div>
          </header>

          {intro ? <p className="lg-intro">{intro}</p> : null}

          {sections.map((s, i) => (
            <section key={i} className="lg-sec">
              <h2 className="ms-h2"><span className="lg-n">{i + 1}.</span>{s.h}</h2>
              {s.body.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((para, j) => (
                <p key={j} className="lg-p">{para}</p>
              ))}
            </section>
          ))}

          <hr className="ms-sep" style={{ marginTop: 40 }} />
          <p className="ms-hint" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Este documento es un modelo general. Te recomendamos revisarlo con un asesor legal antes de su publicación definitiva para adaptarlo a tu operación y a la normativa vigente.
          </p>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
