/**
 * Sube las placas de "Agua en pipas" y "Triturados" a Supabase Storage y las
 * asigna como foto de esas dos categorías.
 *
 * Son las únicas dos de las seis líneas de servicio que nacieron sin imagen (las
 * otras cuatro heredaron la de su familia principal), así que en el sitio salían
 * con el marcador gris. Las genera `scripts/build-categoria-tiles.cjs`.
 *
 * Se guarda la ruta RELATIVA `uploads/<archivo>`, no la URL absoluta: es la
 * convención del uploader del admin y la que `imageUrl()` sabe resolver, así que
 * si algún día cambia el bucket no hay que reescribir filas.
 *
 * Uso: node dist/subir-fotos-categorias.js [--ver | --aplicar]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const BUCKET = 'media';
const ORIGEN = join(process.cwd(), '..', '..', 'apps', 'web', 'public', 'brand');

const FOTOS: Record<string, string> = {
  'agua-en-pipas': 'cat-agua-en-pipas.png',
  triturados: 'cat-triturados.png',
};

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY.');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const prisma = new PrismaClient();

  for (const [slug, archivo] of Object.entries(FOTOS)) {
    const cat = await prisma.categories.findUnique({ where: { cat_slug: slug } });
    if (!cat) {
      console.log(`  ${slug}: no existe esa categoría, se omite`);
      continue;
    }
    console.log(`  ${cat.cat_name}: ${cat.photo ?? '(sin foto)'} -> uploads/${archivo}`);
    if (!aplicar) continue;

    const buf = readFileSync(join(ORIGEN, archivo));
    const clave = `uploads/${archivo}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(clave, buf, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`${archivo}: ${error.message}`);
    await prisma.categories.update({ where: { id: cat.id }, data: { photo: clave } });
  }

  console.log(aplicar ? '\nFotos asignadas.' : '\n(--ver) No se escribió nada. Corre con --aplicar.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
