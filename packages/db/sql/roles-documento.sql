-- ============================================================================
-- ROLES DEL PANEL SEGÚN EL DOCUMENTO · tres en vez de cinco (2026-10-08)
-- ----------------------------------------------------------------------------
-- Decisión del cliente: los roles internos son los tres participantes de la
-- sección 14 del documento: Dirección, Operaciones y Administración.
--
--   red, comercial  →  operaciones   (Operaciones absorbe su trabajo)
--   marca           →  administracion (el de menos alcance; el sitio web pasó
--                                      a Dirección, pero subir una cuenta a
--                                      Dirección le daría acceso total: eso lo
--                                      decide Dirección a mano)
--
-- Aunque no se corra, el código ya trata esos roles viejos así al leerlos; el
-- script solo deja la base en limpio y quita los permisos guardados de los
-- roles que ya no existen (Administradores → Permisos).
--
-- Idempotente. Pegar en phpMyAdmin con la base seleccionada.
-- ============================================================================

START TRANSACTION;

UPDATE admins SET role = 'operaciones', updated_at = NOW() WHERE role IN ('red', 'comercial');
UPDATE admins SET role = 'administracion', updated_at = NOW() WHERE role = 'marca';
DELETE FROM admin_role_modules WHERE rol IN ('red', 'comercial', 'marca');

COMMIT;
