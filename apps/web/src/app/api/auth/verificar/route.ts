import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/session';
import { clientIpHeaders } from '@/lib/client-ip';
import { destinoSeguro } from '@/lib/google-auth';
import { origenPublico } from '@/lib/origen';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * El enlace del correo "Confirma tu cuenta" llega aquí (2026-09-23).
 *
 * Canjea el token en la API, que marca el correo como confirmado y devuelve
 * la sesión; se guardan las cookies y se manda a la persona a donde iba
 * (`next`, por ejemplo /cotizar). Así confirmar el correo ES entrar: no hay
 * que volver a teclear la contraseña. Cualquier fallo vuelve al login con un
 * motivo legible, nunca JSON: quien llega aquí es una persona desde su correo.
 *
 * Las redirecciones van sobre el origen PÚBLICO, no el de la petición: detrás
 * del proxy de cPanel ese origen es la dirección interna (ver lib/origen.ts).
 */
export async function GET(req: NextRequest) {
  const origen = origenPublico(req);
  const next = destinoSeguro(req.nextUrl.searchParams.get('next'));
  const token = req.nextUrl.searchParams.get('t');
  const alLogin = (motivo: string) => {
    const url = new URL('/login', origen);
    url.searchParams.set('error', motivo);
    if (next !== '/') url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  };

  if (!token) return alLogin('verificacion');

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return alLogin('servidor');
  }
  const data = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !data?.token) return alLogin('verificacion');

  const res = NextResponse.redirect(new URL(next, origen));
  // Confirmar el correo siempre recuerda la sesión: acaba de demostrar que
  // el buzón es suyo, y pedirle la contraseña otra vez sobra.
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
  res.cookies.set(SESSION_COOKIE, data.token, opts);
  if (data.refresh_token) res.cookies.set(REFRESH_COOKIE, data.refresh_token, opts);
  return res;
}
