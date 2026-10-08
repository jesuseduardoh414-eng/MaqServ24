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

export type FilterId = 'precio' | 'calif' | 'disp' | 'orden';

/** Rangos de precio en pesos. Parten el catálogo real (27 equipos: 2 / 8 / 17). */
const PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  a: { max: 10000 },
  b: { min: 10000, max: 50000 },
  c: { min: 50000 },
};

export const FILTER_DEFS: FilterDef[] = [
  {
    id: 'precio',
    label: 'Precio',
    options: [['', 'Todos los precios'], ['a', 'Hasta $10,000'], ['b', '$10,000 – $50,000'], ['c', 'Más de $50,000']],
  },
  {
    id: 'calif',
    label: 'Calificación',
    options: [['', 'Cualquiera'], ['4', '4★ o más'], ['3', '3★ o más'], ['2', '2★ o más']],
  },
  {
    id: 'disp',
    label: 'Disponibilidad',
    options: [['', 'Todas'], ['now', 'Disponible ahora'], ['rent', 'Solo renta'], ['offer', 'En oferta']],
  },
  {
    id: 'orden',
    label: 'Ordenar por',
    options: [['', 'Relevancia'], ['low', 'Precio: menor a mayor'], ['high', 'Precio: mayor a menor'], ['new', 'Más recientes']],
  },
];

export type CatalogSearch = { precio?: string; calif?: string; disp?: string; orden?: string };

/** Lo que la URL trae → lo que la API entiende. Ignora valores que no existen. */
export function filtersToQuery(sp: CatalogSearch): {
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability?: string;
  sort?: string;
} {
  const range = sp.precio ? PRICE_RANGES[sp.precio] : undefined;
  const rating = sp.calif ? Number(sp.calif) : NaN;
  const disp = sp.disp === 'now' || sp.disp === 'rent' || sp.disp === 'offer' ? sp.disp : undefined;
  const sort = sp.orden === 'low' || sp.orden === 'high' || sp.orden === 'new' ? sp.orden : undefined;
  return {
    minPrice: range?.min,
    maxPrice: range?.max,
    minRating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
    availability: disp,
    sort,
  };
}

/** ¿Hay algún filtro puesto? Para ofrecer "limpiar". */
export const hasFilters = (sp: CatalogSearch): boolean =>
  Boolean(sp.precio || sp.calif || sp.disp || sp.orden);
