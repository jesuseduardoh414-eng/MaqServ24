import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';
import { clientIpHeaders } from '@/lib/client-ip';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Proxy de cotizaciones: público (invitados pueden cotizar); si hay sesión,
 * adjunta el Bearer para ligar la cotización al usuario.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
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
