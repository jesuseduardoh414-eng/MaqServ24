/**
 * HISTORIAL DE DEMOSTRACIÓN PARA LOS ALIADOS.
 *
 * El historial de cumplimiento no se puede enseñar con lo que hay: cada aliado
 * demo tiene UNA solicitud, y una no es un historial. Debajo de cinco casos el
 * sistema —a propósito— se niega a dar porcentajes, así que la mitad de la
 * función queda invisible.
 *
 * Esto crea solicitudes PASADAS y ya cerradas para los aliados demo. No son
 * clientes reales: llevan [DEMO] y se borran con el resto.
 *
 * Cada aliado está armado para mostrar un comportamiento distinto, porque de
 * eso trata la pantalla:
 *
 *   Rentadora del Norte   cumplidor: contesta rápido y termina lo que acepta.
 *   Equipos y Herramienta acepta casi todo pero tarda MUCHO más de lo que
 *                         promete (25 min declarados contra ~2 h reales). Es el
 *                         caso que justifica medir en vez de creerle al alta.
 *   Pipas y Agua          canceló un servicio ya aceptado. Es lo que más pesa.
 *   Transportes y Volteos rechaza seguido, y siempre por lo mismo: ahí el
 *                         historial deja de ser una calificación y se vuelve un
 *                         dato de reclutamiento.
 *
 *   node migrate/27-historial-demo.mjs           (crea)
 *   node migrate/27-historial-demo.mjs --borrar  (elimina)
 */
import pg from 'pg';
import { env } from './_env.mjs';

const borrar = process.argv.includes('--borrar');
const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

const MARCA = '[DEMO-HIST]';
const hace = (dias, minutos = 0) => new Date(Date.now() - dias * 86400000 - minutos * 60000);

/**
 * `respuestaMin` = cuánto tardó ESE aliado en contestar. Es el número del que
 * sale el tiempo medido, y por eso varía dentro de cada aliado: una mediana de
 * valores idénticos no demuestra nada.
 */
const PERFILES = [
  {
    slug: 'demo-rentadora-industrial-norte',
    categoria: 'maquinaria-pesada',
    casos: [
      { dias: 62, respuestaMin: 9, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 51, respuestaMin: 14, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 40, respuestaMin: 11, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 28, respuestaMin: 22, estado: 'rechazado', servicio: null, motivo: 'Toda la flota comprometida esa semana' },
      { dias: 17, respuestaMin: 8, estado: 'aceptado', servicio: 'cerrado' },
    ],
  },
  {
    slug: 'demo-equipos-herramienta-mty',
    categoria: 'equipo-menor',
    casos: [
      { dias: 58, respuestaMin: 145, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 44, respuestaMin: 96, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 33, respuestaMin: 210, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 21, respuestaMin: 118, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 12, respuestaMin: 175, estado: 'rechazado', servicio: null, motivo: 'Sin unidades libres' },
    ],
  },
  {
    slug: 'demo-pipas-agua-obra',
    categoria: 'agua-en-pipas',
    casos: [
      { dias: 70, respuestaMin: 35, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 55, respuestaMin: 48, estado: 'aceptado', servicio: 'cancelado' },
      { dias: 41, respuestaMin: 29, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 26, respuestaMin: 52, estado: 'rechazado', servicio: null, motivo: 'Fuera de su zona' },
      { dias: 15, respuestaMin: 38, estado: 'aceptado', servicio: 'cerrado' },
    ],
  },
  {
    slug: 'demo-transportes-volteos',
    categoria: 'volteos',
    casos: [
      { dias: 66, respuestaMin: 240, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 49, respuestaMin: 310, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 37, respuestaMin: 190, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 23, respuestaMin: 420, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 11, respuestaMin: 275, estado: 'rechazado', servicio: null, motivo: 'No cubre esa zona' },
    ],
  },
];

await c.connect();
try {
  if (borrar) {
    const r = await c.query(`delete from quotes where comments like '%${MARCA}%' returning quote_number`);
    console.log(`  ✓ ${r.rowCount} solicitud(es) de historial eliminadas`);
    process.exit(0);
  }

  await c.query('begin');
  let n = 0;

  for (const perfil of PERFILES) {
    const p = await c.query(`select id, name from providers where slug = $1`, [perfil.slug]);
    if (p.rowCount === 0) {
      console.log(`  · ${perfil.slug} no existe, se salta`);
      continue;
    }
    const { id: providerId, name } = p.rows[0];

    for (let i = 0; i < perfil.casos.length; i++) {
      const caso = perfil.casos[i];
      const numero = `COT-H${String(providerId).padStart(2, '0')}${String(i + 1).padStart(2, '0')}DEMO`;

      const ya = await c.query('select 1 from quotes where quote_number = $1', [numero]);
      if (ya.rowCount > 0) continue;

      const ofrecido = hace(caso.dias);
      const contestado = hace(caso.dias, -caso.respuestaMin); // después de ofrecer
      const total = 15000 + i * 3200;

      const q = await c.query(
        `insert into quotes (
           name, email, phone, company_name, product_interested, comments,
           service_category, cart_data, subtotal, freight_cost, tax, total,
           status, quote_number, accepted_at, service_state, service_closed_at,
           created_at, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,'{}',$8,0,0,$8,'completed',$9,$10,$11,$12,$13,$13)
         returning id`,
        [
          'Cliente histórico', 'historico@maqser24.mx', '81 8000 0000',
          `Obra ${numero.slice(-8)}`, perfil.categoria,
          `${MARCA} Solicitud pasada, solo para el historial de ${name}.`,
          perfil.categoria, total, numero,
          caso.estado === 'aceptado' ? contestado : null,
          caso.servicio,
          caso.servicio === 'cerrado' ? hace(caso.dias - 6) : null,
          ofrecido,
        ],
      );

      await c.query(
        `insert into service_assignments (quote_id, provider_id, state, reason, offered_at, responded_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$5)`,
        [q.rows[0].id, providerId, caso.estado, caso.motivo ?? null, ofrecido, contestado],
      );
      n++;
    }
    console.log(`  ✓ ${name}: ${perfil.casos.length} solicitud(es) de historial`);
  }

  await c.query('commit');
  console.log(`\n  ${n} solicitud(es) creadas en total`);
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
