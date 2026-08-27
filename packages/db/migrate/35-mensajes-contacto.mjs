/**
 * BANDEJA DE MENSAJES DE CONTACTO (actividad 87).
 *
 * Hasta ahora el formulario de /contacto validaba los datos, intentaba
 * empujarlos a Perfex CRM y respondía "recibido" — pero **no los guardaba en
 * ningún lado**. Con Perfex sin credenciales (que es el estado real), ese
 * intento se descarta en silencio: la persona cree que escribió y nadie lo lee.
 * Es la peor combinación posible, porque el acuse de recibo hace creer que el
 * canal funciona.
 *
 * Esta tabla es el destino que faltaba. El CRM sigue siendo el objetivo del
 * brief, pero deja de ser el ÚNICO: el mensaje se guarda primero y se empuja
 * después. Si el CRM está caído o sin configurar, el mensaje ya no se pierde,
 * solo espera — y `crm_pushed` dice cuáles quedaron sin subir.
 *
 *   node migrate/35-mensajes-contacto.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query('begin');

  await c.query(`
    create table if not exists contact_messages (
      id         serial primary key,
      name       varchar(120) not null,
      email      varchar(190) not null,
      phone      varchar(40),
      company    varchar(190),
      /* Qué eligió en "¿En qué te ayudamos?": rentar equipo, cotización… */
      need       varchar(120),
      message    text not null,
      /* nuevo | atendido | archivado. Arranca en 'nuevo' para que la bandeja
         pueda decir cuántos esperan respuesta, que es el dato que se mira. */
      state      varchar(20) not null default 'nuevo',
      /* Quién lo atendió y cuándo: sin esto, dos personas contestan lo mismo. */
      handled_by varchar(190),
      handled_at timestamp,
      /* ¿Llegó a Perfex? false = quedó pendiente de subir (CRM sin configurar
         o caído). Es lo que permite empujar el atraso cuando se conecte. */
      crm_pushed boolean not null default false,
      created_at timestamp not null default now()
    )
  `);
  await c.query('create index if not exists contact_messages_created_idx on contact_messages(created_at desc)');
  await c.query('create index if not exists contact_messages_state_idx on contact_messages(state, created_at desc)');
  await c.query('create index if not exists contact_messages_email_idx on contact_messages(email)');
  await c.query('alter table contact_messages enable row level security');

  await c.query('commit');
  console.log('  ✓ contact_messages listo');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
