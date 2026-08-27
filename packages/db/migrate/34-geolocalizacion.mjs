/**
 * GEOLOCALIZACIÓN (documento institucional, sección 17).
 *
 * "Geolocalización: relaciona obra, proveedor, equipo, banco, ruta y cobertura."
 *
 * La cobertura era una lista de municipios escritos a mano, y el emparejamiento
 * los comparaba como texto. Funciona en el área metropolitana —donde los
 * municipios son pocos y todos los conocen— y se rompe al salir de ella: nadie
 * va a capturar los 51 municipios de Nuevo León, y "Ciénega de Flores" escrito
 * de tres maneras son tres municipios distintos para una comparación de texto.
 *
 * Con coordenadas y un radio, la pregunta cambia de "¿escribió este municipio?"
 * a "¿está a menos de N kilómetros?", que es la que de verdad importa.
 *
 * SE AGREGA, NO SE REEMPLAZA: la lista de municipios sigue sirviendo y sigue
 * siendo lo único que hay para los aliados sin coordenadas. Cambiar de un
 * criterio a otro de golpe dejaría a la red entera sin cobertura hasta que
 * alguien geocodifique a los seis.
 *
 *   node migrate/34-geolocalizacion.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query(`
    alter table providers
      add column if not exists lat numeric(10,7),
      add column if not exists lng numeric(10,7),
      /* Hasta dónde llega desde su base. Null = sólo vale su lista de municipios. */
      add column if not exists coverage_radius_km integer,
      /* Dirección de su base, para poder geocodificarla. */
      add column if not exists address text
  `);
  await c.query('create index if not exists providers_geo_idx on providers(lat, lng)');
  await c.query('create index if not exists client_sites_geo_idx on client_sites(lat, lng)');

  const p = await c.query('select count(*)::int n from providers where status = 1');
  const s = await c.query('select count(*)::int n from client_sites where status = 1');
  console.log(`  ✓ providers.lat/lng/coverage_radius_km/address listos`);
  console.log(`  · ${p.rows[0].n} aliado(s) y ${s.rows[0].n} obra(s) sin coordenadas todavía`);
  console.log('    Se geocodifican desde el panel: no se inventan.');
} finally {
  await c.end();
}
