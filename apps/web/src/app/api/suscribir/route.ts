import { NextRequest, NextResponse } from 'next/server';
import { clientIpHeaders } from '@/lib/client-ip';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** Alta pública de newsletter. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    const apiRes = await fetch(`${API_URL}/content/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeaders(req) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
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
