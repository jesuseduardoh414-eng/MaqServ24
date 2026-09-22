-- CINCO CATEGORÍAS DE SERVICIO (2026-09-21) · datos para local y producción.
--
-- Lo que pidió el cliente: el ecosistema pasa de seis líneas a cinco, con texto
-- nuevo en el hero y el botón principal "SOLICITAR COTIZACIÓN".
--
--   1. Renta de maquinaria pesada    (era "Maquinaria pesada"; absorbe equipo
--                                     menor y plataformas como subcategorías)
--   2. Transporte y servicios de obra (une "Agua en pipas" + "Volteos")
--   3. Triturados                     (igual, con descripción)
--   4. Materiales para construcción   (nueva)
--   5. Soluciones asfálticas          (nueva)
--
-- Cómo se hace sin romper nada:
--   - Las categorías que siguen (maquinaria-pesada, triturados) CONSERVAN su
--     slug: es lo que cruza `providers.categories` con `quotes.service_category`
--     y lo que llevan los enlaces /productos?categoria=. Solo cambia el nombre.
--   - Las que se retiran NO se borran: quedan en status 0 (igual que hizo
--     `categorias-maqser24.ts` con las nueve familias de equipo).
--   - Los productos y subcategorías de equipo menor y plataformas pasan a
--     maquinaria pesada; el camión de volteo pasa a transporte.
--   - Aliados y solicitudes con slugs retirados se remapean al slug nuevo, para
--     que el emparejamiento (`matching.service`) los siga encontrando.
--   - Columna nueva `categories.description`: la línea bajo el nombre en las
--     tarjetas del sitio. Editable desde Catálogo → Categorías.
--   - Columna nueva `categories.sort_order`: el orden 1..5 en que el cliente
--     numeró las líneas; el sitio y el panel ordenan por ella.
--
-- Es idempotente: correrlo dos veces no duplica ni deshace nada.
--
-- En phpMyAdmin: base `maqserv24_db` → pestaña SQL → pegar → Continuar.
-- Por SSH: mysql --default-character-set=utf8mb4 <base> < categorias-maqser24-v2.sql
--
-- Antes de correrlo en producción, respaldo:
--   mysqldump <base> categories subcategories products providers quotes hero_sections why_choose_us themes > respaldo-categorias-v2.sql

SET NAMES utf8mb4;
START TRANSACTION;

-- 1. Columnas nuevas (MariaDB acepta IF NOT EXISTS en ADD COLUMN).
--    description: la línea bajo el nombre. sort_order: el orden en que el
--    cliente presenta las líneas (1 = primera; 0 = al final, por nombre).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 2. Las dos que siguen: nombre nuevo + descripción.
UPDATE categories
   SET cat_name = 'Renta de maquinaria pesada',
       description = 'Excavadoras, retroexcavadoras, motoconformadoras, compactadores, bulldozers y demás maquinaria disponible',
       status = 1
 WHERE cat_slug = 'maquinaria-pesada';

UPDATE categories
   SET cat_name = 'Triturados',
       description = 'Arena, grava, base hidráulica y CNC',
       status = 1
 WHERE cat_slug = 'triturados';

-- 3. Las tres nuevas. Transporte hereda la foto real del camión de volteo; las
--    otras dos llevan placa de marca (scripts/build-categoria-tiles.cjs), que
--    debe existir en media/uploads/.
SET @foto_volteos := (SELECT photo FROM categories WHERE cat_slug = 'volteos' LIMIT 1);

INSERT INTO categories (cat_name, cat_slug, status, photo, description)
SELECT 'Transporte y servicios de obra', 'transporte-y-servicios-de-obra', 1, @foto_volteos,
       'Entrega de agua en pipas y acarreos en camiones de volteo'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'transporte-y-servicios-de-obra');

INSERT INTO categories (cat_name, cat_slug, status, photo, description)
SELECT 'Materiales para construcción', 'materiales-para-construccion', 1, 'uploads/cat-materiales-para-construccion.png',
       'Concreto premezclado, acero de refuerzo, block y cemento'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'materiales-para-construccion');

INSERT INTO categories (cat_name, cat_slug, status, photo, description)
SELECT 'Soluciones asfálticas', 'soluciones-asfalticas', 1, 'uploads/cat-soluciones-asfalticas.png',
       'Suministro y aplicación de carpeta asfáltica'
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE cat_slug = 'soluciones-asfalticas');

-- Si ya existían (segunda corrida), que queden con el texto y activas.
UPDATE categories SET cat_name = 'Transporte y servicios de obra', description = 'Entrega de agua en pipas y acarreos en camiones de volteo', status = 1 WHERE cat_slug = 'transporte-y-servicios-de-obra';
UPDATE categories SET cat_name = 'Materiales para construcción', description = 'Concreto premezclado, acero de refuerzo, block y cemento', status = 1 WHERE cat_slug = 'materiales-para-construccion';
UPDATE categories SET cat_name = 'Soluciones asfálticas', description = 'Suministro y aplicación de carpeta asfáltica', status = 1 WHERE cat_slug = 'soluciones-asfalticas';

-- 3b. Orden de presentación, tal como lo numeró el cliente.
UPDATE categories SET sort_order = 1 WHERE cat_slug = 'maquinaria-pesada';
UPDATE categories SET sort_order = 2 WHERE cat_slug = 'transporte-y-servicios-de-obra';
UPDATE categories SET sort_order = 3 WHERE cat_slug = 'triturados';
UPDATE categories SET sort_order = 4 WHERE cat_slug = 'materiales-para-construccion';
UPDATE categories SET sort_order = 5 WHERE cat_slug = 'soluciones-asfalticas';

-- 4. Ids con los que se mueve todo lo demás.
SET @maq := (SELECT id FROM categories WHERE cat_slug = 'maquinaria-pesada');
SET @tra := (SELECT id FROM categories WHERE cat_slug = 'transporte-y-servicios-de-obra');
SET @eqm := (SELECT id FROM categories WHERE cat_slug = 'equipo-menor');
SET @pla := (SELECT id FROM categories WHERE cat_slug = 'plataformas-de-elevacion');
SET @pip := (SELECT id FROM categories WHERE cat_slug = 'agua-en-pipas');
SET @vol := (SELECT id FROM categories WHERE cat_slug = 'volteos');

-- 5. Equipo menor y plataformas bajan a subcategorías de maquinaria pesada.
--    Sus subcategorías ya existen (Bombeo de agua, Energía e iluminación,
--    Plataformas y elevación): solo cambian de padre, y los productos
--    conservan su subcategory_id.
UPDATE subcategories SET category_id = @maq WHERE @maq IS NOT NULL AND category_id IN (@eqm, @pla);
UPDATE products      SET category_id = @maq WHERE @maq IS NOT NULL AND category_id IN (@eqm, @pla);

-- 6. Pipas y volteos → transporte y servicios de obra.
UPDATE subcategories SET category_id = @tra WHERE @tra IS NOT NULL AND category_id IN (@pip, @vol);
UPDATE products      SET category_id = @tra WHERE @tra IS NOT NULL AND category_id IN (@pip, @vol);

-- 7. Las cuatro retiradas salen del sitio, sin borrarse.
UPDATE categories SET status = 0
 WHERE cat_slug IN ('equipo-menor', 'plataformas-de-elevacion', 'agua-en-pipas', 'volteos');

-- 8. Aliados: qué servicios atienden (JSON de slugs). Se remapea el slug viejo
--    al nuevo y se quitan los duplicados que deja la unión (con y sin espacio
--    tras la coma, que es como lo imprime cada motor).
UPDATE providers
   SET categories = REPLACE(REPLACE(REPLACE(REPLACE(CAST(categories AS CHAR CHARACTER SET utf8mb4),
                    '"equipo-menor"', '"maquinaria-pesada"'),
                    '"plataformas-de-elevacion"', '"maquinaria-pesada"'),
                    '"agua-en-pipas"', '"transporte-y-servicios-de-obra"'),
                    '"volteos"', '"transporte-y-servicios-de-obra"')
 WHERE CAST(categories AS CHAR CHARACTER SET utf8mb4) REGEXP '"(equipo-menor|plataformas-de-elevacion|agua-en-pipas|volteos)"';

UPDATE providers
   SET categories = REPLACE(REPLACE(REPLACE(REPLACE(CAST(categories AS CHAR CHARACTER SET utf8mb4),
                    '"maquinaria-pesada","maquinaria-pesada"', '"maquinaria-pesada"'),
                    '"maquinaria-pesada", "maquinaria-pesada"', '"maquinaria-pesada"'),
                    '"transporte-y-servicios-de-obra","transporte-y-servicios-de-obra"', '"transporte-y-servicios-de-obra"'),
                    '"transporte-y-servicios-de-obra", "transporte-y-servicios-de-obra"', '"transporte-y-servicios-de-obra"')
 WHERE CAST(categories AS CHAR CHARACTER SET utf8mb4) REGEXP '"(maquinaria-pesada|transporte-y-servicios-de-obra)",? ?"(maquinaria-pesada|transporte-y-servicios-de-obra)"';

-- 9. Solicitudes abiertas o históricas con slug retirado: al slug nuevo, para
--    que el emparejamiento y la unidad de cierre sigan funcionando.
UPDATE quotes SET service_category = 'maquinaria-pesada'
 WHERE service_category IN ('equipo-menor', 'plataformas-de-elevacion');
UPDATE quotes SET service_category = 'transporte-y-servicios-de-obra'
 WHERE service_category IN ('agua-en-pipas', 'volteos');

-- 10. Hero del home (tabla hero_sections manda sobre el copy del tema). Dos
--     párrafos separados por línea en blanco: el sitio los pinta con
--     white-space: pre-line.
UPDATE hero_sections
   SET subtitle = 'En MAQSER24 conectamos tu obra con renta de maquinaria pesada, entrega de agua en pipas, acarreos en camiones de volteo y suministro de triturados como arena, grava, base hidráulica y CNC. También ofrecemos concreto premezclado, suministro y aplicación de carpeta asfáltica, además de venta de acero de refuerzo, block y cemento.\n\nDinos qué necesitas, cuánto requieres, dónde se ubica tu obra y para cuándo lo necesitas. Te presentaremos opciones con disponibilidad, condiciones de servicio y costos de entrega o traslado.',
       updated_at = NOW();

-- 11. "¿Por qué elegirnos?": ya no son seis.
UPDATE why_choose_us
   SET description = REPLACE(description, 'las seis categorías', 'las cinco categorías')
 WHERE description LIKE '%las seis categorías%';

-- 12. Tema activo: botón principal, copy de respaldo del hero, cifra del hero,
--     título de la banda de categorías y hero de /categorias.
UPDATE themes
   SET copys = JSON_SET(copys,
         '$.es."home.hero.ctaPrimary"', 'SOLICITAR COTIZACIÓN',
         '$.es."home.hero.subtitle"', 'En MAQSER24 conectamos tu obra con renta de maquinaria pesada, entrega de agua en pipas, acarreos en camiones de volteo y suministro de triturados como arena, grava, base hidráulica y CNC. También ofrecemos concreto premezclado, suministro y aplicación de carpeta asfáltica, además de venta de acero de refuerzo, block y cemento.\n\nDinos qué necesitas, cuánto requieres, dónde se ubica tu obra y para cuándo lo necesitas. Te presentaremos opciones con disponibilidad, condiciones de servicio y costos de entrega o traslado.',
         '$.es."home.hero.stat1.num"', '5',
         '$.es."home.categories.title"', 'Cinco categorías. Una sola marca.'),
       tokens = JSON_SET(tokens,
         '$.categoriesView.hero.title', 'Cinco categorías. Una sola marca.',
         '$.categoriesView.hero.subtitle', 'Renta de maquinaria pesada, transporte y servicios de obra, triturados, materiales para construcción y soluciones asfálticas. Una misma solicitud, una misma cotización.'),
       publishedAt = NOW(3)
 WHERE active = 1;

COMMIT;

-- Comprobación (debe salir: 5 activas, 0 productos en las retiradas, aliados sin slugs viejos):
-- SELECT cat_name, cat_slug, status, description FROM categories WHERE status = 1 ORDER BY id;
-- SELECT c.cat_slug, COUNT(*) FROM products p JOIN categories c ON c.id = p.category_id GROUP BY c.cat_slug;
-- SELECT name, categories FROM providers;
-- SELECT service_category, COUNT(*) FROM quotes GROUP BY service_category;
