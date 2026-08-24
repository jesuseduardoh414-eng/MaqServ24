# Despliegue — MAQSER24

> **Repositorio (desde 2026-08-24): `github.com/jesuseduardoh414-eng/MaqServ24`.**
> El anterior se movió a una organización privada y la integración de Vercel no
> siguió el traslado: los push llegaban a GitHub pero **no disparaban ningún
> build**, y siete commits se quedaron fuera de producción sin aviso.
>
> **Cómo saber si un cambio de CÓDIGO está realmente desplegado.** No sirve mirar
> el sitio: los colores, textos e imágenes vienen de la BD por la API en tiempo
> de ejecución, así que la pantalla puede verse "nueva" con el código viejo. Hay
> que buscar en el HTML servido una marca que solo exista en el código nuevo. Hoy
> la más cómoda son las fuentes: el layout emite **un `<link>` por familia**, así
> que si ves una sola URL con `family=A&family=B`, ese build es anterior.
>
> ```
> curl -s https://servmaq24-web.vercel.app/productos | grep -o 'fonts.googleapis.com/css2?[^"]*'
> ```
>
> Al reconectar el repo, revisa en CADA proyecto de Vercel:
> - **Root Directory** — `apps/web` y `apps/admin`. Un monorepo mal apuntado falla la build.
> - **Production Branch** — `main`.
> - **`REVALIDATE_SECRET`** — mismo valor que en la API. Sin esto la invalidación
>   bajo demanda responde 503 y una página puede quedarse servida desde caché
>   durante horas aunque la BD ya tenga otra cosa (medido: `Age: 12027`).

Arquitectura de despliegue:

| App              | Qué es              | Dónde se despliega | Root Directory |
|------------------|---------------------|--------------------|----------------|
| `apps/api`       | API NestJS          | **Render**         | `.` (repo raíz)|
| `apps/web`       | Tienda (Next.js)    | **Vercel**         | `apps/web`     |
| `apps/admin`     | Panel admin (Next.js)| **Vercel**        | `apps/admin`   |

Datos y archivos ya viven en **Supabase** (Postgres + Storage). La API es *stateless*:
no guarda nada en disco, por eso Render no necesita disco persistente.

> El navegador solo habla con **Vercel** (mismo origen) y con **Supabase**.
> Las apps Next.js llaman a la API **del lado del servidor** (proxy). Por eso la API
> debe estar pública, pero `API_URL` NO lleva prefijo `NEXT_PUBLIC`.

---

## Orden recomendado

1. Desplegar la **API en Render** primero (necesitas su URL para las apps).
2. Desplegar **web** y **admin** en Vercel apuntando a esa URL.
3. Volver a Render y rellenar `SITE_URL` / `CORS_ORIGINS` con los dominios de Vercel.

---

## 1) API en Render

1. Ten los cambios en GitHub (`git push`). El repo es `MaqServ24`.
2. En Render → **New → Blueprint** → conecta el repo. Render detecta [`render.yaml`](render.yaml)
   y crea el servicio `servmaq-api`.
   - (Alternativa manual: **New → Web Service**, runtime Node, y copia
     `buildCommand` / `startCommand` / `healthCheckPath` desde `render.yaml`.)
3. Rellena las variables de entorno (Render te las pide por estar como `sync: false`).
   Copia los valores reales desde tu `packages/db/.env`:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | pooler transaction (`...pooler.supabase.com:6543/postgres?pgbouncer=true`) |
   | `DIRECT_URL` | pooler session (`...pooler.supabase.com:5432/postgres`) |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_KEY` | **service_role** (secreto) |
   | `IMAGE_BASE_URL` | `https://<ref>.supabase.co/storage/v1/object/public/media` |
   | `MP_ACCESS_TOKEN` | access token de MercadoPago |
   | `REVALIDATE_SECRET` | una cadena aleatoria larga (la misma que pondrás en la web) |
   | `SITE_URL` | dominio de la tienda en Vercel (lo rellenas en el paso 3) |
   | `API_PUBLIC_URL` | la URL de este servicio Render (p. ej. `https://servmaq-api.onrender.com`) |
   | `CORS_ORIGINS` | dominios de web y admin en Vercel, separados por coma (paso 3) |

4. Deploy. Cuando termine, prueba el health check:
   `https://servmaq-api.onrender.com/health` → `{"status":"ok",...}`

> **Plan free:** el servicio "duerme" tras ~15 min de inactividad; la primera petición
> tras dormir tarda ~30-50 s (afecta también a webhooks de MercadoPago). Para producción
> real, sube el servicio a plan **Starter**.

---

## 2) Tienda (`web`) en Vercel

1. Vercel → **Add New → Project** → importa el repo `servmaq24`.
2. **Root Directory** = `apps/web`. Framework: Next.js (autodetectado).
   Deja "Include files outside root directory" activado (monorepo pnpm/turbo).
3. Environment Variables (ver [`apps/web/.env.example`](apps/web/.env.example)):

   | Variable | Valor |
   |---|---|
   | `API_URL` | URL de la API en Render |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SITE_URL` | el propio dominio de esta app en Vercel |
   | `REVALIDATE_SECRET` | la misma cadena que pusiste en la API |

4. Deploy.

## 3) Admin en Vercel

1. Otra vez **Add New → Project** → mismo repo `servmaq24`.
2. **Root Directory** = `apps/admin`.
3. Environment Variables (ver [`apps/admin/.env.example`](apps/admin/.env.example)):

   | Variable | Valor |
   |---|---|
   | `API_URL` | URL de la API en Render |

4. Deploy.

---

## 4) Cerrar el círculo (CORS + URLs)

Con los dominios de Vercel ya asignados, vuelve a **Render → Environment** y ajusta:

- `SITE_URL` = dominio de la **tienda** (p. ej. `https://servmaq-web.vercel.app`).
- `CORS_ORIGINS` = `https://servmaq-web.vercel.app,https://servmaq-admin.vercel.app`.
- `API_PUBLIC_URL` = URL de la propia API en Render.

Guarda → Render redepliega solo.

> El `CORS_ORIGINS` es defensivo (el navegador normalmente no llama a la API directo),
> pero conviene tenerlo bien puesto por si algún día se llama desde el cliente.

---

## Notas y gotchas

- **Imágenes:** ya salen de Supabase Storage y están permitidas en `next.config.ts`
  (`remotePatterns`). No hay que tocar nada.
- **MercadoPago:** en el panel de MP, la URL de notificaciones/retorno debe apuntar a
  `API_PUBLIC_URL` (Render) y `SITE_URL` (tienda). Con el plan free de Render, un webhook
  puede fallar en el primer intento si el servicio está dormido (MP reintenta).
- **Build local en Windows:** `prisma generate` puede fallar con `EPERM ... query_engine-windows.dll.node`
  si el server de dev está corriendo (lock del .dll). Es solo local; en Render (Linux) no pasa.
- **Migraciones de esquema:** el esquema se obtiene por introspección (`prisma db pull`),
  no hay `prisma migrate deploy` en el arranque. Si cambias tablas, hazlo con cuidado aparte.
- **Secretos:** `SUPABASE_SERVICE_KEY`, `MP_ACCESS_TOKEN` y la contraseña de la BD son
  secretos. Nunca se versionan (los `.env` están en `.gitignore`).
