import type { NextRequest } from 'next/server';

/**
 * Igual que en la tienda: la API ve la IP de Vercel en todas las peticiones, así que
 * le pasamos la del visitante real para que su límite (p. ej. 5 intentos de login por
 * minuto) cuente por persona y no por servidor. `PROXY_SECRET` es lo que le prueba a la
 * API que el header viene de aquí.
 */
export function clientIpHeaders(req: NextRequest): Record<string, string> {
  // La ÚLTIMA de `x-forwarded-for`, la que agrega nuestro proxy, no la primera,
  // que la escribe quien llama (auditoría 2026-10-23; ver la de la web).
  const ip = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop()
    || req.headers.get('x-real-ip')?.trim();
  const secret = process.env.PROXY_SECRET?.trim();
  return {
    ...(ip ? { 'x-client-ip': ip } : {}),
    ...(secret ? { 'x-proxy-secret': secret } : {}),
  };
}
