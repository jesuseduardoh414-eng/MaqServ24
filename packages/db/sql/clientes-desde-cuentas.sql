-- ============================================================================
-- CADA CUENTA DEL SITIO ES CLIENTE (2026-10-15)
-- ----------------------------------------------------------------------------
-- Hasta hoy, Clientes y obras sólo tenía a quien ya había pedido algo. Quien
-- se registró en el sitio sin pedir nada no aparecía, aunque también es
-- cliente. Desde ahora el API crea el cliente al confirmar la cuenta; este
-- script hace lo mismo con las cuentas que ya existían.
--
-- 1. Si alguien pidió algo SIN cuenta y después se registró con el mismo
--    correo, se liga ese cliente a su cuenta (no se crea otro).
-- 2. Las demás cuentas confirmadas sin cliente reciben uno con el nombre de la
--    persona. Cuando cotice con el nombre de su empresa, el API lo corrige.
--
-- No borra nada. Idempotente. Pegar en phpMyAdmin con la base seleccionada.
-- ============================================================================

-- 1. Clientes sin cuenta con el correo de una cuenta que aún no tiene cliente.
UPDATE clients c
JOIN users u ON LOWER(u.email) = LOWER(c.email)
SET c.user_id = u.id, c.updated_at = CURRENT_TIMESTAMP(6)
WHERE c.user_id IS NULL
  AND u.email_verified_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT user_id FROM clients WHERE user_id IS NOT NULL) ya
    WHERE ya.user_id = u.id
  );

-- 2. Las cuentas confirmadas que siguen sin cliente.
INSERT INTO clients (name, user_id, email, phone, notes, status, created_at, updated_at)
SELECT
  LEFT(COALESCE(NULLIF(TRIM(u.name), ''), u.email), 190),
  u.id,
  LEFT(LOWER(u.email), 190),
  LEFT(NULLIF(TRIM(u.phone), ''), 40),
  'Se registró en el sitio.',
  1,
  COALESCE(u.created_at, CURRENT_TIMESTAMP(6)),
  CURRENT_TIMESTAMP(6)
FROM users u
WHERE u.email_verified_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.user_id = u.id);
