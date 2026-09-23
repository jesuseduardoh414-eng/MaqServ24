-- ============================================================================
-- REINICIO OPERATIVO · dejar la plataforma "recién estrenada" (2026-09-23)
-- ----------------------------------------------------------------------------
-- Decisión del cliente: empezar a vender desde cero. Se CONSERVA todo lo que es
-- configuración y catálogo (tema, textos, secciones del home, categorías,
-- productos y sus fotos, tabulador del cotizador, métodos de pago, blog, FAQ,
-- marcas, sectores, cupones, plantillas de correo, administradores) y se VACÍA
-- todo lo operativo: cuentas de clientes, cotizaciones, servicios, órdenes,
-- proveedores, avisos, reseñas, preguntas, mensajes, boletín y bitácoras.
--
-- Los productos pasan a ser de MAQSER24 (sin proveedor dueño): el cliente
-- apenas va a invitar a su primer proveedor y le asignará equipo desde
-- Cotizador → Tarifas y desde la ficha del producto cuando toque.
--
-- CÓMO CORRERLO
--   1. Exporta un respaldo completo primero (phpMyAdmin → Exportar). No hay
--      vuelta atrás sin él.
--   2. Pégalo completo en phpMyAdmin → SQL, con la base seleccionada, y ejecuta.
--   3. Si una línea falla porque esa tabla no existe en tu base, bórrala del
--      script y vuelve a ejecutar desde el principio: al ir en transacción,
--      nada se aplica hasta el COMMIT.
--
-- Idempotente: correrlo dos veces deja el mismo resultado.
-- Orden de borrado: primero los hijos (llaves foráneas), luego los padres.
-- ============================================================================

START TRANSACTION;

-- ── Servicios y cotizaciones ───────────────────────────────────────────────
DELETE FROM service_incidents;
DELETE FROM service_assignments;
DELETE FROM service_events;
DELETE FROM quotes;
DELETE FROM quote_emails;     -- correos de cotización del sistema viejo
DELETE FROM rfqs;             -- solicitudes RFQ del sistema viejo
DELETE FROM rfqcorreos;
DELETE FROM quoter_quotes;    -- documentos del cotizador (MQ-…/TR-…), del sitio y del panel

-- ── Clientes y obras ───────────────────────────────────────────────────────
DELETE FROM client_sites;
DELETE FROM clients;

-- ── Proveedores (red de aliados) ───────────────────────────────────────────
DELETE FROM provider_documents;
DELETE FROM availability_blocks;
DELETE FROM providers;

-- ── Pedidos (carrito) ──────────────────────────────────────────────────────
DELETE FROM order_events;
DELETE FROM rastreos;
DELETE FROM vendor_orders;
DELETE FROM payments;
DELETE FROM pickups;
DELETE FROM withdraws;
DELETE FROM orders;

-- ── Cuentas de clientes y todo lo que es suyo ──────────────────────────────
DELETE FROM wishlists;
DELETE FROM favorite_sellers;
DELETE FROM comments;         -- reseñas ligadas a compra
DELETE FROM reviews;
DELETE FROM site_reviews;
DELETE FROM replies;
DELETE FROM sub_replies;
DELETE FROM product_questions;
DELETE FROM product_clicks;
DELETE FROM direcciones;      -- direcciones guardadas por clientes (sistema viejo)
DELETE FROM user_notifications;
DELETE FROM notifications;    -- la campana
DELETE FROM user_subscriptions;
DELETE FROM users;

-- ── Mensajes, boletín y chats del sistema viejo ────────────────────────────
DELETE FROM contact_messages;
DELETE FROM subscribers;
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM admin_user_messages;
DELETE FROM admin_user_conversations;
DELETE FROM mirrormx_customer_chat_message;
DELETE FROM mirrormx_customer_chat_user;
DELETE FROM mirrormx_customer_chat_data;

-- ── Bitácoras y estadísticas ───────────────────────────────────────────────
DELETE FROM email_log;
DELETE FROM admin_audit;
DELETE FROM counters;         -- contadores de visitas del sistema viejo

-- ── El catálogo pasa a ser de MAQSER24 ─────────────────────────────────────
-- Sin proveedor dueño, sin "vendedor" del sistema viejo (user_id 0 = la casa)
-- y sin confirmación de disponibilidad hecha por un proveedor que ya no existe.
UPDATE products
   SET provider_id = NULL,
       user_id = 0,
       availability_confirmed_at = NULL;

-- El tabulador del cotizador tampoco apunta a proveedores que ya no existen.
-- (REGEXP_REPLACE existe en MySQL 8+ y MariaDB 10.0.5+. Si tu servidor no lo
-- tiene, quita esta línea y reasigna dueños desde Cotizador → Tarifas.)
-- El JSON guardado lleva espacio tras los dos puntos ("proveedor_id": 1), por
-- eso el patrón admite espacios; [[:space:]] es POSIX y vale en los dos motores.
UPDATE quoter_catalogs
   SET data = REGEXP_REPLACE(data, '"proveedor_id":[[:space:]]*[0-9]+', '"proveedor_id":null');

COMMIT;

-- ── Contadores desde 1 (opcional; es DDL, va fuera de la transacción) ──────
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE orders AUTO_INCREMENT = 1;
ALTER TABLE order_events AUTO_INCREMENT = 1;
ALTER TABLE quotes AUTO_INCREMENT = 1;
ALTER TABLE quoter_quotes AUTO_INCREMENT = 1;
ALTER TABLE clients AUTO_INCREMENT = 1;
ALTER TABLE client_sites AUTO_INCREMENT = 1;
ALTER TABLE providers AUTO_INCREMENT = 1;
ALTER TABLE provider_documents AUTO_INCREMENT = 1;
ALTER TABLE availability_blocks AUTO_INCREMENT = 1;
ALTER TABLE service_assignments AUTO_INCREMENT = 1;
ALTER TABLE service_events AUTO_INCREMENT = 1;
ALTER TABLE service_incidents AUTO_INCREMENT = 1;
ALTER TABLE notifications AUTO_INCREMENT = 1;
ALTER TABLE email_log AUTO_INCREMENT = 1;
ALTER TABLE admin_audit AUTO_INCREMENT = 1;
ALTER TABLE contact_messages AUTO_INCREMENT = 1;
ALTER TABLE subscribers AUTO_INCREMENT = 1;
ALTER TABLE product_questions AUTO_INCREMENT = 1;
ALTER TABLE comments AUTO_INCREMENT = 1;
ALTER TABLE wishlists AUTO_INCREMENT = 1;

-- ── Administradores: solo MAQSER24 (la cuenta personal del dueño y la de
--    ventas de la empresa). Las demás se DESACTIVAN, no se borran: no pueden
--    entrar y se les corta la sesión, pero se reactivan con un clic desde
--    Administradores si algún día hacen falta.
UPDATE admins
   SET role = 'direccion', status = 1
 WHERE email IN ('jesuseduardoh414@gmail.com', 'ventas@maqserv24.com');

UPDATE admins
   SET status = 0
 WHERE email NOT IN ('jesuseduardoh414@gmail.com', 'ventas@maqserv24.com');

-- ── Los dos administradores del sistema viejo pasan a ser PROVEEDORES ──────
-- Decisión del cliente: SFM (ventas@segaferreterias.com) y "hidden"
-- (jm18.jhr@gmail.com) no son administradores; son aliados. Se dan de alta con
-- su nombre y correo, en nivel "registrado" y sin categorías: el resto (nivel,
-- servicios que atienden, cobertura, papeles) se completa desde Red de aliados,
-- y desde ahí mismo se les manda su enlace con "Su acceso". Idempotente: si ya
-- existe un proveedor con ese correo, no se duplica.
INSERT INTO providers
  (name, slug, level, contact_name, email, coverage, categories, status,
   joined_at, created_at, updated_at, access_version)
SELECT a.name,
       LOWER(REPLACE(TRIM(a.name), ' ', '-')),
       'registrado', a.name, a.email, '[]', '[]', 1,
       NOW(6), NOW(6), NOW(6), 1
  FROM admins a
 WHERE a.email IN ('ventas@segaferreterias.com', 'jm18.jhr@gmail.com')
   AND NOT EXISTS (SELECT 1 FROM providers p WHERE p.email = a.email);
