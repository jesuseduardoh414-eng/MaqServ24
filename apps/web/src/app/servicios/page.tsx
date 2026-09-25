import type { Metadata } from 'next';
import { metadataCatalogo, PaginaCatalogo, type Search } from '../productos/catalogo';

export function generateMetadata(): Promise<Metadata> {
  return metadataCatalogo('servicio');
}

/** Servicios: las cinco líneas de MAQSER24, que se cotizan (2026-09-25). Ver `catalogo.tsx`. */
export default async function ServicesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  return PaginaCatalogo({ sp, kind: 'servicio' });
}
