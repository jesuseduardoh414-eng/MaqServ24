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

/**
 * Lo que un CFDI nunca trae y un XML que ejecuta código sí (auditoría
 * 2026-10-23): un aliado subía como "factura" un XML con un <script> del
 * espacio XHTML y, al abrirlo, corría dentro del panel con la sesión de quien
 * lo abría. Se sirve además como descarga (admin-money.controller.ts) y el
 * proxy del panel no deja abrir en línea nada que no sea PDF: esto es la
 * tercera capa, no la única.
 */
const XML_PELIGROSO = [
  /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i,
  /w3\.org\/1999\/xhtml|w3\.org\/2000\/svg|w3\.org\/1998\/Math|w3\.org\/1999\/XSL/i,
  // Un espacio de nombres escrito con referencias (&#120;html) se resuelve igual.
  /xmlns(:[\w.-]+)?\s*=\s*["'][^"']*&/i,
];

/** PDF por sus bytes (%PDF-) o XML (CFDI) por su arranque; nada más. */
function tipoFactura(buf: Buffer): 'pdf' | 'xml' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  const inicio = buf.subarray(0, 300).toString('utf8').replace(/^﻿/, '').trimStart();
  if (!inicio.startsWith('<?xml') && !inicio.startsWith('<cfdi:')) return null;
  const texto = buf.toString('utf8');
  // Un CFDI de verdad: el Comprobante del SAT, sin nada que un navegador ejecute.
  if (!/<cfdi:Comprobante\b/.test(texto) || !/sat\.gob\.mx\/cfd\//i.test(texto)) return null;
  if (XML_PELIGROSO.some((re) => re.test(texto))) return null;
  return 'xml';
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
        // Cada campo, lo suyo: un XML en el campo del PDF quedaba como "la
        // factura" y se abría con el botón que se espera que sea un PDF.
        if ((file.fieldname === 'pdf' || file.fieldname === 'xml') && file.fieldname !== tipo) {
          cb(new BadRequestException(file.fieldname === 'pdf' ? 'En "PDF" sube el PDF de tu factura.' : 'En "XML" sube el XML (CFDI) de tu factura.'));
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
