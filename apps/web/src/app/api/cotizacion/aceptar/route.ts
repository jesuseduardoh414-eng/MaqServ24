import { NextRequest, NextResponse } from 'next/server';
import { clientIpHeaders } from '@/lib/client-ip';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** Aceptar una cotización del panel (página /cotizacion/aceptar): el enlace del correo viaja como cabecera a la API. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { t?: unknown } | null;
  const token = typeof body?.t === 'string' ? body.t : '';
  if (!token) return NextResponse.json({ message: 'Este enlace está incompleto.' }, { status: 400 });
  try {
    const apiRes = await fetch(`${API_URL}/quoter/aceptar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...clientIpHeaders(req) },
      signal: AbortSignal.timeout(30_000),
    });
    const data = await apiRes.json().catch(() => null);
    return NextResponse.json(data, { status: apiRes.status });
  } catch {
    return NextResponse.json(
      { message: 'El servidor está iniciando; espera unos segundos e inténtalo de nuevo.' },
      { status: 504 },
    );
  }
}
