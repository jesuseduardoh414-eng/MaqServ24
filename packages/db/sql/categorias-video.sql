-- VIDEO EN LAS TARJETAS DE CATEGORÍA (2026-10-19) · local y producción.
--
-- Pedido del cliente: que las seis tarjetas de categoría puedan llevar video en
-- lugar de imagen. El video se sube desde el panel (Catálogo → Categorías →
-- Editar → Video); si una categoría no tiene, sigue saliendo su foto.
--
-- CORRERLO ANTES de arrancar la API nueva: la API ya pide esta columna y, sin
-- ella, la lista de categorías falla y la banda del inicio desaparece.
--
-- Idempotente. En phpMyAdmin: base seleccionada → pestaña SQL → pegar → Continuar.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS video TEXT NULL;
