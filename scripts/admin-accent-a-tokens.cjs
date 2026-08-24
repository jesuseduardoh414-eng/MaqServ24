/**
 * Reemplaza el ámbar de marca hardcodeado del panel admin por el token del tema.
 *
 * El cromo del admin nació con el acento ámbar de SEGAshop escrito como literal
 * en decenas de archivos, así que al pasar el sitio a MAQSER24 el panel se quedó
 * amarillo. Esto lo hace seguir a `var(--color-primary)`.
 *
 * SOLO toca los valores del ámbar DE MARCA. Los ámbar de estrellas de reseña y
 * de estados de advertencia (#F4B400, #FBBF24, #F59E0B) se quedan: ahí el color
 * sí significa algo y el manual se lo asigna a "advierte" (12 / COLOR FUNCIONAL).
 *
 * Uso: node scripts/admin-accent-a-tokens.cjs [--aplicar]
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', 'apps', 'admin', 'src');
const APLICAR = process.argv.includes('--aplicar');

const PRIMARY = 'var(--color-primary)';
const PRIMARY_FG = 'var(--color-primary-fg)';

/** Alfa 0.14 -> "14%", .7 -> "70%". */
const aPorcentaje = (a) => `${Math.round(parseFloat(a) * 100)}%`;

const REGLAS = [
  // El ámbar de marca en todas sus escrituras.
  [/#f5b81e/gi, () => PRIMARY],
  [/#ffd24d/gi, () => 'color-mix(in srgb, var(--color-primary) 72%, #fff)'],
  // Tinta sobre el ámbar.
  [/#1A1206/g, () => PRIMARY_FG],
  // rgba del mismo ámbar con cualquier alfa -> color-mix equivalente.
  [
    /rgba\(\s*245\s*,\s*184\s*,\s*30\s*,\s*(0?\.\d+|1|0)\s*\)/gi,
    (_m, a) => `color-mix(in srgb, var(--color-primary) ${aPorcentaje(a)}, transparent)`,
  ],
];

function archivos(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(p));
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

let tocados = 0;
let cambios = 0;
for (const f of archivos(RAIZ)) {
  const antes = fs.readFileSync(f, 'utf8');
  let despues = antes;
  for (const [re, fn] of REGLAS) despues = despues.replace(re, fn);
  if (despues === antes) continue;
  const n = (antes.match(/#f5b81e|#ffd24d|#1A1206|rgba\(\s*245\s*,\s*184\s*,\s*30/gi) ?? []).length;
  tocados++;
  cambios += n;
  console.log(`${n.toString().padStart(3)}  ${path.relative(RAIZ, f)}`);
  if (APLICAR) fs.writeFileSync(f, despues, 'utf8');
}

console.log(`\n${cambios} literales en ${tocados} archivos.`);
if (!APLICAR) console.log('(ensayo) Corre con --aplicar para escribir.');
