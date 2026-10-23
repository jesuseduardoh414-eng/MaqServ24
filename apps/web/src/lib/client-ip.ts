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
export function clientIpHeaders(req: NextRequest): Record<string, string> {
  // La ÚLTIMA de `x-forwarded-for`, la que agrega nuestro proxy (LiteSpeed),
  // y no la primera (auditoría 2026-10-23): la primera la escribe quien llama,
  // y con una distinta en cada intento se saltaba el límite de 5 logins por
  // minuto. Es el mismo criterio que la API (`trust proxy 1`).
  const ip = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop()
    || req.headers.get('x-real-ip')?.trim();
  const secret = process.env.PROXY_SECRET?.trim();
  return {
    ...(ip ? { 'x-client-ip': ip } : {}),
    ...(secret ? { 'x-proxy-secret': secret } : {}),
  };
}
