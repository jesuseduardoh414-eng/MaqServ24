/**
 * ATRIBUTOS TÉCNICOS DEL EQUIPO (documento institucional, sección 17).
 *
 * "Catálogo: estandariza categorías, tipos de equipo, capacidades, materiales
 * y atributos."
 *
 * `products.specs` ya existía, pero es texto libre: sirve para leer y no para
 * comparar. Nadie podía buscar "excavadora de más de 20 toneladas", y el
 * emparejamiento no podía descartar una plataforma que no alcanza la altura
 * que la obra pidió — aunque la solicitud YA pregunta esa altura.
 *
 * `attributes` guarda lo mismo pero estructurado, con las MISMAS llaves que
 * usa el formulario de solicitud. Ese es todo el puente entre los dos lados.
 *
 * No reemplaza a `specs`: la ficha en prosa sigue siendo útil para lo que no
 * cabe en un campo, y borrarla perdería lo que alguien ya escribió.
 *
 *   node migrate/32-atributos-producto.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query(`alter table products add column if not exists attributes jsonb`);
  // Índice GIN: permite filtrar por atributo sin recorrer la tabla entera
  // cuando el catálogo crezca.
  await c.query(`create index if not exists products_attributes_idx on products using gin (attributes)`);

  const n = await c.query(`select count(*)::int n from products where status = 1`);
  console.log(`  ✓ products.attributes listo (${n.rows[0].n} equipos activos, todos sin atributos todavía)`);
  console.log('    Se llenan desde el alta del producto: no se inventan.');
} finally {
  await c.end();
}
