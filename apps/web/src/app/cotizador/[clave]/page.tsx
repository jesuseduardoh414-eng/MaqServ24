import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cotizadorDelSitio, type CotizadorDelSitio, type Theme } from '@maqserv/config';
import { paginaSeo } from '@/lib/seo';
import { getTheme, t } from '@/lib/theme';
import { PaginaCotizador, resumenDe } from '../pagina';

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

type Params = { params: Promise<{ clave: string }> };

/**
 * Título y descripción. Maquinaria y triturados conservan sus copys del tema
 * (editables en el panel y ya indexados); los demás salen de su categoría.
 */
function seoDe(theme: Theme, c: CotizadorDelSitio): { titulo: string; descripcion: string } {
  if (c.clave === 'maquinaria') return { titulo: t(theme, 'seo.quoter.machinery.title'), descripcion: t(theme, 'seo.quoter.machinery.description') };
  if (c.clave === 'triturados') return { titulo: t(theme, 'seo.quoter.aggregates.title'), descripcion: t(theme, 'seo.quoter.aggregates.description') };
  return {
    titulo: `Cotizador de ${c.titulo.toLowerCase()}`,
    descripcion: `${resumenDe(c)} Elige lo que necesitas, pon la cantidad y revisa el documento antes de enviarlo.`,
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = cotizadorDelSitio((await params).clave);
  if (!c) return {};
  const theme = await getTheme();
  const { titulo, descripcion } = seoDe(theme, c);
  return paginaSeo(theme, { ruta: `/cotizador/${c.clave}`, titulo, descripcion });
}

/** Uno por categoría (2026-11-02): /cotizador/maquinaria, /agua, /acarreos… (`COTIZADORES_SITIO`). */
export default async function CotizadorDeCategoriaPage({ params, searchParams }: Params & { searchParams: Promise<{ tipo?: string }> }) {
  const c = cotizadorDelSitio((await params).clave);
  if (!c) notFound();
  // `?tipo=<ficha>`: viene de "Cotizar" en el catálogo y abre con ese tipo elegido.
  const tipo = Number((await searchParams).tipo);
  return <PaginaCotizador cotizador={c} fichaId={Number.isInteger(tipo) && tipo > 0 ? tipo : null} />;
}
