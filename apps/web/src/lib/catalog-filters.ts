/**
 * Filtros del catálogo: definición ÚNICA de lo que ofrece la barra y de cómo se
 * traduce a la consulta real.
 *
 * Módulo SIN 'use client' a propósito: lo usan `CatalogFilters` (cliente, para
 * pintar los menús) y `productos/catalogo.tsx` (servidor, para llamar a la API;
 * lo usa /servicios). Si
 * cada lado definiera los rangos, "Hasta $10,000" acabaría filtrando otra cosa.
 */

export interface FilterDef {
  id: FilterId;
  label: string;
  /** [valor en la URL, etiqueta]. El primero es el "sin filtro". */
  options: [string, string][];
}

export type FilterId = 'disp' | 'orden';

/**
 * Sin "Precio" ni orden por precio (auditoría 2026-10-28): el sitio nunca
 * enseña precios, y filtrar por rango dejaba averiguar cuánto cuesta cada
 * equipo. "Calificación" también se fue: ningún equipo tiene opiniones.
 */
export const FILTER_DEFS: FilterDef[] = [
  {
    id: 'disp',
    label: 'Disponibilidad',
    options: [['', 'Todas'], ['now', 'Disponible ahora'], ['rent', 'Solo renta'], ['offer', 'En oferta']],
  },
  {
    id: 'orden',
    label: 'Ordenar por',
    options: [['', 'Relevancia'], ['new', 'Más recientes']],
  },
];

export type CatalogSearch = { precio?: string; calif?: string; disp?: string; orden?: string };

/** Lo que la URL trae → lo que la API entiende. Ignora valores que no existen. */
export function filtersToQuery(sp: CatalogSearch): {
  availability?: string;
  sort?: string;
} {
  const disp = sp.disp === 'now' || sp.disp === 'rent' || sp.disp === 'offer' ? sp.disp : undefined;
  const sort = sp.orden === 'new' ? sp.orden : undefined;
  return { availability: disp, sort };
}

/** ¿Hay algún filtro puesto? Para ofrecer "limpiar". Un `?precio=` viejo ya no cuenta. */
export const hasFilters = (sp: CatalogSearch): boolean =>
  Boolean(sp.disp || sp.orden === 'new');
