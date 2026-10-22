import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';
import { clientIpHeaders } from '@/lib/client-ip';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * La solicitud como documento antes de enviarla (2026-10-19): el paso de
 * Confirmación de /cotizar. Mismo cuerpo que `/api/cotizar`; la API la arma
 * con el documento de siempre y no guarda nada.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Para pedir una cotización necesitas entrar a tu cuenta.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  try {
    const apiRes = await fetch(`${API_URL}/quotes/vista-previa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req), Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await apiRes.json().catch(() => null);
    if (data === null) return NextResponse.json({ message: 'No se pudo armar el documento.' }, { status: 503 });
    return NextResponse.json(data, { status: apiRes.status });
  } catch {
    return NextResponse.json({ message: 'No se pudo armar el documento.' }, { status: 504 });
  }
}
