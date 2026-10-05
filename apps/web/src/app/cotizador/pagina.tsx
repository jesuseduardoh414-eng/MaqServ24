import Link from 'next/link';
import { COTIZADORES_META, type CotizadorTipo } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getQuoterCatalog } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { QuoteGate } from '../cotizar/QuoteGate';
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
      {/* Pantalla de trabajo: `.ms-head` del sistema de diseño
          (components/EstilosSistema.tsx); lo propio lleva el prefijo `czp-`. */}
      <main className="ms-page" style={{ minHeight: '60vh' }}>
        <style>{`
          .czp-volver{ margin-bottom:14px; }
          .czp-volver:hover svg{ transform:translateX(-3px); }
          .czp-caja{ max-width:640px; }
        `}</style>
        <div className="ms-wrap">
          <header className="ms-head">
            <div className="ms-head-txt">
              <Link href="/cotizador" className="ms-link ms-link-muted czp-volver">
                <Icon name="arrowLeft" size={15} />Cotizador
              </Link>
              <h1 className="ms-title">Cotizador de {meta.titulo.toLowerCase()}</h1>
              <p className="ms-desc">{meta.resumen}</p>
            </div>
          </header>

          {/* SIN CUENTA NO SE COTIZA (2026-09-23): el candado va ANTES de usar el
              cotizador, no al final. Quien llega aquí ya viene a pedir un
              servicio con precio, y el registro es lo que permite mandárselo al
              proveedor y seguirlo desde su cuenta. Ver QuoteGate. */}
          {!user ? (
            <QuoteGate theme={theme} next={meta.ruta} />
          ) : catalogo === null ? (
            <div className="ms-empty czp-caja">
              <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="calculator" size={22} /></span>
              <h2 className="ms-empty-t">Este cotizador no está disponible</h2>
              <p className="ms-empty-p">
                Puede estar apagado temporalmente o el servidor no respondió. Escríbenos y te cotizamos
                a la medida.
              </p>
              <div className="ms-empty-acts">
                <Link href="/cotizar" className="ms-btn">{t(theme, 'quote.form.title')}</Link>
              </div>
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
