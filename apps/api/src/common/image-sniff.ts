/**
 * Comprueba que un archivo subido SEA lo que dice ser, mirando sus primeros bytes.
 *
 * `file.mimetype` lo manda el navegador: es una etiqueta, no un hecho. Los controllers
 * validaban esa etiqueta ("¿dice png?") y luego el archivo se guardaba en Supabase
 * Storage con ELLA, o sea que quien subía decidía cómo se serviría su propio archivo
 * después. Aquí se mira el contenido y gana el contenido.
 *
 * Los formatos de imagen empiezan por una firma fija ("magic bytes"), así que se
 * reconocen sin librerías. El SVG no: es texto XML y además admite `<script>`, por eso
 * va aparte.
 */

const startsWith = (buf: Buffer, sig: number[], offset = 0): boolean =>
  buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

/** Tipo real del contenido, o null si no lo reconocemos. */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'; // GIF8(7|9)a
  if (startsWith(buf, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon';

  // RIFF....WEBP — el tamaño va en medio, por eso se comprueban los dos trozos.
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  // ....ftyp{avif|avis} — caja ISO-BMFF, la marca empieza en el byte 4.
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  // SVG: texto. Se acepta solo si de verdad parece SVG y no trae nada ejecutable.
  const head = buf.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!doctype svg')) {
    return isSafeSvg(buf) ? 'image/svg+xml' : null;
  }
  return null;
}

/**
 * Un SVG es XML ejecutable: puede traer `<script>`, `onload=` o un `href="javascript:"`.
 * Se sirve desde el dominio de Supabase Storage (no el de la tienda), así que el daño es
 * acotado, pero sigue siendo código de otro alojado con nuestra marca. Aquí se rechaza
 * en vez de intentar limpiarlo: los SVG que sube el admin son logos y no llevan nada de
 * esto, así que rechazar no estorba y no deja rendijas.
 */
function isSafeSvg(buf: Buffer): boolean {
  const text = buf.toString('utf8');
  // Auditoría 2026-10-28: pasaban `<s:script>` (con prefijo), `<h:script xmlns:h=…xhtml>`
  // y `&#106;avascript:` (con entidades). Ahora se rechaza también:
  //  - cualquier elemento peligroso con prefijo (script, foreignObject, iframe…);
  //  - las entidades numéricas (&#…;), que sirven para esconder palabras;
  //  - "javascript:" aunque venga partido con espacios o saltos;
  //  - href/xlink:href a data: que no sea imagen.
  if (/<\s*([\w.-]+:)?(script|foreignobject|iframe|embed|object|handler|listener)\b/i.test(text)) return false;
  if (/&#/.test(text)) return false;
  if (/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(text)) return false;
  if (/href\s*=\s*["']?\s*data:(?!image\/(png|jpe?g|gif|webp))/i.test(text)) return false;
  return !/\son\w+\s*=|<\s*!ENTITY/i.test(text);
}

/**
 * Tipo definitivo con el que se guarda y se servirá el archivo.
 * @param declared lo que dijo el navegador (solo para dar un error entendible)
 * @param allowed  patrón de tipos que acepta ese endpoint
 * @returns el tipo REAL, o null si no es una imagen reconocible o no coincide con lo permitido
 */
export function resolveImageMime(buf: Buffer, allowed: RegExp): { mime: string } | { error: string } {
  const real = sniffImageMime(buf);
  if (!real) return { error: 'El archivo no es una imagen válida (o es un SVG con contenido ejecutable).' };
  if (!allowed.test(real)) return { error: `Ese formato no se acepta aquí (el archivo es ${real}).` };
  return { mime: real };
}
