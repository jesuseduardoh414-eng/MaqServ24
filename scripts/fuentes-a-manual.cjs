/**
 * Alinea las tipografías con el Manual de Identidad (13 / TIPOGRAFÍA):
 * "Inter es la familia operativa recomendada para interfaces y documentos.
 *  Titulares: Inter Tight/Inter Display; cuerpo y datos: Inter."
 *
 * El panel admin usaba Manrope + Space Grotesk y la web usaba Space Mono para
 * datos y etiquetas. Ninguna de las tres está en el manual.
 *
 *   Manrope       -> Inter
 *   Space Grotesk -> Inter Tight
 *   Space Mono    -> Inter
 *
 * Space Mono se sustituye por Inter y NO por otra monoespaciada porque el
 * manual no autoriza ninguna: su ejemplo de "DATO" (EXCAVADORA · 20 T · MTY)
 * es Inter en mayúsculas con letter-spacing, que es justo lo que ya aplican
 * esos componentes.
 *
 * Uso: node scripts/fuentes-a-manual.cjs [--aplicar]
 */
const fs = require('fs');
const path = require('path');

const APLICAR = process.argv.includes('--aplicar');
const RAICES = [
  path.join(__dirname, '..', 'apps', 'admin', 'src'),
  path.join(__dirname, '..', 'apps', 'web', 'src'),
];

const REGLAS = [
  // Nombres dentro de familias CSS y constantes JS.
  [/'Manrope'/g, "'Inter'"],
  [/'Space Grotesk'/g, "'Inter Tight'"],
  [/'Space Mono'/g, "'Inter'"],
  // Nombres dentro de las URLs de Google Fonts (van con + en vez de espacio).
  [/family=Manrope/g, 'family=Inter'],
  [/family=Space\+Grotesk/g, 'family=Inter+Tight'],
  [/family=Space\+Mono/g, 'family=Inter'],
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
for (const raiz of RAICES) {
  for (const f of archivos(raiz)) {
    const antes = fs.readFileSync(f, 'utf8');
    let despues = antes;
    for (const [re, a] of REGLAS) despues = despues.replace(re, a);
    if (despues === antes) continue;
    const n = (antes.match(/Manrope|Space.Grotesk|Space.Mono/g) ?? []).length;
    tocados++;
    cambios += n;
    console.log(`${String(n).padStart(3)}  ${path.relative(path.join(__dirname, '..'), f)}`);
    if (APLICAR) fs.writeFileSync(f, despues, 'utf8');
  }
}

console.log(`\n${cambios} referencias en ${tocados} archivos.`);
if (!APLICAR) console.log('(ensayo) Corre con --aplicar para escribir.');
