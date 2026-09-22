/**
 * A dónde lleva la tarjeta de una categoría de servicio.
 *
 * Varias líneas de servicio —transporte y servicios de obra, triturados,
 * materiales para construcción, soluciones asfálticas— no tienen inventario, y
 * no es un descuido: no son SKUs. Una pipa se mide por viaje, un triturado por
 * tonelada y el concreto por metro cúbico, así que no viven en un catálogo.
 * Mandarlas a `/productos` enseñaría una parrilla vacía; van directo a cotizar
 * con el servicio ya indicado.
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
export function categoryCountLabel(
  c: { productCount: number },
  unit: string,
  unitOne?: string,
): string {
  // Misma voz que el botón principal del hero ("Solicitar cotización").
  if (c.productCount <= 0) return 'Solicitar cotización';
  // "1 equipos" se leía en la tarjeta de Volteos. El singular es un copy
  // aparte y no una regla: en español no basta con quitarle la "s" final
  // (mes/meses, camión/camiones), y además el cliente puede cambiar la
  // palabra desde Diseño y no tiene por qué elegir una que se preste.
  const palabra = c.productCount === 1 ? (unitOne || unit) : unit;
  return `${c.productCount} ${palabra}`;
}
