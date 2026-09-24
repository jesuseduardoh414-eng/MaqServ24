import type { Metadata } from 'next';

/** Origen público sin barra final (`https://maqserv24.com`). En local, el dev server. */
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '');

/**
 * Qué NO debe aparecer en buscadores. Fuente única para robots.txt (no se
 * rastrea) y para el `noindex` de cada página (segunda capa, por si llegan por
 * un enlace). El sitemap solo lista rutas que no estén aquí.
 *
 * robots casa por PREFIJO: `/vendedor` cubre también `/vendedores`, y `/cotizar`
 * cubriría `/cotizador` —que SÍ se indexa—, por eso va anclado (`$` y `?`).
 *
 * Esto no es seguridad: lo que exige sesión lo protege el código, no robots.
 */
export const RUTAS_PRIVADAS = [
  '/cuenta',
  '/checkout',
  '/carrito',
  '/pedido',
  '/login',
  '/registro',
  '/restablecer',
  '/aliado',
  '/vendedor', // también /vendedores (marketplace apagado)
  '/tienda',
  '/rastreo', // herramienta con número de pedido, sin valor para buscar
  '/cotizar$', // formulario que exige cuenta; /cotizador (con -dor) sí se indexa
  '/cotizar?',
  '/sin-conexion',
  '/api',
];

/** Para `metadata.robots` de las páginas privadas. */
export const NOINDEX: NonNullable<Metadata['robots']> = { index: false, follow: false };

/** ¿La ruta cae en alguna de las privadas? (para no meterla al sitemap ni a llms.txt). */
export function esRutaPrivada(pathname: string): boolean {
  return RUTAS_PRIVADAS.some((r) => (r.endsWith('$') ? pathname === r.slice(0, -1) : pathname.startsWith(r)));
}
