-- ============================================================================
-- TODO LO PENDIENTE DE BASE PARA PRODUCCIÓN (2026-10-19) · UN SOLO PEGADO
-- ----------------------------------------------------------------------------
-- Junta, en orden, los scripts que pide el código que se sube ese día:
--
--   1. correo-contenido.sql        email_log.body_html
--   2. resenas-servicio.sql        tabla service_reviews
--   3. preguntas-sitio.sql         product_questions + contact_messages
--   4. rastreo.sql                 tabla service_locations
--   5. clientes-desde-cuentas.sql  cada cuenta confirmada pasa a Clientes
--   6. categorias-video.sql        categories.video
--
-- (seis-categorias.sql ya se corrió en producción el 2026-10-19.)
--
-- Solo AGREGA columnas y tablas, y crea clientes que falten: no borra nada y
-- la versión que hoy está en línea sigue funcionando con estos cambios, así
-- que se corre ANTES de subir el código nuevo. Idempotente: correrlo dos veces
-- no hace daño.
--
-- phpMyAdmin → base maqserv24_db → pestaña SQL → pegar todo → Continuar.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Contenido de los correos en el registro.
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS body_html MEDIUMTEXT NULL AFTER detail;

-- 2. Reseñas de servicio.
CREATE TABLE IF NOT EXISTS service_reviews (
  id          INT NOT NULL AUTO_INCREMENT,
  quote_id    BIGINT NOT NULL,
  provider_id INT NULL,
  rating      TINYINT NOT NULL,
  comment     TEXT NULL,
  author      VARCHAR(190) NOT NULL,
  status      TINYINT NOT NULL DEFAULT 0,
  created_at  DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY service_reviews_quote_key (quote_id),
  KEY service_reviews_status_idx (status, id),
  KEY service_reviews_provider_idx (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Preguntas del sitio y una sola bandeja de mensajes.
ALTER TABLE product_questions
  MODIFY product_id INT NULL,
  MODIFY user_id INT NULL,
  ADD COLUMN IF NOT EXISTS asker_name VARCHAR(190) NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS asker_email VARCHAR(190) NULL AFTER asker_name,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'producto' AFTER asker_email;

ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS answer TEXT NULL AFTER handled_at,
  ADD COLUMN IF NOT EXISTS answered_at DATETIME(6) NULL AFTER answer,
  ADD COLUMN IF NOT EXISTS faq_id INT NULL AFTER answered_at;

-- 4. Rastreo de la unidad en camino.
CREATE TABLE IF NOT EXISTS service_locations (
  id          INT NOT NULL AUTO_INCREMENT,
  quote_id    BIGINT NOT NULL,
  provider_id INT NOT NULL,
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL,
  accuracy_m  INT NULL,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY service_locations_quote_idx (quote_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Cada cuenta confirmada del sitio es cliente.
UPDATE clients c
JOIN users u ON LOWER(u.email) = LOWER(c.email)
SET c.user_id = u.id, c.updated_at = CURRENT_TIMESTAMP(6)
WHERE c.user_id IS NULL
  AND u.email_verified_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT user_id FROM clients WHERE user_id IS NOT NULL) ya
    WHERE ya.user_id = u.id
  );

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

-- 6. Video en las tarjetas de categoría.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS video TEXT NULL;

-- Comprobación: las seis deben salir con 1.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'email_log'         AND column_name = 'body_html') AS correo,
  (SELECT COUNT(*) FROM information_schema.tables  WHERE table_schema = DATABASE() AND table_name = 'service_reviews')                               AS resenas,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_questions' AND column_name = 'source')    AS preguntas,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contact_messages'  AND column_name = 'faq_id')    AS bandeja,
  (SELECT COUNT(*) FROM information_schema.tables  WHERE table_schema = DATABASE() AND table_name = 'service_locations')                             AS rastreo,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories'        AND column_name = 'video')     AS video;
