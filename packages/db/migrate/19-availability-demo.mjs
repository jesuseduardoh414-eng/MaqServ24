/**
 * DISPONIBILIDAD DE DEMOSTRACIÓN.
 *
 * Sin esto, TODOS los equipos dirían POR CONFIRMAR: nadie ha confirmado nada
 * todavía y el modelo, correctamente, no promete lo que no le consta. Es la
 * respuesta correcta, pero no deja ver cómo funciona.
 *
 * Qué carga, y por qué así:
 *
 *   UBICACIÓN — se toma de la ciudad base del aliado que suministra el equipo.
 *   No es un dato inventado: si la máquina es de un proveedor de Apodaca, ahí
 *   está. Cuando exista el portal del proveedor, él la corregirá.
 *
 *   CONFIRMACIONES — repartidas a propósito para que se vean los tres casos:
 *   la mayoría fresca, algunas caducadas (más de 14 días, vuelven a POR
 *   CONFIRMAR solas) y un par sin confirmar nunca.
 *
 *   BLOQUEOS — tres, uno de cada tipo, para poder enseñar que un equipo con
 *   inventario de sobra igual NO se puede asignar si está en mantenimiento,
 *   reservado o en servicio.
 *
 *   node migrate/19-availability-demo.mjs           (carga)
 *   node migrate/19-availability-demo.mjs --borrar  (deja todo como estaba)
 */
import pg from 'pg';
import { env } from './_env.mjs';

const { Client } = pg;
const c = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const MARCA = '[DEMO]';

if (process.argv.includes('--borrar')) {
  const { rowCount: b } = await c.query(`DELETE FROM public.availability_blocks WHERE note LIKE '${MARCA}%'`);
  const { rowCount: p } = await c.query(
    `UPDATE public.products SET location = NULL, availability_confirmed_at = NULL
     WHERE availability_confirmed_at IS NOT NULL OR location IS NOT NULL`,
  );
  console.log(`${b} bloqueos borrados · ${p} equipos sin ubicación ni confirmación.`);
  await c.end();
  process.exit(0);
}

// --- Ubicación: la ciudad del aliado que lo suministra ---------------------
const { rowCount: ubicados } = await c.query(`
  UPDATE public.products p
  SET location = pr.city
  FROM public.providers pr
  WHERE p.provider_id = pr.id AND pr.city IS NOT NULL
`);
console.log(`${ubicados} equipos ubicados según la ciudad de su aliado.`);

// --- Confirmaciones repartidas --------------------------------------------
// El resto (id % 7 == 0) se queda SIN confirmar: es el caso "el sistema conoce
// el activo pero requiere validación del proveedor" del documento.
const { rowCount: frescos } = await c.query(`
  UPDATE public.products
  SET availability_confirmed_at = now() - ((id % 9) || ' days')::interval
  WHERE status = 1 AND id % 7 <> 0 AND id % 5 <> 0
`);
const { rowCount: caducos } = await c.query(`
  UPDATE public.products
  SET availability_confirmed_at = now() - (18 + (id % 20) || ' days')::interval
  WHERE status = 1 AND id % 5 = 0 AND id % 7 <> 0
`);
console.log(`${frescos} con confirmación fresca · ${caducos} con confirmación caducada (>14 días).`);

// --- Tres bloqueos, uno de cada tipo --------------------------------------
await c.query(`DELETE FROM public.availability_blocks WHERE note LIKE '${MARCA}%'`);

const BLOQUEOS = [
  { cat: 'maquinaria-pesada', state: 'mantenimiento', desde: -3, hasta: 6, nota: 'Servicio preventivo de 500 horas' },
  { cat: 'plataformas-de-elevacion', state: 'reservado', desde: 0, hasta: 4, nota: 'Apartada para mantenimiento industrial' },
  { cat: 'equipo-menor', state: 'en-servicio', desde: -1, hasta: 2, nota: 'En obra, regresa el jueves' },
];

for (const b of BLOQUEOS) {
  // Un solo equipo por categoría, el primero, para que el resto siga normal.
  const { rows } = await c.query(
    `SELECT p.id, p.name FROM public.products p
     JOIN public.categories c ON c.id = p.category_id
     WHERE c.cat_slug = $1 AND p.status = 1
     ORDER BY p.id LIMIT 1`,
    [b.cat],
  );
  if (rows.length === 0) {
    console.log(`  (sin equipos en ${b.cat}, se omite)`);
    continue;
  }
  const eq = rows[0];
  await c.query(
    `INSERT INTO public.availability_blocks (product_id, state, starts_on, ends_on, note)
     VALUES ($1, $2, current_date + ($3)::int, current_date + ($4)::int, $5)`,
    [eq.id, b.state, b.desde, b.hasta, `${MARCA} ${b.nota}`],
  );
  console.log(`  ${eq.name.padEnd(30)} ${b.state}`);
}

// --- Resumen de lo que se verá --------------------------------------------
const { rows: resumen } = await c.query(`
  SELECT
    count(*) FILTER (WHERE availability_confirmed_at IS NULL)::int AS sin_confirmar,
    count(*) FILTER (WHERE availability_confirmed_at < now() - interval '14 days')::int AS caducos,
    count(*) FILTER (WHERE availability_confirmed_at >= now() - interval '14 days')::int AS frescos,
    count(*) FILTER (WHERE location IS NOT NULL)::int AS con_ubicacion
  FROM public.products WHERE status = 1
`);
const r = resumen[0];
console.log(`\nequipos activos: sin confirmar ${r.sin_confirmar} · caducados ${r.caducos} · frescos ${r.frescos} · con ubicación ${r.con_ubicacion}`);

await c.end();
console.log('\nPara revertir: node migrate/19-availability-demo.mjs --borrar');
