-- ============================================================================
-- RESEÑAS DE SERVICIO (2026-10-12)
-- ----------------------------------------------------------------------------
-- Las reseñas que había estaban ligadas a una COMPRA del carrito, y el carrito
-- se retiró: nadie podía dejar una. Ahora, al cerrar un servicio, el correo de
-- cierre trae "Calificar el servicio" con un enlace firmado (sin iniciar
-- sesión). Una reseña por servicio; se publica cuando alguien la aprueba en
-- Sitio web › Reseñas.
--
-- Sin esta tabla el resto del sistema sigue funcionando, pero el enlace de
-- calificar dirá que no se pudo guardar. Idempotente. Pegar en phpMyAdmin con
-- la base seleccionada.
-- ============================================================================

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
