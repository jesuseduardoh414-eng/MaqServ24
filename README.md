# MAQSER24 — Ficha técnica

Plataforma web de **MAQSER24** (maqser24.com): coordinación de renta y venta de
maquinaria pesada, triturados, transporte y servicios de obra, materiales y
soluciones asfálticas. MAQSER24 **es solo la plataforma**: las máquinas las pone
la red de **aliados** (el grupo del dueño es un aliado más). El cliente ve un
solo precio, el de MAQSER24, y la plataforma asigna al aliado y sigue el
servicio hasta el cierre.

Nació como migración del sistema Laravel anterior (`scava`) a un stack
JavaScript moderno. El sistema viejo ya no está en uso.

## Datos generales

| Concepto | Valor |
|---|---|
| Sitio público | https://maqser24.com |
| Panel de administración | https://admin.maqser24.com |
| API | https://api.maqser24.com |
| Hosting | Servidor cPanel propio (3 apps Node.js + MySQL en la misma cuenta) |
| Dominio | maqser24.com en Namecheap, DNS del hosting (desde 2026-10-21). maqserv24.com redirige con 301 y se debe seguir renovando |
| Repositorio | Monorepo `pnpm` + Turborepo |
| Idioma / moneda | Español (México) / MXN |

## Stack

| Capa | Tecnología |
|---|---|
| Sitio público (`apps/web`) | Next.js 15 (App Router, SSR) · React 19 · Tailwind CSS 4 |
| Panel (`apps/admin`) | Next.js 15 · React 19 · Tailwind CSS 4 · componentes Radix/shadcn |
| API (`apps/api`) | NestJS 11 · validación Zod · rate limit con `@nestjs/throttler` |
| Base de datos | MySQL/MariaDB · Prisma 6 (94 modelos, esquema por introspección) |
| Autenticación | Contraseñas bcrypt · sesiones JWT (`jose`) · inicio de sesión con Google |
| Pagos | Ninguno en línea: el carrito y MercadoPago se retiraron el 2026-10-08 |
| Correo | SMTP de cPanel (puerto 587) con Nodemailer |
| Mapas / distancias | Google Distance Matrix si hay llave; OpenStreetMap (Nominatim) si no |
| Runtime | Node.js ≥ 20 (CI compila con Node 22) |

## Estructura del monorepo

```
apps/
  web/      → sitio público: catálogo, cotizadores, cuenta, portal del aliado, operador, blog
  admin/    → panel: operación, catálogo, cotizador, diseño, usuarios y permisos
  api/      → API REST, un módulo por área de negocio
packages/
  config/   → @maqserv/config — tokens de tema, motor de los cotizadores, roles e interruptores
  db/       → @maqserv/db — esquema Prisma, SQL de mantenimiento y CLI de administradores
  types/    → @maqserv/types — tipos compartidos entre front y back
  ui/       → @maqserv/ui — componentes base que solo consumen tokens
scripts/    → empaquetado para cPanel y generadores de recursos de marca
```

## Funcionalidad

**Sitio público**

- Catálogo de las 5 líneas de servicio, sectores, ficha de cada servicio,
  opiniones y preguntas. "Lista para cotizar" para pedir varios a la vez.
- **Cotizadores** de maquinaria y de triturados (`/cotizador`) con el precio del
  tabulador, y el formulario a la medida (`/cotizar`) sin precio. Los dos exigen
  cuenta. MAQSER24 revisa o responde la solicitud en el panel; aceptada, se le
  ofrece sola a los aliados que llegan a la obra y el primero que acepta se la queda.
- Cuenta del cliente: cotizaciones (aceptar, documento, seguimiento del servicio
  en mapa), favoritos, perfil y campana de avisos.
- Aceptar sin cuenta una cotización armada en el panel (`/cotizacion/aceptar`,
  enlace firmado del correo) y calificar el servicio al cierre (`/resena`).
- Portal del aliado (`/aliado`, enlace firmado): ofertas, avance, operador,
  ubicación, equipos y papeles. Página del operador (`/operador`).
- Registro de proveedores, blog, contacto, Quiénes somos, términos y privacidad.

**Panel de administración** (menú por flujo: Recibir → Cotizar → Ejecutar → Cobrar y medir)

- Solicitudes, clientes y obras, mensajes, disponibilidad, mapa de cobertura,
  cotizadores y cotizaciones emitidas, servicios en curso y agenda.
- Proveedores (expediente, papeles, sello de verificado, equipos ofrecidos),
  inventario y categorías.
- Indicadores (12 del documento institucional; utilización y margen aún no se miden).
- Cobranza, pagos a aliados, margen y zonas: **solo diseño**, con datos de
  ejemplo, hasta que Dirección defina el modelo de cobro.
- **Diseño configurable** sin recompilar: marca, secciones del home, contacto,
  pie, FAQ, textos legales y temas.
- Administradores con **3 roles** (Dirección General, Operaciones,
  Administración), permisos editables por módulo y bitácora.

**Retirado** (2026-10-08 y 2026-10-15): carrito, checkout y MercadoPago,
marketplace de vendedores y boletín. **Apagado**: sincronización con Perfex CRM
(`CRM_ACTIVO` en `packages/config`).

## Reglas de diseño

- **Prohibido hardcodear** colores, tamaños, radios o textos visibles: todo sale
  de tokens CSS (`var(--color-primary)`, …) o de copys servidos por la API desde
  la BD. Si algo aún no es configurable, se crea el token con valor por defecto.
- Identidad MAQSER24: negro / grafito / azul eléctrico, tipografía Inter,
  fondos negros (el gris solo para elementos, nunca de fondo).
- Responsivo en móvil y tablet: menú en cajón y tablas que pasan a tarjetas.

## Seguridad

- Contraseñas con bcrypt; recuperación de contraseña por token firmado de un solo uso.
- Guard de permisos del panel **cerrado por defecto** (fail-closed) y bitácora de acciones.
- Enlaces sin contraseña (aliado, operador, reseña, aceptar cotización) firmados
  con `PROVIDER_LINK_SECRET`, cada uno con su emisor y su vigencia.
- Rate limit en la API, CORS restringido y secreto compartido entre proxy y API (`PROXY_SECRET`).
- Subidas de archivos validadas y guardadas fuera de las apps (`MEDIA_DIR`).

## Tareas programadas

Dos workflows de GitHub Actions llaman a la API con la cabecera
`x-tasks-secret` (el secreto del repositorio y la variable `TASKS_SECRET` de la
API deben ser idénticos):

- **Diario, 8:00 Monterrey** (`tareas-programadas.yml` → `/tareas/recordatorios`):
  revisa las reservas, manda recordatorios a los aliados (equipos sin confirmar,
  papeles por vencer) y avisa al cliente cuya cotización vence en 2 días o menos.
- **Cada 15 min** (`avisos-de-salida.yml` → `/tareas/salidas`): recordatorio del
  día anterior, hora de salir y retraso; seguimiento de ofertas sin contestar
  (recordatorio al aliado y oferta a los siguientes). Mientras la API está
  despierta, esto también corre con su propio reloj cada 5 min.

## Despliegue

Cada `push` a `main` **despliega solo** por SSH al servidor cPanel
(`.github/workflows/desplegar-cpanel.yml`); los cambios que solo tocan `.md` no
disparan despliegue. Queda manual: correr SQL en phpMyAdmin y editar variables
de entorno en cPanel. Guía completa en [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md).
[DEPLOY.md](DEPLOY.md) documenta la alternativa anterior (Vercel + Render).

### Variables de entorno principales (API)

| Grupo | Variables |
|---|---|
| Base de datos | `MYSQL_URL` |
| URLs | `SITE_URL`, `ADMIN_URL`, `API_PUBLIC_URL`, `IMAGE_BASE_URL`, `CORS_ORIGINS` |
| Secretos | `JWT_SECRET`, `AUTH_SECRET`, `PROXY_SECRET`, `REVALIDATE_SECRET`, `TASKS_SECRET`, `PROVIDER_LINK_SECRET` |
| Correo | `MAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_FROM_NAME` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DISTANCE_MATRIX_API_KEY` |
| Archivos | `MEDIA_DIR` |
| Servidor | `PORT`, `TOKIO_WORKER_THREADS=2` (limita hilos del motor Prisma por los límites del hosting) |

`web` y `admin` usan `API_URL`, `SITE_URL`, `PROXY_SECRET`, `REVALIDATE_SECRET` y `GOOGLE_CLIENT_ID`.

## Desarrollo local

```bash
pnpm install
pnpm dev            # api :4000 · web :3000 · admin
pnpm typecheck
pnpm build
```

Requiere MariaDB/MySQL local (XAMPP) con la BD `maqserv_dev`.
Variables: copia `packages/db/.env.example` → `packages/db/.env` y
`apps/api/.env.example` → `apps/api/.env`.

Comandos útiles:

| Comando | Qué hace |
|---|---|
| `pnpm db:generate` | Regenera el cliente de Prisma |
| `pnpm db:pull` | Vuelve a leer el esquema desde la BD |
| `pnpm --filter @maqserv/db build` y luego `node packages/db/dist/crear-admin.js <correo> <contraseña> [nombre] [rol]` | Crea un administrador desde la terminal |

Los scripts SQL de mantenimiento (categorías, cotizador, permisos por rol,
reinicio operativo) están en `packages/db/sql/`.
