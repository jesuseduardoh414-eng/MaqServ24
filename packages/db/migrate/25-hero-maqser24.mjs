/**
 * FOTO DEL HERO CON LA MARCA CORRECTA.
 *
 * La imagen que estaba traía el logo de SEGAshop grabado en el casco, en el
 * polo y en la pluma de la excavadora. Como es un PNG con la marca DENTRO de la
 * foto, ningún cambio de tema la corregía: el sitio entero ya era MAQSER24 y lo
 * primero que veía cualquiera seguía siendo la marca vieja.
 *
 * La nueva la entregó el cliente ya montada (casco, polo y máquina con el
 * emblema MS azul sobre fondo negro), que es como tenía que ser: rehacerla
 * desde aquí habría sido inventar identidad.
 *
 * Uso:
 *   node migrate/25-hero-maqser24.mjs "C:\ruta\a\la\foto.png"
 *   node migrate/25-hero-maqser24.mjs --ver     (solo muestra qué hay hoy)
 */
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { env } from './_env.mjs';

const BUCKET = 'media';
const ruta = process.argv[2];
const soloVer = process.argv.includes('--ver');

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

try {
  const actual = await c.query('select id, image from hero_sections order by id limit 1');
  if (actual.rowCount === 0) throw new Error('No hay fila en hero_sections');
  console.log('  hoy:', actual.rows[0].image);
  if (soloVer || !ruta) {
    if (!soloVer) console.log('\n  Falta la ruta de la imagen. Ver el encabezado del archivo.');
    process.exit(0);
  }

  const bytes = readFileSync(ruta);
  const ext = (extname(ruta) || '.png').toLowerCase();
  // Nombre estable y descriptivo: el que traía era un uuid del generador, que
  // no dice nada cuando alguien abre el bucket dentro de seis meses.
  const nombre = `uploads/maqser24-hero${ext}`;

  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { error } = await sb.storage.from(BUCKET).upload(nombre, bytes, {
    contentType: ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png',
    upsert: true,
  });
  if (error) throw error;

  await c.query('update hero_sections set image = $1, updated_at = now() where id = $2', [
    nombre,
    actual.rows[0].id,
  ]);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(nombre);
  console.log(`  ✓ subida (${Math.round(bytes.length / 1024)} KB)`);
  console.log('  ✓ hero_sections.image ->', nombre);
  console.log('  url:', data.publicUrl);
  console.log('\n  Falta revalidar la portada para que la web publica la tome.');
} finally {
  await c.end();
}
