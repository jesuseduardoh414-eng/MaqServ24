/**
 * Recupera del respaldo los campos de CONTENIDO que se perdieron al aplicar el
 * rebranding.
 *
 * QUÉ PASÓ: la primera versión de `rebrand-maqser24.ts` escribía los tokens
 * completos del código sobre los de la BD. Pero los tokens no son solo
 * identidad: también guardan lo que el cliente configuró desde el admin
 * (imágenes de banner, foto de "¿por qué elegirnos?", imagen de la oferta, la
 * dirección de contacto). En el código todos esos campos valen `null` o `''`
 * porque significan "sin configurar", así que el reemplazo los vació.
 *
 * `rebrand-maqser24.ts` ya no puede repetirlo (ver `fusionarTokens`); esto
 * repara el daño que ya se hizo.
 *
 * REGLA: solo se restaura un campo que en el respaldo tenía valor y HOY está
 * vacío. Nunca se pisa un color, una tipografía ni nada que el rebranding haya
 * puesto a propósito.
 *
 * Uso: node dist/restaurar-contenido-tema.js <respaldo.json> [--aplicar]
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

type Dict = Record<string, unknown>;

const vacio = (v: unknown) => v === null || v === undefined || v === '';

/**
 * Copia de `respaldo` a `actual` los ESCALARES que allá tenían valor y aquí no.
 * Devuelve la lista de rutas restauradas para poder enseñarlas antes de escribir.
 */
function restaurar(actual: unknown, respaldo: unknown, ruta = '', log: string[] = []): unknown {
  // Los arreglos no se tocan: `sections`, `brands.list` o `about.timeline` los
  // decide el código a propósito.
  if (Array.isArray(respaldo) || Array.isArray(actual)) return actual;

  if (respaldo && typeof respaldo === 'object' && actual && typeof actual === 'object') {
    const salida: Dict = { ...(actual as Dict) };
    for (const [clave, valor] of Object.entries(respaldo as Dict)) {
      const sub = ruta ? `${ruta}.${clave}` : clave;
      salida[clave] = restaurar((actual as Dict)[clave], valor, sub, log);
    }
    return salida;
  }

  if (!vacio(respaldo) && vacio(actual)) {
    log.push(`${ruta} = ${String(respaldo).slice(0, 90)}`);
    return respaldo;
  }
  return actual;
}

async function main() {
  const ruta = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');
  if (!ruta || ruta.startsWith('--')) throw new Error('Falta la ruta del respaldo JSON.');

  const prisma = new PrismaClient();
  const tema = await prisma.theme.findFirst({ where: { active: true } });
  if (!tema) throw new Error('No hay tema activo.');
  const previo = JSON.parse(readFileSync(ruta, 'utf8'));

  const log: string[] = [];
  const tokens = restaurar(tema.tokens, previo.tokens, '', log);

  if (!log.length) {
    console.log('No hay nada que restaurar: ningún campo del respaldo está vacío hoy.');
    await prisma.$disconnect();
    return;
  }
  console.log(`Campos a restaurar (${log.length}):`);
  for (const l of log) console.log(`  ${l}`);

  if (!aplicar) {
    console.log('\n(ensayo) No se escribió nada. Agrega --aplicar para guardar.');
    await prisma.$disconnect();
    return;
  }

  await prisma.theme.update({
    where: { id: tema.id },
    data: { tokens: tokens as never, publishedAt: new Date() },
  });
  console.log('\nContenido restaurado.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
