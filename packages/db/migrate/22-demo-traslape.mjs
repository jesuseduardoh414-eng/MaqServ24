/**
 * QUE LOS ALIADOS DEMO SE TRASLAPEN.
 *
 * Como quedaron, cada línea de servicio tiene exactamente un aliado. Eso hace
 * que el emparejamiento no tenga nada que decidir: siempre sale uno y siempre
 * es el mismo. No se puede enseñar así, porque lo que hay que enseñar es
 * precisamente el criterio con el que el sistema ORDENA a varios candidatos.
 *
 * Ampliar la cobertura tampoco es inventar: una rentadora que tiene
 * excavadoras casi siempre renta también rompedoras y compactadores, y quien
 * mueve volteos suele mover material del banco. Los traslapes de abajo son los
 * que ocurren de verdad en el ramo, no combinaciones al azar.
 *
 * Con esto, una solicitud de equipo menor en Monterrey pone a competir a tres
 * aliados con expedientes, tiempos de respuesta y disponibilidad distintos, que
 * es la demostración que sirve.
 *
 *   node migrate/22-demo-traslape.mjs           (aplica)
 *   node migrate/22-demo-traslape.mjs --revertir  (deja una categoría por aliado)
 */
import pg from 'pg';
import { env } from './_env.mjs';

const revertir = process.argv.includes('--revertir');
const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

/** slug del aliado -> las líneas que atiende, la primera es la principal. */
const TRASLAPES = {
  // Rentadora grande: la pesada es lo suyo, pero también renta el equipo menor
  // que acompaña a la obra (rompedoras, compactadores, plantas de luz).
  'demo-rentadora-industrial-norte': ['maquinaria-pesada', 'equipo-menor'],
  // Casa de herramienta: su fuerte es el equipo menor y sube a plataformas
  // chicas (tijera eléctrica), que es el brinco natural del giro.
  'demo-equipos-herramienta-mty': ['equipo-menor', 'plataformas-de-elevacion'],
  'demo-alturas-plataformas': ['plataformas-de-elevacion', 'equipo-menor'],
  // Quien tiene pipas casi siempre tiene volteos: es la misma flota de carga.
  'demo-pipas-agua-obra': ['agua-en-pipas', 'volteos'],
  'demo-transportes-volteos': ['volteos', 'agua-en-pipas', 'triturados'],
  // El banco de materiales vende el triturado y lo entrega en sus propios
  // volteos; sin el flete no cierra la venta.
  'demo-banco-materiales-sierra': ['triturados', 'volteos'],
};

await c.connect();
try {
  for (const [slug, cats] of Object.entries(TRASLAPES)) {
    const lista = revertir ? [cats[0]] : cats;
    const r = await c.query(
      `update providers set categories = $1 where slug = $2 and notes like '%[DEMO]%' returning name`,
      [lista, slug],
    );
    if (r.rowCount === 0) {
      console.log(`  · ${slug}: no existe o no es demo, se salta`);
      continue;
    }
    console.log(`  ✓ ${r.rows[0].name} -> ${lista.join(', ')}`);
  }

  const resumen = await c.query(`
    select cat.cat_slug, count(p.id)::int n
    from categories cat
    left join providers p on p.status = 1 and cat.cat_slug = any(p.categories)
    where cat.status = 1
    group by cat.cat_slug, cat.id order by cat.id
  `);
  console.log('\nAliados por línea de servicio:');
  resumen.rows.forEach((x) => console.log(`  ${x.cat_slug.padEnd(28)} ${x.n}`));
} finally {
  await c.end();
}
