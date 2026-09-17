import type { Metadata } from 'next';
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
  return {
    title: `Cotizador de triturados — ${t(theme, 'site.name')}`,
    description: 'Cotiza grava, arena, base y material de banco: por tonelada en planta o por viaje puesto en obra.',
  };
}

export default function CotizadorTrituradosPage() {
  return <PaginaCotizador tipo="triturados" />;
}
