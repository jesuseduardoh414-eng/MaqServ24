/**
 * Constantes de sesión del admin. Módulo SIN imports server-only (no usa
 * next/headers) para poder importarse desde el middleware, que corre en Edge.
 */
export const ADMIN_COOKIE = 'maqserv_admin';
/** Refresh token (30 días, firmado por la API); el middleware lo usa para renovar el token admin. */
export const ADMIN_REFRESH_COOKIE = 'maqserv_admin_refresh';
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
/** Sitio público: solo para enlazar hacia él (p. ej. ver la tienda de un vendedor). */
export const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
