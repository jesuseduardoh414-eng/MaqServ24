import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, API_URL } from '@/lib/admin';
import { clientIpHeaders } from '@/lib/client-ip';

/**
 * Proxy del admin: login escribe la cookie httpOnly; el resto reenvía a
 * /admin/* de la API con el Bearer. Solo rutas admin — nada abierto.
 */
async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  // Todo lo de aquí sale con el prefijo `/admin/`; un `..` lo dejaría salirse de él
  // (`admin/../auth/login`). No hay escalada —fuera de /admin solo hay endpoints
  // públicos— pero la ruta que se envía debe ser la que se ve.
  if (path.some((seg) => seg === '.' || seg === '..' || seg.includes('\\') || seg.includes('%2e') || seg.includes('%2E'))) {
    return NextResponse.json({ message: 'Ruta no permitida' }, { status: 404 });
  }
  const joined = path.join('/');

  if (joined === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(ADMIN_COOKIE);
    res.cookies.delete(ADMIN_REFRESH_COOKIE);
    return res;
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const headers: Record<string, string> = {
    ...clientIpHeaders(req),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    headers['Content-Type'] = req.headers.get('content-type') ?? 'application/json';
    init.body = await req.blob();
  }

  // Reenviar el query string (?page, ?search, …); sin esto la paginación y la
  // búsqueda del admin no llegaban a la API.
  const search = req.nextUrl.search;
  // Tope explícito: con Render dormido, el fetch colgado dejaba la función a
  // merced del verdugo de la plataforma (error crudo, sin mensaje).
  init.signal = AbortSignal.timeout(20_000);
  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/admin/${joined}${search}`, init);
  } catch {
    return NextResponse.json(
      { message: 'El servidor está iniciando (Render); espera unos segundos e inténtalo de nuevo.' },
      { status: 504 },
    );
  }
  const data = await apiRes.json().catch(() => null);

  // Login exitoso → guardar cookies httpOnly (access + refresh)
  if (joined === 'auth/login' && apiRes.ok && data?.token) {
    const res = NextResponse.json({ admin: data.admin });
    // El access token expira en minutos; el middleware lo renueva con el refresh.
    const opts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    };
    res.cookies.set(ADMIN_COOKIE, data.token, opts);
    if (data.refresh_token) res.cookies.set(ADMIN_REFRESH_COOKIE, data.refresh_token, opts);
    return res;
  }
  return NextResponse.json(data, { status: apiRes.status });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
