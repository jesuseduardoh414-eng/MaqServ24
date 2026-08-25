/**
 * RED DE ALIADOS — tablas de proveedores y su expediente.
 *
 * De dónde sale el modelo: documento institucional, sección 15 (Red de aliados
 * y proveedores). Ahí se pide que un aliado no entre solo por tener maquinaria,
 * sino con un expediente que permita saber quién es, qué ofrece, en qué zonas
 * opera, qué documentos tiene y cuál ha sido su desempeño. Y que la red
 * distinga entre proveedor "registrado, validado, activo y preferente".
 *
 * POR QUÉ NO SE REUSA `users.is_vendor`: ese es el marketplace legacy —un
 * vendedor con su propia tienda— y está vacío (0 aprobados, 2 pendientes de
 * prueba). Un aliado es otra cosa: una empresa que aporta capacidad y a la que
 * MAQSER24 coordina. La mayoría no va a tener cuenta en el portal; el documento
 * los describe atendiendo por teléfono y mensajería. Por eso `user_id` es
 * opcional: enlaza al aliado con una cuenta SOLO si algún día entra al portal.
 *
 * SOLO AGREGA. No borra ni modifica ninguna tabla existente. `products` recibe
 * una columna nueva que admite nulos, así que ningún producto actual cambia.
 *
 * Idempotente: se puede correr las veces que haga falta.
 *   node migrate/16-providers.mjs
 */
import pg from 'pg';
import { env } from './_env.mjs';

const { Client } = pg;
const c = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// --- 1. El aliado -----------------------------------------------------------
await c.query(`
  CREATE TABLE IF NOT EXISTS public.providers (
    id                serial PRIMARY KEY,
    name              text NOT NULL,
    slug              text NOT NULL UNIQUE,
    -- Los cuatro niveles que nombra el documento. Empieza en 'registrado':
    -- estar dado de alta no es lo mismo que estar validado.
    level             text NOT NULL DEFAULT 'registrado',
    contact_name      text,
    phone             text,
    email             text,
    city              text,
    state             text,
    -- Cobertura real por municipio y qué líneas de servicio atiende. Arreglos
    -- para poder cruzarlos luego contra la zona y la categoría de una solicitud.
    coverage          text[] NOT NULL DEFAULT '{}',
    categories        text[] NOT NULL DEFAULT '{}',
    -- Minutos promedio en responder. El manual pide que la confianza se
    -- exprese con datos y no con medallas; este es uno de esos datos.
    response_minutes  integer,
    notes             text,
    status            smallint NOT NULL DEFAULT 1,
    user_id           integer,
    joined_at         timestamp NOT NULL DEFAULT now(),
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now()
  )
`);

// --- 2. Expediente con vigencias -------------------------------------------
// El documento insiste en que un papel válido hoy deja de serlo semanas
// después, y que no se puede tratar como "verificado" un expediente vencido.
// Por eso la fecha de vencimiento es una columna y no una nota suelta.
await c.query(`
  CREATE TABLE IF NOT EXISTS public.provider_documents (
    id          serial PRIMARY KEY,
    provider_id integer NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    kind        text NOT NULL,
    name        text,
    file        text,
    issued_at   date,
    expires_at  date,
    created_at  timestamp NOT NULL DEFAULT now()
  )
`);

// --- 3. Qué equipo es de quién ---------------------------------------------
// Sin constraint de llave foránea a propósito: el resto del esquema viene de
// una introspección del sistema anterior y no tiene ninguna, así que agregarla
// solo aquí crearía una excepción difícil de explicar. La integridad se cuida
// desde la aplicación, igual que en el resto del proyecto.
await c.query(`ALTER TABLE public.products ADD COLUMN IF NOT EXISTS provider_id integer`);

// --- 4. Índices -------------------------------------------------------------
await c.query(`CREATE INDEX IF NOT EXISTS provider_documents_provider_idx ON public.provider_documents (provider_id)`);
await c.query(`CREATE INDEX IF NOT EXISTS provider_documents_expires_idx  ON public.provider_documents (expires_at)`);
await c.query(`CREATE INDEX IF NOT EXISTS products_provider_idx           ON public.products (provider_id)`);
await c.query(`CREATE INDEX IF NOT EXISTS providers_level_idx             ON public.providers (level)`);

// --- 5. Seguridad -----------------------------------------------------------
// El resto de las tablas ya tiene RLS activo (ver 08-enable-rls.mjs). Sin esto,
// las tablas nuevas quedarían legibles con la llave pública del navegador. La
// API entra con service_role, así que no le afecta.
for (const t of ['providers', 'provider_documents']) {
  await c.query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
}

// --- Verificación -----------------------------------------------------------
const { rows: tablas } = await c.query(`
  SELECT c.relname AS tabla, c.relrowsecurity AS rls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('providers','provider_documents')
  ORDER BY c.relname
`);
for (const t of tablas) console.log(`tabla ${t.tabla} lista · RLS ${t.rls ? 'activo' : 'APAGADO'}`);

const { rows: col } = await c.query(`
  SELECT is_nullable FROM information_schema.columns
  WHERE table_name = 'products' AND column_name = 'provider_id'
`);
console.log(`products.provider_id ${col.length ? `existe (admite nulos: ${col[0].is_nullable})` : 'NO SE CREÓ'}`);

const { rows: n } = await c.query(`SELECT count(*)::int AS n FROM public.providers`);
console.log(`proveedores registrados: ${n[0].n}`);

await c.end();
console.log('\nListo. Siguiente paso: pnpm --filter @maqserv/db pull  (re-leer el esquema)');
