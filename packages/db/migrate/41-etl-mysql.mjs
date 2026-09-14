// ETL Supabase Postgres -> MySQL/MariaDB. Es el 01-etl.mjs al revés.
//
// Destino: MYSQL_URL (env) — la BD debe existir YA con el esquema de
// `prisma db push`. Origen: DIRECT_URL de packages/db/.env (Supabase).
// Guiado por el destino: copia las columnas que existen en MySQL; si Postgres
// tiene alguna de más, avisa y la ignora. Idempotente: vacía cada tabla antes.
//
//   MYSQL_URL="mysql://root@localhost:3306/maqserv24" node migrate/41-etl-mysql.mjs
import pg from 'pg';
import mysql from 'mysql2/promise';
import { env } from './_env.mjs';

const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) { console.error('Falta MYSQL_URL (destino).'); process.exit(1); }

// Fechas: Postgres las guarda "sin zona" y Prisma las lee como UTC. Si `pg` las
// convierte a Date, Node las interpreta en la zona de ESTA máquina y al escribirlas
// en MySQL salen desplazadas 6 h (medido). Se piden como texto y se copian tal cual.
pg.types.setTypeParser(1114, (s) => s); // timestamp sin zona
pg.types.setTypeParser(1082, (s) => s); // date

const pgc = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await pgc.connect();
const my = await mysql.createConnection({ uri: MYSQL_URL, supportBigNumbers: true, bigNumberStrings: true });
await my.query('SET FOREIGN_KEY_CHECKS=0');
await my.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
await my.query("SET time_zone='+00:00'");

// ---- metadata del destino (MySQL) ----
const [tcols] = await my.query(
  `select table_name t, column_name c, data_type d, column_type ct, is_nullable n
   from information_schema.columns where table_schema=database() order by table_name, ordinal_position`);
const targets = new Map();
for (const r of tcols) {
  if (!targets.has(r.t)) targets.set(r.t, []);
  targets.get(r.t).push({ name: r.c, type: r.d, ct: r.ct, nullable: r.n === 'YES' });
}

// ---- columnas del origen (Postgres) ----
const scols = await pgc.query(
  `select table_name t, column_name c, udt_name u from information_schema.columns where table_schema='public'`);
const sources = new Map();
for (const r of scols.rows) {
  if (!sources.has(r.t)) sources.set(r.t, new Map());
  sources.get(r.t).set(r.c, r.u);
}

const pad = (n) => String(n).padStart(6);
const fmtDate = (d) => {
  if (!(d instanceof Date)) return d;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/** Postgres → MySQL, columna por columna. */
function coerce(val, col, srcUdt) {
  if (val === null || val === undefined) return null;
  switch (col.type) {
    case 'tinyint': // Boolean de Prisma = tinyint(1)
      if (col.ct === 'tinyint(1)') return val === true || val === 1 || val === '1' || val === 't' ? 1 : 0;
      return val;
    // Texto = venía de timestamp/date sin zona: va tal cual. Date = timestamptz: a UTC.
    case 'datetime': case 'timestamp': return typeof val === 'string' ? val.replace('T', ' ').slice(0, 26) : fmtDate(val);
    case 'date': return typeof val === 'string' ? val.slice(0, 10) : val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
    case 'json': case 'longtext': // MariaDB guarda JSON como longtext
      if (srcUdt === 'json' || srcUdt === 'jsonb' || srcUdt === '_text') {
        return typeof val === 'string' && srcUdt !== '_text' ? val : JSON.stringify(val);
      }
      return typeof val === 'object' && !Buffer.isBuffer(val) ? JSON.stringify(val) : val;
    case 'longblob': case 'blob': return Buffer.isBuffer(val) ? val : Buffer.from(val);
    default:
      if (typeof val === 'object' && !Buffer.isBuffer(val) && !(val instanceof Date)) return JSON.stringify(val);
      return val instanceof Date ? fmtDate(val) : val;
  }
}

const resumen = [];
let totalFilas = 0;
for (const [table, cols] of targets) {
  if (table.startsWith('_prisma')) continue;
  const src = sources.get(table);
  if (!src) { resumen.push([table, 'SIN TABLA EN POSTGRES', 0]); continue; }

  const comunes = cols.filter((c) => src.has(c.name));
  const soloMy = cols.filter((c) => !src.has(c.name)).map((c) => c.name);
  const soloPg = [...src.keys()].filter((c) => !cols.some((k) => k.name === c));
  if (soloMy.length) console.log(`  ! ${table}: solo en MySQL (quedan NULL/default): ${soloMy.join(', ')}`);
  if (soloPg.length) console.log(`  ! ${table}: solo en Postgres (se ignoran): ${soloPg.join(', ')}`);

  const sel = comunes.map((c) => `"${c.name}"`).join(',');
  const { rows } = await pgc.query(`select ${sel} from "${table}"`);
  await my.query('TRUNCATE TABLE `' + table + '`');

  const colList = comunes.map((c) => '`' + c.name + '`').join(',');
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = chunk.map((row) => {
      const ph = comunes.map((c) => { params.push(coerce(row[c.name], c, src.get(c.name))); return '?'; });
      return '(' + ph.join(',') + ')';
    });
    try {
      await my.query('INSERT INTO `' + table + '` (' + colList + ') VALUES ' + tuples.join(','), params);
    } catch (e) {
      console.error(`\n  ✗ ${table} lote ${i}: ${e.message}`);
      throw e;
    }
  }
  totalFilas += rows.length;
  resumen.push([table, 'ok', rows.length]);
}

console.log('\n=== RESUMEN ===');
for (const [t, s, n] of resumen) if (n > 0 || s !== 'ok') console.log(`  ${t.padEnd(32)} ${s.padEnd(22)} ${pad(n)}`);
console.log(`\nTablas: ${resumen.length} | filas copiadas: ${totalFilas}`);
await my.query('SET FOREIGN_KEY_CHECKS=1');
await my.end(); await pgc.end();
