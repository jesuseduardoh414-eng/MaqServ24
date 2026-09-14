// Fidelidad Postgres -> MySQL: conteos por tabla + muestras de los tipos delicados.
//   MYSQL_URL="mysql://root@localhost:3306/maqserv24" node migrate/42-verificar-mysql.mjs
import pg from 'pg';
import mysql from 'mysql2/promise';
import { env } from './_env.mjs';

const pgc = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await pgc.connect();
const my = await mysql.createConnection({ uri: process.env.MYSQL_URL });

const [tabs] = await my.query(`select table_name t from information_schema.tables where table_schema=database() and table_name not like '\_prisma%' order by 1`);
let mism = 0, checked = 0;
for (const { t } of tabs) {
  const [[m]] = await my.query('select count(*) c from `' + t + '`');
  const p = Number((await pgc.query(`select count(*)::bigint c from "${t}"`)).rows[0].c);
  checked++;
  if (Number(m.c) !== p) { mism++; console.log(`  ✗ ${t.padEnd(32)} PG ${p}  !=  MySQL ${m.c}`); }
}
console.log(`Tablas: ${checked} | discrepancias de conteo: ${mism}`);

// orders.cart (bzip2) — los primeros bytes deben ser "BZh"
const [[cart]] = await my.query('select id, hex(substring(cart,1,3)) magic from orders where cart is not null limit 1');
console.log(`orders.cart #${cart?.id}: ${cart?.magic} ${cart?.magic === '425A68' ? '✓ bzip2 intacto' : '✗ NO es bzip2'}`);

// JSON: que se pueda parsear y que las listas sigan siendo listas
const [[th]] = await my.query('select json_valid(tokens) t, json_valid(copys) c, json_length(tokens) n from themes limit 1');
console.log(`themes.tokens: válido=${th?.t} claves=${th?.n} | copys válido=${th?.c}`);
const [[pv]] = await my.query('select json_valid(coverage) v, json_type(coverage) ty, coverage from providers limit 1');
console.log(`providers.coverage: válido=${pv?.v} tipo=${pv?.ty} valor=${String(pv?.coverage).slice(0, 60)}`);
const [[pa]] = await my.query('select json_type(attributes) ty from products where attributes is not null limit 1');
console.log(`products.attributes: tipo=${pa?.ty ?? '(sin filas)'}`);

// Booleans y fechas
const [[u]] = await my.query('select mail_sent, created_at, auth_id, left(password,4) p from users where auth_id is not null limit 1');
console.log(`users: mail_sent=${u?.mail_sent} created_at=${u?.created_at?.toISOString?.() ?? u?.created_at} auth_id=${u?.auth_id} hash=${u?.p}`);
const [[o]] = await my.query("select status, payment_status, fulfillment from orders limit 1");
console.log(`orders: status(enum)=${o?.status} payment=${o?.payment_status} fulfillment=${o?.fulfillment}`);

// Acentos: que el UTF-8 haya llegado bien
const [[acc]] = await my.query("select count(*) n from products where name like binary '%á%' or name like binary '%é%' or name like binary '%ó%' or name like binary '%ñ%'");
const accPg = Number((await pgc.query("select count(*)::int n from products where name ~ '[áéíóúñ]'")).rows[0].n);
console.log(`products con acentos: PG ${accPg} vs MySQL ${acc.n} ${accPg === Number(acc.n) ? '✓' : '✗'}`);
await my.end(); await pgc.end();
