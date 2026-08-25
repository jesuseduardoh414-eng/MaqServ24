/**
 * REQUERIMIENTOS DE LA SOLICITUD.
 *
 * Guarda las respuestas del formulario por categoria (documento institucional,
 * secciones 8 a 13) en la cotizacion, ademas del texto legible que ya va en
 * `comments`. El JSON sirve para lo que viene despues —comparar solicitudes,
 * emparejar con proveedores, medir que se pide y no se cubre—; el texto sirve
 * hoy, para que quien cotiza lo lea sin pantallas nuevas.
 *
 * SOLO AGREGA una columna que admite nulos: las cotizaciones existentes no
 * cambian.
 *
 *   node migrate/20-quote-requirements.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const { Client } = pg;
const c = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

await c.query(`ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS requirements jsonb`);
await c.query(`ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_category text`);

const { rows } = await c.query(`
  SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name = 'quotes' AND column_name IN ('requirements','service_category')
  ORDER BY column_name
`);
for (const r of rows) console.log(`quotes.${r.column_name} listo (${r.data_type}, admite nulos: ${r.is_nullable})`);

const { rows: n } = await c.query(`SELECT count(*)::int AS n FROM public.quotes WHERE requirements IS NOT NULL`);
console.log(`cotizaciones con requerimientos: ${n[0].n}`);

await c.end();
