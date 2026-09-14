import { mediaBaseUrl, sanitizeKey } from '../common/media';

/**
 * Resolución de fotos. Los archivos viven en disco (MEDIA_DIR) y se sirven
 * desde IMAGE_BASE_URL (en cPanel, https://media.maqserv24.com por Apache; en
 * local, la propia API en /media/). Las rutas guardadas en la BD no cambiaron
 * con la salida de Supabase Storage:
 * - filename legacy (ej. "1772826218retoexcava.png") → <base>/<name>
 * - "uploads/xxx" (subidas)                          → <base>/uploads/xxx
 * - URL absoluta                                     → tal cual
 */
export function imageUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  if (photo.startsWith('http')) return photo;
  return `${mediaBaseUrl()}/${sanitizeKey(photo)}`;
}

/**
 * Campos legacy de `inf_sitio` (misión/visión/objetivos) a veces vienen como
 * JSON `{"title":...,"text":"..."}` (con escapes unicode). Devuelve solo el
 * texto plano; si no es ese formato, lo deja igual. Así la página y el editor
 * muestran texto limpio, y al reguardar queda normalizado en la BD.
 */
export function normLegacyText(v: string | null | undefined): string | null {
  if (v == null) return v ?? null;
  const s = v.trim();
  if (s.startsWith('{') && s.includes('"text"')) {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === 'object' && 'text' in o) return String((o as { text?: unknown }).text ?? '');
    } catch { /* no es JSON válido: se deja igual */ }
  }
  return v;
}
