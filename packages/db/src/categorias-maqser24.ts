/**
 * Fase 2 · Reestructura el catálogo a las SEIS categorías de servicio MAQSER24.
 *
 * EL PROBLEMA: el manual define seis categorías de servicio (03 / ECOSISTEMA DE
 * SERVICIOS) y la BD tenía nueve categorías que en realidad son familias de
 * EQUIPO — no es lo mismo. Además el catálogo solo filtra por una categoría a
 * la vez, así que una línea de servicio que abarque cinco familias no se podía
 * enlazar.
 *
 * LA SOLUCIÓN: las seis líneas de servicio pasan a ser `categories` (el primer
 * nivel de navegación) y las nueve familias de equipo bajan a `subcategories`
 * (segundo nivel). El catálogo YA sabe filtrar por subcategoría, así que no
 * hace falta tocar el filtrado.
 *
 * Las categorías viejas NO se borran: quedan en `status = 0`. El endpoint
 * público filtra por `status: 1`, así que desaparecen del sitio pero los datos
 * siguen ahí por si hay que volver atrás.
 *
 * Dos de las seis (agua en pipas y triturados) nacen SIN inventario. Es
 * correcto: no son SKUs, se miden por viaje y por tonelada. La UI manda esas
 * tarjetas a cotizar en vez de a un catálogo vacío.
 *
 * Uso: node dist/categorias-maqser24.js [--ver | --aplicar]
 *      node dist/categorias-maqser24.js --revertir <respaldo.json>
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const DIR_RESPALDOS = join(process.cwd(), 'respaldos-tema');

/** Las seis líneas de servicio del manual, en el orden en que él las presenta. */
const LINEAS = [
  { slug: 'maquinaria-pesada', nombre: 'Maquinaria pesada', fotoDe: 'Excavación' },
  { slug: 'equipo-menor', nombre: 'Equipo menor', fotoDe: 'Energía e Iluminación' },
  { slug: 'plataformas-de-elevacion', nombre: 'Plataformas de elevación', fotoDe: 'Elevación' },
  { slug: 'agua-en-pipas', nombre: 'Agua en pipas', fotoDe: null },
  { slug: 'volteos', nombre: 'Volteos', fotoDe: 'Carga y Acarreo' },
  { slug: 'triturados', nombre: 'Triturados', fotoDe: null },
];

/** Categoría vieja -> [línea de servicio, nombre de la subcategoría nueva]. */
const A_SUBCATEGORIA: Record<string, [string, string]> = {
  'Excavación': ['maquinaria-pesada', 'Excavación'],
  'Movimiento de Tierra': ['maquinaria-pesada', 'Movimiento de tierra'],
  'Compactación': ['maquinaria-pesada', 'Compactación'],
  'Carga y Acarreo': ['maquinaria-pesada', 'Carga y acarreo'],
  'Grúas y Maniobras': ['maquinaria-pesada', 'Grúas y maniobras'],
  'Manipulación de Materiales': ['maquinaria-pesada', 'Manipulación de materiales'],
  'Bombeo de Agua': ['equipo-menor', 'Bombeo de agua'],
  'Energía e Iluminación': ['equipo-menor', 'Energía e iluminación'],
  'Elevación': ['plataformas-de-elevacion', 'Plataformas y elevación'],
};

/**
 * Productos que NO siguen el mapa de su categoría, por id.
 * `sub: null` = va directo a la línea de servicio, sin segundo nivel.
 */
const EXCEPCIONES: Record<number, { linea: string; sub: string | null; porque: string }> = {
  // El camión de volteo estaba en "Carga y Acarreo" junto a cargadores y
  // minicargadores, pero es el servicio de Volteos del manual.
  9930: { linea: 'volteos', sub: null, porque: 'es el servicio de volteos, no un cargador' },
  // Una retroexcavadora archivada dentro de "Bombeo de Agua": mal clasificada
  // desde el legacy. Está inactiva (status 0), pero se coloca donde va.
  9923: { linea: 'maquinaria-pesada', sub: 'Excavación', porque: 'estaba mal clasificada en Bombeo de Agua' },
};

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function main() {
  const args = process.argv.slice(2);
  const prisma = new PrismaClient();

  if (args[0] === '--revertir') {
    const previo = JSON.parse(readFileSync(args[1], 'utf8'));
    for (const p of previo.productos) {
      await prisma.products.update({
        where: { id: p.id },
        data: { category_id: p.category_id, subcategory_id: p.subcategory_id, childcategory_id: p.childcategory_id },
      });
    }
    for (const c of previo.categorias) {
      await prisma.categories.update({ where: { id: c.id }, data: { status: c.status } });
    }
    await prisma.categories.deleteMany({ where: { cat_slug: { in: LINEAS.map((l) => l.slug) } } });
    await prisma.subcategories.deleteMany({ where: { id: { in: previo.subsCreadas ?? [] } } });
    console.log('Catálogo revertido a las categorías anteriores.');
    await prisma.$disconnect();
    return;
  }

  const viejas = await prisma.categories.findMany({ where: { status: 1 }, orderBy: { id: 'asc' } });
  const porNombre = new Map(viejas.map((c) => [c.cat_name.trim(), c]));
  const productos = await prisma.products.findMany({
    select: { id: true, name: true, category_id: true, subcategory_id: true, childcategory_id: true, status: true },
  });

  // --- Plan ---------------------------------------------------------------
  const sinMapa = viejas.filter((c) => !A_SUBCATEGORIA[c.cat_name.trim()]);
  const plan = new Map<string, { linea: string; sub: string | null; productos: string[] }>();
  for (const p of productos) {
    const excep = EXCEPCIONES[p.id];
    const vieja = viejas.find((c) => c.id === p.category_id);
    const mapeo = vieja ? A_SUBCATEGORIA[vieja.cat_name.trim()] : undefined;
    const destino = excep ? { linea: excep.linea, sub: excep.sub } : mapeo ? { linea: mapeo[0], sub: mapeo[1] } : null;
    if (!destino) continue;
    const clave = `${destino.linea}|${destino.sub ?? ''}`;
    if (!plan.has(clave)) plan.set(clave, { ...destino, productos: [] });
    plan.get(clave)!.productos.push(`${p.name}${p.status === 0 ? ' (inactivo)' : ''}`);
  }

  for (const linea of LINEAS) {
    const entradas = [...plan.entries()].filter(([, v]) => v.linea === linea.slug);
    const total = entradas.reduce((n, [, v]) => n + v.productos.length, 0);
    console.log(`\n${linea.nombre}  (${total} producto${total === 1 ? '' : 's'})`);
    if (!entradas.length) console.log('   — sin inventario: la tarjeta manda a cotizar');
    for (const [, v] of entradas) {
      console.log(`   ${v.sub ?? '(sin subcategoría)'}: ${v.productos.join(', ')}`);
    }
  }
  for (const [id, e] of Object.entries(EXCEPCIONES)) {
    const p = productos.find((x) => x.id === Number(id));
    if (p) console.log(`\nExcepción · ${p.name} -> ${e.linea}: ${e.porque}`);
  }
  if (sinMapa.length) console.log(`\nOJO — categorías sin mapa (se desactivan y sus productos quedan huérfanos): ${sinMapa.map((c) => c.cat_name).join(', ')}`);

  if (args[0] !== '--aplicar') {
    console.log('\n(--ver) No se escribió nada. Corre con --aplicar para guardar.');
    await prisma.$disconnect();
    return;
  }

  // --- Respaldo -----------------------------------------------------------
  mkdirSync(DIR_RESPALDOS, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = join(DIR_RESPALDOS, `categorias-${marca}.json`);

  // --- Aplicar ------------------------------------------------------------
  const idLinea = new Map<string, number>();
  for (const linea of LINEAS) {
    const foto = linea.fotoDe ? (porNombre.get(linea.fotoDe)?.photo ?? null) : null;
    const fila = await prisma.categories.upsert({
      where: { cat_slug: linea.slug },
      create: { cat_name: linea.nombre, cat_slug: linea.slug, status: 1, photo: foto },
      update: { cat_name: linea.nombre, status: 1, photo: foto },
    });
    idLinea.set(linea.slug, fila.id);
  }

  const idSub = new Map<string, number>();
  const subsCreadas: number[] = [];
  for (const [, [lineaSlug, subNombre]] of Object.entries(A_SUBCATEGORIA)) {
    const clave = `${lineaSlug}|${subNombre}`;
    if (idSub.has(clave)) continue;
    const catId = idLinea.get(lineaSlug)!;
    const sub = await prisma.subcategories.create({
      data: { category_id: catId, sub_name: subNombre, sub_slug: slugify(subNombre), status: 1 },
    });
    idSub.set(clave, sub.id);
    subsCreadas.push(sub.id);
  }

  writeFileSync(
    ruta,
    JSON.stringify({ productos, categorias: viejas.map((c) => ({ id: c.id, status: c.status })), subsCreadas }, null, 2),
    'utf8',
  );
  console.log(`\nRespaldo guardado en ${ruta}`);

  let movidos = 0;
  for (const p of productos) {
    const excep = EXCEPCIONES[p.id];
    const vieja = viejas.find((c) => c.id === p.category_id);
    const mapeo = vieja ? A_SUBCATEGORIA[vieja.cat_name.trim()] : undefined;
    const destino = excep ? { linea: excep.linea, sub: excep.sub } : mapeo ? { linea: mapeo[0], sub: mapeo[1] } : null;
    if (!destino) continue;
    await prisma.products.update({
      where: { id: p.id },
      data: {
        category_id: idLinea.get(destino.linea)!,
        subcategory_id: destino.sub ? idSub.get(`${destino.linea}|${destino.sub}`)! : null,
        // Las childcategories del legacy apuntaban al árbol viejo: quedarían colgando.
        childcategory_id: null,
      },
    });
    movidos++;
  }

  // Las viejas salen del sitio (status 0) pero no se borran. Igual la
  // subcategoría "ejemplo" que quedó del legacy.
  await prisma.categories.updateMany({ where: { id: { in: viejas.map((c) => c.id) } }, data: { status: 0 } });
  await prisma.subcategories.updateMany({
    where: { id: { notIn: subsCreadas } },
    data: { status: 0 },
  });

  console.log(`${movidos} productos reasignados · 6 categorías de servicio · ${subsCreadas.length} subcategorías · ${viejas.length} categorías viejas desactivadas.`);
  console.log(`Para revertir: node dist/categorias-maqser24.js --revertir "${ruta}"`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
