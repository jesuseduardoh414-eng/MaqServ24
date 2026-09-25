import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { StorageEngine } from 'multer';
import { resolveImageMime } from './image-sniff';
import { mediaDir, sanitizeKey } from './media';

/** Extensión con la que se guarda cada tipo REAL (ver `image-sniff`). */
const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
};

/** Lo que aceptan por defecto todas las subidas: imágenes de verdad, sin SVG. */
const RASTER = /^image\/(png|jpeg|webp|avif|gif)$/;

/**
 * Motor de multer que guarda el archivo en disco (MEDIA_DIR/uploads/). Sustituye
 * al que subía a Supabase Storage y conserva su contrato: `file.filename` es el
 * nombre pelón y el handler guarda `uploads/${file.filename}` en la BD, que
 * imageUrl() resuelve contra IMAGE_BASE_URL.
 *
 * El tipo real del archivo se decide aquí a partir de los BYTES (ver
 * `image-sniff`), no del Content-Type que mande el navegador; y se decide en
 * este punto —y no en cada controller— porque todas las subidas pasan por aquí.
 *
 * @param allowed qué tipos REALES acepta este campo. Por defecto, imágenes sin
 *   SVG; el endpoint de favicon/logo pasa el suyo para permitir svg e ico.
 */
export function mediaStorage(allowed: RegExp = RASTER): StorageEngine {
  const engine: StorageEngine = {
    _handleFile(_req, file, cb) {
      const chunks: Buffer[] = [];
      file.stream.on('data', (c: Buffer) => chunks.push(c));
      file.stream.on('error', (e) => cb(e));
      file.stream.on('end', () => {
        const buf = Buffer.concat(chunks);
        const resolved = resolveImageMime(buf, allowed);
        if ('error' in resolved) {
          // Tiene que ser una HttpException: Nest reenvía tal cual las que ya lo
          // son, y cualquier otro Error acabaría como un 500 sin explicación.
          cb(new BadRequestException(resolved.error));
          return;
        }

        // La EXTENSIÓN sale del tipo real, nunca del nombre que mandaron
        // (QA 2026-09-25): un archivo con bytes de JPEG llamado "x.html" pasaba
        // el detector y el estático lo servía como text/html → JavaScript
        // ejecutable bajo nuestro dominio. Del nombre original solo queda la
        // base, como referencia legible.
        const ext = EXTENSION[resolved.mime] ?? 'bin';
        const base = file.originalname.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(-50) || 'archivo';
        const filename = `${Date.now()}-${base}.${ext}`;
        const rel = sanitizeKey(`uploads/${filename}`);
        const abs = join(mediaDir(), rel);
        fs.mkdir(join(mediaDir(), 'uploads'), { recursive: true })
          .then(() => fs.writeFile(abs, buf))
          .then(() => cb(null, { filename, size: buf.length, path: rel, mimetype: resolved.mime }))
          .catch(cb);
      });
    },
    _removeFile(_req, file, cb) {
      const p = (file as { path?: string }).path ?? `uploads/${file.filename}`;
      fs.unlink(join(mediaDir(), sanitizeKey(p)))
        .catch(() => undefined) // ya no estaba: da igual
        .then(() => cb(null));
    },
  };
  return engine;
}

/** Para el favicon/logo del sitio: además de imágenes, ahí sí tienen sentido SVG e ICO. */
export const ICON_TYPES = /^image\/(png|jpeg|webp|avif|gif|svg\+xml|x-icon)$/;
