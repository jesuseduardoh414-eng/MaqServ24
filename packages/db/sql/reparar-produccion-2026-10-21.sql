-- ============================================================================
-- REPARACIÓN DE PRODUCCIÓN (2026-10-21) · UN SOLO PEGADO
-- ----------------------------------------------------------------------------
-- Síntoma: el inicio del panel dice "No se pudo cargar el resumen" y las
-- preguntas de las fichas del sitio responden error 500
-- (api.maqserv24.com/catalog/products/<id>/questions). La causa: a
-- `product_questions` le faltan las columnas de produccion-2026-10-19.sql
-- (`source`, `asker_name`, `asker_email`); ese script no se terminó de correr.
--
-- Es lo mismo que aquel, pero a prueba de tropiezos: phpMyAdmin se detiene en
-- el primer error y aquel ponía cada columna "AFTER" de otra; si esa otra no
-- existía en producción, se caía ahí y ya no corría nada de lo que seguía.
-- Aquí cada columna va sola y sin posición, y lo urgente va primero.
--
-- Solo AGREGA columnas y tablas (y crea clientes que falten): no borra nada.
-- Idempotente: correrlo dos veces no hace daño.
--
-- phpMyAdmin → base maqserv24_db → pestaña SQL → pegar todo → Continuar.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Preguntas del sitio (lo que tumba el inicio del panel y las fichas).
ALTER TABLE product_questions MODIFY product_id INT NULL;
ALTER TABLE product_questions MODIFY user_id INT NULL;
ALTER TABLE product_questions ADD COLUMN IF NOT EXISTS asker_name VARCHAR(190) NULL;
ALTER TABLE product_questions ADD COLUMN IF NOT EXISTS asker_email VARCHAR(190) NULL;
ALTER TABLE product_questions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'producto';
ALTER TABLE product_questions ADD COLUMN IF NOT EXISTS answered_at DATETIME NULL;
ALTER TABLE product_questions ADD COLUMN IF NOT EXISTS featured INT NOT NULL DEFAULT 0;
ALTER TABLE product_questions ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Una sola bandeja: lo de Contacto se contesta desde el panel.
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS answer TEXT NULL;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS answered_at DATETIME(6) NULL;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS faq_id INT NULL;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS crm_pushed TINYINT(1) NOT NULL DEFAULT 0;

-- 3. Contenido de los correos en el registro.
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS body_html MEDIUMTEXT NULL;

-- 4. Reseñas de servicio.
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

-- 5. Rastreo de la unidad en camino.
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

-- 6. Video en las tarjetas de categoría (ya estaba; se deja por si acaso).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS video TEXT NULL;

-- 7. Comprobación: TODAS deben salir con 1.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_questions' AND column_name = 'source')      AS preguntas_source,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_questions' AND column_name = 'asker_name')  AS preguntas_nombre,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_questions' AND column_name = 'asker_email') AS preguntas_correo,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contact_messages'  AND column_name = 'faq_id')      AS bandeja,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'email_log'         AND column_name = 'body_html')   AS correo,
  (SELECT COUNT(*) FROM information_schema.tables  WHERE table_schema = DATABASE() AND table_name = 'service_reviews')                                 AS resenas,
  (SELECT COUNT(*) FROM information_schema.tables  WHERE table_schema = DATABASE() AND table_name = 'service_locations')                               AS rastreo,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories'        AND column_name = 'video')       AS video;

-- 8. Cada cuenta confirmada del sitio es cliente (al final a propósito: si
--    esta parte marcara error, lo de arriba ya quedó; avisa y se revisa).
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
