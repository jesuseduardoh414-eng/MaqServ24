import { createHash, timingSafeEqual } from 'node:crypto';
import { COTIZADORES_ACTIVOS, HUELLA_ACCESO_DIRECTO, esCotizadorTipo, type CotizadorTipo } from '@maqserv/config';

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

/** El cotizador de la dirección, si existe y está activo. */
export const tipoDirecto = (v: string): CotizadorTipo | null => (esCotizadorTipo(v) && COTIZADORES_ACTIVOS.includes(v) ? v : null);
