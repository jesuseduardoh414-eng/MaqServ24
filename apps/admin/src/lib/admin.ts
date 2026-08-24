import { cookies } from 'next/headers';
import { ADMIN_COOKIE, API_URL } from './cookies';

// Estas constantes viven en ./cookies (sin next/headers) para que el middleware
// Edge pueda importarlas; se reexportan aquí por compatibilidad.
export { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, API_URL, SITE_URL } from './cookies';

/**
 * Tope de espera de cada llamada del panel a la API.
 *
 * La API vive en Render con plan free y se duerme sin tráfico: el arranque en
 * frío puede tardar más que el límite de la función de Vercel. Sin tope, la
 * página se queda colgada hasta que la plataforma la mata con un 504; con tope,
 * devuelve `null` y cada vista ya sabe pintar su estado vacío.
 *
 * Es más generoso que el del middleware (8 s) porque aquí sí vale la pena
 * esperar a que la API despierte: es el contenido de la página, no un refresco
 * de token que se puede reintentar en la siguiente navegación.
 */
const TIMEOUT_MS = 20_000;

/** Fetch autenticado del lado servidor con el token admin de la cookie. */
export async function adminFetch<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Timeout o API caída: mismo trato que una respuesta no-ok.
    return null;
  }
}

export async function getAdmin(): Promise<{ id: number; name: string; email: string; role: string } | null> {
  return adminFetch('/admin/auth/me');
}
