-- ============================================================================
-- BORRAR CUENTAS VIEJAS DE PRUEBAS AUTOMÁTICAS DEL PANEL (2026-10-08)
-- ----------------------------------------------------------------------------
-- Las pruebas automáticas dejaron cuentas del panel con dominio
-- @maqserv24.test (fix-*, aud2, u-*) cuyas contraseñas nadie conoce. Se borran.
-- Se CONSERVAN las cuentas de prueba con contraseña conocida, que terminan en
-- `.prueba@maqserv24.test` (operaciones.prueba, administracion.prueba), y
-- todas las de correos reales.
--
-- Nada tiene llave foránea hacia `admins`: la bitácora guarda el correo, no
-- el id, así que el rastro de lo que hicieron se queda. Solo se borran sus
-- marcas de "avisos leídos" (filas `panel-leido:<id>` en `notifications`).
--
-- Idempotente. Pegar en phpMyAdmin con la base seleccionada.
-- ============================================================================

START TRANSACTION;

CREATE TEMPORARY TABLE cuentas_fuera AS
  SELECT id FROM admins
   WHERE email LIKE '%@maqserv24.test'
     AND email NOT LIKE '%.prueba@maqserv24.test';

DELETE FROM notifications
 WHERE user_id IS NULL
   AND type IN (SELECT CONCAT('panel-leido:', id) FROM cuentas_fuera);
DELETE FROM admins WHERE id IN (SELECT id FROM cuentas_fuera);

DROP TEMPORARY TABLE cuentas_fuera;

COMMIT;
