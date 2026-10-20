import { imageUrl } from './images';

/**
 * Video principal de un servicio (2026-10-20): va en lugar de la foto principal
 * en la tarjeta y en la ficha; la foto se queda de portada y es la que usan el
 * carrito, las cotizaciones y las vistas al compartir.
 *
 * SE GUARDA EN LA COLUMNA LEGACY `products.youtube`, que nadie leía: así no
 * hace falta columna nueva ni SQL en producción (mismo criterio que el video
 * del hero, que vive en el tema). Solo cuenta como video lo que subimos
 * nosotros —`uploads/…mp4|webm`—: si algún producto viejo trae ahí un enlace de
 * YouTube, se ignora en vez de pintarse como un <video> roto.
 */
export const RUTA_VIDEO_SERVICIO = /^uploads\/[^/]+\.(mp4|webm)$/i;

/** URL pública del video principal, o null si no tiene (o si es un dato legacy). */
export function videoDeServicio(ruta: string | null | undefined): string | null {
  return ruta && RUTA_VIDEO_SERVICIO.test(ruta.trim()) ? imageUrl(ruta.trim()) : null;
}
