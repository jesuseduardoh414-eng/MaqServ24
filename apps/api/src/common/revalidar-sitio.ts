import { Logger } from '@nestjs/common';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
const log = new Logger('RevalidarSitio');

/**
 * Pide al sitio que regenere sus páginas tras publicar algo del tema.
 *
 * El resultado VIAJA al panel: antes fallaba en silencio total (sin secret se
 * saltaba sin log, y un 503/401 del endpoint no es excepción, así que ni el
 * warn corría) y el admin veía "publicado" con el sitio viejo — el incidente
 * de REVALIDATE_SECRET. Devuelve el error legible, o null si todo salió bien.
 */
export async function revalidarSitio(): Promise<{ revalidated: boolean; revalidateError: string | null }> {
  const secret = process.env.REVALIDATE_SECRET;
  let revalidateError: string | null = null;
  if (!secret) {
    revalidateError = 'REVALIDATE_SECRET no está configurado en la API: el sitio se actualizará solo por caducidad de caché (~1 min).';
  } else {
    try {
      const res = await fetch(`${SITE_URL}/api/revalidate?secret=${encodeURIComponent(secret)}&path=/`, {
        method: 'POST',
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return { revalidated: true, revalidateError: null };
      revalidateError = `El sitio respondió ${res.status} al revalidar (¿REVALIDATE_SECRET distinto en el sitio?). Se actualizará por caducidad de caché (~1 min).`;
    } catch (err) {
      revalidateError = `No se pudo contactar al sitio para revalidar: ${(err as Error).message}. Se actualizará por caducidad de caché (~1 min).`;
    }
  }
  log.warn(revalidateError);
  return { revalidated: false, revalidateError };
}
