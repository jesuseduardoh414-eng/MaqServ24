/**
 * A dónde lleva la tarjeta de una categoría de servicio.
 *
 * Dos de las seis líneas del manual —agua en pipas y triturados— no tienen
 * inventario, y no es un descuido: no son SKUs. Una pipa se mide por viaje y un
 * triturado por tonelada, así que no viven en un catálogo. Mandarlas a
 * `/productos` enseñaría una parrilla vacía; van directo a cotizar con el
 * servicio ya indicado.
 *
 * La regla es por conteo y no por una lista fija de slugs a propósito: si el
 * cliente da de alta una categoría nueva sin productos, se comporta igual sin
 * tocar código.
 */
export function categoryHref(c: { slug: string; productCount: number }): string {
  return c.productCount > 0
    ? `/productos?categoria=${c.slug}`
    : `/cotizar?servicio=${encodeURIComponent(c.slug)}`;
}

/** Texto bajo el nombre: el conteo si hay equipos, la acción si no los hay. */
export function categoryCountLabel(c: { productCount: number }, unit: string): string {
  return c.productCount > 0 ? `${c.productCount} ${unit}` : 'Cotizar servicio';
}
