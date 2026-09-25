import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCatalogoResumen } from '@/lib/api';
import { metadataCatalogo, PaginaCatalogo, type Search } from './catalogo';

export function generateMetadata(): Promise<Metadata> {
  return metadataCatalogo('producto');
}

/**
 * Productos: lo que se vende a precio fijo (2026-09-25). Hoy MAQSER24 solo
 * tiene servicios, así que mientras no exista un producto publicado esta ruta
 * manda a /servicios en vez de enseñar una parrilla vacía.
 */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, resumen] = await Promise.all([searchParams, getCatalogoResumen()]);
  if (resumen.productos === 0) redirect('/servicios');
  return PaginaCatalogo({ sp, kind: 'producto' });
}
