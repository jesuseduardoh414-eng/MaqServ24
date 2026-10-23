import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/session';
import { VERIFICACION_COOKIE } from '@/lib/cookies';
import { clientIpHeaders } from '@/lib/client-ip';

/**
 * La llave de ESTE navegador para el enlace "Confirma tu cuenta" (auditoría
 * 2026-10-23): la API mete su huella en el enlace y solo da sesión si se abre
 * aquí (ver /api/auth/verificar). Se reutiliza la que ya hubiera, para que
 * sirvan todos los enlaces pedidos desde este navegador.
 */
function llaveNavegador(req: NextRequest): string {
  const ya = req.cookies.get(VERIFICACION_COOKIE)?.value;
  return ya && /^[a-f0-9]{64}$/.test(ya) ? ya : randomBytes(32).toString('hex');
}

function guardarLlave(res: NextResponse, llave: string): NextResponse {
  res.cookies.set(VERIFICACION_COOKIE, llave, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * GET /api/auth/session: devuelve el usuario de la cookie (o null).
 * Lo usa el header en cliente para no volver dinámicas las páginas estáticas.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== 'session') {
    return NextResponse.json({ message: 'Acción inválida' }, { status: 404 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return NextResponse.json({ user: null });
    return NextResponse.json({ user: await res.json() });
  } catch {
    return NextResponse.json({ user: null });
  }
}

/**
 * Proxy de auth: reenvía login/register a la API y guarda el JWT en cookie
 * httpOnly + SameSite=Lax. `logout` solo borra la cookie.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  // Restablecer contraseña: siempre respondemos ok (anti-enumeración).
  if (action === 'forgot') {
    const body = await req.json().catch(() => null);
    try {
      const apiRes = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
        body: JSON.stringify({ email: body?.email }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await apiRes.json().catch(() => ({ ok: true }));
      return NextResponse.json(data, { status: apiRes.ok ? 200 : apiRes.status });
    } catch {
      return NextResponse.json({ ok: true }); // anti-enumeración también en fallo
    }
  }

  // Segundo paso del restablecimiento: token del correo + contraseña nueva.
  if (action === 'reset') {
    const body = await req.json().catch(() => null);
    try {
      const apiRes = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
        body: JSON.stringify({ token: body?.token, password: body?.password }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await apiRes.json().catch(() => null);
      return NextResponse.json(data ?? { message: 'Sin respuesta del servidor' }, { status: apiRes.status });
    } catch {
      return NextResponse.json({ message: 'El servidor no respondió; inténtalo de nuevo.' }, { status: 504 });
    }
  }

  // Reenviar el correo de confirmación. Siempre ok (anti-enumeración).
  if (action === 'resend') {
    const body = await req.json().catch(() => null);
    const llave = llaveNavegador(req);
    try {
      const apiRes = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
        body: JSON.stringify({ email: body?.email, next: body?.next, navegador: llave }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await apiRes.json().catch(() => ({ ok: true }));
      return guardarLlave(NextResponse.json(data, { status: apiRes.ok ? 200 : apiRes.status }), llave);
    } catch {
      return NextResponse.json({ ok: true });
    }
  }

  if (action !== 'login' && action !== 'register') {
    return NextResponse.json({ message: 'Acción inválida' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const remember = body?.remember !== false; // login: casilla; register: siempre recuerda
  const llave = action === 'register' ? llaveNavegador(req) : null;
  let apiRes: Response;
  try {
    // Tope explícito: con Render despertando, el fetch colgado dejaba al login
    // esperando hasta que Vercel matara la función (500 crudo).
    apiRes = await fetch(`${API_URL}/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
      body: JSON.stringify(llave ? { ...(body ?? {}), navegador: llave } : body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      { message: 'El servidor está iniciando; espera unos segundos e inténtalo de nuevo.' },
      { status: 504 },
    );
  }
  // Render devuelve HTML mientras despierta: sin el catch, el .json() daba 500 crudo.
  const data = await apiRes.json().catch(() => null);
  if (data === null) {
    return NextResponse.json(
      { message: 'El servidor está iniciando; espera unos segundos e inténtalo de nuevo.' },
      { status: 503 },
    );
  }

  if (!apiRes.ok) {
    return NextResponse.json(data, { status: apiRes.status });
  }

  /**
   * Registro con contraseña: la API ya NO devuelve sesión, devuelve "confirma
   * tu correo" (2026-09-23). Sin esto, `data.token` sería undefined y se
   * escribiría una cookie basura que el middleware tomaría por sesión.
   */
  if (data?.verificar) {
    const res = NextResponse.json({ verificar: true, email: data.email });
    return llave ? guardarLlave(res, llave) : res;
  }

  const res = NextResponse.json({ user: data.user });
  // Con "recordar": cookie de 7 días. Sin recordar: cookie de sesión (expira al cerrar
  // el navegador). El access token (1 h) lo renueva el middleware con el refresh.
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(remember ? { maxAge: 60 * 60 * 24 * 7 } : {}),
  };
  res.cookies.set(SESSION_COOKIE, data.token, opts);
  if (data.refresh_token) res.cookies.set(REFRESH_COOKIE, data.refresh_token, opts);
  return res;
}
