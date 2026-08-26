/**
 * EL SERVICIO DESPUÉS DE LA COTIZACIÓN (documento institucional, sección 16).
 *
 * La plataforma se detenía al responder la cotización. Lo que pasaba después
 * —a quién se le asignó, si ya llegó la unidad, cuántos viajes hizo, cuándo se
 * cerró— vivía en llamadas y WhatsApp. Es exactamente lo que el documento
 * señala como el hueco: "falta de trazabilidad sobre quién cotizó, qué se
 * ofreció, dónde está el equipo y cuál es el estatus de la operación".
 *
 * Tres piezas:
 *
 *   quotes.service_*        el estatus del servicio y su cierre (cuánto y en
 *                           qué unidad: horas, viajes, toneladas).
 *   service_assignments     a qué aliado se le ofreció y qué contestó. Es una
 *                           TABLA y no una columna a propósito: una solicitud
 *                           puede necesitar dos aliados (la excavadora de uno,
 *                           las pipas de otro), y cuando el primero rechaza hay
 *                           que poder ver que rechazó, no que nunca existió.
 *   service_events          el historial. Sin él, "trazabilidad" es una palabra
 *                           en un documento.
 *
 *   node migrate/23-servicios.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query('begin');

  // --- El estatus del servicio vive en la cotización ---------------------
  // No se toca `quotes.status` (pending/completed): ese dice si YA SE COTIZÓ.
  // Mezclar las dos cosas en una columna es lo que hizo que en `orders` el
  // enum legacy quedara de sombra. Aquí se separa desde el principio.
  await c.query(`
    alter table quotes
      add column if not exists service_state    varchar(20),
      add column if not exists service_unit     varchar(20),
      add column if not exists service_quantity numeric(12,2),
      add column if not exists service_notes    text,
      add column if not exists service_started_at timestamp,
      add column if not exists service_closed_at  timestamp
  `);

  // --- A quién se le ofreció y qué contestó ------------------------------
  await c.query(`
    create table if not exists service_assignments (
      id           serial primary key,
      quote_id     bigint  not null references quotes(id) on delete cascade,
      provider_id  integer not null references providers(id) on delete restrict,
      -- propuesto | aceptado | rechazado | retirado
      state        varchar(20) not null default 'propuesto',
      -- Qué le toca a este aliado cuando la solicitud se reparte entre varios.
      scope        text,
      -- Por qué rechazó. Es el dato que dice si la red sirve o no para esa zona.
      reason       text,
      offered_at   timestamp not null default now(),
      responded_at timestamp,
      created_by   integer,
      created_at   timestamp not null default now()
    )
  `);
  await c.query('create index if not exists service_assignments_quote_idx on service_assignments(quote_id, id)');
  await c.query('create index if not exists service_assignments_provider_idx on service_assignments(provider_id, state)');

  // --- El historial ------------------------------------------------------
  await c.query(`
    create table if not exists service_events (
      id         serial primary key,
      quote_id   bigint not null references quotes(id) on delete cascade,
      -- null = lo movió el sistema, no una persona.
      admin_id   integer,
      from_state varchar(20),
      to_state   varchar(20) not null,
      note       text,
      created_at timestamp not null default now()
    )
  `);
  await c.query('create index if not exists service_events_quote_idx on service_events(quote_id, id)');

  // --- Las cotizaciones ya aceptadas entran al flujo ---------------------
  // Sin esto quedarían fuera del tablero para siempre: aceptadas, sin estatus
  // y sin forma de llegar a ellas.
  const r = await c.query(`
    update quotes set service_state = 'por_asignar'
    where accepted_at is not null and service_state is null
  `);
  console.log(`  · ${r.rowCount} cotización(es) ya aceptada(s) entran como "por asignar"`);

  // --- RLS ---------------------------------------------------------------
  // Mismo criterio que el resto: la API entra con la llave de servicio, que
  // salta RLS. Se activa para que nadie llegue con la llave pública.
  for (const t of ['service_assignments', 'service_events']) {
    await c.query(`alter table ${t} enable row level security`);
  }

  await c.query('commit');
  console.log('  ✓ service_state en quotes, service_assignments y service_events listos');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
