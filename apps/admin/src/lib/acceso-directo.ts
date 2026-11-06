import { createHash, timingSafeEqual } from 'node:crypto';
import { HUELLA_ACCESO_DIRECTO, cotizadorDelSitio, type CotizadorDelSitio } from '@maqserv/config';

/**
 * La llave del enlace del acceso directo (2026-10-29), comprobada en el panel
 * antes de pedirle nada a la API: un enlace con otra llave es un 404, igual
 * que una página que no existe. La API la vuelve a comprobar al abrir sesión.
 */
export function llaveValida(llave: string | null | undefined): boolean {
  if (!llave || llave.length < 20 || llave.length > 200) return false;
  const huella = createHash('sha256').update(llave).digest();
  return timingSafeEqual(huella, Buffer.from(HUELLA_ACCESO_DIRECTO, 'hex'));
}

/**
 * El cotizador de la dirección, si existe (2026-11-06: los siete del menú del
 * sitio, no solo maquinaria y triturados). `/cotizar/<llave>/maquinaria` y
 * `/triturados` siguen igual: son las mismas claves.
 */
export const cotizadorDirecto = (v: string): CotizadorDelSitio | null => cotizadorDelSitio(v);
