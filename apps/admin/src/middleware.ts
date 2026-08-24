import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, API_URL } from '@/lib/cookies';

const WEEK = 60 * 60 * 24 * 7;
const REFRESH_SKEW = 120; // renovar cuando falten <2 min para expirar

/**
 * Tope de espera al renovar el token.
 *
 * Sin esto el `fetch` no tenía límite, y el `catch` de abajo —que existe justo
 * para no romper la navegación— nunca llegaba a ejecutarse: Vercel mataba la
 * invocación entera antes y el panel devolvía `504 MIDDLEWARE_INVOCATION_TIMEOUT`
 * en TODAS las rutas. Pasa cuando la API de Render (plan free) lleva rato sin
 * tráfico y se duerme: el arranque en frío tarda bastante más que el límite del
 * middleware.
 *
 * 8 s cubre de sobra una API despierta aunque vaya lenta, y deja margen amplio
 * contra el límite de Vercel. Si se agota, se sigue navegando con el token que
 * hubiera y se reintenta en la siguiente petición.
 */
const TIMEOUT_REFRESH_MS = 8_000;

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
 * Renovación transparente del token admin de Supabase. La cookie dura 7 días pero
 * el JWT expira en minutos; sin esto el panel "cierra la sesión sola". Corre antes
 * de los Server Components (getAdmin/adminFetch) para que lean el token fresco.
 * Reutiliza /auth/refresh: al renovar, Supabase preserva role=admin y app_admin_id.
 */
export async function middleware(req: NextRequest) {
  // El logout borra las cookies en su propio handler; no renovar aquí.
  if (req.nextUrl.pathname === '/api/admin/logout') return NextResponse.next();

  const access = req.cookies.get(ADMIN_COOKIE)?.value;
  const refresh = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!access || !refresh) return NextResponse.next();

  const exp = jwtExp(access);
  const now = Math.floor(Date.now() / 1000);
  // Todavía válido con margen → seguir sin tocar nada (caso común, sin fetch).
  if (exp !== null && exp - now > REFRESH_SKEW) return NextResponse.next();

  try {
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      signal: AbortSignal.timeout(TIMEOUT_REFRESH_MS),
    });

    if (!r.ok) {
      // Refresh inválido/expirado → cerrar sesión de verdad.
      const res = NextResponse.next();
      res.cookies.delete(ADMIN_COOKIE);
      res.cookies.delete(ADMIN_REFRESH_COOKIE);
      return res;
    }

    const data = (await r.json()) as { token?: string; refresh_token?: string };
    if (!data.token) return NextResponse.next();

    // Inyectar el token nuevo en el request para que ESTA misma petición ya lo use.
    req.cookies.set(ADMIN_COOKIE, data.token);
    if (data.refresh_token) req.cookies.set(ADMIN_REFRESH_COOKIE, data.refresh_token);

    const res = NextResponse.next({ request: req });
    const opts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: WEEK,
      path: '/',
    };
    res.cookies.set(ADMIN_COOKIE, data.token, opts);
    if (data.refresh_token) res.cookies.set(ADMIN_REFRESH_COOKIE, data.refresh_token, opts);
    return res;
  } catch {
    // Si la API no responde, no rompas la navegación; se reintenta en la próxima.
    return NextResponse.next();
  }
}

export const config = {
  // Todo excepto assets estáticos de Next; incluye páginas y /api/admin/* (proxy).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|webp|ico|css|js|woff2?|ttf|map)).*)',
  ],
};
