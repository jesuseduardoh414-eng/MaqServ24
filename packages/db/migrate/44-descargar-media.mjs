// Baja TODO el bucket `media` de Supabase Storage a una carpeta local, con la
// misma estructura de rutas (uploads/…, gallery/…, sectores/…, y los archivos
// sueltos del legacy). Esa carpeta se sube tal cual a MEDIA_DIR en cPanel.
//
// Idempotente: salta lo que ya está bajado con el mismo tamaño.
//   node migrate/44-descargar-media.mjs [carpeta-destino]   (default: ../../media)
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { env } from './_env.mjs';

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en packages/db/.env');
  process.exit(1);
}
const BUCKET = 'media';
const destino = resolve(process.argv[2] ?? join(process.cwd(), '..', '..', 'media'));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

/** Recorre el bucket carpeta por carpeta (list() no es recursivo). */
async function listar(prefijo = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset });
    if (error) throw new Error(`list(${prefijo}): ${error.message}`);
    for (const e of data) {
      const ruta = prefijo ? `${prefijo}/${e.name}` : e.name;
      // Un "archivo" sin id es una carpeta virtual.
      if (e.id === null) out.push(...(await listar(ruta)));
      else out.push({ ruta, size: e.metadata?.size ?? null });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

const objetos = await listar();
console.log(`Bucket "${BUCKET}": ${objetos.length} archivos → ${destino}`);

let bajados = 0, saltados = 0, fallos = 0, bytes = 0;
for (const o of objetos) {
  const abs = join(destino, o.ruta);
  if (existsSync(abs) && o.size !== null && statSync(abs).size === o.size) { saltados++; continue; }
  const { data, error } = await sb.storage.from(BUCKET).download(o.ruta);
  if (error || !data) { fallos++; console.log(`  ✗ ${o.ruta}: ${error?.message ?? 'sin datos'}`); continue; }
  mkdirSync(dirname(abs), { recursive: true });
  const buf = Buffer.from(await data.arrayBuffer());
  writeFileSync(abs, buf);
  bytes += buf.length; bajados++;
  if (bajados % 25 === 0) console.log(`  … ${bajados} bajados (${(bytes / 1048576).toFixed(0)} MB)`);
}
console.log(`\nBajados ${bajados} (${(bytes / 1048576).toFixed(0)} MB) | ya estaban ${saltados} | fallos ${fallos}`);
console.log(`Sube el CONTENIDO de ${destino} a MEDIA_DIR del servidor (/home/maqserv24/media).`);
