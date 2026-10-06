import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import Link from 'next/link';
import { COTIZADORES_META, COTIZADOR_TIPOS } from '@maqserv/config';
import { IconoCotizador } from '@maqserv/ui';
import { getTheme, t } from '@/lib/theme';
import { getQuoterCatalog } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

/**
 * Siempre en servidor, nunca horneada.
 *
 * El tabulador se lee con `no-store` para que apagar el cotizador o mover una
 * tarifa desde el panel se vea al recargar. Next ya deduce que la ruta es
 * dinámica por eso, pero la deducción pasa por un error que `pedirOr` atrapa
 * —ahí está para que un 500 no tumbe el build—, así que se deja escrito: si
 * algún día la dedujera mal, la página saldría horneada con el catálogo del
 * día del build, o peor, con el 'no disponible' del respaldo.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/cotizador', titulo: t(theme, 'seo.quoter.title'), descripcion: t(theme, 'seo.quoter.description') });
}

const PASOS = [
  { n: '01', titulo: 'Dinos de qué obra se trata', texto: 'Cliente, obra y municipio de entrega. Es lo que sale en el encabezado del documento.' },
  { n: '02', titulo: 'Elige qué necesitas', texto: 'Equipos y servicios, o materiales y modalidad de entrega, según el cotizador.' },
  { n: '03', titulo: 'Ajusta cantidades', texto: 'Días y horas, o toneladas y viajes. El resumen se actualiza conforme capturas.' },
  { n: '04', titulo: 'Revisa y envía', texto: 'Ves el documento tal como se imprime, con condiciones incluidas, antes de mandarlo.' },
];

/**
 * Portada pública del cotizador: la bifurcación entre los dos.
 *
 * Es la página a la que apunta el menú, y existe porque "Cotizador" a secas no
 * dice si esto sirve para rentar una excavadora o para pedir tres viajes de
 * grava. Aquí se elige con la diferencia enfrente.
 */
export default async function CotizadorHome() {
  const theme = await getTheme();
  // Un cotizador apagado en el panel no debe aparecer como opción y llevar a
  // una pantalla que dice "no disponible".
  const catalogos = await Promise.all(COTIZADOR_TIPOS.map((tipo) => getQuoterCatalog(tipo)));
  const disponibles = COTIZADOR_TIPOS.filter((_, i) => catalogos[i] !== null);

  // Página de presentación: `.ms-hero` + secciones del sistema de diseño
  // (components/EstilosSistema.tsx). Lo propio lleva el prefijo `cz-`.
  return (
    <>
      <SiteHeader theme={theme} />
      <main className="ms-page">
        <style>{`
          .cz-wrap{ padding-top:0; }
          .cz-wrap .ms-hero + .ms-section{ margin-top:0; }
          .cz-cards{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap:16px; margin-top:20px; }
          .cz-card{ display:grid; gap:0; align-content:start; }
          .cz-card .ms-ico{ margin-bottom:18px; }
          .cz-card-t{ font-size:19px; }
          .cz-card p{ margin:8px 0 0; font-size:14.5px; line-height:1.6; color:var(--color-text-muted); }
          .cz-card .ms-link{ margin-top:18px; }
          .cz-pasos{ list-style:none; margin:20px 0 0; padding:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap:16px; }
          .cz-paso{ display:grid; gap:6px; align-content:start; }
          .cz-paso-n{ width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-size:13px; font-weight:700; color:var(--color-primary); border:1px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); margin-bottom:6px; font-variant-numeric:tabular-nums; }
          .cz-paso p{ margin:0; font-size:14px; line-height:1.55; color:var(--color-text-muted); }
          .cz-otro{ margin:28px 0 0; font-size:14.5px; line-height:1.65; color:var(--color-text-muted); max-width:70ch; }
          .cz-otro a{ color:var(--color-primary); font-weight:600; text-decoration:none; }
          .cz-otro a:hover{ text-decoration:underline; }
        `}</style>
        <div className="ms-wrap cz-wrap">
          <header className="ms-hero">
            <p className="ms-kicker">Cotizador en línea</p>
            <h1 className="ms-hero-title">Tu cotización, paso a paso</h1>
            <p className="ms-hero-desc">
              Sin llamadas ni idas y vueltas por correo: eliges, capturas cantidades y ves el documento
              completo antes de enviarlo.
            </p>
          </header>

          <section className="ms-section">
            <h2 className="ms-h2">¿Qué vas a cotizar?</h2>

            {disponibles.length === 0 ? (
              <div className="ms-empty" style={{ marginTop: 20 }}>
                <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="calculator" size={22} /></span>
                <p className="ms-empty-t">El cotizador en línea no está disponible</p>
                <p className="ms-empty-p">
                  No está disponible en este momento. Mándanos tu requerimiento y te respondemos con una
                  propuesta.
                </p>
                <div className="ms-empty-acts">
                  <Link href="/cotizar" className="ms-btn">{t(theme, 'quote.form.title')}</Link>
                </div>
              </div>
            ) : (
              <div className="cz-cards">
                {disponibles.map((tipo) => {
                  const meta = COTIZADORES_META[tipo];
                  return (
                    <Link key={tipo} href={meta.ruta} className="ms-panel cz-card">
                      <span className="ms-ico ms-ico-lg" aria-hidden>
                        <IconoCotizador nombre={meta.icono} size={26} />
                      </span>
                      <h3 className="ms-h2 cz-card-t">{meta.titulo}</h3>
                      <p>{meta.resumen}</p>
                      <span className="ms-link">Empezar<Icon name="arrowRight" size={16} /></span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="ms-section">
            <h2 className="ms-h2">Cómo funciona</h2>
            <ol className="cz-pasos">
              {PASOS.map((p, i) => (
                <li key={p.n} className="ms-panel cz-paso">
                  <span className="cz-paso-n" aria-hidden>{i + 1}</span>
                  <h3 className="ms-h3">{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
            <p className="cz-otro">
              ¿Necesitas algo que no está en el cotizador —agua en pipas, volteos, block o carpeta asfáltica?{' '}
              <Link href="/cotizar">Mándanos tu requerimiento</Link>{' '}
              y un asesor lo arma contigo.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
