/**
 * CLIENTES Y SUS OBRAS (documento institucional, sección 17 · Módulo Clientes).
 *
 * "Clientes: datos, obras, contactos, requisitos y comportamiento."
 *
 * Hoy una solicitud guarda una dirección escrita a mano y nada más. En la base
 * real eso ya se ve: "Constructora del Norte SA de CV" tiene tres solicitudes
 * con TRES direcciones distintas, y para el sistema son tres desconocidos. No
 * se puede saber qué se le mandó a esa obra, quién es el residente, ni qué
 * exige el acceso.
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. CLIENTE no es USUARIO. Ya existe `users`, que son cuentas que entran al
 *    sitio; de las 50 cotizaciones, sólo 6 tienen usuario — las otras 44 las
 *    hizo alguien sin registrarse. El cliente es la empresa que contrata, y
 *    existe tenga cuenta o no. Meterlo en `users` obligaría a inventarle una
 *    cuenta a quien nunca la pidió, y a tratar como clientes a las 70 cuentas
 *    de prueba que nunca compraron.
 *
 * 2. Las solicitudes viejas SE LIGAN, no se descartan. El historial de una obra
 *    empieza el día que se abre la obra; si el respaldo no se agrupa, la
 *    plataforma nace amnésica y el dato hay que reconstruirlo a mano, que es
 *    justo lo que advierte la sección 25.
 *
 *   node migrate/28-clientes-obras.mjs             (crea y agrupa)
 *   node migrate/28-clientes-obras.mjs --solo-ver   (enseña qué agruparía)
 *   node migrate/28-clientes-obras.mjs --renombrar  (corrige nombres deducidos)
 */
import pg from 'pg';
import { env } from './_env.mjs';

const soloVer = process.argv.includes('--solo-ver');
const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

/** Compara nombres y direcciones ignorando acentos, mayúsculas y ruido. */
function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?a\.?\s*de\s*c\.?v\.?|s\.?\s*de\s*r\.?l\.?|sapi|sc)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Nombre provisional de una obra.
 *
 * La primera version usaba la REGION, y salio mal: las tres obras de
 * "Constructora del Norte" quedaron llamadas "Nuevo Leon", que es exactamente
 * el problema que las obras vienen a resolver. La region es la misma para todos
 * los frentes de la misma empresa; lo que los distingue es la calle o la
 * colonia, o sea el PRIMER pedazo de la direccion.
 *
 * Es un nombre para que el admin lo reconozca y lo corrija, no uno definitivo.
 */
function nombrarObra(direccion, region) {
  const trozo = (direccion ?? '').split(',')[0].trim();
  // Un numero suelto o un codigo postal no nombran nada.
  if (trozo.length > 2 && !/^\d+$/.test(trozo)) return trozo.slice(0, 190);
  const segundo = (direccion ?? '').split(',')[1]?.trim();
  if (segundo && segundo.length > 2) return segundo.slice(0, 190);
  return (region || 'Obra').trim().slice(0, 190);
}

await c.connect();
try {
  // Reparar los nombres que la primera version dedujo mal. Solo toca las que
  // siguen con la nota de "deducida": una obra que alguien ya renombro a mano
  // no se pisa.
  if (process.argv.includes('--renombrar')) {
    const obras = await c.query(`
      select s.id, s.name, s.client_id, s.address, s.municipality
      from client_sites s
      where s.notes like 'Obra deducida%'
    `);
    let n = 0;
    for (const o of obras.rows) {
      const propuesto = nombrarObra(o.address, o.municipality);
      if (propuesto && propuesto !== o.name) {
        await c.query('update client_sites set name = $1, updated_at = now() where id = $2', [propuesto, o.id]);
        console.log(`  · #${o.id} "${o.name}" -> "${propuesto}"`);
        n++;
      }
    }
    console.log(`  ✓ ${n} obra(s) renombradas`);
    process.exit(0);
  }

  if (!soloVer) await c.query('begin');

  // ── Tablas ───────────────────────────────────────────────────────────
  if (!soloVer) {
    await c.query(`
      create table if not exists clients (
        id          serial primary key,
        name        varchar(190) not null,
        /* Cuenta del sitio, SI la tiene. La mayoría no la tiene. */
        user_id     integer,
        email       varchar(190),
        phone       varchar(40),
        rfc         varchar(20),
        industry    varchar(120),
        notes       text,
        status      smallint not null default 1,
        created_at  timestamp not null default now(),
        updated_at  timestamp not null default now()
      )
    `);
    await c.query('create index if not exists clients_name_idx on clients(lower(name))');
    await c.query('create index if not exists clients_user_idx on clients(user_id)');

    await c.query(`
      create table if not exists client_sites (
        id            serial primary key,
        client_id     integer not null references clients(id) on delete cascade,
        /* Cómo le dicen en la obra: "Torre Vasconcelos", "Frente 3". */
        name          varchar(190) not null,
        address       text,
        municipality  varchar(120),
        state         varchar(120),
        /* Vacías por ahora; las llena el requisito de geolocalización. */
        lat           numeric(10,7),
        lng           numeric(10,7),
        contact_name  varchar(190),
        contact_phone varchar(40),
        /* Lo que ESA obra exige: inducción, seguro del operador, torreta.
           Va como lista para poder cruzarla después con el expediente del
           aliado sin volver a leer texto libre. */
        requirements  text[] not null default '{}',
        notes         text,
        status        smallint not null default 1,
        created_at    timestamp not null default now(),
        updated_at    timestamp not null default now()
      )
    `);
    await c.query('create index if not exists client_sites_client_idx on client_sites(client_id, status)');

    await c.query(`
      alter table quotes
        add column if not exists client_id integer references clients(id) on delete set null,
        add column if not exists site_id   integer references client_sites(id) on delete set null
    `);
    await c.query('create index if not exists quotes_client_idx on quotes(client_id)');
    await c.query('create index if not exists quotes_site_idx on quotes(site_id)');

    for (const t of ['clients', 'client_sites']) {
      await c.query(`alter table ${t} enable row level security`);
    }
  }

  // ── Agrupar lo que ya existe ─────────────────────────────────────────
  const qs = await c.query(`
    select id, coalesce(company_name,'') company_name, coalesce(name,'') name,
           email, phone, industry, address, region, user_id, quote_number
    from quotes order by id
  `);

  /**
   * La identidad del cliente es la empresa; si no la dieron, el correo. El
   * NOMBRE de la persona no sirve como identidad: dos residentes distintos de
   * la misma constructora crearían dos clientes.
   */
  const clientes = new Map(); // clave -> { nombre, filas[] }
  for (const q of qs.rows) {
    const porEmpresa = normalizar(q.company_name);
    const clave = porEmpresa || `correo:${(q.email ?? '').toLowerCase().trim()}`;
    if (!clave || clave === 'correo:') continue;
    if (!clientes.has(clave)) {
      clientes.set(clave, { nombre: q.company_name.trim() || q.name.trim() || q.email, filas: [] });
    }
    clientes.get(clave).filas.push(q);
  }

  console.log(`  ${qs.rowCount} solicitudes -> ${clientes.size} cliente(s)`);

  let obras = 0;
  for (const [, cli] of clientes) {
    const direcciones = new Set(cli.filas.map((f) => normalizar(f.address)).filter(Boolean));
    obras += direcciones.size;
    if (soloVer && (cli.filas.length > 1 || direcciones.size > 1)) {
      console.log(`  · ${cli.nombre.slice(0, 34).padEnd(36)} ${cli.filas.length} solicitud(es), ${direcciones.size} obra(s)`);
    }
  }
  console.log(`  ${obras} obra(s) por dirección distinta`);

  if (soloVer) {
    console.log('\n  (--solo-ver: no se escribió nada)');
    process.exit(0);
  }

  for (const [, cli] of clientes) {
    const primera = cli.filas[0];
    const ya = await c.query('select id from clients where lower(name) = lower($1) limit 1', [cli.nombre]);
    let clientId;
    if (ya.rowCount > 0) {
      clientId = ya.rows[0].id;
    } else {
      const ins = await c.query(
        `insert into clients (name, user_id, email, phone, industry, notes)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [
          cli.nombre.slice(0, 190),
          primera.user_id ?? null,
          primera.email ?? null,
          primera.phone ?? null,
          primera.industry ?? null,
          'Creado al agrupar las solicitudes que ya existían.',
        ],
      );
      clientId = ins.rows[0].id;
    }

    // Una obra por dirección distinta. El nombre sale del municipio o de la
    // primera parte de la dirección: es un nombre provisional que el admin
    // corrige, pero es mejor que "Obra 1".
    const porDireccion = new Map();
    for (const f of cli.filas) {
      const k = normalizar(f.address);
      if (!k) continue;
      if (!porDireccion.has(k)) porDireccion.set(k, []);
      porDireccion.get(k).push(f);
    }

    for (const [, filas] of porDireccion) {
      const f0 = filas[0];
      const nombreObra = nombrarObra(f0.address, f0.region);
      const ins = await c.query(
        `insert into client_sites (client_id, name, address, municipality, contact_name, contact_phone, notes)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [
          clientId, nombreObra, f0.address, f0.region ?? null,
          f0.name || null, f0.phone || null,
          'Obra deducida de la dirección de solicitudes anteriores. Conviene revisar el nombre.',
        ],
      );
      const siteId = ins.rows[0].id;
      await c.query('update quotes set site_id = $1, client_id = $2 where id = any($3)', [
        siteId, clientId, filas.map((x) => x.id),
      ]);
    }

    // Las solicitudes sin dirección se quedan con cliente pero sin obra: es
    // más honesto que inventarles una.
    await c.query(
      'update quotes set client_id = $1 where id = any($2) and client_id is null',
      [clientId, cli.filas.map((x) => x.id)],
    );
  }

  const r = await c.query(`
    select count(*) filter (where client_id is not null)::int con_cliente,
           count(*) filter (where site_id is not null)::int con_obra,
           count(*)::int total
    from quotes
  `);
  console.log(`\n  ✓ ${r.rows[0].con_cliente}/${r.rows[0].total} solicitudes ligadas a un cliente`);
  console.log(`  ✓ ${r.rows[0].con_obra}/${r.rows[0].total} ligadas también a una obra`);

  await c.query('commit');
} catch (e) {
  if (!soloVer) await c.query('rollback').catch(() => {});
  throw e;
} finally {
  await c.end();
}
