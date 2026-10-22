import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import { getTheme, t } from '@/lib/theme';
import { PaginaCotizador } from '../pagina';

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
  return paginaSeo(theme, { ruta: '/cotizador/maquinaria', titulo: t(theme, 'seo.quoter.machinery.title'), descripcion: t(theme, 'seo.quoter.machinery.description') });
}

export default async function CotizadorMaquinariaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  // `?tipo=<ficha>`: viene de "Cotizar" en el catálogo y abre con ese equipo elegido.
  const tipo = Number((await searchParams).tipo);
  return <PaginaCotizador tipo="maquinaria" fichaId={Number.isInteger(tipo) && tipo > 0 ? tipo : null} />;
}
