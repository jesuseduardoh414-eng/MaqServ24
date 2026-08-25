/**
 * COTIZACION FORMAL (documento institucional, seccion 22).
 *
 * El documento pide que una cotizacion guarde "la version enviada, vigencia,
 * conceptos incluidos, conceptos excluidos, impuestos, terminos, condiciones de
 * cancelacion y cualquier variable que pudiera convertirse despues en una
 * diferencia comercial", y que quede registro de "quien autorizo y que version
 * fue aceptada". Y remata: "La estandarizacion protege tanto al cliente como al
 * proveedor".
 *
 * Hoy la cotizacion ya tiene folio y un campo de condiciones en texto libre.
 * Faltaban estas cuatro:
 *
 *   valid_until  — hasta cuando vale el precio. Sin esto una cotizacion de hace
 *                  tres meses sigue pareciendo vigente.
 *   included     — que SI incluye (traslado, operador, combustible...)
 *   excluded     — que NO incluye. Es la que evita la discusion cara.
 *   responded_by — quien la autorizo, y cuando la acepto el cliente.
 *
 * SOLO AGREGA columnas que admiten nulos.
 *
 *   node migrate/21-quote-formal.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const { Client } = pg;
const c = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const COLS = [
  ['valid_until', 'date'],
  ['included', 'text'],
  ['excluded', 'text'],
  ['responded_by', 'text'],
  ['responded_at', 'timestamp'],
  ['accepted_at', 'timestamp'],
];
for (const [name, type] of COLS) {
  await c.query(`ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS ${name} ${type}`);
}

const { rows } = await c.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'quotes' AND column_name = ANY($1) ORDER BY column_name
`, [COLS.map((c) => c[0])]);
for (const r of rows) console.log(`quotes.${r.column_name.padEnd(14)} ${r.data_type}`);
console.log(`\n${rows.length}/${COLS.length} columnas listas`);

await c.end();
