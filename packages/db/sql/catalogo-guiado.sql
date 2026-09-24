-- Cotizador guiado por máquina (2026-09-25).
--
-- Cada máquina del catálogo trae su precio, el costo del aliado, su mínimo y
-- el horario en que atiende. Con eso el cotizador recomienda máquinas reales
-- (cerca, libres y en horario) y la solicitud le llega al dueño de la elegida.
--
-- Correr UNA vez en phpMyAdmin (base de producción). En local ya está aplicado.
-- Si una columna ya existe, MySQL avisa "Duplicate column" y se puede ignorar
-- esa línea.

ALTER TABLE `products`
  ADD COLUMN `tarifas`      JSON NULL COMMENT 'Precio al publico por unidad: {"dia":6500,"semana":36000}',
  ADD COLUMN `costo_aliado` JSON NULL COMMENT 'Lo que cobra el aliado por unidad (nunca se muestra al cliente)',
  ADD COLUMN `minimo`       INT  NULL COMMENT 'Minimo de unidades (en price_unit): 1 dia, 1 viaje...',
  ADD COLUMN `horario`      JSON NULL COMMENT 'Cuando atiende: {"dias":[1,2,3,4,5,6],"desde":"08:00","hasta":"18:00"}';

-- Ajustes de plataforma que no son diseño ni secretos: el margen de MAQSER24
-- sobre el costo del aliado, y más adelante interruptores de operación.
CREATE TABLE IF NOT EXISTS `platform_settings` (
  `key`        VARCHAR(80)  NOT NULL,
  `value`      JSON         NOT NULL,
  `updated_by` VARCHAR(190) NULL,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `platform_settings` (`key`, `value`) VALUES ('margen_aliado_pct', '20');
