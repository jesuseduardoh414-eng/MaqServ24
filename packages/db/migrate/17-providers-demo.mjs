/**
 * ALIADOS DE DEMOSTRACIÓN.
 *
 * Sirven para enseñar cómo funciona la red mientras no hay proveedores reales.
 * NO son empresas de verdad: los nombres están inventados a propósito para que
 * nadie los confunda con un aliado real ni parezca que existe una relación
 * comercial que no existe.
 *
 * Cada uno está armado para demostrar una parte distinta del modelo, no para
 * verse bonito:
 *
 *   - Los CUATRO niveles del documento: registrado, validado, activo y preferente.
 *   - Los CUATRO estados de expediente: al día, por vencer, vencido y sin documentos.
 *   - Y sobre todo el caso que más importa: un aliado de nivel "activo" cuyos
 *     papeles vencieron PIERDE el sello de verificado. Es la regla que el
 *     documento institucional pide y la que hay que poder enseñar.
 *
 * Todos llevan la marca [DEMO] en sus notas y se borran juntos:
 *   node migrate/17-providers-demo.mjs           (crea)
 *   node migrate/17-providers-demo.mjs --borrar  (elimina)
 *
 * Idempotente: volver a correrlo actualiza, no duplica.
 */
import pg from 'pg';
import { env } from './_env.mjs';

const { Client } = pg;
const c = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const MARCA = '[DEMO]';
const dias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const meses = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

if (process.argv.includes('--borrar')) {
  await c.query(`UPDATE public.products SET provider_id = NULL WHERE provider_id IN
                 (SELECT id FROM public.providers WHERE notes LIKE '${MARCA}%')`);
  const { rowCount } = await c.query(`DELETE FROM public.providers WHERE notes LIKE '${MARCA}%'`);
  console.log(`${rowCount} aliados de demostración eliminados (sus documentos se van en cascada).`);
  await c.end();
  process.exit(0);
}

/** Municipios reales del área metropolitana; los que el análisis competitivo prioriza. */
const ALIADOS = [
  {
    slug: 'demo-rentadora-industrial-norte',
    name: 'Rentadora Industrial del Norte',
    level: 'preferente',
    contact: 'Coordinación de flota',
    phone: '81 8000 0001',
    city: 'Apodaca',
    coverage: ['Apodaca', 'Escobedo', 'Monterrey', 'García', 'Salinas Victoria'],
    categories: ['maquinaria-pesada'],
    responseMinutes: 12,
    mesesEnRed: 24,
    docs: [
      { kind: 'fiscal', name: 'Constancia de situación fiscal', expires: dias(240) },
      { kind: 'legal', name: 'Acta constitutiva', expires: null },
      { kind: 'seguro', name: 'Póliza de responsabilidad civil', expires: dias(180) },
    ],
    caso: 'nivel más alto y expediente en regla → verificado',
  },
  {
    slug: 'demo-equipos-herramienta-mty',
    name: 'Equipos y Herramienta MTY',
    level: 'activo',
    contact: 'Mostrador de rentas',
    phone: '81 8000 0002',
    city: 'Monterrey',
    coverage: ['Monterrey', 'San Nicolás', 'Guadalupe', 'Santa Catarina'],
    categories: ['equipo-menor'],
    responseMinutes: 25,
    mesesEnRed: 9,
    docs: [
      { kind: 'fiscal', name: 'Constancia de situación fiscal', expires: dias(300) },
      { kind: 'seguro', name: 'Póliza de equipo', expires: dias(18) },
    ],
    caso: 'una póliza por vencer en 18 días → sigue verificado, pero avisa',
  },
  {
    slug: 'demo-alturas-plataformas',
    name: 'Alturas y Plataformas del Golfo',
    level: 'validado',
    contact: 'Servicio a clientes',
    phone: '81 8000 0003',
    city: 'Santa Catarina',
    coverage: ['Santa Catarina', 'Monterrey', 'García'],
    categories: ['plataformas-de-elevacion'],
    responseMinutes: 18,
    mesesEnRed: 5,
    docs: [
      { kind: 'fiscal', name: 'Constancia de situación fiscal', expires: dias(150) },
      { kind: 'seguridad', name: 'Certificación de operadores en altura', expires: dias(90) },
    ],
    caso: 'recién validado, papeles vigentes → verificado',
  },
  {
    slug: 'demo-pipas-agua-obra',
    name: 'Pipas y Agua para Obra',
    level: 'activo',
    contact: 'Programación de viajes',
    phone: '81 8000 0004',
    city: 'Escobedo',
    coverage: ['Escobedo', 'Salinas Victoria', 'El Carmen', 'Apodaca'],
    categories: ['agua-en-pipas'],
    responseMinutes: 40,
    mesesEnRed: 14,
    docs: [
      { kind: 'fiscal', name: 'Constancia de situación fiscal', expires: dias(200) },
      { kind: 'seguridad', name: 'Permiso sanitario de transporte de agua', expires: dias(-45) },
    ],
    caso: 'ESTE ES EL IMPORTANTE: nivel activo pero un permiso vencido hace 45 días → PIERDE el sello',
  },
  {
    slug: 'demo-transportes-volteos',
    name: 'Transportes y Volteos Regios',
    level: 'registrado',
    contact: 'Despacho',
    phone: '81 8000 0005',
    city: 'Juárez',
    coverage: ['Juárez', 'Cadereyta', 'Guadalupe', 'Apodaca'],
    categories: ['volteos'],
    responseMinutes: null,
    mesesEnRed: 1,
    docs: [],
    caso: 'recién dado de alta, sin expediente todavía → no verificado',
  },
  {
    slug: 'demo-banco-materiales-sierra',
    name: 'Banco de Materiales La Sierra',
    level: 'validado',
    contact: 'Ventas de agregados',
    phone: '81 8000 0006',
    city: 'García',
    coverage: ['García', 'Santa Catarina', 'Monterrey'],
    categories: ['triturados'],
    responseMinutes: 60,
    mesesEnRed: 7,
    docs: [
      { kind: 'fiscal', name: 'Constancia de situación fiscal', expires: dias(260) },
      { kind: 'tecnico', name: 'Ensaye de laboratorio del banco', expires: dias(120) },
    ],
    caso: 'proveedor de material con ficha técnica vigente → verificado',
  },
];

for (const a of ALIADOS) {
  const { rows } = await c.query(
    `INSERT INTO public.providers
       (name, slug, level, contact_name, phone, email, city, state,
        coverage, categories, response_minutes, notes, status, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Nuevo León',$8,$9,$10,$11,1,$12)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, level = EXCLUDED.level, contact_name = EXCLUDED.contact_name,
       phone = EXCLUDED.phone, city = EXCLUDED.city, coverage = EXCLUDED.coverage,
       categories = EXCLUDED.categories, response_minutes = EXCLUDED.response_minutes,
       notes = EXCLUDED.notes, joined_at = EXCLUDED.joined_at, updated_at = now()
     RETURNING id`,
    [
      a.name,
      a.slug,
      a.level,
      a.contact,
      a.phone,
      `contacto@${a.slug.replace(/^demo-/, '')}.mx`,
      a.city,
      a.coverage,
      a.categories,
      a.responseMinutes,
      `${MARCA} Aliado de demostración — ${a.caso}`,
      meses(a.mesesEnRed),
    ],
  );
  const id = rows[0].id;

  // Los documentos se rehacen en cada corrida: así las fechas relativas
  // (vencido hace 45 días, vence en 18) siguen significando lo mismo mañana.
  await c.query(`DELETE FROM public.provider_documents WHERE provider_id = $1`, [id]);
  for (const d of a.docs) {
    await c.query(
      `INSERT INTO public.provider_documents (provider_id, kind, name, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [id, d.kind, d.name, d.expires],
    );
  }

  // Cada aliado se queda con los equipos de la línea que atiende.
  const { rowCount } = await c.query(
    `UPDATE public.products p SET provider_id = $1
     FROM public.categories c
     WHERE p.category_id = c.id AND c.cat_slug = ANY($2)`,
    [id, a.categories],
  );
  console.log(`${a.name.padEnd(34)} ${a.level.padEnd(11)} ${a.docs.length} doc(s)  ${rowCount} equipo(s)`);
}

const { rows: resumen } = await c.query(`
  SELECT p.level, count(*)::int AS n FROM public.providers p
  WHERE p.notes LIKE '${MARCA}%' GROUP BY p.level ORDER BY p.level
`);
console.log('\npor nivel:', resumen.map((r) => `${r.level}=${r.n}`).join(' '));

const { rows: sinDueno } = await c.query(
  `SELECT count(*)::int AS n FROM public.products WHERE status = 1 AND provider_id IS NULL`,
);
console.log(`equipos activos sin aliado asignado: ${sinDueno[0].n}`);

await c.end();
console.log('\nPara quitarlos: node migrate/17-providers-demo.mjs --borrar');
