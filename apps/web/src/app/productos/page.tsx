import { permanentRedirect } from 'next/navigation';

type Search = Record<string, string | string[] | undefined>;

/**
 * /productos → /servicios, permanente (2026-10-08).
 *
 * MAQSER24 ya no vende nada a precio fijo en línea: todo se cotiza y se paga
 * fuera del sitio, así que no hay un catálogo de "productos" aparte. La ruta
 * se queda solo para que los enlaces viejos (buscadores, correos, el buscador
 * del header antiguo con ?q=) sigan llegando. Se conservan los parámetros
 * simples (q, categoria…) para no perder la búsqueda.
 *
 * `catalogo.tsx` vive en esta carpeta porque lo importa /servicios; no se borra.
 */
export default async function ProductosRedirect({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'),
  ).toString();
  permanentRedirect(qs ? `/servicios?${qs}` : '/servicios');
}
