import { prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';

/**
 * VIDEO DE CADA SECTOR ESTRATÉGICO (2026-11-16, pedido del cliente: que las
 * tarjetas de «Sectores estratégicos» lleven video además de imagen).
 *
 * Se guarda en `platform_settings` (clave `sectores_video`: { idDelSector:
 * "uploads/x.mp4" }) y no en una columna de `strategic_sectors`: subir el
 * código no corre SQL, y una columna nueva obligaba a pegarlo a mano en
 * phpMyAdmin antes de que el sitio volviera a enseñar los sectores.
 */
export const AJUSTE_VIDEOS_SECTORES = 'sectores_video';

type Videos = Record<string, string>;

const limpio = (v: unknown): Videos =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0))
    : {};

/** Para pintar (sitio y panel): con la caché corta de los ajustes. */
export async function videosDeSectores(): Promise<Videos> {
  return limpio(await leerAjuste<unknown>(AJUSTE_VIDEOS_SECTORES, {}));
}

/**
 * Pone (o quita, con null) el video de un sector y devuelve el que tenía, para
 * borrarlo del disco. Lee la fila directo, sin la caché: con varios procesos de
 * la API, una copia vieja de otro proceso borraría el video recién subido de
 * otro sector.
 */
export async function ponerVideoDeSector(id: number, ruta: string | null, por: string): Promise<string | null> {
  const fila = await prisma.platform_settings.findUnique({ where: { key: AJUSTE_VIDEOS_SECTORES } });
  const videos = limpio(fila?.value);
  const anterior = videos[String(id)] ?? null;
  if (ruta) videos[String(id)] = ruta;
  else delete videos[String(id)];
  if (anterior === ruta) return null;
  await guardarAjuste(AJUSTE_VIDEOS_SECTORES, videos, por);
  return anterior;
}
