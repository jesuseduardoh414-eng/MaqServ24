-- ============================================================================
-- CAMBIO DE DOMINIO maqserv24.com → maqser24.com (oct-2026) · UN SOLO PEGADO
-- ----------------------------------------------------------------------------
-- Lo que el panel guardó con el dominio escrito adentro:
--   - themes: logos, video del hero, imágenes de secciones y promociones
--     (https://media.maqserv24.com/uploads/…), el correo de contacto y los
--     textos legales (info@maqserv24.com).
--   - quoter_catalogs: datos de la empresa en el documento del cotizador
--     (correo y "web").
--   - platform_settings: por si algún ajuste trae el dominio.
--   - quotes.cart_data: la foto de cada renglón de las cotizaciones (solo la
--     dirección de la foto; el resto de la cotización no se toca).
--
-- NO se tocan a propósito: email_log y admin_audit (son historia), ni
-- quoter_quotes (los documentos ya emitidos se quedan como se mandaron).
--
-- CUÁNDO: después de que https://media.maqser24.com/uploads/<un archivo>
-- abra con candado (DNS + AutoSSL listos) y de crear el buzón
-- info@maqser24.com. Antes, las imágenes del sitio se verían rotas.
--
-- Idempotente: correrlo dos veces no hace daño (ya no encuentra qué cambiar).
--
-- phpMyAdmin → base maqserv24_db → pestaña SQL → pegar todo → Continuar.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Tema del sitio (publicado y borrador).
UPDATE themes SET
  tokens      = REPLACE(tokens,      'maqserv24.com', 'maqser24.com'),
  copys       = REPLACE(copys,       'maqserv24.com', 'maqser24.com'),
  draftTokens = REPLACE(draftTokens, 'maqserv24.com', 'maqser24.com'),
  draftCopys  = REPLACE(draftCopys,  'maqserv24.com', 'maqser24.com')
WHERE CONCAT_WS(' ', tokens, copys, draftTokens, draftCopys) LIKE '%maqserv24.com%';

-- 2. Datos de la empresa en el cotizador.
UPDATE quoter_catalogs SET data = REPLACE(data, 'maqserv24.com', 'maqser24.com')
WHERE data LIKE '%maqserv24.com%';

-- 3. Ajustes de la plataforma.
UPDATE platform_settings SET value = REPLACE(value, 'maqserv24.com', 'maqser24.com')
WHERE value LIKE '%maqserv24.com%';

-- 4. Fotos dentro de las cotizaciones.
UPDATE quotes SET cart_data = REPLACE(cart_data, 'media.maqserv24.com', 'media.maqser24.com')
WHERE cart_data LIKE '%media.maqserv24.com%';

-- 5. Comprobación: todo en 0.
SELECT
  (SELECT COUNT(*) FROM themes WHERE CONCAT_WS(' ', tokens, copys, draftTokens, draftCopys) LIKE '%maqserv24.com%') AS temas_pendientes,
  (SELECT COUNT(*) FROM quoter_catalogs WHERE data LIKE '%maqserv24.com%') AS cotizador_pendiente,
  (SELECT COUNT(*) FROM platform_settings WHERE value LIKE '%maqserv24.com%') AS ajustes_pendientes,
  (SELECT COUNT(*) FROM quotes WHERE cart_data LIKE '%media.maqserv24.com%') AS cotizaciones_pendientes;

-- ----------------------------------------------------------------------------
-- 6. (APARTE, OPCIONAL) Correos con los que se entra al panel.
-- Cambiarlos cambia el usuario con el que cada quien inicia sesión, y el
-- "olvidé mi contraseña" llega al buzón nuevo: córrelo solo cuando ya existan
-- los buzones @maqser24.com de esas personas. Primero mira quiénes son:
--
--   SELECT id, name, email, role FROM admins WHERE email LIKE '%@maqserv24.com';
--
-- y luego, para cambiarlos todos:
--
--   UPDATE admins SET email = REPLACE(email, '@maqserv24.com', '@maqser24.com')
--   WHERE email LIKE '%@maqserv24.com';
--
-- La cuenta principal (Dirección) sigue siéndolo con ventas@maqser24.com o con
-- ventas@maqserv24.com: el código acepta los dos.
-- ============================================================================
