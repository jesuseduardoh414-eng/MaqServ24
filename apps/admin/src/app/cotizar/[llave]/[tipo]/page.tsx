import type { Metadata, Viewport } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CATALOGOS_DEFAULT, COTIZADORES_META, esAccesoDirecto, type CatalogoCotizador } from '@maqserv/config';
import { adminFetch, getAdmin, tieneModulo } from '@/lib/admin';
import { llaveValida, tipoDirecto } from '@/lib/acceso-directo';
import { CotizadorPanel } from '@/app/cotizador/CotizadorPanel';
import { AppCotizador } from './AppCotizador';

/**
 * ACCESO DIRECTO A UN COTIZADOR (2026-10-29).
 *
 * "Son solo para una persona, no deben ser públicos: no se entra con un botón
 * desde el panel ni desde el sitio; solo con los enlaces puedes entrar e
 * instalarlos en el celular, sin usuario ni contraseña." La dirección lleva
 * la llave (`/cotizar/<llave>/maquinaria`); sin ella, o con otra, es un 404.
 * Sin sesión, `/api/acceso-directo` la abre con la cuenta interna, que solo
 * puede usar los cotizadores, y vuelve aquí.
 *
 * Es el MISMO cotizador del panel (precios editables por cotización, clientes,
 * historial), sin el menú lateral. El manifiesto para instalarlo también lleva
 * la llave: el ícono del celular abre directo aquí.
 */
type Params = { params: Promise<{ llave: string; tipo: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { llave, tipo: t } = await params;
  const tipo = tipoDirecto(t);
  if (!tipo || !llaveValida(llave)) return {};
  const nombre = COTIZADORES_META[tipo].titulo;
  return {
    title: `Cotizador de ${nombre.toLowerCase()}`,
    manifest: `/cotizar/${llave}/${tipo}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: nombre, statusBarStyle: 'black-translucent' },
    // Con tamaño: así el iPhone usa este y no el ícono general del panel.
    icons: { apple: [{ url: `/pwa/${tipo}-180.png`, sizes: '180x180' }] },
    // La dirección es la llave: que ningún buscador la guarde.
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export const viewport: Viewport = { themeColor: '#0b0d11' };

export default async function CotizadorDirecto({ params }: Params) {
  const { llave, tipo: t } = await params;
  const tipo = tipoDirecto(t);
  if (!tipo || !llaveValida(llave)) notFound();

  // Sin sesión (o una sin el cotizador): la abre el enlace y vuelve aquí.
  const admin = await getAdmin();
  if (!admin || !tieneModulo(admin, 'cotizador')) redirect(`/api/acceso-directo?llave=${encodeURIComponent(llave)}&tipo=${tipo}`);

  // Como en /cotizador/<tipo>: sin API se cotiza con el de fábrica y el servidor recalcula al guardar.
  const catalogo = (await adminFetch<CatalogoCotizador>(`/admin/quoter/catalog/${tipo}`)) ?? CATALOGOS_DEFAULT[tipo];

  return (
    <AppCotizador tipo={tipo} llave={llave} nombre={esAccesoDirecto(admin.email) ? null : admin.name}>
      <CotizadorPanel catalogo={catalogo} titulo={`Cotizador de ${COTIZADORES_META[tipo].titulo.toLowerCase()}`} resumen={COTIZADORES_META[tipo].resumen} app />
    </AppCotizador>
  );
}
