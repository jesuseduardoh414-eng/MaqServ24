-- Tablas del cotizador (maquinaria y triturados). Equivalen a los modelos
-- `quoter_catalogs` y `quoter_quotes` de schema.prisma.
--
-- En local las creó `prisma db push`; en producción hay que correr esto en
-- phpMyAdmin (base maqserv24_db). Sin ellas, /quoter/catalog/* responde 500 y
-- el sitio muestra "Este cotizador no está disponible". Los tabuladores se
-- siembran solos la primera vez que alguien abre cada cotizador.
--
-- `id` va INT con signo, como dice el esquema. (El local quedó UNSIGNED por
-- una migración vieja y por eso `db push` pide --accept-data-loss ahí.)

CREATE TABLE IF NOT EXISTS `quoter_catalogs` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `kind`       VARCHAR(20)  NOT NULL,
  `version`    VARCHAR(40)  NOT NULL,
  `data`       JSON         NOT NULL,
  `updated_by` VARCHAR(190) NULL,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quoter_catalogs_kind_unique` (`kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quoter_quotes` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `kind`         VARCHAR(20)   NOT NULL,
  `folio`        VARCHAR(40)   NOT NULL,
  `origin`       VARCHAR(10)   NOT NULL DEFAULT 'panel',
  `state`        VARCHAR(20)   NOT NULL DEFAULT 'borrador',
  `client_name`  VARCHAR(190)  NOT NULL,
  `work`         VARCHAR(190)  NULL,
  `attention`    VARCHAR(190)  NULL,
  `municipality` VARCHAR(90)   NULL,
  `email`        VARCHAR(190)  NULL,
  `phone`        VARCHAR(40)   NULL,
  `notes`        TEXT          NULL,
  `options`      JSON          NOT NULL,
  `items`        JSON          NOT NULL,
  `snapshot`     JSON          NOT NULL,
  `subtotal`     DECIMAL(12,2) NOT NULL,
  `tax`          DECIMAL(12,2) NOT NULL,
  `total`        DECIMAL(12,2) NOT NULL,
  `admin_id`     INT           NULL,
  `admin_name`   VARCHAR(190)  NULL,
  `user_id`      INT           NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quoter_quotes_folio_unique` (`folio`),
  KEY `quoter_quotes_kind_idx`   (`kind`,   `created_at`),
  KEY `quoter_quotes_state_idx`  (`state`,  `created_at`),
  KEY `quoter_quotes_origin_idx` (`origin`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
