import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/session';
import { clientIpHeaders } from '@/lib/client-ip';
import { ESTADO_GOOGLE_COOKIE, destinoSeguro, redirectUriGoogle } from '@/lib/google-auth';
import { dominioCookie, origenPublico } from '@/lib/origen';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Borra la cookie de estado tal como se puso: con el mismo `domain`. Un
 * delete sin dominio no toca una cookie que sí lo tiene, y la siguiente vuelta
 * por Google encontraría un estado viejo.
 */
function sinEstado(res: NextResponse): NextResponse {
  const domain = dominioCookie();
  res.cookies.set(ESTADO_GOOGLE_COOKIE, '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
  return res;
}

/**
 * Paso 2 de "entrar con Google": Google devuelve aquí con un `code`.
 *
 * El canje lo hace la API, que es donde vive el `client_secret`; esta ruta solo
 * comprueba el `state`, pide la sesión y guarda las cookies. Van aquí y no en
 * la API porque son dominios distintos (maqserv24.com / api.maqserv24.com) y
 * una cookie de la API no viaja a la web.
 *
 * Siempre se termina en una redirección, nunca en JSON: quien llega a esta URL
 * es una PERSONA que venía de Google, no un fetch. Cualquier fallo la devuelve
 * al login con un motivo legible en vez de dejarla viendo un objeto.
 */
export async function GET(req: NextRequest) {
  // NUNCA `req.nextUrl.origin`: detrás del proxy de cPanel es
  // `https://0.0.0.0:3000` y el navegador acababa en ERR_ADDRESS_INVALID.
  const origen = origenPublico(req);
  const volverAlLogin = (motivo: string, next?: string) => {
    const url = new URL('/login', origen);
    url.searchParams.set('error', motivo);
    if (next && next !== '/') url.searchParams.set('next', next);
    return sinEstado(NextResponse.redirect(url));
  };

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const guardado = req.cookies.get(ESTADO_GOOGLE_COOKIE)?.value ?? '';
  const [stateEsperado, destinoGuardado] = guardado.split('|');
  const next = destinoSeguro(destinoGuardado);

  // Cancelar en la pantalla de Google no es un error: se vuelve sin ruido.
  if (req.nextUrl.searchParams.get('error')) {
    return sinEstado(NextResponse.redirect(new URL(next, origen)));
  }

  if (!code) return volverAlLogin('google_sin_codigo', next);
  if (!stateEsperado || state !== stateEsperado) {
    // O es un intento de CSRF, o la cookie caducó porque la pantalla de Google
    // se quedó abierta más de diez minutos. Desde aquí no se distinguen.
    return volverAlLogin('google_estado', next);
  }

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
      body: JSON.stringify({ code, redirectUri: redirectUriGoogle(origen) }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return volverAlLogin('servidor', next);
  }

  const data = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !data?.token) {
    // El detalle real ya quedó en el log de la API; aquí solo el motivo.
    return volverAlLogin(apiRes.status === 401 ? 'google_cuenta_existente' : 'google', next);
  }

  const res = NextResponse.redirect(new URL(next, origen));
  // Entrar con Google siempre recuerda la sesión: no hay casilla que marcar en
  // la pantalla de Google, y volver a pasar por ahí en cada visita sobra.
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
  res.cookies.set(SESSION_COOKIE, data.token, opts);
  if (data.refresh_token) res.cookies.set(REFRESH_COOKIE, data.refresh_token, opts);
  return sinEstado(res);
}
