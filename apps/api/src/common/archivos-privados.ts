import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, normalize, sep } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { StorageEngine } from 'multer';
import { mediaDir } from './media';

/**
 * ARCHIVOS PRIVADOS (2026-10-22): las facturas de los aliados.
 *
 * Todo lo de `mediaDir()` es PÚBLICO (media.maqser24.com sirve esa carpeta tal
 * cual). Una factura trae RFC, montos y datos fiscales, así que va en otra
 * carpeta, hermana de la de medios y fuera de cualquier sitio servido, con un
 * nombre que no se adivina. Solo sale por la API: al panel (módulo
 * Administración) y al aliado dueño, desde su portal.
 *
 * En cPanel: /home/maqserv24/privado (junto a /home/maqserv24/media). Se puede
 * mover con PRIVATE_DIR.
 */
export function privadoDir(): string {
  return process.env.PRIVATE_DIR ?? join(mediaDir(), '..', 'privado');
}

/** Ruta absoluta de un archivo privado guardado, sin dejar salir de la carpeta. */
export function rutaPrivada(rel: string): string {
  const base = normalize(privadoDir());
  const abs = normalize(join(base, rel));
  if (!abs.startsWith(base + sep)) throw new BadRequestException('Archivo inválido');
  return abs;
}

/** PDF por sus bytes (%PDF-) o XML (CFDI) por su arranque; nada más. */
function tipoFactura(buf: Buffer): 'pdf' | 'xml' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  const inicio = buf.subarray(0, 300).toString('utf8').replace(/^﻿/, '').trimStart();
  if (inicio.startsWith('<?xml') || inicio.startsWith('<cfdi:')) return 'xml';
  return null;
}

/**
 * Motor de multer para facturas: decide el tipo por los BYTES, como el de
 * imágenes, y guarda en `privado/facturas/<uuid>.<pdf|xml>`.
 */
export function facturaStorage(): StorageEngine {
  return {
    _handleFile(_req, file, cb) {
      const chunks: Buffer[] = [];
      file.stream.on('data', (c: Buffer) => chunks.push(c));
      file.stream.on('error', (e) => cb(e));
      file.stream.on('end', () => {
        const buf = Buffer.concat(chunks);
        const tipo = tipoFactura(buf);
        if (!tipo) {
          cb(new BadRequestException('La factura tiene que ser el PDF o el XML que te dio tu sistema de facturación.'));
          return;
        }
        const rel = `facturas/${randomUUID()}.${tipo}`;
        fs.mkdir(join(privadoDir(), 'facturas'), { recursive: true })
          .then(() => fs.writeFile(join(privadoDir(), rel), buf))
          .then(() => cb(null, { filename: rel, size: buf.length, path: rel, mimetype: tipo === 'pdf' ? 'application/pdf' : 'application/xml' }))
          .catch(cb);
      });
    },
    _removeFile(_req, file, cb) {
      const p = (file as { path?: string }).path;
      (p ? fs.unlink(rutaPrivada(p)) : Promise.resolve())
        .catch(() => undefined)
        .then(() => cb(null));
    },
  };
}
