import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { defaultTheme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon, type IconName } from '@/components/Icon';
import { ContactForm } from './ContactForm';
import { telHref, whatsappHref } from '@/lib/telefono';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/contacto', titulo: t(theme, 'seo.contact.title'), descripcion: t(theme, 'seo.contact.description') });
}

// Enlaces de llamar y WhatsApp: un solo convertidor para todo el sitio (acepta
// "81…", "+52 81…" y "+52 1 81…"). Ver lib/telefono.ts.
const waHref = (v: string) => whatsappHref(v);

/**
 * Estilos propios de Contacto (prefijo `ct-`). Lo común (hero, campos,
 * botones, tarjetas) sale del sistema de diseño `ms-*`.
 */
const CSS = `
.ct-main{ display:grid; grid-template-columns:minmax(0,1fr) 400px; gap:56px; align-items:start; }
.ct-stats{ margin-top:36px; }
.ct-chs{ display:grid; gap:10px; }
.ct-ch{ display:grid; grid-template-columns:auto minmax(0,1fr); gap:14px; align-items:center; padding:14px 16px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; color:var(--color-text); text-decoration:none; transition:border-color .18s ease; }
a.ct-ch:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
a.ct-ch:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.ct-ch-l{ display:block; font-size:13px; color:var(--color-text-muted); }
.ct-ch-v{ display:block; margin-top:2px; font-size:16px; font-weight:600; overflow-wrap:anywhere; }
.ct-urg{ margin-top:16px; }
.ct-urg-t{ margin:4px 0 16px; font-family:var(--font-display); font-size:19px; font-weight:700; letter-spacing:-.015em; line-height:1.25; }
.ct-br{ padding:0; overflow:hidden; }
.ct-br-img{ height:150px; display:grid; place-items:center; background:color-mix(in srgb, var(--color-text) 3%, var(--color-bg)); border-bottom:1px solid var(--color-border); color:var(--color-text-muted); }
.ct-br-img[data-vacio="true"]{ height:88px; }
.ct-br-img img{ width:100%; height:100%; object-fit:cover; display:block; }
.ct-br-body{ padding:20px 22px 22px; }
.ct-br-head{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
.ct-br-addr{ margin:0 0 10px; font-size:14px; line-height:1.55; color:var(--color-text-muted); }
.ct-br-tel{ font-size:14px; font-weight:600; color:var(--color-text); text-decoration:none; font-variant-numeric:tabular-nums; }
@media (max-width: 960px){ .ct-main{ grid-template-columns:minmax(0,1fr); gap:40px; } }
`;

export default async function ContactPage() {
  const theme = await getTheme();
  const c = theme.tokens.contact ?? defaultTheme.tokens.contact;

  const channels: Array<{ label: string; value: string; href?: string; icon: IconName }> = [
    { label: 'Teléfono', value: c.phone, href: c.phone ? telHref(c.phone) : undefined, icon: 'phone' as IconName },
    { label: 'WhatsApp', value: c.whatsapp, href: c.whatsapp ? waHref(c.whatsapp) : undefined, icon: 'chat' as IconName },
    { label: 'Correo', value: c.email, href: c.email ? `mailto:${c.email}` : undefined, icon: 'mail' as IconName },
    { label: 'Horario', value: c.hours, icon: 'clock' as IconName },
  ].filter((x) => x.value);

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: t(theme, 'nav.contact') }])} />
      <style>{CSS}</style>

      <div className="ms-page">
        <main className="ms-wrap">
          {/* Presentación */}
          <header className="ms-hero" style={{ paddingTop: 16 }}>
            {c.eyebrow ? <p className="ms-kicker">{c.eyebrow}</p> : null}
            <h1 className="ms-hero-title">{c.title}</h1>
            {c.subtitle ? <p className="ms-hero-desc">{c.subtitle}</p> : null}
            {c.stats.length > 0 ? (
              <div className="ms-stats ct-stats">
                {c.stats.map((s, i) => (
                  <div key={i}>
                    <span className="ms-stat-n">{s.value}</span>
                    <span className="ms-stat-l">{s.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </header>

          {/* Formulario + contacto directo */}
          <div className="ct-main">
            <section aria-labelledby="ct-form-t">
              <div className="ms-sec-head">
                <div>
                  <h2 id="ct-form-t" className="ms-h2">Cuéntanos qué necesitas</h2>
                  <p className="ms-h2-desc">Los campos con asterisco son obligatorios.</p>
                </div>
              </div>
              <div className="ms-panel ms-panel-lg">
                <ContactForm needs={c.needs} />
              </div>
            </section>

            <section aria-labelledby="ct-dir-t">
              <div className="ms-sec-head">
                <h2 id="ct-dir-t" className="ms-h2">Contacto directo</h2>
              </div>
              <div className="ct-chs">
                {channels.map((ch) => {
                  const inner = (
                    <>
                      <span className="ms-ico" aria-hidden><Icon name={ch.icon} size={18} /></span>
                      <span style={{ minWidth: 0 }}>
                        <span className="ct-ch-l">{ch.label}</span>
                        <span className="ct-ch-v">{ch.value}</span>
                      </span>
                    </>
                  );
                  return ch.href
                    ? <a key={ch.label} href={ch.href} className="ct-ch">{inner}</a>
                    : <div key={ch.label} className="ct-ch">{inner}</div>;
                })}
              </div>

              {c.urgent.show ? (
                <div className="ms-panel ct-urg">
                  {c.urgent.eyebrow ? <p className="ms-kicker" style={{ margin: 0 }}>{c.urgent.eyebrow}</p> : null}
                  <p className="ct-urg-t">{c.urgent.title}</p>
                  {c.phone ? (
                    <a href={telHref(c.phone)} className="ms-btn">
                      <Icon name="phone" size={16} />{c.urgent.ctaLabel}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          {/* Sucursales */}
          {c.branches.length > 0 ? (
            <section className="ms-section" style={{ marginTop: 64 }} aria-labelledby="ct-br-t">
              <div className="ms-sec-head">
                <h2 id="ct-br-t" className="ms-h2">Nuestras sucursales</h2>
              </div>
              <div className="ms-cards">
                {c.branches.map((b, i) => (
                  <article key={i} className="ms-panel ct-br">
                    <div className="ct-br-img" data-vacio={!b.image}>
                      {b.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.image} alt={b.city} loading="lazy" />
                      ) : (
                        <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="mapPin" size={22} /></span>
                      )}
                    </div>
                    <div className="ct-br-body">
                      <div className="ct-br-head">
                        <h3 className="ms-h3" style={{ fontSize: 17 }}>{b.city}</h3>
                        {b.isNew ? <span className="ms-chip ms-chip-info">Nueva</span> : null}
                      </div>
                      <p className="ct-br-addr">{b.address}</p>
                      {b.phone ? <a href={telHref(b.phone)} className="ct-br-tel">{b.phone}</a> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <SiteFooter theme={theme} />
    </>
  );
}
