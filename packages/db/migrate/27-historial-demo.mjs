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
 *   Rentadora del Norte   12 solicitudes: el aliado en el que te apoyas.
 *   Equipos y Herramienta 7: trabaja bien pero tarda ~2 h contra los 25 min
 *                         que declara. Justifica medir en vez de creerle al alta.
 *   Pipas y Agua          6, y canceló DOS ya aceptadas. Es lo que más pesa.
 *   Transportes y Volteos 8 y solo aceptó 1, siempre por el mismo motivo: ahí
 *                         el historial deja de ser una calificación y se vuelve
 *                         un dato de reclutamiento.
 *   Alturas y Plataformas 2, a propósito debajo del mínimo: es el único que
 *                         enseña la regla de "muy pocos casos para porcentajes".
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
 * `respuestaMin` = cuanto tardo ESE aliado en contestar. De ahi sale el tiempo
 * medido, y varia dentro de cada aliado a proposito: una mediana de valores
 * identicos no demuestra nada.
 *
 * OJO con el VOLUMEN. La primera version le dio cinco casos a cada uno con el
 * mismo reparto (4 aceptados y 1 rechazado), asi que las tarjetas de arriba
 * —lo primero que se ve— salian identicas para tres de los cuatro aliados y
 * solo se distinguian en el tiempo de respuesta, que queda mas abajo. Un
 * historial de demostracion donde todos se ven igual no demuestra nada: los
 * numeros de cada uno tienen que contar su propia historia DESDE LAS TARJETAS.
 */
const PERFILES = [
  {
    // El aliado en el que te apoyas: mucho trabajo y casi nada se cae.
    slug: 'demo-rentadora-industrial-norte',
    categoria: 'maquinaria-pesada',
    casos: [
      { dias: 96, respuestaMin: 11, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 88, respuestaMin: 7, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 79, respuestaMin: 14, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 71, respuestaMin: 9, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 63, respuestaMin: 26, estado: 'rechazado', servicio: null, motivo: 'Toda la flota comprometida esa semana' },
      { dias: 55, respuestaMin: 10, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 47, respuestaMin: 8, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 38, respuestaMin: 13, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 30, respuestaMin: 12, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 21, respuestaMin: 19, estado: 'rechazado', servicio: null, motivo: 'Obra fuera de su cobertura' },
      { dias: 13, respuestaMin: 6, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 5, respuestaMin: 15, estado: 'aceptado', servicio: 'cerrado' },
    ],
  },
  {
    // Trabaja bien, pero contesta cuando puede: ~2 h contra los 25 min que dice.
    slug: 'demo-equipos-herramienta-mty',
    categoria: 'equipo-menor',
    casos: [
      { dias: 74, respuestaMin: 145, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 61, respuestaMin: 96, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 52, respuestaMin: 210, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 43, respuestaMin: 118, estado: 'aceptado', servicio: 'cancelado' },
      { dias: 31, respuestaMin: 175, estado: 'rechazado', servicio: null, motivo: 'Sin unidades libres' },
      { dias: 19, respuestaMin: 132, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 9, respuestaMin: 164, estado: 'aceptado', servicio: 'cerrado' },
    ],
  },
  {
    // El problema no es que rechace: es que acepta y despues se cae.
    slug: 'demo-pipas-agua-obra',
    categoria: 'agua-en-pipas',
    casos: [
      { dias: 84, respuestaMin: 35, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 69, respuestaMin: 48, estado: 'aceptado', servicio: 'cancelado' },
      { dias: 57, respuestaMin: 29, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 44, respuestaMin: 52, estado: 'aceptado', servicio: 'cancelado' },
      { dias: 33, respuestaMin: 41, estado: 'rechazado', servicio: null, motivo: 'Fuera de su zona' },
      { dias: 20, respuestaMin: 38, estado: 'aceptado', servicio: 'cerrado' },
    ],
  },
  {
    // Casi nunca toma trabajo, y siempre por lo mismo. Aqui el historial deja
    // de ser una calificacion y se vuelve un dato de reclutamiento.
    slug: 'demo-transportes-volteos',
    categoria: 'volteos',
    casos: [
      { dias: 91, respuestaMin: 240, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 80, respuestaMin: 310, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 68, respuestaMin: 190, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 58, respuestaMin: 420, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 45, respuestaMin: 275, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 34, respuestaMin: 360, estado: 'rechazado', servicio: null, motivo: 'No cubre esa zona' },
      { dias: 22, respuestaMin: 295, estado: 'rechazado', servicio: null, motivo: 'Flota comprometida' },
      { dias: 10, respuestaMin: 330, estado: 'rechazado', servicio: null, motivo: 'No cubre esa zona' },
    ],
  },
  {
    // A proposito debajo del minimo: es el unico que ensena la regla de "muy
    // pocos casos para sacar porcentajes". Sin un aliado asi, esa proteccion
    // —que es una decision de diseno— queda invisible.
    slug: 'demo-alturas-plataformas',
    categoria: 'plataformas-de-elevacion',
    casos: [
      { dias: 26, respuestaMin: 21, estado: 'aceptado', servicio: 'cerrado' },
      { dias: 12, respuestaMin: 17, estado: 'aceptado', servicio: 'cerrado' },
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
