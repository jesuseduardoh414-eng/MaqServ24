-- ============================================================================
-- CONTENIDO DE LOS CORREOS EN EL REGISTRO (2026-10-12)
-- ----------------------------------------------------------------------------
-- Configuración › Correo solo guardaba a quién, el asunto y si salió: no se
-- podía abrir un correo para ver qué decía. Desde ahora se guarda el cuerpo,
-- con los enlaces personales (contraseña, acceso del aliado) ocultos.
--
-- Los correos anteriores se quedan sin contenido: no se guardó.
--
-- Sin esta columna la API sigue funcionando (registra sin contenido), pero el
-- detalle dice "sin contenido". Idempotente. Pegar en phpMyAdmin con la base
-- seleccionada.
-- ============================================================================

ALTER TABLE email_log ADD COLUMN IF NOT EXISTS body_html MEDIUMTEXT NULL AFTER detail;
