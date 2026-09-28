import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import Link from 'next/link';
import { COTIZADORES_META, COTIZADOR_TIPOS } from '@maqserv/config';
import { IconoCotizador } from '@maqserv/ui';
import { getTheme, t } from '@/lib/theme';
import { getQuoterCatalog } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';

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

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        {/* Banda de entrada. `--band` = negro tecnológico en oscuro, grafito en claro. */}
        <section style={{ background: 'var(--band)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '58px clamp(16px, 4vw, 26px) 52px' }}>
            <span
              style={{
                display: 'inline-block', fontSize: 11.5, fontWeight: 800, letterSpacing: '.16em',
                textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 14,
              }}
            >
              Cotizador en línea
            </span>
            <h1
              style={{
                fontFamily: 'var(--font-display)', margin: 0, color: '#fff',
                fontSize: 'clamp(32px, 6vw, 58px)', lineHeight: 1.03, letterSpacing: '-0.04em',
                textTransform: 'uppercase', maxWidth: '16ch',
              }}
            >
              Tu cotización, <span style={{ color: 'var(--color-primary)' }}>paso a paso</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,.72)', margin: '18px 0 0', fontSize: 16, maxWidth: '58ch', lineHeight: 1.65, fontWeight: 300 }}>
              Sin llamadas ni idas y vueltas por correo: eliges, capturas cantidades y ves el documento
              completo antes de enviarlo.
            </p>
          </div>
        </section>

        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '46px clamp(16px, 4vw, 26px) 20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 22px', fontSize: 'clamp(22px, 3.4vw, 30px)', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
            ¿Qué vas a cotizar?
          </h2>

          {disponibles.length === 0 ? (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '28px 24px', background: 'var(--color-surface)', maxWidth: 620 }}>
              <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 15, lineHeight: 1.6 }}>
                El cotizador en línea no está disponible en este momento. Mándanos tu requerimiento y te
                respondemos con una propuesta.
              </p>
              <Link href="/cotizar" style={botonPrimario}>
                {t(theme, 'quote.form.title')}
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
              {disponibles.map((tipo) => {
                const meta = COTIZADORES_META[tipo];
                return (
                  <Link
                    key={tipo}
                    href={meta.ruta}
                    style={{
                      display: 'block', padding: '28px 26px 26px', textDecoration: 'none',
                      color: 'var(--color-text)', background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span
                      style={{
                        display: 'grid', placeItems: 'center', width: 58, height: 58, marginBottom: 18,
                        borderRadius: 'var(--radius-md)', color: 'var(--color-primary)',
                        background: 'color-mix(in srgb, var(--color-primary) 13%, transparent)',
                      }}
                    >
                      <IconoCotizador nombre={meta.icono} size={32} />
                    </span>
                    <h3 style={{ fontFamily: 'var(--font-display)', margin: '0 0 9px', fontSize: 23, letterSpacing: '-0.025em', textTransform: 'uppercase' }}>
                      {meta.titulo}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 14.5, lineHeight: 1.65 }}>{meta.resumen}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, fontWeight: 700, fontSize: 14.5, color: 'var(--color-primary)' }}>
                      Empezar →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <section style={{ maxWidth: 1240, margin: '0 auto', padding: '36px clamp(16px, 4vw, 26px) 64px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 22px', fontSize: 'clamp(20px, 3vw, 26px)', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
            Cómo funciona
          </h2>
          <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, listStyle: 'none', margin: 0, padding: 0 }}>
            {PASOS.map((p) => (
              <li key={p.n} style={{ borderTop: '2px solid var(--color-primary)', paddingTop: 16 }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--color-primary)', letterSpacing: '-0.03em' }}>{p.n}</span>
                <b style={{ display: 'block', margin: '8px 0 6px', fontSize: 15.5 }}>{p.titulo}</b>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>{p.texto}</span>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 28, color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.7, maxWidth: '70ch' }}>
            ¿Necesitas algo que no está en el cotizador —agua en pipas, volteos, concreto premezclado, acero, block, cemento o carpeta asfáltica?{' '}
            <Link href="/cotizar" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              Mándanos tu requerimiento
            </Link>{' '}
            y un asesor lo arma contigo.
          </p>
        </section>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}

const botonPrimario = {
  display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 22px',
  borderRadius: 'var(--radius-button)', background: 'var(--color-primary)',
  color: 'var(--color-primary-fg)', fontWeight: 700, textDecoration: 'none', fontSize: 14.5,
} as const;
