import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

// El tope del fetch (25 s) debe caber en la función: sin esto, Vercel Hobby la
// mata a los ~10 s y volvemos al escenario de la orden fantasma.
export const maxDuration = 30;

/** Proxy del checkout: agrega el Bearer de la cookie httpOnly y reenvía a la API. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Sesión requerida' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  try {
    // Tope < al verdugo de Vercel (~10 s en Hobby): sin él, Vercel mataba la
    // función pero la petición YA había salido — la API creaba la orden y el
    // cliente veía un error y reintentaba (orden duplicada). El reintento va
    // protegido además por la idempotencyKey que manda el CheckoutForm.
    const apiRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    // Render devuelve HTML ("Bad Gateway") mientras despierta: sin el catch,
    // el .json() reventaba y el cliente veía un 500 crudo.
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
      { message: 'No pudimos contactar al servidor. Tu pedido NO se duplicará si reintentas.' },
      { status: 504 },
    );
  }
}
