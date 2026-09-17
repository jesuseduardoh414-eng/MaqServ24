-- COTIZADORES INTERNOS · tablas para producción (cPanel).
--
-- Mismo contenido que `45-cotizador.mjs`, en SQL plano, para pegarlo en
-- phpMyAdmin cuando no hay SSH a mano. Es idempotente (`if not exists`):
-- correrlo dos veces no rompe nada.
--
-- En phpMyAdmin: elegir la base `maqserv24_db` → pestaña SQL → pegar → Continuar.
--
-- NO siembra los catálogos a propósito: los crea la API sola la primera vez que
-- alguien abre el cotizador, leyéndolos de `@maqserv/config`. Así el punto de
-- partida no es una copia pegada aquí que se quedaría vieja al primer cambio.

create table if not exists quoter_catalogs (
  id         int unsigned not null auto_increment primary key,
  -- 'maquinaria' | 'triturados'
  kind       varchar(20)  not null,
  version    varchar(40)  not null,
  -- El tabulador completo. Lo valida la API con zod antes de escribir.
  data       json         not null,
  updated_by varchar(190) null,
  updated_at datetime     not null default current_timestamp,
  unique key quoter_catalogs_kind_unique (kind)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists quoter_quotes (
  id           int unsigned not null auto_increment primary key,
  kind         varchar(20)  not null,
  folio        varchar(40)  not null,
  -- 'panel' (la armó un administrador) | 'sitio' (la pidió un visitante)
  origin       varchar(10)  not null default 'panel',
  -- solicitada | borrador | enviada | aceptada | cancelada
  state        varchar(20)  not null default 'borrador',
  client_name  varchar(190) not null,
  work         varchar(190) null,
  attention    varchar(190) null,
  municipality varchar(90)  null,
  email        varchar(190) null,
  phone        varchar(40)  null,
  notes        text         null,
  options      json         not null,
  items        json         not null,
  -- El cálculo CONGELADO: el documento no cambia si mañana sube la tarifa.
  snapshot     json         not null,
  subtotal     decimal(12,2) not null default 0,
  tax          decimal(12,2) not null default 0,
  total        decimal(12,2) not null default 0,
  admin_id     int          null,
  admin_name   varchar(190) null,
  user_id      int          null,
  created_at   datetime     not null default current_timestamp,
  updated_at   datetime     not null default current_timestamp,
  unique key quoter_quotes_folio_unique (folio),
  key quoter_quotes_kind_idx   (kind, created_at desc),
  key quoter_quotes_state_idx  (state, created_at desc),
  key quoter_quotes_origin_idx (origin, created_at desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Comprobación: las dos deben aparecer.
select table_name, table_rows
from information_schema.tables
where table_schema = database()
  and table_name in ('quoter_catalogs', 'quoter_quotes');
