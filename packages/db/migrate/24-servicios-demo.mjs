/**
 * SERVICIOS DE DEMOSTRACIÓN.
 *
 * El tablero de operaciones nace vacío: ninguna de las 11 cotizaciones que hay
 * traía línea de servicio ni ubicación —son todas anteriores al cotizador por
 * categoría— y ninguna fue aceptada. Sin datos no se puede enseñar el flujo, y
 * el flujo es justamente lo que hay que enseñar.
 *
 * Estos tres NO son clientes reales. Llevan [DEMO] en los comentarios y se
 * borran juntos. Cada uno está parado en una etapa distinta a propósito, para
 * que el tablero muestre el ciclo completo de un vistazo:
 *
 *   1. POR ASIGNAR   — aceptada, nadie asignado todavía. Es donde entra el
 *                      "Buscar aliado" y el emparejamiento.
 *   2. EN CURSO      — con aliado que aceptó y la unidad trabajando.
 *   3. TERMINADO     — listo para capturar el cierre: cuántos viajes hizo la
 *                      pipa. Es el paso que el documento pide documentar y el
 *                      único que no se puede saltar.
 *
 *   node migrate/24-servicios-demo.mjs           (crea)
 *   node migrate/24-servicios-demo.mjs --borrar  (elimina)
 */
import pg from 'pg';
import { env } from './_env.mjs';

const borrar = process.argv.includes('--borrar');
const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

const MARCA = '[DEMO]';

/** Días hacia atrás, para que las fechas no salgan todas iguales. */
const hace = (d) => new Date(Date.now() - d * 86400000);

const SERVICIOS = [
  {
    numero: 'COT-DEMO0001',
    empresa: 'Constructora Cerro Azul',
    contacto: 'Ing. Patricia Salinas',
    email: 'demo1@maqser24.mx',
    telefono: '81 8000 0001',
    categoria: 'maquinaria-pesada',
    direccion: 'Parque Industrial Apodaca, Apodaca, N.L.',
    equipo: 'Excavadora sobre orugas 20 ton',
    subtotal: 48000,
    flete: 6500,
    estado: 'por_asignar',
    aceptadaHace: 1,
    requisitos: {
      obra_ubicacion: 'Parque Industrial Apodaca, Apodaca, N.L.',
      fecha_inicio: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      duracion: '2 semanas',
      capacidad: '20 toneladas',
      implemento: 'Cucharón de excavación',
      acceso: 'Camino de terracería, entra lowboy',
    },
    aliados: [],
  },
  {
    numero: 'COT-DEMO0002',
    empresa: 'Urbanizadora Valle Poniente',
    contacto: 'Arq. Daniel Treviño',
    email: 'demo2@maqser24.mx',
    telefono: '81 8000 0002',
    categoria: 'equipo-menor',
    direccion: 'Av. Lázaro Cárdenas 2400, Monterrey, N.L.',
    equipo: 'Rompedora neumática + compresor',
    subtotal: 12800,
    flete: 1200,
    estado: 'en_curso',
    aceptadaHace: 6,
    iniciadoHace: 3,
    requisitos: {
      obra_ubicacion: 'Av. Lázaro Cárdenas 2400, Monterrey, N.L.',
      duracion: '10 días',
      horario: 'Lunes a sábado, 7:00 a 18:00',
    },
    // El aliado que aceptó. Se busca por slug para no depender de ids.
    aliados: [{ slug: 'demo-equipos-herramienta-mty', estado: 'aceptado', hace: 5 }],
  },
  {
    numero: 'COT-DEMO0003',
    empresa: 'Terracerías del Golfo',
    contacto: 'Sr. Marco Villarreal',
    email: 'demo3@maqser24.mx',
    telefono: '81 8000 0003',
    categoria: 'agua-en-pipas',
    direccion: 'Camino a Salinas Victoria km 8, Salinas Victoria, N.L.',
    equipo: 'Pipa de agua 10,000 L',
    subtotal: 21000,
    flete: 0,
    estado: 'terminado',
    aceptadaHace: 12,
    iniciadoHace: 9,
    requisitos: {
      origen: 'Pozo autorizado, Escobedo',
      destino: 'Camino a Salinas Victoria km 8',
      frecuencia: 'Diaria',
      volumen: '10,000 litros por viaje',
    },
    // Uno rechazó y otro aceptó: es el caso que hace visible por qué el rechazo
    // se guarda con motivo en lugar de borrarse.
    aliados: [
      { slug: 'demo-transportes-volteos', estado: 'rechazado', hace: 11, motivo: 'Flota comprometida esa semana' },
      { slug: 'demo-pipas-agua-obra', estado: 'aceptado', hace: 11 },
    ],
  },
];

await c.connect();
try {
  if (borrar) {
    // El borrado en cascada de las FK se lleva asignaciones y eventos.
    const r = await c.query(`delete from quotes where comments like '%${MARCA}%' returning quote_number`);
    console.log(`  ✓ ${r.rowCount} servicio(s) de demostración eliminados`);
    process.exit(0);
  }

  await c.query('begin');

  for (const s of SERVICIOS) {
    // Idempotente: correrlo dos veces no duplica.
    const ya = await c.query('select id from quotes where quote_number = $1', [s.numero]);
    if (ya.rowCount > 0) {
      console.log(`  · ${s.numero} ya existe, se salta`);
      continue;
    }

    const total = s.subtotal + s.flete;
    const aceptada = hace(s.aceptadaHace);
    // `cart_data` en el formato keyed-map del legacy, para que el detalle del
    // cliente muestre el equipo como en cualquier otra cotización.
    const carrito = JSON.stringify({
      demo: { qty: 1, days: 1, price: s.subtotal, item: { id: 0, name: s.equipo, cprice: s.subtotal, photo: null } },
    });

    const q = await c.query(
      `insert into quotes (
         name, email, phone, company_name, product_interested, comments,
         address, service_category, requirements, cart_data,
         subtotal, freight_cost, tax, total, status, quote_number,
         conditions, included, excluded, valid_until, responded_by, responded_at,
         accepted_at, service_state, service_started_at,
         created_at, updated_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,'completed',$14,
         $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
       ) returning id`,
      [
        s.contacto, s.email, s.telefono, s.empresa, s.equipo,
        `${MARCA} Servicio de demostración — no es un cliente real.`,
        s.direccion, s.categoria, JSON.stringify(s.requisitos), carrito,
        s.subtotal, s.flete, total, s.numero,
        'Precio sujeto a confirmación de disponibilidad.',
        'Traslado de ida y vuelta, operador y mantenimiento.',
        'Combustible, maniobras especiales y tiempos de espera.',
        new Date(Date.now() + 10 * 86400000),
        'Operaciones MAQSER24', hace(s.aceptadaHace + 1),
        aceptada, s.estado,
        s.iniciadoHace ? hace(s.iniciadoHace) : null,
        hace(s.aceptadaHace + 2), hace(0),
      ],
    );
    const quoteId = q.rows[0].id;

    // Historial: lo que ya pasó. Sin esto el servicio aparecería en su etapa
    // final sin forma de saber cómo llegó ahí, que es lo contrario de la
    // trazabilidad que el documento pide.
    const pasos = ['por_asignar'];
    if (s.estado !== 'por_asignar') pasos.push('asignado', 'en_traslado', 'en_sitio', 'en_curso');
    if (s.estado === 'terminado') pasos.push('terminado');

    for (let i = 0; i < pasos.length; i++) {
      await c.query(
        `insert into service_events (quote_id, from_state, to_state, note, created_at)
         values ($1,$2,$3,$4,$5)`,
        [
          quoteId,
          i === 0 ? null : pasos[i - 1],
          pasos[i],
          i === 0 ? 'El cliente aceptó la cotización' : null,
          hace(Math.max(0, s.aceptadaHace - i)),
        ],
      );
    }

    for (const a of s.aliados) {
      const p = await c.query('select id, name from providers where slug = $1', [a.slug]);
      if (p.rowCount === 0) {
        console.log(`    ! aliado ${a.slug} no existe, se salta`);
        continue;
      }
      await c.query(
        `insert into service_assignments (quote_id, provider_id, state, reason, offered_at, responded_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$5)`,
        [quoteId, p.rows[0].id, a.estado, a.motivo ?? null, hace(a.hace + 1), hace(a.hace)],
      );
      await c.query(
        `insert into service_events (quote_id, to_state, note, created_at)
         values ($1,$2,$3,$4)`,
        [
          quoteId,
          a.estado,
          a.estado === 'aceptado'
            ? `${p.rows[0].name} aceptó`
            : `${p.rows[0].name} rechazó${a.motivo ? `: ${a.motivo}` : ''}`,
          hace(a.hace),
        ],
      );
    }

    console.log(`  ✓ ${s.numero}  ${s.empresa.padEnd(26)} ${s.estado}`);
  }

  await c.query('commit');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
