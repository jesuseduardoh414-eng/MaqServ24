// Convierte schema.prisma de Postgres a MySQL/MariaDB. Determinista: se puede
// volver a correr sobre el original (schema.postgres.prisma) y da lo mismo.
//
// Reglas (todas salen de contar lo que hay, no de teoría):
//   text sin tipo (603) → @db.Text; si está indexado (8) → @db.VarChar(191),
//     porque MySQL no indexa TEXT sin prefijo. Los que guardan >8 k chars → MediumText.
//   @db.Timestamp(0) (114) → @db.DateTime(0): TIMESTAMP en MySQL acaba en 2038 y
//     convierte zona horaria; DATETIME guarda lo que se le da.
//   @db.Uuid (2) → @db.Char(36).  DoublePrecision → Double.  Real → Float.
//   Bytes (orders.cart, bzip2) → @db.LongBlob.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'prisma');
const original = join(dir, 'schema.postgres.prisma');
const destino = join(dir, 'schema.prisma');

// Primera corrida: guarda el original de Postgres para poder volver atrás.
if (!existsSync(original)) copyFileSync(destino, original);
let s = readFileSync(original, 'utf8');

// Columnas con datos largos medidos en Supabase (>8 000 chars): TEXT (64 KB) es
// justo para pages.text (29 798 chars en UTF-8). MediumText = 16 MB.
const MEDIUM = new Set(['pages.text', 'pagesettings.about', 'pagesettings.faq', 'generalsettings.theme_settings']);

s = s.replace(/provider\s*=\s*"postgresql"/, 'provider  = "mysql"');
s = s.replace(/^\s*directUrl\s*=\s*env\("DIRECT_URL"\)\s*\n/m, '');

const out = [];
let model = null;
let indexed = new Set();
const bloques = s.split('\n');

// Primero: qué campos van en @@index/@@unique de cada modelo.
const idxPorModelo = new Map();
for (const l of bloques) {
  const m = l.match(/^model (\w+) \{/); if (m) { model = m[1]; idxPorModelo.set(model, new Set()); continue; }
  if (l.startsWith('}')) { model = null; continue; }
  const i = l.trim().match(/^@@(?:index|unique)\(\[([^\]]+)\]/);
  if (model && i) i[1].split(',').forEach((f) => idxPorModelo.get(model).add(f.trim().split(/[( ]/)[0]));
}

model = null;
let cambios = { text: 0, varchar: 0, medium: 0, datetime: 0, uuid: 0, double: 0, float: 0, blob: 0 };
for (let l of bloques) {
  const m = l.match(/^model (\w+) \{/);
  if (m) { model = m[1]; indexed = idxPorModelo.get(model); out.push(l); continue; }
  if (l.startsWith('}')) { model = null; out.push(l); continue; }
  const t = l.trim();
  // Índice GIN sobre JSON (products.attributes): no existe en MySQL. Sin índice el
  // filtro por atributos sigue funcionando (28 productos; no se nota).
  if (/@@index(.*type: Gin)/.test(t)) { cambios.gin = (cambios.gin ?? 0) + 1; continue; }
  if (!model || !t || t.startsWith('//') || t.startsWith('@@')) { out.push(l); continue; }

  const f = t.match(/^(\w+)\s+(\w+)(\??|\[\])?\s*(.*)$/);
  if (!f) { out.push(l); continue; }
  const [, nombre, tipo, , resto] = f;
  const clave = `${model}.${nombre}`;

  // Listas escalares (String[]) no existen en MySQL: se guardan como JSON.
  // El código que las lee las sigue viendo como arreglo; los filtros `has`
  // pasan a `array_contains` (ver 41-etl y los controladores tocados).
  if (tipo === 'String' && f[3] === '[]') {
    l = l.replace(/String\[\]\s+@default\(\[\]\)/, 'Json     @default("[]")');
    cambios.json = (cambios.json ?? 0) + 1; out.push(l); continue;
  }

  if (tipo === 'String' && !/@db\./.test(resto)) {
    const idx = /@id\b|@unique/.test(resto) || indexed.has(nombre);
    let attr;
    if (idx) { attr = '@db.VarChar(191)'; cambios.varchar++; }
    else if (MEDIUM.has(clave)) { attr = '@db.MediumText'; cambios.medium++; }
    else { attr = '@db.Text'; cambios.text++; }
    l = l.replace(/\s*$/, '') + ' ' + attr;
  } else if (tipo === 'Bytes') {
    l = l.replace(/\s*$/, '') + ' @db.LongBlob'; cambios.blob++;
  }
  // VARCHAR enormes (sites: 11 columnas de 1 000 a 6 000) revientan el tope de
  // 64 KB por fila de MySQL; TEXT vive fuera de la fila y no cuenta.
  const vc = l.match(/@db\.VarChar\((\d+)\)/);
  if (vc && Number(vc[1]) > 1000 && !(/@id\b|@unique/.test(resto) || indexed.has(nombre))) {
    l = l.replace(/@db\.VarChar\(\d+\)/, '@db.Text');
    cambios.varcharGrande = (cambios.varcharGrande ?? 0) + 1;
  }
  if (l.includes('@db.Timestamp(')) { l = l.replace(/@db\.Timestamp\((\d)\)/, '@db.DateTime($1)'); cambios.datetime++; }
  if (l.includes('@db.Uuid')) { l = l.replace('@db.Uuid', '@db.Char(36)'); cambios.uuid++; }
  if (l.includes('@db.DoublePrecision')) { l = l.replace('@db.DoublePrecision', '@db.Double'); cambios.double++; }
  if (l.includes('@db.Real')) { l = l.replace('@db.Real', '@db.Float'); cambios.float++; }
  out.push(l);
}

writeFileSync(destino, out.join('\n'));
console.log('schema.prisma → MySQL. Cambios:', JSON.stringify(cambios));
console.log('Original de Postgres conservado en prisma/schema.postgres.prisma');
