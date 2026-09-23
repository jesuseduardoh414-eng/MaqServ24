import { NextRequest, NextResponse } from 'next/server';
import { ESTADO_GOOGLE_COOKIE, destinoSeguro, redirectUriGoogle } from '@/lib/google-auth';
import { dominioCookie, origenPublico } from '@/lib/origen';

/**
 * Paso 1 de "entrar con Google": mandar al visitante a Google.
 *
 * Es un ENLACE normal (`<a href>`), no un fetch: el navegador tiene que
 * navegar de verdad a accounts.google.com. Por eso responde con un redirect y
 * no con JSON.
 *
 * El `state` es la defensa contra CSRF: se genera aquí, se guarda en una cookie
 * httpOnly y Google lo devuelve tal cual en el paso 2, donde se comparan. Sin
 * esto, cualquiera podría empujarle a alguien un callback con SU código y
 * dejarlo dentro de una cuenta ajena sin que se diera cuenta.
 *
 * La cookie lleva `domain` cuando hay SITE_URL: se pone en el host donde se
 * hizo clic (podía ser `www.`) y se lee en el host al que Google regresa (el
 * de SITE_URL). Sin el dominio, cruzar de `www` al dominio principal la
 * perdía y el callback contestaba `google_estado` (2026-09-23).
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origen = origenPublico(req);
  const next = destinoSeguro(req.nextUrl.searchParams.get('next'));

  if (!clientId) {
    // El sitio no debería ni pintar el botón (pregunta antes por
    // /auth/providers), pero si alguien llega a mano, se le dice qué pasa en
    // vez de dejarlo en una pantalla en blanco de Google.
    return NextResponse.redirect(new URL('/login?error=google_off', origen));
  }

  const state = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUriGoogle(origen));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  // Con varias cuentas de Google abiertas, sin esto entra siempre con la última
  // y no hay forma de cambiar.
  url.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(url);
  const domain = dominioCookie();
  res.cookies.set(ESTADO_GOOGLE_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(domain ? { domain } : {}),
    maxAge: 600, // 10 min: lo que dura ir a Google y volver, y ni un minuto más.
  });
  return res;
}
