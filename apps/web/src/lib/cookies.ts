/**
 * Nombres de las cookies de sesión. Módulo SIN imports server-only (no usa
 * next/headers) para poder importarse desde el middleware, que corre en Edge.
 */
export const SESSION_COOKIE = 'servmaq_session';
/** Refresh token de Supabase; el middleware lo usa para renovar el access token. */
export const REFRESH_COOKIE = 'servmaq_refresh';
/**
 * Enlace firmado del aliado. NO es una sesion: el aliado no tiene cuenta, su
 * credencial es el enlace que le llego por correo. Vive en cookie —y no en la
 * URL— porque dura 30 dias y un query string queda escrito en el historial del
 * navegador y en los logs de acceso de Vercel y Render.
 */
export const ALIADO_COOKIE = 'servmaq_aliado';
