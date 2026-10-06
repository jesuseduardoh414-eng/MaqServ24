-- ============================================================================
-- CRM DE PROVEEDORES (2026-10-06) — máquinas de cada proveedor.
--
-- Pedido del cliente: un CRM dentro del panel (sin terceros) con, por
-- proveedor, su maquinaria: tipo, marca, modelo, características y lo que
-- cobra por hora en tres modalidades. Los costos son SOLO un dato de
-- referencia: no los usa el cotizador ni ningún precio del sitio.
--
-- Nombre, correo, WhatsApp/celular y ubicación del taller ya viven en
-- `providers` (phone, email, address). Esto agrega solo la tabla de máquinas.
--
-- Idempotente. Pegar en phpMyAdmin con la base de producción seleccionada.
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `provider_machines` (
  `id`                INT           NOT NULL AUTO_INCREMENT,
  `provider_id`       INT           NOT NULL,
  `tipo`              VARCHAR(120)  NOT NULL,
  `marca`             VARCHAR(120)  NULL,
  `modelo`            VARCHAR(120)  NULL,
  `caracteristicas`   TEXT          NULL,
  -- Por hora: sin operador y sin diésel / con operador sin diésel / con operador y diésel.
  `costo_hora_sin_op` DECIMAL(10,2) NULL,
  `costo_hora_con_op` DECIMAL(10,2) NULL,
  `costo_hora_todo`   DECIMAL(10,2) NULL,
  `notas`             TEXT          NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `provider_machines_provider_idx` (`provider_id`),
  CONSTRAINT `provider_machines_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comprobación: debe salir la tabla vacía (o con lo que ya se haya capturado).
SELECT COUNT(*) AS maquinas FROM provider_machines;
