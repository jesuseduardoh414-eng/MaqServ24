import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';
import { clientIpHeaders } from '@/lib/client-ip';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Proxy de cotizaciones. Desde el 2026-09-23 pedir cotización exige cuenta:
 * adjunta el Bearer de la cookie httpOnly y, si no hay sesión, contesta 401
 * aquí mismo sin molestar a la API (que igualmente lo rechazaría).
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { message: 'Para pedir una cotización necesitas entrar a tu cuenta.' },
      { status: 401 },
    );
  }
  const body = await req.json().catch(() => null);
  try {
    const apiRes = await fetch(`${API_URL}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...clientIpHeaders(req),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await apiRes.json().catch(() => null);
    if (data === null) {
      return NextResponse.json(
        { message: 'El servidor está iniciando; espera unos segundos e inténtalo de nuevo.' },
        { status: 503 },
      );
    }
    return NextResponse.json(data, { status: apiRes.status });
  } catch {
    return NextResponse.json(
      { message: 'El servidor está iniciando; espera unos segundos e inténtalo de nuevo.' },
      { status: 504 },
    );
  }
}
