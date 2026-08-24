/**
 * Sube los activos de marca MAQSER24 a Supabase Storage y apunta el `branding`
 * del tema activo a esas URLs.
 *
 * POR QUÉ: el `branding` del tema por defecto usa rutas locales (/brand/...) que
 * viven en el `public/` de cada app. Eso funciona en local, pero en producción
 * solo existe DESPUÉS de un deploy — hasta entonces el logo sale roto. El admin
 * sube los logos a Supabase Storage justamente por eso, y este script hace lo
 * mismo desde la terminal para no depender de un deploy.
 *
 * Uso: node dist/subir-marca-maqser24.js
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const BUCKET = 'media';
const ORIGEN = join(process.cwd(), '..', '..', 'apps', 'web', 'public', 'brand');

/** slot del branding -> archivo generado por _build-brand.cjs */
const ARCHIVOS: Record<string, string> = {
  logoLight: 'maqser24-logo.png',
  logoDark: 'maqser24-logo.png',
  logoAlt: 'maqser24-logo-vertical.png',
  icon: 'app-icon.png',
  favicon: 'favicon.png',
};

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY.');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const prisma = new PrismaClient();

  // Nombre estable (sin Date.now()): republicar el mismo archivo sobrescribe en
  // lugar de dejar basura acumulada en el bucket.
  const subidos: Record<string, string> = {};
  const cache = new Map<string, string>();
  for (const [slot, archivo] of Object.entries(ARCHIVOS)) {
    if (cache.has(archivo)) {
      subidos[slot] = cache.get(archivo)!;
      continue;
    }
    const buf = readFileSync(join(ORIGEN, archivo));
    const clave = `uploads/maqser24-${archivo}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(clave, buf, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`${archivo}: ${error.message}`);
    const publica = sb.storage.from(BUCKET).getPublicUrl(clave).data.publicUrl;
    cache.set(archivo, publica);
    subidos[slot] = publica;
    console.log(`  ${archivo.padEnd(30)} -> ${publica}`);
  }

  const tema = await prisma.theme.findFirst({ where: { active: true } });
  if (!tema) throw new Error('No hay tema activo.');
  const tokens = tema.tokens as Record<string, unknown>;
  tokens.branding = subidos;
  await prisma.theme.update({
    where: { id: tema.id },
    data: { tokens: tokens as never, publishedAt: new Date() },
  });

  console.log('\nBranding del tema activo apuntando a Supabase Storage.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
