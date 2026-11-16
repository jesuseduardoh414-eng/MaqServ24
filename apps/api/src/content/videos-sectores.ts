import { prisma } from '@maqserv/db';
import { normalizarTextosSector, TEXTOS_SECTOR_VACIOS, type TextosSector } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';

/**
 * LO QUE UN SECTOR GUARDA FUERA DE SU TABLA (en `platform_settings`, por id).
 *
 *  - `sectores_video` (2026-11-16): { idDelSector: "uploads/x.mp4" }, el video
 *    que va en lugar de la imagen.
 *  - `sectores_textos` (2026-11-16): { idDelSector: TextosSector }, la frase
 *    corta de la tarjeta y el título y la frase destacada de cada apartado de
 *    su página (ver `sector-contenido` en @maqserv/config).
 *
 * No son columnas de `strategic_sectors` porque subir el código no corre SQL:
 * una columna nueva obligaba a pegarlo a mano en phpMyAdmin antes de que el
 * sitio volviera a enseñar los sectores.
 */
export const AJUSTE_VIDEOS_SECTORES = 'sectores_video';
export const AJUSTE_TEXTOS_SECTORES = 'sectores_textos';

type Mapa<T> = Record<string, T>;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const videosLimpios = (v: unknown): Mapa<string> =>
  esObjeto(v)
    ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0))
    : {};

const textosLimpios = (v: unknown): Mapa<TextosSector> =>
  esObjeto(v) ? Object.fromEntries(Object.entries(v).filter(([, t]) => esObjeto(t)).map(([id, t]) => [id, normalizarTextosSector(t as Partial<TextosSector>)])) : {};

/** Para pintar (sitio y panel): con la caché corta de los ajustes. */
export async function videosDeSectores(): Promise<Mapa<string>> {
  return videosLimpios(await leerAjuste<unknown>(AJUSTE_VIDEOS_SECTORES, {}));
}

export async function textosDeSectores(): Promise<Mapa<TextosSector>> {
  return textosLimpios(await leerAjuste<unknown>(AJUSTE_TEXTOS_SECTORES, {}));
}

export function textosDe(mapa: Mapa<TextosSector>, id: number | bigint): TextosSector {
  return mapa[String(id)] ?? TEXTOS_SECTOR_VACIOS;
}

/**
 * Lee la fila directo, sin la caché: con varios procesos de la API, una copia
 * vieja de otro proceso borraría lo recién guardado de otro sector.
 */
async function leerFila(clave: string): Promise<unknown> {
  const fila = await prisma.platform_settings.findUnique({ where: { key: clave } });
  return fila?.value ?? {};
}

/** Pone (o quita, con null) el video de un sector y devuelve el que tenía, para borrarlo del disco. */
export async function ponerVideoDeSector(id: number, ruta: string | null, por: string): Promise<string | null> {
  const videos = videosLimpios(await leerFila(AJUSTE_VIDEOS_SECTORES));
  const anterior = videos[String(id)] ?? null;
  if (ruta) videos[String(id)] = ruta;
  else delete videos[String(id)];
  if (anterior === ruta) return null;
  await guardarAjuste(AJUSTE_VIDEOS_SECTORES, videos, por);
  return anterior;
}

/** Pone (o quita, con null) la frase, los títulos y las frases destacadas de un sector. */
export async function ponerTextosDeSector(id: number, textos: Partial<TextosSector> | null, por: string): Promise<void> {
  const todos = textosLimpios(await leerFila(AJUSTE_TEXTOS_SECTORES));
  const t = textos ? normalizarTextosSector(textos) : null;
  if (!t || (!t.frase && !Object.keys(t.titulos).length && !Object.keys(t.destacados).length)) {
    if (!(String(id) in todos)) return;
    delete todos[String(id)];
  } else todos[String(id)] = t;
  await guardarAjuste(AJUSTE_TEXTOS_SECTORES, todos, por);
}
