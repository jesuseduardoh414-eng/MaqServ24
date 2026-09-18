/**
 * Piezas compartidas por los dos pasos de "entrar con Google".
 *
 * Viven aquí y no duplicadas en cada ruta porque la `redirect_uri` tiene que
 * ser EXACTAMENTE la misma en los dos: Google compara la cadena carácter por
 * carácter contra la que esté dada de alta en la consola, y si difieren —aunque
 * sea en la barra final— responde `redirect_uri_mismatch`.
 */

/** Guarda el `state` del CSRF y a dónde volver, separados por "|". */
export const ESTADO_GOOGLE_COOKIE = 'maqserv_google_state';

/**
 * La URL de retorno que se le declara a Google.
 *
 * Sale de `SITE_URL` cuando está definida y, si no, del origen de la petición.
 * El orden importa en producción: detrás del proxy de cPanel el origen que ve
 * Next puede ser `http://localhost:3000`, y esa no es la URL que Google tiene
 * registrada.
 */
export function redirectUriGoogle(origenPeticion: string): string {
  const base = (process.env.SITE_URL || origenPeticion).replace(/\/$/, '');
  return `${base}/api/auth/google/callback`;
}

/**
 * A dónde se vuelve tras entrar.
 *
 * Solo rutas internas. Un `?next=https://otro-sitio` convertiría el login en
 * un redirector abierto: se manda un enlace de maqserv24.com que acaba en
 * cualquier parte, que es justo lo que usan las campañas de phishing.
 */
export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor) return '/';
  // `//evil.com` es una URL absoluta para el navegador aunque no lo parezca.
  if (!valor.startsWith('/') || valor.startsWith('//')) return '/';
  return valor;
}
