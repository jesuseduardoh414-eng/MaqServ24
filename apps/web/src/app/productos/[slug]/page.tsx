import { permanentRedirect } from 'next/navigation';

type Params = { slug: string };

/**
 * /productos/<slug> → /servicios/<slug>, permanente (2026-10-08).
 *
 * Sin venta en línea ya no hay fichas "de producto": toda ficha vive bajo
 * /servicios y se cotiza. Esta ruta solo existe para que los enlaces viejos
 * sigan funcionando. `detalle.tsx` y `ProductDetailView.tsx` se quedan en esta
 * carpeta porque los importa /servicios/[slug].
 */
export default async function ProductoRedirect({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  permanentRedirect(`/servicios/${encodeURIComponent(slug)}`);
}
