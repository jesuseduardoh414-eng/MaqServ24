import type { Metadata } from 'next';
import { metadataDetalle, PaginaDetalle } from './detalle';

type Params = { slug: string };

/** Ficha de un producto. Si el slug es de un servicio, `PaginaDetalle` redirige a /servicios. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return metadataDetalle(slug);
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return PaginaDetalle({ slug, base: '/productos' });
}
