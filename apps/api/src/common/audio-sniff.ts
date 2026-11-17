/**
 * Igual que `video-sniff`, para audio (2026-11-17, música de fondo del sitio):
 * el tipo lo deciden los BYTES, no la etiqueta que manda el navegador.
 *
 * Se aceptan los formatos que reproduce cualquier navegador en un <audio>:
 * MP3, M4A (AAC) y OGG. WAV no: pesa diez veces más para lo mismo.
 */

const startsWith = (buf: Buffer, sig: number[], offset = 0): boolean =>
  buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

export function sniffAudioMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // MP3: con etiqueta ID3 al inicio, o directo un encabezado de cuadro (11 bits en 1).
  if (startsWith(buf, [0x49, 0x44, 0x33])) return 'audio/mpeg';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0) return 'audio/mpeg';
  // M4A: contenedor ISO-BMFF con marca de audio.
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const marca = buf.subarray(8, 12).toString('latin1');
    return /^(M4A |M4B |mp42|isom|dash)$/.test(marca) ? 'audio/mp4' : null;
  }
  if (startsWith(buf, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString('latin1') === 'WAVE') return 'audio/wav';
  return null;
}

export const AUDIO_TYPES = /^audio\/(mpeg|mp4|ogg)$/;

export function resolveAudioMime(buf: Buffer, allowed: RegExp): { mime: string } | { error: string } {
  const real = sniffAudioMime(buf);
  if (real === 'audio/wav') return { error: 'Ese audio es WAV y pesa demasiado. Pásalo a MP3 y súbelo otra vez.' };
  if (!real) return { error: 'El archivo no es un audio MP3, M4A u OGG.' };
  if (!allowed.test(real)) return { error: `Ese formato no se acepta aquí (el archivo es ${real}).` };
  return { mime: real };
}
