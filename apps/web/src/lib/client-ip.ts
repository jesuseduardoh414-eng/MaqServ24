import type { NextRequest } from 'next/server';

/**
 * Cabeceras con las que le decimos a la API quién es el visitante de verdad.
 *
 * El navegador nunca llama a la API: pasa por aquí, y este servidor hace la petición.
 * Para la API todas las visitas salen de la misma IP (la de Vercel), así que su límite
 * por IP nos contaría a todos juntos y un rato ocupado bloquearía a clientes reales.
 * Estas cabeceras le pasan la IP real; `PROXY_SECRET` es lo que le prueba que venimos
 * de aquí y no de alguien inventándose el header (si no está configurado, la API lo
 * acepta igual y avisa en su log).
 */
/** Una IP de red interna o del propio servidor: no es la del visitante. */
const INTERNA = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|::ffff:(127|10)\.|f[cd][0-9a-f]{2}:|fe80:)/i;

export function ultimaPublica(xff: string | null | undefined): string | undefined {
  const ips = (xff ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...ips].reverse().find((x) => !INTERNA.test(x)) ?? ips.at(-1);
}

export function clientIpHeaders(req: NextRequest): Record<string, string> {
  // La ÚLTIMA de `x-forwarded-for` que no sea de red interna: la agrega nuestro
  // proxy (LiteSpeed). No la primera (auditoría 2026-10-23): esa la escribe quien
  // llama, y con una distinta en cada intento se saltaba el límite de logins por
  // minuto. Las internas (127.x, 10.x…) se saltan: si el servidor agregara una
  // suya al final, todos los visitantes compartirían el mismo límite.
  const ip = ultimaPublica(req.headers.get('x-forwarded-for')) || req.headers.get('x-real-ip')?.trim();
  const secret = process.env.PROXY_SECRET?.trim();
  return {
    ...(ip ? { 'x-client-ip': ip } : {}),
    ...(secret ? { 'x-proxy-secret': secret } : {}),
  };
}
