import type { Metadata, Viewport } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CATALOGOS_DEFAULT, COTIZADORES_ACTIVOS, COTIZADORES_META, esCotizadorTipo, type CatalogoCotizador, type CotizadorTipo } from '@maqserv/config';
import { adminFetch, exigirModulo, getAdmin } from '@/lib/admin';
import { CotizadorPanel } from '@/app/cotizador/CotizadorPanel';
import { AppCotizador } from './AppCotizador';

/**
 * ACCESO DIRECTO A UN COTIZADOR (2026-10-29).
 *
 * "Que el encargado pueda entrar a un enlace y abra directo el cotizador de
 * triturados y otro al de maquinaria, y que los pueda instalar en el inicio de
 * su celular." Es el MISMO cotizador del panel (precios editables por
 * cotización, clientes, historial), sin el menú lateral, y cada uno con su
 * manifiesto para instalarse como app aparte (`public/pwa/`).
 *
 * Sin sesión pide entrar y vuelve aquí (`/login?next=`).
 */
const tipoDe = (v: string): CotizadorTipo | null => (esCotizadorTipo(v) && COTIZADORES_ACTIVOS.includes(v) ? v : null);

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }): Promise<Metadata> {
  const tipo = tipoDe((await params).tipo);
  if (!tipo) return {};
  const nombre = COTIZADORES_META[tipo].titulo;
  return {
    title: `Cotizador de ${nombre.toLowerCase()}`,
    manifest: `/pwa/cotizar-${tipo}.webmanifest`,
    appleWebApp: { capable: true, title: nombre, statusBarStyle: 'black-translucent' },
    // Con tamaño: así el iPhone usa este y no el ícono general del panel.
    icons: { apple: [{ url: `/pwa/${tipo}-180.png`, sizes: '180x180' }] },
  };
}

export const viewport: Viewport = { themeColor: '#0b0d11' };

export default async function CotizadorDirecto({ params }: { params: Promise<{ tipo: string }> }) {
  const tipo = tipoDe((await params).tipo);
  if (!tipo) notFound();
  const admin = await getAdmin();
  if (!admin) redirect(`/login?next=/cotizar/${tipo}`);
  exigirModulo(admin, 'cotizador');

  // Como en /cotizador/<tipo>: sin API se cotiza con el de fábrica y el servidor recalcula al guardar.
  const catalogo = (await adminFetch<CatalogoCotizador>(`/admin/quoter/catalog/${tipo}`)) ?? CATALOGOS_DEFAULT[tipo];

  return (
    <AppCotizador tipo={tipo} nombre={admin.name}>
      <CotizadorPanel catalogo={catalogo} titulo={`Cotizador de ${COTIZADORES_META[tipo].titulo.toLowerCase()}`} resumen={COTIZADORES_META[tipo].resumen} app />
    </AppCotizador>
  );
}
