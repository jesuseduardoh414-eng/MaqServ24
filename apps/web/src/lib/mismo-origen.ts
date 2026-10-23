import type { NextRequest } from 'next/server';

/**
 * ¿Una petición que CAMBIA algo llegó desde una página de OTRO sitio?
 * (auditoría 2026-10-23, protección contra CSRF).
 *
 * Las cookies de sesión son SameSite=Lax, y Lax no separa subdominios: para
 * el navegador, maqser24.com y admin.maqser24.com son "el mismo sitio". Un
 * script plantado en el sitio público podía mandar un POST al panel y el
 * navegador le ponía la cookie de quien tuviera la sesión abierta (crear un
 * administrador, marcar un pago…).
 *
 * El navegador dice de dónde viene cada petición en `Sec-Fetch-Site` (y en
 * `Origin`), y una página ajena no puede cambiarlo. Se exige "same-origin":
 * mismo esquema, host y puerto. Sin ninguna de las dos cabeceras no es un
 * navegador (curl, un servidor), y ese no trae las cookies de nadie.
 */
export function peticionAjena(req: NextRequest, hostsPublicos: Array<string | null | undefined> = []): boolean {
  const metodo = req.method.toUpperCase();
  if (metodo === 'GET' || metodo === 'HEAD' || metodo === 'OPTIONS') return false;
  const sitio = req.headers.get('sec-fetch-site');
  if (sitio) return sitio !== 'same-origin';
  const origen = req.headers.get('origin');
  if (!origen) return false;
  // Detrás de Passenger el Host puede llegar como `0.0.0.0:3000`: por eso también
  // vale el dominio público que dice la configuración.
  const propios = [req.headers.get('x-forwarded-host'), req.headers.get('host'), ...hostsPublicos]
    .filter((h): h is string => Boolean(h))
    .map((h) => h.toLowerCase());
  try {
    return !propios.includes(new URL(origen).host.toLowerCase());
  } catch {
    return true;
  }
}
