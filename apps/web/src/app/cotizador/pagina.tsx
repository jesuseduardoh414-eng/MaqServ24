import Link from 'next/link';
import { COTIZADORES_META, type CotizadorTipo } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getQuoterCatalog } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { CotizadorPublico } from './CotizadorPublico';

/**
 * Página pública de un cotizador. La comparten /cotizador/maquinaria y
 * /cotizador/triturados: lo único que cambia entre las dos es el tipo.
 */
export async function PaginaCotizador({ tipo }: { tipo: CotizadorTipo }) {
  const [theme, catalogo, user] = await Promise.all([getTheme(), getQuoterCatalog(tipo), getSessionUser()]);
  const meta = COTIZADORES_META[tipo];
  // El documento se imprime en blanco: se usa el logo para fondo claro.
  const branding = theme.tokens.branding ?? {};
  const logo = branding.logoLight ?? branding.logoAlt ?? null;

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '60vh' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '38px clamp(16px, 4vw, 26px) 60px' }}>
          <Link
            href="/cotizador"
            style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none' }}
          >
            ← Cotizador
          </Link>
          <h1
            style={{
              fontFamily: 'var(--font-display)', margin: '10px 0 0',
              fontSize: 'clamp(30px, 5vw, 46px)', letterSpacing: '-0.035em', lineHeight: 1.05,
              textTransform: 'uppercase',
            }}
          >
            Cotizador de {meta.titulo.toLowerCase()}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '12px 0 28px', fontSize: 15.5, maxWidth: '64ch', lineHeight: 1.6 }}>
            {meta.resumen}
          </p>

          {catalogo === null ? (
            <div
              style={{
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                padding: '30px 26px', background: 'var(--color-surface)', maxWidth: 620,
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>Este cotizador no está disponible</h2>
              <p style={{ margin: '0 0 18px', color: 'var(--color-text-muted)', fontSize: 14.5, lineHeight: 1.6 }}>
                Puede estar apagado temporalmente o el servidor no respondió. Escríbenos y te cotizamos
                a la medida.
              </p>
              <Link
                href="/cotizar"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 22px',
                  borderRadius: 'var(--radius-button)', background: 'var(--color-primary)',
                  color: 'var(--color-primary-fg)', fontWeight: 700, textDecoration: 'none', fontSize: 14.5,
                }}
              >
                {t(theme, 'quote.form.title')}
              </Link>
            </div>
          ) : (
            <CotizadorPublico
              catalogo={catalogo}
              logo={logo}
              inicial={{
                cliente: user?.name ?? '',
                correo: user?.email ?? '',
                telefono: user?.phone ?? '',
                municipio: user?.city ?? '',
              }}
            />
          )}
        </div>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
