import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, API_URL } from '@/lib/admin';
import { llaveValida, tipoDirecto } from '@/lib/acceso-directo';

/**
 * ABRIR SESIÓN CON EL ENLACE DEL ACCESO DIRECTO (2026-10-29).
 *
 * La página `/cotizar/<llave>/<tipo>` manda aquí cuando no hay sesión: se le
 * pide a la API la sesión de la cuenta interna (que solo usa los cotizadores),
 * se guardan las cookies como en el login y se vuelve al cotizador. Sin llave
 * válida, 404: no se distingue de una dirección que no existe.
 */
export async function GET(req: NextRequest) {
  const llave = req.nextUrl.searchParams.get('llave') ?? '';
  const tipo = tipoDirecto(req.nextUrl.searchParams.get('tipo') ?? '');
  if (!tipo || !llaveValida(llave)) return new NextResponse('No encontrado', { status: 404 });

  let datos: { token?: string; refresh_token?: string } | null = null;
  try {
    const r = await fetch(`${API_URL}/admin/auth/enlace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llave }),
      cache: 'no-store',
    });
    datos = r.ok ? await r.json() : null;
  } catch {
    datos = null;
  }
  if (!datos?.token) {
    return new NextResponse('No se pudo abrir el cotizador. Intenta de nuevo en un momento.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Relativa al propio panel (detrás del proxy el host interno no es el público).
  const res = new NextResponse(null, { status: 303, headers: { Location: `/cotizar/${encodeURIComponent(llave)}/${tipo}`, 'Referrer-Policy': 'no-referrer' } });
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };
  res.cookies.set(ADMIN_COOKIE, datos.token, opts);
  if (datos.refresh_token) res.cookies.set(ADMIN_REFRESH_COOKIE, datos.refresh_token, opts);
  return res;
}
