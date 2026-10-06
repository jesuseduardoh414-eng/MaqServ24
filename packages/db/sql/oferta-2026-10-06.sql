-- ============================================================================
-- OFERTA VIGENTE (2026-10-06) — textos que viven en la base de datos.
--
-- Lista del cliente ("por lo pronto vamos a ofrecer"): renta de excavadoras,
-- retroexcavadoras, motoconformadoras y vibrocompactadores; triturados arena 4,
-- arena 5, grava 1, grava 2, base hidráulica y CNC; block de 6"; agua en pipa
-- de 10 y 20 m³, material de banco y retiros en 14 y 28 m³; riego de
-- impregnación y carpeta asfáltica normal; venta de maquinaria.
--
-- Lo que cambia aquí (el resto va en el código):
--   1. La línea bajo el nombre de cada categoría (inicio y /categorias).
--   2. El texto del hero del inicio (hero_sections y el copy del tema).
--
-- Idempotente: se puede correr más de una vez. Pegar en phpMyAdmin con la base
-- de producción seleccionada. NO toca el tabulador de los cotizadores.
-- ============================================================================

SET NAMES utf8mb4;

START TRANSACTION;

UPDATE categories SET description = 'Excavadoras, retroexcavadoras, motoconformadoras y vibrocompactadores'
 WHERE cat_slug = 'maquinaria-pesada';
UPDATE categories SET description = 'Agua en pipas de 10 y 20 m³, material de banco y retiros de material en 14 y 28 m³'
 WHERE cat_slug = 'transporte-y-servicios-de-obra';
UPDATE categories SET description = 'Arena 4 y 5, grava 1 y 2, base hidráulica y CNC'
 WHERE cat_slug = 'triturados';
UPDATE categories SET description = 'Block de concreto de 6"'
 WHERE cat_slug = 'materiales-para-construccion';
UPDATE categories SET description = 'Riego de impregnación y carpeta asfáltica'
 WHERE cat_slug = 'soluciones-asfalticas';

SET @hero := CONCAT(
  'En MAQSER24 conectamos tu obra con renta de maquinaria pesada, entrega de agua en pipas, entregas de material de banco y retiros de material en camiones de volteo, y suministro de triturados como arena, grava, base hidráulica y CNC. También ofrecemos venta de maquinaria, block de 6", riego de impregnación y carpeta asfáltica.',
  '\n\n',
  'Dinos qué necesitas, cuánto requieres, dónde se ubica tu obra y para cuándo lo necesitas. Te presentaremos opciones con disponibilidad, condiciones de servicio y costos de entrega o traslado.'
);

-- El hero pinta el subtítulo con white-space: pre-line (los dos párrafos van
-- separados por una línea en blanco).
UPDATE hero_sections SET subtitle = @hero, updated_at = NOW()
 WHERE id = (SELECT id FROM (SELECT MAX(id) AS id FROM hero_sections) AS ultimo);

UPDATE themes SET copys = JSON_SET(copys, '$.es."home.hero.subtitle"', @hero)
 WHERE JSON_CONTAINS_PATH(copys, 'one', '$.es."home.hero.subtitle"');

COMMIT;

-- Comprobación: deben salir las cinco descripciones nuevas y el hero nuevo.
SELECT cat_slug, description FROM categories
 WHERE cat_slug IN ('maquinaria-pesada','transporte-y-servicios-de-obra','triturados','materiales-para-construccion','soluciones-asfalticas');
SELECT LEFT(subtitle, 120) AS hero FROM hero_sections ORDER BY id DESC LIMIT 1;
