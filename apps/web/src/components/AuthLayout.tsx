import type { ReactNode } from 'react';
import { defaultTheme, type Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { Icon } from '@/components/Icon';

/**
 * MARCO DE /login Y /registro (rediseño 2026-10-15).
 *
 * Antes era una tarjeta de 440 px sola en medio de una página vacía: no decía
 * qué se gana con la cuenta ni se sentía parte de la marca. Ahora es un bloque
 * partido —a la izquierda el panel de marca, a la derecha el formulario— con
 * el lenguaje de las fichas de categoría: fondo de banda oscura, retícula de
 * plano y el azul como única luz.
 *
 * El panel va SIEMPRE oscuro (`--band`, igual que el pie): es la identidad de
 * MAQSER24 y el logotipo metálico está hecho para fondo oscuro. En móvil se
 * oculta: el encabezado ya trae la marca y el formulario sube a la vista.
 *
 * Todos los textos salen del tema (`auth.aside.*`, editables en Diseño).
 */
export function AuthLayout({ theme, children }: { theme: Theme; children: ReactNode }) {
  const b = theme.tokens.branding ?? {};
  // Fondo siempre oscuro: el logo para oscuro, o el metálico del repo. El de
  // fondos claros (`logoLight`) podría no verse aquí.
  const logo = b.logoDark || '/brand/maqser24-logo.png';
  const contacto = theme.tokens.contact ?? defaultTheme.tokens.contact;
  const beneficios = [
    { icono: 'calculator', texto: t(theme, 'auth.aside.b1') },
    { icono: 'clock', texto: t(theme, 'auth.aside.b2') },
    { icono: 'heart', texto: t(theme, 'auth.aside.b3') },
  ] as const;

  return (
    <main className="au-page">
      <style>{CSS}</style>
      <div className="au-shell">
        <aside className="au-aside">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={t(theme, 'site.name')} className="au-aside-logo" />

          <div className="au-aside-body">
            <p className="au-aside-title">{t(theme, 'auth.aside.title')}</p>
            <ul className="au-aside-list">
              {beneficios.map((x) => (
                <li key={x.icono}>
                  <span className="au-aside-ico" aria-hidden><Icon name={x.icono} size={17} /></span>
                  <span>{x.texto}</span>
                </li>
              ))}
            </ul>
          </div>

          {contacto.phone ? (
            <p className="au-aside-foot">
              {t(theme, 'auth.aside.contact')}:{' '}
              <a href={`tel:${contacto.phone.replace(/[^\d+]/g, '')}`}>{contacto.phone}</a>
              {contacto.hours ? <span className="au-aside-hours"> · {contacto.hours}</span> : null}
            </p>
          ) : null}

          {/* Isotipo de fondo: solo textura, a muy baja opacidad. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/maqser24-isotipo.png" alt="" aria-hidden className="au-aside-mark" />
        </aside>

        <section className="au-main">{children}</section>
      </div>
    </main>
  );
}

const CSS = `
.au-page{ padding:44px 32px 80px; }
.au-shell{
  max-width:1060px; margin:0 auto; display:grid; grid-template-columns:minmax(0,.92fr) minmax(0,1fr);
  background:var(--color-surface); border:1px solid var(--color-border); border-radius:20px; overflow:hidden;
  box-shadow:0 40px 90px -50px color-mix(in srgb, var(--color-primary) 35%, rgba(0,0,0,.6));
}
.au-main{ display:flex; flex-direction:column; justify-content:center; padding:48px 56px 44px; min-width:0; }

/* Panel de marca */
.au-aside{
  position:relative; isolation:isolate; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; gap:44px;
  padding:44px 44px 40px; background:var(--band); color:#F5F7FA;
}
.au-aside::before{
  /* Retícula de plano, como las fichas de categoría, desvanecida hacia abajo. */
  content:''; position:absolute; inset:0; z-index:-1; pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size:36px 36px; background-position:-1px -1px;
  -webkit-mask-image:radial-gradient(130% 90% at 0% 0%, #000 25%, transparent 78%); mask-image:radial-gradient(130% 90% at 0% 0%, #000 25%, transparent 78%);
}
.au-aside::after{
  /* La única luz: el azul de marca saliendo de la esquina. */
  content:''; position:absolute; inset:0; z-index:-1; pointer-events:none;
  background:radial-gradient(70% 55% at 100% 100%, color-mix(in srgb, var(--color-primary) 34%, transparent), transparent 70%);
}
.au-aside-logo{ height:38px; width:auto; max-width:220px; object-fit:contain; object-position:left; }
.au-aside-title{
  margin:0 0 26px; font-family:var(--font-display); font-size:clamp(26px, 2.6vw, 34px); font-weight:700;
  line-height:1.12; letter-spacing:-.03em; text-wrap:balance; max-width:16ch;
}
.au-aside-list{ list-style:none; margin:0; padding:0; display:grid; gap:16px; max-width:38ch; }
.au-aside-list li{ display:flex; align-items:flex-start; gap:13px; font-size:14.5px; line-height:1.5; color:rgba(245,247,250,.78); }
.au-aside-ico{
  width:34px; height:34px; flex-shrink:0; display:grid; place-items:center; border-radius:9px; margin-top:-5px;
  color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 13%, transparent);
  box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 26%, transparent);
}
.au-aside-foot{ margin:0; font-size:13px; color:rgba(245,247,250,.6); }
.au-aside-foot a{ color:#F5F7FA; font-weight:600; text-decoration:none; white-space:nowrap; }
.au-aside-foot a:hover{ text-decoration:underline; }
.au-aside-mark{
  position:absolute; right:-110px; bottom:-120px; z-index:-1; width:380px; height:auto; opacity:.05; pointer-events:none;
  filter:grayscale(1) brightness(1.6);
}

@media (max-width: 980px){
  .au-main{ padding:44px 40px 40px; }
  .au-aside{ padding:40px 34px 36px; }
}
@media (max-width: 860px){
  .au-page{ padding:28px 18px 64px; }
  .au-shell{ grid-template-columns:1fr; max-width:480px; background:transparent; border:0; border-radius:0; box-shadow:none; overflow:visible; }
  .au-aside{ display:none; }
  .au-main{ padding:0; }
}
`;
