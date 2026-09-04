import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE, ALIADO_COOKIE } from '@/lib/cookies';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const WEEK = 60 * 60 * 24 * 7;
const REFRESH_SKEW = 120; // renovar cuando falten <2 min para expirar
/** Los 30 días que dura el enlace del aliado (ver provider-access.ts en la API). */
const ALIADO_MAX_AGE = 60 * 60 * 24 * 30;

/** Lee el claim `exp` de un JWT SIN verificar la firma (solo para decidir si renovar). */
function jwtExp(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

/**
 * Renovación transparente del access token de Supabase. Sin esto la cookie dura
 * 7 días pero el JWT de adentro expira en minutos y la sesión "se cierra sola".
 * Corre ANTES de los Server Components y route handlers, así todos leen el token
 * fresco en la misma petición.
 */
export async function middleware(req: NextRequest) {
  // El logout borra las cookies en su propio handler; no renovar aquí.
  if (req.nextUrl.pathname === '/api/auth/logout') return NextResponse.next();

  /**
   * EL ENLACE DEL ALIADO NO SE QUEDA EN LA BARRA DE DIRECCIONES.
   *
   * El correo trae `/aliado?t=<jwt>` y ese token ES la credencial, durante 30
   * dias. Dejarlo en la URL lo escribe en el historial del navegador, en los
   * logs de acceso de Vercel y Render (que registran el query string) y en
   * cualquier captura que el aliado comparta por WhatsApp.
   *
   * Se canjea aqui —y no en la pagina— porque un Server Component no puede
   * escribir cookies, y porque asi siguen funcionando los enlaces YA enviados.
   */
  if (req.nextUrl.pathname === '/aliado') {
    const t = req.nextUrl.searchParams.get('t');
    if (t) {
      const limpia = new URL(req.nextUrl);
      limpia.searchParams.delete('t');
      const res = NextResponse.redirect(limpia);
      res.cookies.set(ALIADO_COOKIE, t, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ALIADO_MAX_AGE,
      });
      return res;
    }
  }

  const access = req.cookies.get(SESSION_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!access || !refresh) return NextResponse.next();

  const exp = jwtExp(access);
  const now = Math.floor(Date.now() / 1000);
  // Todavía válido con margen → seguir sin tocar nada (caso común, sin fetch).
  if (exp !== null && exp - now > REFRESH_SKEW) return NextResponse.next();

  try {
    // TOPE OBLIGATORIO: el matcher cubre TODAS las rutas, así que un fetch
    // colgado aquí (API de Render dormida) es un MIDDLEWARE_INVOCATION_TIMEOUT
    // en el sitio completo para el visitante — exactamente el incidente del
    // panel admin. Mismo fix que apps/admin/src/middleware.ts.
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!r.ok) {
      // Refresh inválido/expirado → cerrar sesión de verdad.
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE);
      res.cookies.delete(REFRESH_COOKIE);
      return res;
    }

    const data = (await r.json()) as { token?: string; refresh_token?: string };
    if (!data.token) return NextResponse.next();

    // Inyectar el token nuevo en el request para que ESTA misma petición ya lo use.
    req.cookies.set(SESSION_COOKIE, data.token);
    if (data.refresh_token) req.cookies.set(REFRESH_COOKIE, data.refresh_token);

    const res = NextResponse.next({ request: req });
    const opts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: WEEK,
      path: '/',
    };
    res.cookies.set(SESSION_COOKIE, data.token, opts);
    if (data.refresh_token) res.cookies.set(REFRESH_COOKIE, data.refresh_token, opts);
    return res;
  } catch {
    // Si la API no responde, no rompas la navegación; se reintenta en la próxima.
    return NextResponse.next();
  }
}

export const config = {
  // Todo excepto assets estáticos de Next; incluye páginas y /api/* (proxy, checkout…).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|webp|ico|css|js|woff2?|ttf|map)).*)',
  ],
};
