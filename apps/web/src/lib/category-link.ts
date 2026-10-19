/**
 * A dónde lleva la tarjeta de una categoría de servicio.
 *
 * Varias líneas de servicio —transporte y servicios de obra, triturados,
 * materiales para construcción, soluciones asfálticas— no tienen inventario, y
 * no es un descuido: no son SKUs. Una pipa se mide por viaje, un triturado por
 * tonelada y el concreto por metro cúbico, así que no viven en un catálogo.
 * Mandarlas al catálogo enseñaría una parrilla vacía; van directo a cotizar
 * con el servicio ya indicado.
 *
 * La regla es por conteo y no por una lista fija de slugs a propósito: si el
 * cliente da de alta una categoría nueva sin productos, se comporta igual sin
 * tocar código.
 *
 * La excepción son las categorías con página propia (PAGINA_PROPIA).
 */
export function categoryHref(c: { slug: string; productCount: number }): string {
  const propia = PAGINA_PROPIA[c.slug];
  if (propia) return propia.href;
  // Todo va a /servicios (2026-10-08): sin venta en línea, /productos ya solo
  // redirige ahí y enlazarlo directo ahorra el salto.
  return c.productCount > 0
    ? `/servicios?categoria=${c.slug}`
    : `/cotizar?servicio=${encodeURIComponent(c.slug)}`;
}

/**
 * Venta de maquinaria (sexta tarjeta, 2026-10-19) no es un servicio que se
 * cotice: se compra con la red de proveedores. Su tarjeta lleva a su página
 * (lib/landings.ts), cuyo botón abre Contacto con «Comprar maquinaria».
 */
const PAGINA_PROPIA: Record<string, { href: string; accion: string }> = {
  'venta-de-maquinaria': { href: '/venta-de-maquinaria-pesada', accion: 'Ver opciones de compra' },
};

/** Texto bajo el nombre: el conteo si hay equipos, la acción si no los hay. */
export function categoryCountLabel(
  c: { slug?: string; productCount: number },
  unit: string,
  unitOne?: string,
): string {
  const propia = c.slug ? PAGINA_PROPIA[c.slug] : undefined;
  if (propia) return propia.accion;
  // Misma voz que el botón principal del hero ("Solicitar cotización").
  if (c.productCount <= 0) return 'Solicitar cotización';
  // "1 equipos" se leía en la tarjeta de Volteos. El singular es un copy
  // aparte y no una regla: en español no basta con quitarle la "s" final
  // (mes/meses, camión/camiones), y además el cliente puede cambiar la
  // palabra desde Diseño y no tiene por qué elegir una que se preste.
  const palabra = c.productCount === 1 ? (unitOne || unit) : unit;
  return `${c.productCount} ${palabra}`;
}
