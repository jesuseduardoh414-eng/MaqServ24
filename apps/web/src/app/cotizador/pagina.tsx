import Link from '@/components/Enlace';
import { cookies } from 'next/headers';
import { catalogoDelSitio, COTIZADORES_META, COTIZADORES_SITIO, hayQueElegir, type CatalogoMaquinaria, type CatalogoTriturados, type CotizadorDelSitio } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getProducts, getQuoterCatalog } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { SESSION_COOKIE } from '@/lib/cookies';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { QuoteGate } from '../cotizar/QuoteGate';
import { CotizadorPublico, type ProductoALaMedida } from './CotizadorPublico';

/** Lo que dice la cabecera: el texto largo de los dos de siempre, la línea del menú en los demás. */
export function resumenDe(c: CotizadorDelSitio): string {
  return c.clave === c.tipo ? COTIZADORES_META[c.tipo].resumen : `${c.resumen}.`;
}

/** A dónde se pide a la medida mientras la categoría no tiene nada con precio. */
export function aLaMedidaDe(c: CotizadorDelSitio): string {
  return c.aLaMedida ?? `/cotizar?servicio=${encodeURIComponent(c.linea)}`;
}

/**
 * Página pública de un cotizador del sitio: uno por categoría (2026-11-02).
 *
 * Todos leen uno de los dos tabuladores (maquinaria o triturados) y enseñan
 * solo lo de su categoría (`catalogoDelSitio`). Si la categoría todavía no
 * tiene nada con precio, se pide a la medida; el día que su ficha tenga
 * precio, aquí aparece sin tocar nada más.
 */
export async function PaginaCotizador({ cotizador, fichaId }: { cotizador: CotizadorDelSitio; /** `?tipo=` del catálogo: abre con ese equipo elegido (2026-10-22). */ fichaId?: number | null }) {
  // Sin sesión se enseña el candado (QuoteGate), que no usa el tabulador: no se pide (rendimiento, 2026-10-29).
  const conSesion = (await cookies()).has(SESSION_COOKIE);
  // Los dos tabuladores (2026-11-03): una sola cotización puede llevar cualquier categoría.
  const [theme, maquinaria, triturados, user] = await Promise.all([
    getTheme(),
    conSesion ? getQuoterCatalog('maquinaria') : null,
    conSesion ? getQuoterCatalog('triturados') : null,
    getSessionUser(),
  ]);
  const tabuladores = {
    maquinaria: maquinaria?.tipo === 'maquinaria' ? (maquinaria as CatalogoMaquinaria) : null,
    triturados: triturados?.tipo === 'triturados' ? (triturados as CatalogoTriturados) : null,
  };
  const tabulador = tabuladores[cotizador.tipo];
  const catalogo = tabulador ? catalogoDelSitio(tabulador, cotizador) : null;
  // Lo que todavía no tiene precio se cotiza a la medida dentro de la misma solicitud, con los productos de su catálogo.
  const sinPrecio = user && tabulador
    ? COTIZADORES_SITIO.filter((c) => {
        const tab = tabuladores[c.tipo];
        return !tab || !hayQueElegir(catalogoDelSitio(tab, c));
      })
    : [];
  const aLaMedida: Record<string, ProductoALaMedida[]> = Object.fromEntries(
    await Promise.all(
      sinPrecio.map(async (c) => {
        const r = await getProducts({ category: c.linea }).catch(() => null);
        return [c.clave, (r?.items ?? []).map((p) => ({ id: p.id, nombre: p.name, unidad: p.priceUnit }))] as const;
      }),
    ),
  );
  const ruta = `/cotizador/${cotizador.clave}`;
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
              <h1 className="ms-title">Cotizador de {cotizador.titulo.toLowerCase()}</h1>
              <p className="ms-desc">{resumenDe(cotizador)}</p>
            </div>
          </header>

          {/* SIN CUENTA NO SE COTIZA (2026-09-23): el candado va ANTES de usar el
              cotizador, no al final. Quien llega aquí viene a pedir una
              cotización, y el registro es lo que permite mandarle el precio y
              que la acepte y siga desde su cuenta. Ver QuoteGate. */}
          {!user ? (
            <QuoteGate theme={theme} next={fichaId ? `${ruta}?tipo=${fichaId}` : ruta} />
          ) : catalogo === null ? (
            <div className="ms-empty czp-caja">
              <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="calculator" size={22} /></span>
              <h2 className="ms-empty-t">Este cotizador no está disponible</h2>
              <p className="ms-empty-p">
                Puede estar apagado temporalmente o el servidor no respondió. Escríbenos y te cotizamos
                a la medida.
              </p>
              <div className="ms-empty-acts">
                <Link href={aLaMedidaDe(cotizador)} className="ms-btn">{t(theme, 'quote.form.title')}</Link>
              </div>
            </div>
          ) : !hayQueElegir(catalogo) ? (
            <div className="ms-empty czp-caja">
              <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="calculator" size={22} /></span>
              <h2 className="ms-empty-t">{cotizador.titulo}: se cotiza a la medida</h2>
              <p className="ms-empty-p">
                Por ahora no tenemos precios de lista en línea para esta categoría. Cuéntanos qué
                necesitas y te mandamos la cotización.
              </p>
              <div className="ms-empty-acts">
                <Link href={aLaMedidaDe(cotizador)} className="ms-btn">{t(theme, 'quote.form.title')}</Link>
              </div>
            </div>
          ) : (
            <CotizadorPublico
              tabuladores={tabuladores}
              cotizador={cotizador.clave}
              aLaMedida={aLaMedida}
              logo={logo}
              fichaId={fichaId ?? null}
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
