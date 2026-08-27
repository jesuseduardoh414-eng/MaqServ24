/**
 * ACCESO DEL ALIADO (documento institucional, sección 20).
 *
 * "La experiencia debe permitir al aliado registrar o actualizar sus equipos,
 * zonas, capacidades y documentos; recibir solicitudes que realmente
 * correspondan a su oferta; contestar disponibilidad y condiciones; conocer
 * asignaciones; y mantener historial."
 *
 * Es la mitad del modelo que hoy ejecuta operaciones a mano: alguien captura
 * lo que el aliado contestó por teléfono y renueva sus papeles por él. Funciona
 * con seis aliados; no funciona con sesenta.
 *
 * POR QUÉ UN ENLACE Y NO UNA CONTRASEÑA:
 *
 * El aliado no es un usuario de software: es el dueño de una rentadora que
 * contesta desde la cabina de una camioneta. Pedirle que recuerde una
 * contraseña de un portal que usa dos veces al mes garantiza que no lo use —
 * y entonces todo vuelve al teléfono, que es lo que se quiere quitar.
 *
 * En su lugar, un enlace firmado que llega por correo y abre directo lo suyo.
 * `access_version` permite revocarlo: subirle uno invalida todos los enlaces
 * que se hayan mandado antes, sin tocar nada más. Es lo que se usa cuando a un
 * aliado se le va el encargado con el correo en el teléfono.
 *
 *   node migrate/30-acceso-aliado.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

await c.connect();
try {
  await c.query('begin');

  await c.query(`
    alter table providers
      add column if not exists access_version integer not null default 1,
      /* Última vez que entró. Alimenta el indicador de salud de la información
         de oferta: un aliado que nunca entra es un aliado cuyo inventario está
         hablando de memoria. */
      add column if not exists last_access_at timestamp,
      /* Cuándo se le mandó el enlace, para no mandarlo dos veces al día. */
      add column if not exists access_sent_at timestamp
  `);

  console.log('  ✓ providers.access_version, last_access_at y access_sent_at listos');

  const n = await c.query(`select count(*)::int n from providers where email is not null and email <> ''`);
  console.log(`  · ${n.rows[0].n} aliado(s) tienen correo y podrían recibir su enlace`);

  await c.query('commit');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
