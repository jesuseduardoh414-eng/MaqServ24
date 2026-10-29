/**
 * Una foto subida, en versión ligera (rendimiento, 2026-10-29).
 *
 * Para los lugares que no pueden usar `<Image>` de Next: la portada de un
 * video (`poster`), el logo del encabezado y del pie, y el icono de la
 * pestaña. Ahí se mandaba el archivo tal como se subió: medido en
 * producción, la portada bajaba una portada de video de 3 MB, otra de 1 MB
 * y un logo de 400 KB que se ve a 42 px de alto.
 *
 * Devuelve la dirección del optimizador de Next (el mismo que usa `<Image>`):
 * la recorta al ancho pedido y la entrega en WebP/AVIF si el navegador puede.
 * La primera vez se recorta y después sale de su caché de 30 días.
 *
 * Solo toca fotos de nuestro almacén (las que `images.remotePatterns` deja
 * pasar); cualquier otra dirección, un SVG o una ruta propia se devuelven tal
 * cual: el optimizador las rechazaría y la imagen se rompería.
 */
const NUESTRAS = /^(https:\/\/(media\.maqserv?24\.com\/|api\.maqserv?24\.com\/media\/|kxewnuotuolwloccusqx\.supabase\.co\/storage\/v1\/object\/public\/media\/)|http:\/\/localhost:4000\/media\/)/;

/** Anchos que el optimizador acepta (los de fábrica de Next: `deviceSizes` + `imageSizes`). */
type Ancho = 96 | 256 | 384 | 640 | 828 | 1080 | 1200 | 1920;

export function fotoLigera(src: string, ancho: Ancho, calidad = 75): string {
  if (!NUESTRAS.test(src) || /\.svgz?(\?|$)/i.test(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${ancho}&q=${calidad}`;
}
