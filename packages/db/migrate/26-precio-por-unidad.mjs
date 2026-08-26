/**
 * EL PRECIO SABE EN QUÉ UNIDAD ESTÁ (documento institucional, sección 16).
 *
 * "Una excavadora se renta por hora, día o periodo; un volteo puede medirse por
 * viaje; una pipa por viaje o jornada; un triturado por tonelada o metro
 * cúbico; una plataforma por día, semana o mes."
 *
 * Hasta ahora `cprice` era SIEMPRE mensual y el día y la semana se sacaban
 * dividiendo (mes/20 y mes/4). Para renta de equipo eso es una regla real del
 * ramo. Para lo demás no existe: un viaje de pipa no es una fracción de un mes,
 * y una tonelada de triturado tampoco. El resultado era que a los tres
 * servicios que se cobran por viaje o por peso había que cotizarlos a mano
 * fuera del sistema.
 *
 * `price_unit` guarda en qué unidad está `cprice`. Se llena con 'mes' para
 * todo lo que hoy es renta —que es lo que ya significaba— así que ningún
 * precio existente cambia de valor ni de lectura.
 *
 *   node migrate/26-precio-por-unidad.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

/**
 * Unidad por defecto de cada línea, para los equipos que ya están dados de alta.
 * Coincide con `UNIDADES_POR_CATEGORIA` de packages/config, pero aquí la renta
 * arranca en 'mes' y no en 'dia': es la unidad en la que están capturados los
 * precios de hoy, y cambiarla los multiplicaría por veinte.
 */
const POR_CATEGORIA = {
  'maquinaria-pesada': 'mes',
  'equipo-menor': 'mes',
  'plataformas-de-elevacion': 'mes',
  'agua-en-pipas': 'viaje',
  volteos: 'viaje',
  triturados: 'tonelada',
};

await c.connect();
try {
  await c.query('begin');

  await c.query(`alter table products add column if not exists price_unit varchar(20)`);

  // Todo lo que es renta ya estaba capturado en pesos por mes.
  const renta = await c.query(
    `update products set price_unit = 'mes' where is_rental = true and price_unit is null`,
  );
  console.log(`  · ${renta.rowCount} equipo(s) de renta quedan en 'mes' (su valor no cambia)`);

  // Los de las líneas que no se cobran por tiempo. Se hace DESPUÉS y solo sobre
  // los que no son renta: si un volteo estuviera dado de alta como renta
  // mensual, cambiarle la unidad a 'viaje' convertiría su tarifa de mes en
  // tarifa de viaje sin tocar el número — y ahí sí cambia el precio de verdad.
  for (const [slug, unidad] of Object.entries(POR_CATEGORIA)) {
    if (unidad === 'mes') continue;
    const r = await c.query(
      `update products p set price_unit = $1
       from categories cat
       where cat.id = p.category_id and cat.cat_slug = $2
         and p.price_unit is null and p.is_rental = false`,
      [unidad, slug],
    );
    if (r.rowCount > 0) console.log(`  · ${r.rowCount} en ${slug} -> ${unidad}`);
  }

  const resto = await c.query(`select count(*)::int n from products where price_unit is null`);
  console.log(`  · ${resto.rows[0].n} sin unidad (venta directa: el precio es por pieza)`);

  await c.query('commit');
  console.log('  ✓ products.price_unit listo');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
