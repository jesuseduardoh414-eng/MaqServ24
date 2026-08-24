/**
 * Fase 2 · Ajusta el CONTENIDO del home a la voz de MAQSER24.
 *
 * Los tokens y copys los aplica `rebrand-maqser24.ts`. Pero el hero y la banda
 * "¿Por qué elegirnos?" NO leen copys: leen las tablas `hero_sections` y
 * `why_choose_us`, y los copys solo son respaldo. Por eso el sitio seguía
 * diciendo "Soporte técnico 24/7 · a cualquier hora, todos los días" aunque los
 * copys ya estuvieran reescritos.
 *
 * Qué se corrige y por qué (31 / VOZ Y TONO y 27 / IDENTIDAD del manual):
 *   - "Soporte técnico 24/7 · a cualquier hora, todos los días" — la red no
 *     puede garantizarlo; es el ejemplo exacto que el manual prohíbe.
 *   - "Seguridad Garantizada" y "sin riesgos" — promesas absolutas sobre
 *     maquinaria pesada.
 *   - "Precio y disponibilidad en tiempo real" — hoy la disponibilidad es un
 *     entero de stock, no un estado con fecha y ubicación.
 *
 * Todo esto sigue siendo editable desde el admin. Deja respaldo JSON.
 *
 * Uso: node dist/contenido-maqser24.js [--ver | --aplicar]
 *      node dist/contenido-maqser24.js --revertir <respaldo.json>
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const DIR_RESPALDOS = join(process.cwd(), 'respaldos-tema');

const HERO = {
  badge: 'Monterrey y zona metropolitana',
  title: 'Encuentra maquinaria disponible para tu obra',
  subtitle:
    'Maquinaria pesada, equipo menor, plataformas de elevación, agua en pipas, volteos y triturados. Dinos qué necesitas, dónde y para cuándo: te devolvemos opciones con disponibilidad, condiciones y costo de traslado.',
  feature1: 'Cotización con condiciones a la vista',
  feature2: 'Proveedores con expediente verificado',
};

/** title -> [nuevo título, nueva descripción]. Se busca por el título actual. */
const RAZONES: Record<string, [string, string]> = {
  'Transparencia total': [
    'Información clara',
    'Especificaciones, ubicación, condiciones de renta y costo de traslado desglosados antes de confirmar.',
  ],
  'Precios Justos': [
    'Precio comparable',
    'Cuando hay más de una opción para tu requerimiento, las ves juntas y con las mismas variables.',
  ],
  'Seguridad Garantizada': [
    'Operación trazable',
    'Cada solicitud deja registro: qué se pidió, quién respondió, qué se acordó y en qué estado va.',
  ],
  'Procesos Seguros y Eficientes': [
    'Un solo proceso',
    'La misma solicitud, cotización y seguimiento sirven para las seis categorías de servicio.',
  ],
  'Entrega en obra': [
    'Entrega en obra',
    'Coordinamos el traslado hasta el punto de la obra y su costo se calcula por distancia.',
  ],
  'Soporte técnico 24/7': [
    'Acompañamiento',
    'Un responsable por operación para resolver cambios, incidencias y cierre del servicio.',
  ],
};

async function main() {
  const args = process.argv.slice(2);
  const prisma = new PrismaClient();

  if (args[0] === '--revertir') {
    const previo = JSON.parse(readFileSync(args[1], 'utf8'));
    for (const h of previo.hero) await prisma.hero_sections.update({ where: { id: h.id }, data: h });
    for (const w of previo.razones) {
      await prisma.why_choose_us.update({
        where: { id: BigInt(w.id) },
        data: { title: w.title, description: w.description },
      });
    }
    console.log('Contenido revertido.');
    await prisma.$disconnect();
    return;
  }

  const heros = await prisma.hero_sections.findMany();
  const razones = await prisma.why_choose_us.findMany({ orderBy: { order: 'asc' } });

  console.log('=== hero_sections ===');
  for (const h of heros) {
    console.log(`  título:   ${h.title}\n         -> ${HERO.title}`);
    console.log(`  subtítulo: ${(h.subtitle ?? '').slice(0, 70)}…\n          -> ${HERO.subtitle.slice(0, 70)}…`);
  }
  console.log('\n=== why_choose_us ===');
  let sinMapear = 0;
  for (const w of razones) {
    const clave = w.title.trim();
    const nuevo = RAZONES[clave];
    if (!nuevo) {
      console.log(`  [sin cambio] ${w.title}`);
      sinMapear++;
      continue;
    }
    console.log(`  ${w.title.trim()}  ->  ${nuevo[0]}`);
  }
  if (sinMapear) console.log(`  (${sinMapear} razones no estaban en el mapa y se dejan como están)`);

  if (args[0] !== '--aplicar') {
    console.log('\n(--ver) No se escribió nada. Corre con --aplicar para guardar.');
    await prisma.$disconnect();
    return;
  }

  mkdirSync(DIR_RESPALDOS, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = join(DIR_RESPALDOS, `contenido-${marca}.json`);
  writeFileSync(
    ruta,
    JSON.stringify(
      {
        hero: heros,
        razones: razones.map((w) => ({ id: String(w.id), title: w.title, description: w.description })),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nRespaldo guardado en ${ruta}`);

  for (const h of heros) await prisma.hero_sections.update({ where: { id: h.id }, data: HERO });
  for (const w of razones) {
    const nuevo = RAZONES[w.title.trim()];
    if (!nuevo) continue;
    await prisma.why_choose_us.update({
      where: { id: w.id },
      data: { title: nuevo[0], description: nuevo[1] },
    });
  }
  console.log('Contenido del home actualizado a la voz MAQSER24.');
  console.log(`Para revertir: node dist/contenido-maqser24.js --revertir "${ruta}"`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
