/**
 * DIRECCIÓN DEL NEGOCIO → ENLACE A GOOGLE MAPS (2026-11-09).
 *
 * La dirección se captura a mano en Diseño → Contacto («Dirección»; es también
 * el origen del cálculo de fletes) y se muestra tal cual en el pie de todas las
 * páginas y en Contacto. Al tocarla se abre Google Maps buscando ese texto.
 */
export function mapaHref(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion.trim())}`;
}
