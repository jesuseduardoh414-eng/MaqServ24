import { join } from 'node:path';

/**
 * Dónde viven los archivos subidos (fotos de producto, galería, evidencias,
 * documentos de aliados). Antes: bucket `media` de Supabase Storage. Ahora: una
 * carpeta en disco que Apache sirve como sitio estático.
 *
 * En cPanel: MEDIA_DIR=/home/maqserv24/media y el subdominio media.maqserv24.com
 * apunta a esa carpeta, así que IMAGE_BASE_URL=https://media.maqserv24.com y las
 * imágenes ni pasan por Node. En local, sin variables, es `apps/api/media` y la
 * propia API la sirve en /media/ (ver main.ts).
 *
 * La carpeta va FUERA del árbol de la app a propósito: cada despliegue borra y
 * vuelve a subir `nodeapps/api`, y las fotos no deben irse con él.
 */
export function mediaDir(): string {
  return process.env.MEDIA_DIR ?? join(process.cwd(), 'media');
}

/** Base pública de los archivos. Coincide con lo que resuelve `imageUrl()`. */
export function mediaBaseUrl(): string {
  if (process.env.IMAGE_BASE_URL) return process.env.IMAGE_BASE_URL.replace(/\/$/, '');
  const api = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  return `${api}/media`;
}

/**
 * Sanitiza rutas relativas de archivos. Se heredó del bucket de Supabase, que
 * rechazaba caracteres fuera de este set; se conserva porque las rutas YA
 * guardadas en la BD pasaron por aquí y `imageUrl()` las resuelve igual.
 * DEBE coincidir con el sanitize de catalog/images.ts.
 */
export const sanitizeKey = (k: string): string =>
  k
    .split('/')
    .map((seg) => seg.replace(/[^A-Za-z0-9_.\-!*'() &$@=;:+,?]/g, '_'))
    .join('/');

/**
 * Borra del disco fotos que ya no usa nadie (QA 2026-09-25: al rechazar una
 * propuesta quedaban huérfanas). Solo toca `uploads/<nombre>` y por NOMBRE
 * de archivo: una ruta rara en la BD nunca puede salirse de esa carpeta.
 * Nunca lanza.
 */
export async function borrarSubidas(rutas: Array<string | null | undefined>): Promise<void> {
  const { unlink } = await import('node:fs/promises');
  const { basename } = await import('node:path');
  for (const r of rutas) {
    if (!r || !r.startsWith('uploads/')) continue;
    const nombre = basename(r);
    if (!nombre || nombre.startsWith('.')) continue;
    await unlink(join(mediaDir(), 'uploads', nombre)).catch(() => undefined);
  }
}
