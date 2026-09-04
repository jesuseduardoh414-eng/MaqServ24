import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/session';
import { clientIpHeaders } from '@/lib/client-ip';

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

  if (action !== 'login' && action !== 'register') {
    return NextResponse.json({ message: 'Acción inválida' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const remember = body?.remember !== false; // login: casilla; register: siempre recuerda
  let apiRes: Response;
  try {
    // Tope explícito: con Render despertando, el fetch colgado dejaba al login
    // esperando hasta que Vercel matara la función (500 crudo).
    apiRes = await fetch(`${API_URL}/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
      body: JSON.stringify(body),
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

  const res = NextResponse.json({ user: data.user });
  // Con "recordar": cookie de 7 días. Sin recordar: cookie de sesión (expira al cerrar
  // el navegador). El access token de Supabase se renueva por el middleware.
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
