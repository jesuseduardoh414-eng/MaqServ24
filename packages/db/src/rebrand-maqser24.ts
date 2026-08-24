/**
 * Aplica la identidad MAQSER24 (Fase 1) al tema activo de la BD.
 *
 * POR QUÉ NO SE USA `seed.ts`: ese script hace `update: { tokens, copys }`, es
 * decir REEMPLAZA los copys enteros por los del código. La BD ya tiene copys
 * editados desde el admin y —peor— 5 claves que existen SOLO en la BD
 * (home.categories.viewAll, home.categoriesPage.*). Un seed ciego las borra y
 * el sitio pinta la clave cruda en la cara del usuario.
 *
 * Este script hace un merge en los dos lados:
 *   - tokens: campo por campo, y un valor nulo o vacío del código NO pisa uno de
 *             la BD (ver `fusionarTokens`, que nació de haber borrado las
 *             imágenes del cliente con un reemplazo completo).
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

/**
 * Copys que el CLIENTE editó a mano desde el admin. Estos NUNCA se pisan.
 *
 * La regla está al revés que en la Fase 1 a propósito: aquella solo cambiaba el
 * nombre y el descriptor, así que bastaba una lista de lo que sí se pisaba. La
 * Fase 2 reescribe casi todos los textos del sitio (voz y tono del manual), así
 * que ahora la lista es la de lo intocable.
 *
 * Ojo: varias de estas están VACÍAS en la BD. No es un error — el cliente las
 * borró a propósito para ocultar esos bloques (el "24/7 · Soporte" del hero y
 * los subtítulos de categorías). Sobrescribirlas los haría reaparecer.
 */
const COPYS_QUE_EDITO_EL_CLIENTE = [
  'home.hero.stat3.num',
  'home.hero.stat3.label',
  'catalog.search.placeholder',
  'home.categories.viewAll',
  'home.categories.subtitle',
  'home.categoriesPage.title',
  'home.categoriesPage.eyebrow',
  'home.categoriesPage.subtitle',
];

const DIR_RESPALDOS = join(process.cwd(), 'respaldos-tema');

/**
 * Fusiona los tokens del código sobre los de la BD, campo por campo.
 *
 * ESTO NACIÓ DE UN ERROR: la primera versión hacía `tokens: nuevo.tokens`, un
 * reemplazo completo. Los tokens no son solo identidad — también guardan lo que
 * el cliente configuró desde el admin: imágenes de banner, foto de "¿por qué
 * elegirnos?", imagen de la oferta, la dirección de contacto. En el código todos
 * esos campos valen `null` o `''` porque son "sin configurar", así que el
 * reemplazo los borró todos de golpe.
 *
 * La regla que lo evita es simple: **un valor nulo o vacío del código no pisa un
 * valor de la BD**. Los colores, tipografías y textos nuevos SÍ traen valor, así
 * que se aplican; las imágenes que el código no conoce se quedan como están.
 *
 * Los arreglos son la excepción y siempre pisan: cuando el código deja uno
 * vacío es una decisión (p. ej. `about.timeline: []`, que quita a propósito la
 * historia de empresa inventada), no un "sin configurar".
 */
function fusionarTokens(bd: unknown, codigo: unknown): unknown {
  if (Array.isArray(codigo)) return codigo;
  if (codigo && typeof codigo === 'object' && bd && typeof bd === 'object' && !Array.isArray(bd)) {
    const salida: Record<string, unknown> = { ...(bd as Record<string, unknown>) };
    for (const [clave, valor] of Object.entries(codigo as Record<string, unknown>)) {
      salida[clave] = fusionarTokens((bd as Record<string, unknown>)[clave], valor);
    }
    return salida;
  }
  // Escalar: el código solo gana si trae algo.
  if (codigo === null || codigo === undefined || codigo === '') return bd ?? codigo;
  return codigo;
}

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
  const tokensNuevos = fusionarTokens(actual.tokens, nuevo.tokens);
  const copysBd = (actual.copys ?? {}) as Record<string, Record<string, string>>;
  const copysNuevos: Record<string, Record<string, string>> = JSON.parse(JSON.stringify(copysBd));

  for (const [locale, claves] of Object.entries(nuevo.copys)) {
    copysNuevos[locale] ??= {};
    for (const [clave, texto] of Object.entries(claves)) {
      // Lo que el cliente editó se queda como está; todo lo demás toma el texto
      // nuevo del código.
      const esIntocable =
        COPYS_QUE_EDITO_EL_CLIENTE.includes(clave) && copysNuevos[locale][clave] !== undefined;
      if (!esIntocable) copysNuevos[locale][clave] = texto;
    }
  }

  const conservados = COPYS_QUE_EDITO_EL_CLIENTE.filter((k) => copysBd.es?.[k] !== undefined);
  const reescritos = Object.keys(nuevo.copys.es ?? {}).filter(
    (k) => !conservados.includes(k) && copysBd.es?.[k] !== nuevo.copys.es[k],
  );

  console.log(`Tema activo: ${actual.slug} (${actual.name})`);
  console.log(`  nombre:      ${actual.name}  ->  ${nuevo.name}`);
  console.log(`  fondo:       ${(actual.tokens as any).colors.dark.background}  ->  ${nuevo.tokens.colors.dark.background}`);
  console.log(`  primario:    ${(actual.tokens as any).colors.dark.primary}  ->  ${nuevo.tokens.colors.dark.primary}`);
  console.log(`  titulares:   ${(actual.tokens as any).typography.fontHeading}  ->  ${nuevo.tokens.typography.fontHeading}`);
  console.log(`  modo:        ${(actual.tokens as any).defaultMode}  ->  ${nuevo.tokens.defaultMode}`);
  console.log(`  hero (CTA principal): ${(actual.tokens as any).hero?.primaryLink} -> ${nuevo.tokens.hero?.primaryLink}`);
  console.log(`  hero (color del botón): ${(actual.tokens as any).hero?.primaryBg} -> ${nuevo.tokens.hero?.primaryBg}`);
  console.log(`\n  copys reescritos: ${reescritos.length}`);
  console.log(`  copys intocables (editados por el cliente): ${conservados.length} — ${conservados.join(', ')}`);

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
    data: { name: nuevo.name, tokens: tokensNuevos as never, copys: copysNuevos, publishedAt: new Date() },
  });
  console.log('Identidad MAQSER24 aplicada al tema activo.');
  console.log(`Para revertir: node dist/rebrand-maqser24.js --revertir "${rutaRespaldo}"`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
