import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { puedeVer, type ModuloAdmin, type RolAdmin } from '@maqserv/config';
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

/**
 * Sesión del admin. DISTINGUE "sesión inválida" (→ null → redirect al login)
 * de "la API no responde" (→ throw → error.tsx con el mensaje de Render
 * dormido). Antes ambos devolvían null y una API caída expulsaba al admin al
 * login con la sesión válida — parecía problema de credenciales y era el 504.
 */
export async function getAdmin(): Promise<{ id: number; name: string; email: string; role: string; rol: RolAdmin; rolNombre: string; modulos: ModuloAdmin[] } | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('La API no responde (Render dormido o caído)');
  }
  if (!res.ok) return null; // 401/403 real: la sesión no sirve
  try {
    const a = (await res.json()) as { id: number; name: string; email: string; role: string; rol?: RolAdmin; rolNombre?: string; modulos?: ModuloAdmin[] };
    /**
     * Si la API todavía no manda `rol`, se asume Dirección.
     *
     * No es un permiso regalado: es el orden de despliegue. El panel sale a
     * Vercel en cuanto se hace push y la API de Render se despliega A MANO, así
     * que hay una ventana en la que esta app nueva habla con la API vieja. Sin
     * esta red, `puedeVer(undefined, …)` daría false para todo y `exigirModulo`
     * mandaría a Inicio desde CADA pantalla: el panel entero inservible hasta
     * que alguien se acordara de desplegar la API.
     *
     * Y no abre nada: si la API es vieja, no hay permisos que respetar del lado
     * del servidor; si es nueva, siempre manda el rol y esto nunca se usa.
     */
    const rol = a.rol ?? ('direccion' as RolAdmin);
    return { ...a, rol, rolNombre: a.rolNombre ?? '', modulos: a.modulos ?? [] };
  } catch {
    throw new Error('La API respondió algo que no es JSON (¿despertando?)');
  }
}

/**
 * Corta la página si el rol no tiene ese módulo.
 *
 * El menú ya esconde lo que no toca, pero una dirección se puede teclear, y
 * antes de esto el resultado era peor que un "no puedes": la pantalla cargaba
 * vacía —la API devuelve 403 y `adminFetch` lo convierte en null— y parecía que
 * la sección estaba sin datos. Mejor devolver a Inicio, que todos tienen.
 *
 * Sigue sin ser la seguridad: la seguridad es el `@Modulo` de la API. Esto es
 * que la mentira no se vea como un módulo vacío.
 */
export function exigirModulo(admin: { rol: RolAdmin }, modulo: ModuloAdmin): void {
  if (!puedeVer(admin.rol, modulo)) redirect('/');
}
