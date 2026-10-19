-- SEIS CATEGORÍAS · UNA SOLA MARCA (2026-10-19) · datos para local y producción.
--
-- Lo que pidió el cliente: la banda de categorías del inicio pasa a seis, en
-- este orden y con estos nombres:
--
--   1. Renta de maquinaria             (slug maquinaria-pesada)
--   2. Suministro de triturados        (slug triturados)
--   3. Materiales para construcción    (slug materiales-para-construccion)
--   4. Transporte y servicios de obra  (slug transporte-y-servicios-de-obra)
--   5. Carpeta asfáltica               (slug soluciones-asfalticas)
--   6. Venta de maquinaria             (slug venta-de-maquinaria, NUEVA)
--
-- Por qué salían en otro orden: las líneas recreadas desde el panel después del
-- 2026-10-08 quedaron con sort_order 0 y la consulta las ponía antes de Renta
-- (que tenía 1), por nombre. Aquí se numeran las seis; desde el panel ya se
-- reordenan con las flechas de Catálogo → Categorías.
--
-- Solo cambia el NOMBRE: los slugs son los de siempre (cruzan aliados,
-- solicitudes y enlaces). La descripción que ya tenga cada una se respeta.
-- Venta de maquinaria lleva a /venta-de-maquinaria-pesada (lib/category-link.ts);
-- no es línea de servicio, así que no entra al cotizador ni a /servicios.
-- Su foto se sube desde el panel (Catálogo → Categorías → Editar).
--
-- Idempotente: correrlo dos veces deja lo mismo.
--
-- En phpMyAdmin: base seleccionada → pestaña SQL → pegar → Continuar.
-- Antes, respaldo: mysqldump <base> categories themes why_choose_us > respaldo-seis-categorias.sql

SET NAMES utf8mb4;

-- Por si la base no corrió categorias-maqser24-v2.sql (ALTER cierra la
-- transacción por su cuenta: va antes de abrirla).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

START TRANSACTION;

-- 1. Las que falten, se crean (con la línea que usa el sitio para cada una).
INSERT INTO categories (cat_name, cat_slug, status, description)
SELECT 'Renta de maquinaria', 'maquinaria-pesada', 1, 'Excavadoras, retroexcavadoras, motoconformadoras y vibrocompactadores'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'maquinaria-pesada');
INSERT INTO categories (cat_name, cat_slug, status, description)
SELECT 'Suministro de triturados', 'triturados', 1, 'Arena 4 y 5, grava 1 y 2, base hidráulica y CNC'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'triturados');
INSERT INTO categories (cat_name, cat_slug, status, description)
SELECT 'Materiales para construcción', 'materiales-para-construccion', 1, 'Block de concreto de 6"'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'materiales-para-construccion');
INSERT INTO categories (cat_name, cat_slug, status, description)
SELECT 'Transporte y servicios de obra', 'transporte-y-servicios-de-obra', 1, 'Agua en pipas de 10 y 20 m³, material de banco y retiros de material en 14 y 28 m³'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'transporte-y-servicios-de-obra');
INSERT INTO categories (cat_name, cat_slug, status, description)
SELECT 'Carpeta asfáltica', 'soluciones-asfalticas', 1, 'Riego de impregnación y carpeta asfáltica'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'soluciones-asfalticas');
INSERT INTO categories (cat_name, cat_slug, status, description)
SELECT 'Venta de maquinaria', 'venta-de-maquinaria', 1, 'Maquinaria, camiones de volteo y pipas con proveedores de la red'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'venta-de-maquinaria');

-- 2. Nombre del cliente, activas y en su orden.
UPDATE categories SET cat_name = 'Renta de maquinaria',            status = 1, sort_order = 1 WHERE cat_slug = 'maquinaria-pesada';
UPDATE categories SET cat_name = 'Suministro de triturados',       status = 1, sort_order = 2 WHERE cat_slug = 'triturados';
UPDATE categories SET cat_name = 'Materiales para construcción',   status = 1, sort_order = 3 WHERE cat_slug = 'materiales-para-construccion';
UPDATE categories SET cat_name = 'Transporte y servicios de obra', status = 1, sort_order = 4 WHERE cat_slug = 'transporte-y-servicios-de-obra';
UPDATE categories SET cat_name = 'Carpeta asfáltica',              status = 1, sort_order = 5 WHERE cat_slug = 'soluciones-asfalticas';
UPDATE categories SET cat_name = 'Venta de maquinaria',            status = 1, sort_order = 6 WHERE cat_slug = 'venta-de-maquinaria';

-- Cualquier otra categoría (activa o no) va detrás de las seis, en el orden que ya tenía.
UPDATE categories SET sort_order = sort_order + 100
 WHERE cat_slug NOT IN ('maquinaria-pesada', 'triturados', 'materiales-para-construccion',
                        'transporte-y-servicios-de-obra', 'soluciones-asfalticas', 'venta-de-maquinaria')
   AND sort_order < 100;

-- 3. Tema activo: título de la banda, hero de /categorias, SEO y cifra del hero.
UPDATE themes
   SET copys = JSON_SET(copys,
         '$.es."home.categories.title"', 'Seis categorías. Una sola marca.',
         '$.es."seo.categories.description"', 'Seis categorías para tu obra: renta de maquinaria, suministro de triturados, materiales para construcción, transporte y servicios de obra, carpeta asfáltica y venta de maquinaria.',
         '$.es."nav.solutions.all.hint"', 'Las seis categorías en una sola página'),
       tokens = JSON_SET(tokens,
         '$.categoriesView.hero.title', 'Seis categorías. Una sola marca.',
         '$.categoriesView.hero.subtitle', 'Renta de maquinaria, suministro de triturados, materiales para construcción, transporte y servicios de obra, carpeta asfáltica y venta de maquinaria. Una misma solicitud, una misma cotización.'),
       publishedAt = NOW(3)
 WHERE active = 1;

-- La cifra flotante del hero ("5 categorías de servicio"), solo si sigue en 5.
UPDATE themes
   SET copys = JSON_SET(copys, '$.es."home.hero.stat1.num"', '6')
 WHERE active = 1
   AND JSON_UNQUOTE(JSON_EXTRACT(copys, '$.es."home.hero.stat1.num"')) = '5';

-- 4. "¿Por qué elegirnos?" decía "las cinco categorías".
UPDATE why_choose_us
   SET description = REPLACE(REPLACE(description, 'las cinco categorías de servicio', 'las seis categorías'), 'las cinco categorías', 'las seis categorías')
 WHERE description LIKE '%las cinco categorías%';

COMMIT;

-- Comprobación (deben salir las seis, 1..6, activas):
-- SELECT sort_order, cat_name, cat_slug, status FROM categories ORDER BY sort_order;
