/**
 * INCIDENCIAS DE CAMPO Y COMPROMISO DE LLEGADA.
 *
 * El documento las lista como CONTROL DE RIESGO, no como función deseable
 * (sección 30): "Incidencias de campo: registro, evidencias, responsables,
 * escalamiento y cierre". Una máquina que llega tarde, una unidad que falla a
 * media jornada, un acceso que no permitió entrar — hoy eso vive en llamadas y
 * desaparece.
 *
 * VAN JUNTAS CON EL COMPROMISO DE LLEGADA, y es la razón de hacerlas ahora:
 * la incidencia más común es "llegó tarde", y eso no se puede afirmar sin una
 * hora comprometida contra la cual comparar. Hasta hoy el historial de
 * cumplimiento medía todo menos la puntualidad y lo reportaba como no medible
 * — que era honesto, pero era un hueco.
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. La incidencia cuelga del SERVICIO, no del aliado. Muchas no son culpa de
 *    nadie —una obra inundada, un acceso cerrado por la constructora— y
 *    colgarlas del aliado convertiría el registro en un expediente de castigos
 *    que nadie querría llenar. El responsable se marca aparte, y puede ser el
 *    cliente, el aliado, la plataforma o nadie.
 *
 * 2. La incidencia tiene su PROPIO cierre, separado del cierre del servicio.
 *    Un servicio puede terminar bien con una incidencia todavía abierta —falta
 *    reponer una pieza, falta acordar el descuento— y forzarlas a cerrar
 *    juntas haría que se cerraran en falso.
 *
 *   node migrate/31-incidencias.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query('begin');

  // ── Compromiso de llegada ─────────────────────────────────────────────
  // Va en la ASIGNACIÓN y no en la cotización: quien se compromete es el
  // aliado que aceptó, y si se reasigna a otro, el compromiso es del nuevo.
  await c.query(`
    alter table service_assignments
      add column if not exists committed_at timestamp,
      add column if not exists arrived_at   timestamp
  `);
  await c.query(
    'create index if not exists service_assignments_committed_idx on service_assignments(committed_at)',
  );

  // ── Incidencias ───────────────────────────────────────────────────────
  await c.query(`
    create table if not exists service_incidents (
      id           serial primary key,
      quote_id     bigint not null references quotes(id) on delete cascade,
      /* Qué aliado estaba atendiendo cuando pasó. Null si todavía no había. */
      provider_id  integer references providers(id) on delete set null,
      /* retraso | falla | acceso | seguridad | faltante | dano | otro */
      kind         varchar(20) not null,
      /* baja | media | alta */
      severity     varchar(10) not null default 'media',
      /* cliente | aliado | plataforma | nadie */
      responsible  varchar(20) not null default 'nadie',
      description  text not null,
      /* Fotos y documentos. El documento pide evidencias por su nombre. */
      evidence     text[] not null default '{}',
      /* abierta | cerrada */
      state        varchar(10) not null default 'abierta',
      resolution   text,
      opened_by    integer,
      closed_by    integer,
      opened_at    timestamp not null default now(),
      closed_at    timestamp,
      created_at   timestamp not null default now()
    )
  `);
  await c.query('create index if not exists service_incidents_quote_idx on service_incidents(quote_id, id)');
  await c.query('create index if not exists service_incidents_provider_idx on service_incidents(provider_id, state)');
  await c.query('create index if not exists service_incidents_open_idx on service_incidents(state, opened_at desc)');
  await c.query('alter table service_incidents enable row level security');

  await c.query('commit');
  console.log('  ✓ service_incidents, committed_at y arrived_at listos');

  const n = await c.query(`
    select count(*)::int n from service_assignments where state = 'aceptado'
  `);
  console.log(`  · ${n.rows[0].n} asignación(es) aceptadas sin compromiso de llegada todavía`);
  console.log('    (no se les inventa una: sólo se pide de aquí en adelante)');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
