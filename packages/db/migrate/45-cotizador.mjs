/**
 * COTIZADORES INTERNOS · tablas `quoter_catalogs` y `quoter_quotes`.
 *
 * Trae a la plataforma los dos cotizadores que el cliente operaba por fuera
 * (maquinaria y triturados). Idempotente: se puede correr las veces que haga
 * falta.
 *
 *   node migrate/45-cotizador.mjs
 *
 * Alternativa equivalente si prefieres no tocar SQL a mano:
 *   pnpm --filter @maqserv/db push     (prisma db push, lee schema.prisma)
 *
 * El script NO siembra los catálogos: de eso se encarga la API la primera vez
 * que alguien abre el cotizador (ver `QuoterService.catalogo`). Así el punto de
 * partida sale de `@maqserv/config` y no de una copia pegada aquí que se
 * quedaría vieja al primer cambio.
 */
import mysql from 'mysql2/promise';
import { env } from './_env.mjs';

const uri = process.env.MYSQL_URL ?? env.DATABASE_URL;
if (!uri) {
  console.error('Falta MYSQL_URL (o DATABASE_URL en packages/db/.env)');
  process.exit(1);
}

const db = await mysql.createConnection({ uri, multipleStatements: false });

try {
  await db.query(`
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
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci
  `);
  console.log('  ✓ quoter_catalogs');

  await db.query(`
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
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci
  `);
  console.log('  ✓ quoter_quotes');

  const [[cat]] = await db.query('select count(*) c from quoter_catalogs');
  const [[cot]] = await db.query('select count(*) c from quoter_quotes');
  console.log(`Listo. Catálogos: ${cat.c} · Cotizaciones: ${cot.c}`);
} finally {
  await db.end();
}
