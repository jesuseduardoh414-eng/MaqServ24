// Trae las contraseñas REALES (auth.users.encrypted_password de Supabase) a las
// columnas users.password / admins.password de MySQL, enlazando por auth_id.
//
// Por qué: el login dejará de ir por Supabase Auth y pasará a bcrypt local. Sin
// esto, users.password aún trae el hash del Laravel viejo ($2y$), que es el que
// tenía cada cuenta ANTES de la migración de 2026-07 — quien cambió su contraseña
// desde entonces no podría entrar. Los hashes de Supabase son bcrypt ($2a/$2b),
// que bcryptjs verifica tal cual.
//
//   MYSQL_URL="mysql://root@localhost:3306/maqserv24" node migrate/43-importar-hashes.mjs
import pg from 'pg';
import mysql from 'mysql2/promise';
import { env } from './_env.mjs';

const pgc = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await pgc.connect();
const my = await mysql.createConnection({ uri: process.env.MYSQL_URL });

const { rows } = await pgc.query(
  `select id::text id, lower(email) email, encrypted_password hash, raw_app_meta_data->>'role' role
   from auth.users where encrypted_password is not null`);
console.log(`auth.users con hash: ${rows.length}`);

let u = 0, a = 0, sinFila = [];
for (const r of rows) {
  const [res] = await my.query('update users set password=? where auth_id=?', [r.hash, r.id]);
  if (res.affectedRows) { u += res.affectedRows; continue; }
  const [res2] = await my.query('update admins set password=? where auth_id=?', [r.hash, r.id]);
  if (res2.affectedRows) { a += res2.affectedRows; continue; }
  sinFila.push(`${r.email} (${r.role})`);
}
console.log(`users actualizados: ${u} | admins actualizados: ${a}`);
if (sinFila.length) console.log(`sin fila enlazada (no pasa nada, no tenían cuenta en la app): ${sinFila.join(', ')}`);

const [[chk]] = await my.query(`select
  (select count(*) from users where password like '$2a$%' or password like '$2b$%') u_ok,
  (select count(*) from users where password like '$2y$%') u_legacy,
  (select count(*) from users where password is null) u_sin,
  (select count(*) from admins where password like '$2a$%' or password like '$2b$%') a_ok`);
console.log('MySQL ahora:', JSON.stringify(chk));
await my.end(); await pgc.end();
