-- ============================================================================
-- RASTREO DE LA UNIDAD EN CAMINO (2026-10-14)
-- ----------------------------------------------------------------------------
-- Cuando el aliado marca "Ya salió la unidad" en su portal, su teléfono manda
-- su ubicación cada pocos minutos hasta que marca "Ya llegué a la obra".
-- Operaciones la ve en Servicios en curso y el cliente ve a cuántos km va.
-- Se guardan solo los últimos puntos de cada servicio.
--
-- Sin esta tabla el resto sigue funcionando; el rastreo dice "sin ubicación".
-- Idempotente. Pegar en phpMyAdmin con la base seleccionada.
-- ============================================================================

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
