/**
 * PRIMER CONTACTO CON EL CLIENTE (documento institucional, sección 25).
 *
 * De los doce indicadores, "tiempo a primera respuesta" era uno de los tres que
 * el tablero declaraba NO MEDIBLES, con este motivo escrito: sólo se sabía
 * cuándo se le puso precio a una solicitud, no cuándo alguien le habló al
 * cliente por primera vez.
 *
 * No son lo mismo y la diferencia es justo lo que el documento quiere ver: una
 * operación puede tardar dos días en cotizar y aun así haber llamado en veinte
 * minutos para decir "lo estamos viendo" — o no haber llamado nunca. Enseñar el
 * tiempo a cotización con el nombre de "primera respuesta" habría tapado esa
 * diferencia con un número que ya existía.
 *
 * `first_contact_via` distingue de dónde salió el dato: una llamada que alguien
 * registró, o la cotización misma (cuando nadie contactó antes, el primer
 * contacto real FUE la cotización). Sin esa columna, el indicador no podría
 * decir cuánto de su número es atención temprana de verdad.
 *
 * Aditivo y sin backfill: rellenar el histórico con `responded_at` inventaría
 * llamadas que nadie hizo. El indicador arranca vacío y el tablero ya sabe
 * decir "todavía no hay casos".
 *
 *   node migrate/36-primer-contacto.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query('begin');

  await c.query(`
    alter table quotes
      add column if not exists first_contact_at  timestamp,
      /* Quién lo contactó: el nombre del admin, igual que en responded_by. */
      add column if not exists first_contact_by  varchar(190),
      /* llamada | whatsapp | correo | visita | cotizacion */
      add column if not exists first_contact_via varchar(20)
  `);
  await c.query('create index if not exists quotes_first_contact_idx on quotes(first_contact_at)');

  await c.query('commit');
  console.log('  ✓ quotes.first_contact_at / _by / _via listos');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
