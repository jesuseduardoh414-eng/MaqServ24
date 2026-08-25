/**
 * DISPONIBILIDAD REAL — ubicación, frescura del dato y bloqueos por fecha.
 *
 * Del documento institucional, sección 21: "Un inventario estático no basta: un
 * equipo puede estar rentado, en mantenimiento, en traslado, reservado, fuera de
 * zona o técnicamente disponible pero sin operador. MAQSER24 debe tratar la
 * disponibilidad como un ESTADO DINÁMICO con fecha, ubicación y confiabilidad."
 *
 * Hoy la disponibilidad es un entero de existencias. Esto agrega las tres piezas
 * que faltan:
 *
 *   1. UBICACIÓN — dónde está el equipo. El documento insiste en que dos
 *      excavadoras iguales no son la misma solución si una está a 5 km y la otra
 *      a 150. Sin este dato no se puede calcular traslado ni cercanía.
 *
 *   2. FRESCURA — cuándo se confirmó por última vez. El control que pide el
 *      documento contra el riesgo de "disponibilidad desactualizada" es
 *      "confirmación periódica y marca de antigüedad del dato". Un stock que
 *      nadie confirma en meses no es una promesa que se pueda sostener, así que
 *      pasado cierto tiempo el equipo vuelve a POR CONFIRMAR solo.
 *
 *   3. BLOQUEOS — periodos en que el equipo NO se puede asignar, con su motivo.
 *      Son los estados que el documento enumera: reservado, en traslado, en
 *      servicio, mantenimiento e inactivo.
 *
 * SOLO AGREGA: dos columnas que admiten nulos y una tabla nueva. Ningún producto
 * cambia de comportamiento hasta que se le capture algo.
 *
 * Idempotente:
 *   node migrate/18-availability.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const { Client } = pg;
const c = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// --- 1 y 2. Ubicación y frescura del dato --------------------------------
await c.query(`ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location text`);
await c.query(`ALTER TABLE public.products ADD COLUMN IF NOT EXISTS availability_confirmed_at timestamp`);

// --- 3. Bloqueos con fecha ------------------------------------------------
// `ends_on` puede ir nulo: un equipo dado de baja o en mantenimiento sin fecha
// de retorno se bloquea "hasta nuevo aviso".
await c.query(`
  CREATE TABLE IF NOT EXISTS public.availability_blocks (
    id         serial PRIMARY KEY,
    product_id integer NOT NULL,
    state      text NOT NULL,
    starts_on  date NOT NULL,
    ends_on    date,
    note       text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`);

// El índice cubre la consulta real: "bloqueos de ESTE equipo vigentes HOY".
await c.query(`CREATE INDEX IF NOT EXISTS availability_blocks_product_idx ON public.availability_blocks (product_id, starts_on, ends_on)`);
await c.query(`ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY`);

// --- Verificación ---------------------------------------------------------
const { rows: cols } = await c.query(`
  SELECT column_name, is_nullable FROM information_schema.columns
  WHERE table_name = 'products' AND column_name IN ('location','availability_confirmed_at')
  ORDER BY column_name
`);
for (const x of cols) console.log(`products.${x.column_name} listo (admite nulos: ${x.is_nullable})`);

const { rows: t } = await c.query(`
  SELECT c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='availability_blocks'
`);
console.log(`tabla availability_blocks lista · RLS ${t[0]?.rls ? 'activo' : 'APAGADO'}`);

const { rows: n } = await c.query(`SELECT count(*)::int AS n FROM public.availability_blocks`);
console.log(`bloqueos registrados: ${n[0].n}`);

await c.end();
console.log('\nSiguiente: pnpm --filter @maqserv/db pull');
