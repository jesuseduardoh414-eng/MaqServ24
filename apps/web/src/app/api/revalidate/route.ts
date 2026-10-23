import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Invalidación bajo demanda del cache ISR.
 * El admin (F4) la dispara al publicar un tema o contenido:
 *   POST /api/revalidate?secret=...&path=/
 * Sin REVALIDATE_SECRET configurado, el endpoint queda deshabilitado.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET no configurado' }, { status: 503 });
  }
  // Por cabecera (la API, desde 2026-10-23) o por ?secret= (versiones viejas de
  // la API). En tiempo constante: con !== se puede adivinar por partes midiendo.
  const dado = req.headers.get('x-revalidate-secret') ?? req.nextUrl.searchParams.get('secret') ?? '';
  const huella = (s: string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(huella(dado), huella(secret))) {
    return NextResponse.json({ error: 'Secret inválido' }, { status: 401 });
  }
  const path = req.nextUrl.searchParams.get('path') ?? '/';
  revalidatePath(path, 'layout'); // layout: invalida también el tema inyectado
  return NextResponse.json({ revalidated: true, path, ts: Date.now() });
}
