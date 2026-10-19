'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mientras la unidad va en camino, la página se vuelve a pedir sola cada
 * minuto para que "a cuántos km va" no se quede congelado (2026-10-14).
 */
export function AutoRefresco({ cadaMs = 60_000 }: { cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), cadaMs);
    return () => clearInterval(t);
  }, [router, cadaMs]);
  return null;
}
