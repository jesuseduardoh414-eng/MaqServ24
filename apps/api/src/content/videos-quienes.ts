import { prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { imageUrl } from '../catalog/images';

/**
 * VIDEOS DEL MOSAICO DE QUIÉNES SOMOS (2026-11-16, el dueño: «esas imágenes
 * también se pueden cambiar por videos»).
 *
 * `inf_sitio.imagenes` es una lista de rutas; el video de cada imagen vive en
 * `platform_settings` (`quienes_videos`) con la ruta de la imagen como llave:
 *   { "uploads/obra.webp": "uploads/obra.mp4" }
 * Va por la ruta y no por la posición, para que quitar una imagen no le pase
 * su video a la siguiente. La imagen queda de portada del video. Sin columna
 * nueva: subir el código no corre SQL (igual que `sectores_video`).
 */
export const AJUSTE_VIDEOS_QUIENES = 'quienes_videos';

type Mapa = Record<string, string>;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const limpios = (v: unknown): Mapa =>
  esObjeto(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0)) : {};

/** Para pintar: con la caché corta de los ajustes. */
export async function videosDeQuienes(): Promise<Mapa> {
  return limpios(await leerAjuste<unknown>(AJUSTE_VIDEOS_QUIENES, {}));
}

/**
 * Las imágenes del mosaico (URL completas) y, alineado con ellas, el video de
 * cada una (URL o null). Se descartan las rutas que no dan URL, en pareja.
 */
export function mosaicoQuienes(rutas: string[], videos: Mapa): { imagenes: string[]; videos: Array<string | null> } {
  const imagenes: string[] = [];
  const vids: Array<string | null> = [];
  for (const ruta of rutas) {
    const url = imageUrl(ruta);
    if (!url) continue;
    imagenes.push(url);
    vids.push(videos[ruta] ? imageUrl(videos[ruta]) : null);
  }
  return { imagenes, videos: vids };
}

/** Pone (o quita, con null) el video de una imagen y devuelve el que tenía, para borrarlo del disco. Sin caché. */
export async function ponerVideoDeQuienes(imagen: string, ruta: string | null, por: string): Promise<string | null> {
  const fila = await prisma.platform_settings.findUnique({ where: { key: AJUSTE_VIDEOS_QUIENES } });
  const videos = limpios(fila?.value ?? {});
  const anterior = videos[imagen] ?? null;
  if (ruta) videos[imagen] = ruta;
  else delete videos[imagen];
  if (anterior === ruta) return null;
  await guardarAjuste(AJUSTE_VIDEOS_QUIENES, videos, por);
  return anterior;
}
