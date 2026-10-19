-- ============================================================================
-- PREGUNTAS DEL SITIO Y PREGUNTAS FRECUENTES (2026-10-12)
-- ----------------------------------------------------------------------------
-- Hasta hoy solo se podía preguntar sobre un producto y con sesión iniciada.
-- Ahora también se pregunta en general desde Preguntas frecuentes (sin cuenta,
-- con nombre y correo) y el panel captura las que llegan por correo o WhatsApp.
-- Por eso producto y usuario pasan a ser opcionales, y se guarda quién
-- preguntó y por dónde llegó.
--
-- Idempotente. Pegar en phpMyAdmin con la base seleccionada.
-- ============================================================================

ALTER TABLE product_questions
  MODIFY product_id INT NULL,
  MODIFY user_id INT NULL,
  ADD COLUMN IF NOT EXISTS asker_name VARCHAR(190) NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS asker_email VARCHAR(190) NULL AFTER asker_name,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'producto' AFTER asker_email;

-- Una sola bandeja (2026-10-14): los mensajes de Contacto también se contestan
-- desde Mensajes (la respuesta le llega por correo) y se pueden publicar como
-- pregunta frecuente.
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS answer TEXT NULL AFTER handled_at,
  ADD COLUMN IF NOT EXISTS answered_at DATETIME(6) NULL AFTER answer,
  ADD COLUMN IF NOT EXISTS faq_id INT NULL AFTER answered_at;
