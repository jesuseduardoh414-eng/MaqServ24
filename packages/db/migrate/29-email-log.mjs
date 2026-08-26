/**
 * REGISTRO DE CORREOS (documento institucional, sección 17 · Comunicaciones).
 *
 * "Notificaciones, recordatorios y TRAZABILIDAD DE INTERACCIONES."
 *
 * La tabla no es un detalle de implementación: es la mitad del requisito. Un
 * sistema que manda correos y no anota cuáles mandó no tiene trazabilidad,
 * tiene esperanza. Cuando el cliente diga "nunca me llegó", la respuesta debe
 * salir de aquí y no de la memoria de alguien.
 *
 * También es lo que hace visible el fallo. Un correo que no sale y no avisa es
 * peor que no tener correos: la operación cree que informó y nadie informó.
 *
 *   node migrate/29-email-log.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query('begin');

  await c.query(`
    create table if not exists email_log (
      id          serial primary key,
      /* Para qué se mandó: quote_answered, service_status, provider_offer... */
      kind        varchar(40) not null,
      to_email    varchar(190) not null,
      to_name     varchar(190),
      subject     text not null,
      /* enviado | fallido | omitido | simulado */
      state       varchar(20) not null,
      /* Por qué falló, o por qué se omitió. Es el campo que se lee cuando
         alguien pregunta qué pasó. */
      detail      text,
      /* A qué se refiere, para poder saltar desde el registro al caso. */
      quote_id    bigint,
      order_id    integer,
      provider_id integer,
      created_at  timestamp not null default now()
    )
  `);
  await c.query('create index if not exists email_log_created_idx on email_log(created_at desc)');
  await c.query('create index if not exists email_log_state_idx on email_log(state, created_at desc)');
  await c.query('create index if not exists email_log_quote_idx on email_log(quote_id)');
  await c.query('alter table email_log enable row level security');

  await c.query('commit');
  console.log('  ✓ email_log listo');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
