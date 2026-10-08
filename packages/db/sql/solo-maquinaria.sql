-- ============================================================================
-- SOLO RENTA DE MAQUINARIA · empezar el catálogo de cero (2026-10-08)
-- ----------------------------------------------------------------------------
-- Decisión del cliente: el catálogo se arma por partes, empezando por Renta de
-- maquinaria pesada (excavadoras, retroexcavadoras, motoconformadora y
-- vibrocompactador). Las otras cuatro líneas (Transporte y servicios de obra,
-- Triturados, Materiales para construcción, Soluciones asfálticas) se eliminan
-- POR COMPLETO y se crearán de cero cuando toque cada una.
--
-- Qué hace:
--   1. Borra TODAS las fichas (products) y lo que cuelga de ellas: fotos,
--      favoritos, clics, bloqueos de disponibilidad, opiniones, preguntas,
--      reseñas y periodos de renta. El inventario se arma después con las
--      máquinas reales de cada aliado.
--   2. Borra todas las categorías menos `maquinaria-pesada`, con sus
--      subcategorías (las 14 del sistema viejo y la de prueba incluidas).
--   3. Tabulador de maquinaria: quita las pipas y el retiro de material (eran
--      de Transporte) y sus condiciones. Los 6 equipos de renta se quedan.
--   (El tabulador de triturados ya NO se toca: esa línea regresó el mismo día
--   con scripts/sembrar-triturados.mjs, que solo cambia su lista de materiales y
--   respeta las zonas y fletes que ya tenga la base.)
--
-- Qué NO toca: solicitudes y cotizaciones ya emitidas (son historia), aliados,
-- clientes, administradores, diseño del sitio.
--
-- CÓMO CORRERLO
--   1. Exporta un respaldo completo primero (phpMyAdmin → Exportar).
--   2. Pégalo completo en phpMyAdmin → SQL, con la base seleccionada, y ejecuta.
--   3. Va en transacción: si una línea falla, nada se aplica.
--   4. La API guarda el tabulador en caché 1 minuto: espera ese minuto antes de
--      revisar el cotizador.
--
-- Idempotente: correrlo dos veces deja el mismo resultado.
-- ============================================================================

START TRANSACTION;

-- ── 1. Fichas y lo que cuelga de ellas ─────────────────────────────────────
DELETE FROM galleries;
DELETE FROM wishlists;
DELETE FROM product_clicks;
DELETE FROM availability_blocks;
DELETE FROM comments;
DELETE FROM product_questions;
DELETE FROM reviews;
DELETE FROM rental_periods;
DELETE FROM products;

-- ── 2. Categorías: solo Renta de maquinaria pesada ─────────────────────────
-- Las subcategorías se van TODAS, también las de maquinaria (Grúas, Bombeo,
-- Energía…): son del sistema viejo, el panel no deja asignarlas a una ficha y
-- en el catálogo público salían como filtros que siempre daban vacío.
DELETE FROM childcategories;
DELETE FROM subcategories;
DELETE FROM categories WHERE cat_slug <> 'maquinaria-pesada';
UPDATE categories SET status = 1 WHERE cat_slug = 'maquinaria-pesada';

-- ── 3. Tabulador de maquinaria: fuera pipas y retiro de material ───────────
UPDATE quoter_catalogs
   SET data = JSON_REMOVE(
         JSON_SET(data, '$.servicios', JSON_ARRAY()),
         '$.condiciones.pipa',
         '$.condiciones.retiro'
       ),
       updated_by = 'script solo-maquinaria',
       updated_at = NOW()
 WHERE kind = 'maquinaria';

COMMIT;
