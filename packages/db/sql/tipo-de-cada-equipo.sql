-- ============================================================================
-- DE QUÉ TIPO ES CADA EQUIPO (2026-10-22) · Fase 2 de "catálogo y cotizador"
-- ----------------------------------------------------------------------------
-- Cada máquina de un aliado apunta a la FICHA DEL TIPO que lleva el precio
-- (un producto sin aliado, por ejemplo "Retroexcavadora 4x4"). Con eso:
--   · el aliado elige el tipo de una lista al ofrecer su equipo,
--   · las ofertas van a quien tiene ese tipo (Fase 3),
--   · al aceptar, se aparta SU máquina de ese tipo.
--
-- Solo AGREGA una columna (vacía) y su índice: no borra ni cambia nada.
-- Idempotente: correrlo dos veces no hace daño.
--
-- CORRERLO ANTES DE SUBIR EL CÓDIGO que lo usa: sin la columna, todo lo que
-- lee `products` (catálogo, cotizador, panel) responde error.
--
-- phpMyAdmin → base maqserv24_db → pestaña SQL → pegar todo → Continuar.
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_id INT NULL;
CREATE INDEX IF NOT EXISTS products_tipo_id_index ON products (tipo_id);

-- Comprobación: debe decir 1.
SELECT COUNT(*) AS columna_tipo_id
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'tipo_id';
