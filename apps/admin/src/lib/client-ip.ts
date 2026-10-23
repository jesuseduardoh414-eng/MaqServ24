import type { NextRequest } from 'next/server';

/**
 * Igual que en la tienda: la API ve la IP de Vercel en todas las peticiones, así que
 * le pasamos la del visitante real para que su límite (p. ej. 5 intentos de login por
 * minuto) cuente por persona y no por servidor. `PROXY_SECRET` es lo que le prueba a la
 * API que el header viene de aquí.
 */
/** Una IP de red interna o del propio servidor: no es la del visitante. */
const INTERNA = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|::ffff:(127|10)\.|f[cd][0-9a-f]{2}:|fe80:)/i;

function ultimaPublica(xff: string | null | undefined): string | undefined {
  const ips = (xff ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...ips].reverse().find((x) => !INTERNA.test(x)) ?? ips.at(-1);
}

export function clientIpHeaders(req: NextRequest): Record<string, string> {
  // La ÚLTIMA de `x-forwarded-for` que no sea de red interna, la que agrega
  // nuestro proxy; no la primera, que la escribe quien llama (auditoría
  // 2026-10-23; ver la de la web).
  const ip = ultimaPublica(req.headers.get('x-forwarded-for')) || req.headers.get('x-real-ip')?.trim();
  const secret = process.env.PROXY_SECRET?.trim();
  return {
    ...(ip ? { 'x-client-ip': ip } : {}),
    ...(secret ? { 'x-proxy-secret': secret } : {}),
  };
}
