/**
 * Igual que `image-sniff`, para videos: el tipo lo deciden los BYTES, no la
 * etiqueta que manda el navegador.
 *
 * Se aceptan los dos formatos que reproduce cualquier navegador dentro de un
 * <video>: MP4 y WebM. El .mov del iPhone (QuickTime) se rechaza con un mensaje
 * que dice cómo exportarlo: muchos vienen en HEVC, que Chrome en Windows no
 * reproduce, y la tarjeta saldría negra sin que nadie se entere.
 */

const startsWith = (buf: Buffer, sig: number[], offset = 0): boolean =>
  buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

/** Marcas ISO-BMFF ("ftyp") que son MP4 de video. AVIF también es ftyp, y no es video. */
const MARCA_MP4 = /^(iso\d|isom|mp4\d|mp71|avc1|M4V|dash|MSNV|f4v )/;

export function sniffVideoMime(buf: Buffer): string | null {
  if (buf.length < 16) return null;
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const marca = buf.subarray(8, 12).toString('latin1');
    if (marca === 'qt  ') return 'video/quicktime';
    if (MARCA_MP4.test(marca)) return 'video/mp4';
    return null;
  }
  // EBML (Matroska); WebM lo declara en el DocType de la cabecera.
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) {
    return buf.subarray(0, 64).toString('latin1').includes('webm') ? 'video/webm' : null;
  }
  return null;
}

export const VIDEO_TYPES = /^video\/(mp4|webm)$/;

export function resolveVideoMime(buf: Buffer, allowed: RegExp): { mime: string } | { error: string } {
  const real = sniffVideoMime(buf);
  if (real === 'video/quicktime') {
    return { error: 'Ese video es .mov (iPhone). Expórtalo como MP4 —CapCut, HandBrake o casi cualquier editor lo hace— y súbelo otra vez.' };
  }
  if (!real) return { error: 'El archivo no es un video MP4 o WebM.' };
  if (!allowed.test(real)) return { error: `Ese formato no se acepta aquí (el archivo es ${real}).` };
  return { mime: real };
}
