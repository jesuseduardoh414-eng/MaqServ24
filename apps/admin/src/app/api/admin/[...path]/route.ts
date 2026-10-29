import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, API_URL } from '@/lib/admin';
import { clientIpHeaders } from '@/lib/client-ip';

/**
 * Proxy del admin: login escribe la cookie httpOnly; el resto reenvía a
 * /admin/* de la API con el Bearer. Solo rutas admin — nada abierto.
 */
/**
 * Un segmento que, DECODIFICADO, trae '/', '\', '%', '.' o '..' (QA 2026-09-25):
 * `auth%2f..%2f..%2fhealth` llegaba como un solo segmento y se salía del
 * prefijo /admin/ al normalizar la URL.
 */
function segmentoRaro(seg: string): boolean {
  let d: string;
  try { d = decodeURIComponent(seg); } catch { return true; }
  return d === '.' || d.includes('..') || /[\\/%]/.test(d);
}

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  // Todo lo de aquí sale con el prefijo `/admin/`; un `..` lo dejaría salirse de él
  // (`admin/../auth/login`). No hay escalada —fuera de /admin solo hay endpoints
  // públicos— pero la ruta que se envía debe ser la que se ve.
  if (path.some(segmentoRaro)) {
    return NextResponse.json({ message: 'Ruta no permitida' }, { status: 404 });
  }
  const joined = path.join('/');

  /**
   * Cerrar sesión (auditoría 2026-10-28): solo con POST —un GET desde otra
   * página bastaba para sacarte— y avisándole a la API, que cambia la versión
   * de sesión de la cuenta: un token copiado deja de servir en ese momento.
   */
  if (joined === 'logout') {
    if (req.method !== 'POST') return NextResponse.json({ message: 'Usa POST' }, { status: 405 });
    const actual = req.cookies.get(ADMIN_COOKIE)?.value;
    if (actual) {
      await fetch(`${API_URL}/admin/auth/logout`, {
        method: 'POST',
        headers: { ...clientIpHeaders(req), Authorization: `Bearer ${actual}` },
        signal: AbortSignal.timeout(8_000),
      }).catch(() => undefined);
    }
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
  // Archivos (la factura de un aliado, 2026-10-22): pasan sin leerlos como JSON.
  // Salen en el dominio DEL PANEL, con la sesión al lado: un archivo que el
  // navegador abriera como página (un XML con <script>, auditoría 2026-10-23)
  // correría como si fuera el panel. Solo el PDF y las fotos (sin SVG, que puede
  // traer código) se abren en línea; lo demás se descarga, sin adivinar el tipo
  // y en una caja sin permisos.
  const tipo = apiRes.headers.get('content-type') ?? '';
  if (apiRes.ok && tipo && !tipo.includes('application/json')) {
    const enLinea = /^(application\/pdf|image\/(png|jpeg|webp|gif|avif))(;|$)/i.test(tipo);
    const disposicion = apiRes.headers.get('content-disposition') ?? '';
    const nombre = /filename="[^"]*"/.exec(disposicion)?.[0];
    return new NextResponse(apiRes.body, {
      status: apiRes.status,
      headers: {
        'Content-Type': tipo,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': enLinea && disposicion ? disposicion : `attachment${nombre ? `; ${nombre}` : ''}`,
        ...(enLinea ? {} : { 'Content-Security-Policy': "default-src 'none'; sandbox" }),
      },
    });
  }
  const data = await apiRes.json().catch(() => null);

  // Login exitoso → guardar cookies httpOnly (access + refresh). También tras
  // "Cambiar mi contraseña": las demás sesiones caen y esta sigue con las nuevas.
  if ((joined === 'auth/login' || joined === 'auth/mi-contrasena') && apiRes.ok && data?.token) {
    const res = NextResponse.json(joined === 'auth/login' ? { admin: data.admin } : { ok: true });
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
export const PUT = forward; // Permisos → "Guardar cambios"
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
