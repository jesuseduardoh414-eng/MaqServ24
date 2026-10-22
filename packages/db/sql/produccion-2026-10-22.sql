-- ============================================================================
-- PRODUCCIÓN 2026-10-22 · UN SOLO PEGADO antes de subir las Fases 2–4, A, B y C
-- ----------------------------------------------------------------------------
-- Junta, en este orden:
--   1. tipo-de-cada-equipo.sql  → columna products.tipo_id (de qué tipo es cada
--      máquina de aliado).
--   2. cobros-y-pagos.sql       → tablas service_money y money_moves, y la
--      columna clients.credito_dias (Cobranza, Pagos a aliados y Margen).
--
-- Solo AGREGA: no borra ni cambia ningún dato. Idempotente: correrlo dos veces
-- no hace daño.
--
-- CORRERLO ANTES DE SUBIR EL CÓDIGO: sin estas columnas, el catálogo, el
-- cotizador y el panel responden error.
--
-- phpMyAdmin → base maqserv24_db → pestaña SQL → pegar todo → Continuar.
-- Al final debe salir una sola fila: listo = 4.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. De qué tipo es cada equipo -----------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_id INT NULL;
CREATE INDEX IF NOT EXISTS products_tipo_id_index ON products (tipo_id);

-- 2. Cobros y pagos ------------------------------------------------------------

-- 2a. La cuenta de cada servicio cerrado (una por servicio).
CREATE TABLE IF NOT EXISTS service_money (
  quote_id          BIGINT        NOT NULL,
  client_id         INT           NULL,
  provider_id       INT           NULL,
  -- Lo cotizado sin IVA (incluye fletes), el IVA y el total que paga el cliente.
  subtotal          DECIMAL(12,2) NOT NULL,
  iva               DECIMAL(12,2) NOT NULL,
  total             DECIMAL(12,2) NOT NULL,
  -- La comisión de MAQSER24 y lo que le toca al aliado (sin IVA).
  comision_pct      DECIMAL(5,2)  NOT NULL,
  pago_aliado       DECIMAL(12,2) NOT NULL,
  -- Cobro al cliente.
  vence             DATE          NOT NULL,
  factura_cliente   VARCHAR(60)   NULL,
  cobrado           DECIMAL(12,2) NOT NULL DEFAULT 0,
  cobrado_at        DATETIME      NULL,
  -- Pago al aliado: su factura (PDF/XML que sube en su portal) y el pago.
  factura_aliado    VARCHAR(255)  NULL,
  factura_aliado_xml VARCHAR(255) NULL,
  factura_aliado_at DATETIME      NULL,
  pagar_el          DATE          NULL,
  pagado_at         DATETIME      NULL,
  pago_ref          VARCHAR(120)  NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quote_id),
  KEY service_money_cobro_idx (cobrado_at, vence),
  KEY service_money_pago_idx (pagado_at, provider_id),
  KEY service_money_client_idx (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2b. Cada dinero que entra (cobro) o sale (pago), con su fecha y referencia.
CREATE TABLE IF NOT EXISTS money_moves (
  id          INT           NOT NULL AUTO_INCREMENT,
  quote_id    BIGINT        NOT NULL,
  tipo        VARCHAR(10)   NOT NULL,
  monto       DECIMAL(12,2) NOT NULL,
  forma       VARCHAR(40)   NULL,
  referencia  VARCHAR(120)  NULL,
  fecha       DATE          NOT NULL,
  admin_id    INT           NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY money_moves_quote_idx (quote_id),
  KEY money_moves_fecha_idx (tipo, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2c. Días de crédito de cada cliente. Vacío = paga al cerrar el servicio.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credito_dias INT NULL;

-- Comprobación: debe decir 4.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'tipo_id')
+ (SELECT COUNT(*) FROM information_schema.TABLES  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_money')
+ (SELECT COUNT(*) FROM information_schema.TABLES  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'money_moves')
+ (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'credito_dias') AS listo;
