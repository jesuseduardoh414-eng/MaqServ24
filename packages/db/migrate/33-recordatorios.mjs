/**
 * RECORDATORIOS AL ALIADO (documento institucional, sección 18).
 *
 * "Recordatorios automáticos para confirmar disponibilidad."
 *
 * La regla ya existe: un equipo sin confirmar en catorce días pasa solo a "por
 * confirmar" y deja de proponerse. Lo que faltaba es que alguien se entere —
 * sin el recordatorio, esa regla sólo degrada el catálogo en silencio hasta que
 * todo aparece sin confirmar y el emparejamiento se queda sin nada que ofrecer.
 *
 * `reminder_sent_at` es lo que impide convertir el recordatorio en spam: sin
 * él, cada corrida volvería a escribirle a los mismos, y un aliado que recibe
 * el mismo correo cinco veces deja de leer los correos — incluidos los que sí
 * importan.
 *
 *   node migrate/33-recordatorios.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query(`alter table providers add column if not exists reminder_sent_at timestamp`);
  console.log('  ✓ providers.reminder_sent_at listo');
} finally {
  await c.end();
}
