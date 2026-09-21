-- Permisos por rol editables desde el panel (Administradores → Permisos).
--
-- Se crea con SQL y no con `prisma db push` a propósito: hoy el push arrastra
-- una diferencia vieja y ajena (`quoter_catalogs.id` es UNSIGNED en la BD e INT
-- en el esquema) y pide `--accept-data-loss`, que tocaría la llave primaria de
-- esa tabla. Esto crea SOLO lo nuevo. El modelo equivalente queda escrito en
-- schema.prisma para que un `db pull` no lo pierda.
--
-- Aplicar en cada entorno (local y producción):
--   cd packages/db && npx prisma db execute --file sql/admin_role_modules.sql --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS `admin_role_modules` (
  `rol`        VARCHAR(32)  NOT NULL,
  `modulos`    JSON         NOT NULL,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` INT          NULL,
  PRIMARY KEY (`rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
