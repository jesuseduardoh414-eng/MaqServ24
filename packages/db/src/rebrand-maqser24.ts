/**
 * Aplica la identidad MAQSER24 (Fase 1) al tema activo de la BD.
 *
 * POR QUÉ NO SE USA `seed.ts`: ese script hace `update: { tokens, copys }`, es
 * decir REEMPLAZA los copys enteros por los del código. La BD ya tiene copys
 * editados desde el admin y —peor— 5 claves que existen SOLO en la BD
 * (home.categories.viewAll, home.categoriesPage.*). Un seed ciego las borra y
 * el sitio pinta la clave cruda en la cara del usuario.
 *
 * Este script hace un merge:
 *   - tokens: se reemplazan por los nuevos (eso ES el rebranding).
 *   - copys:  se parte de los de la BD (conserva TODA edición del cliente) y
 *             solo se pisan las claves que el rebranding cambia a propósito.
 *
 * Antes de escribir deja un respaldo JSON del tema actual. Para revertir:
 *   node dist/rebrand-maqser24.js --revertir <ruta-del-respaldo.json>
 *
 * Uso:
 *   node dist/rebrand-maqser24.js --ver       (no escribe: muestra el plan)
 *   node dist/rebrand-maqser24.js --aplicar
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { defaultTheme, themeSchema } from '@maqserv/config';

/** Claves de copy que el rebranding pisa a propósito. El resto se respeta. */
const COPYS_DEL_REBRANDING = ['site.name', 'site.tagline'];

const DIR_RESPALDOS = join(process.cwd(), 'respaldos-tema');

async function main() {
  const args = process.argv.slice(2);
  const prisma = new PrismaClient();

  if (args[0] === '--revertir') {
    const ruta = args[1];
    if (!ruta) throw new Error('Falta la ruta del respaldo.');
    const previo = JSON.parse(readFileSync(ruta, 'utf8'));
    await prisma.theme.update({
      where: { id: previo.id },
      data: { name: previo.name, tokens: previo.tokens, copys: previo.copys, publishedAt: new Date() },
    });
    console.log(`Revertido al respaldo ${ruta}`);
    await prisma.$disconnect();
    return;
  }

  const actual = await prisma.theme.findFirst({ where: { active: true } });
  if (!actual) throw new Error('No hay tema activo en la BD.');

  const nuevo = themeSchema.parse(defaultTheme);
  const copysBd = (actual.copys ?? {}) as Record<string, Record<string, string>>;
  const copysNuevos: Record<string, Record<string, string>> = JSON.parse(JSON.stringify(copysBd));

  for (const [locale, claves] of Object.entries(nuevo.copys)) {
    copysNuevos[locale] ??= {};
    for (const clave of COPYS_DEL_REBRANDING) {
      if (claves[clave] !== undefined) copysNuevos[locale][clave] = claves[clave];
    }
    // Claves nuevas del código que la BD todavía no tiene: se agregan (no pisan nada).
    for (const [clave, texto] of Object.entries(claves)) {
      if (copysNuevos[locale][clave] === undefined) copysNuevos[locale][clave] = texto;
    }
  }

  const conservados = Object.keys(copysBd.es ?? {}).filter(
    (k) => !COPYS_DEL_REBRANDING.includes(k) && copysBd.es[k] !== nuevo.copys.es?.[k],
  );

  console.log(`Tema activo: ${actual.slug} (${actual.name})`);
  console.log(`  nombre:      ${actual.name}  ->  ${nuevo.name}`);
  console.log(`  fondo:       ${(actual.tokens as any).colors.dark.background}  ->  ${nuevo.tokens.colors.dark.background}`);
  console.log(`  primario:    ${(actual.tokens as any).colors.dark.primary}  ->  ${nuevo.tokens.colors.dark.primary}`);
  console.log(`  titulares:   ${(actual.tokens as any).typography.fontHeading}  ->  ${nuevo.tokens.typography.fontHeading}`);
  console.log(`  modo:        ${(actual.tokens as any).defaultMode}  ->  ${nuevo.tokens.defaultMode}`);
  console.log(`  copys conservados de la BD: ${conservados.length}`);
  console.log(`  copys pisados por el rebranding: ${COPYS_DEL_REBRANDING.join(', ')}`);

  if (args[0] !== '--aplicar') {
    console.log('\n(--ver) No se escribió nada. Corre con --aplicar para guardar.');
    await prisma.$disconnect();
    return;
  }

  mkdirSync(DIR_RESPALDOS, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const rutaRespaldo = join(DIR_RESPALDOS, `tema-${actual.slug}-${marca}.json`);
  writeFileSync(rutaRespaldo, JSON.stringify(actual, null, 2), 'utf8');
  console.log(`\nRespaldo guardado en ${rutaRespaldo}`);

  await prisma.theme.update({
    where: { id: actual.id },
    data: { name: nuevo.name, tokens: nuevo.tokens, copys: copysNuevos, publishedAt: new Date() },
  });
  console.log('Identidad MAQSER24 aplicada al tema activo.');
  console.log(`Para revertir: node dist/rebrand-maqser24.js --revertir "${rutaRespaldo}"`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
