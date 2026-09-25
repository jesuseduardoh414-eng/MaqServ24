import type { Metadata } from 'next';
import { metadataDetalle, PaginaDetalle } from '../../productos/[slug]/detalle';

type Params = { slug: string };

/** Ficha de un servicio (2026-09-25). Misma vista que la de producto; ver `detalle.tsx`. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return metadataDetalle(slug);
}

export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return PaginaDetalle({ slug, base: '/servicios' });
}
