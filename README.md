# MAQSER24 — Ficha técnica

Plataforma web de **MAQSER24** (maqserv24.com): coordinación de renta y venta de
maquinaria pesada, triturados, transporte y servicios de obra, materiales y
soluciones asfálticas. MAQSER24 **no es dueño del equipo**: lo publica cada
**proveedor (aliado)**; la plataforma cotiza, cobra y coordina entre el
**comprador**, el **proveedor** y **MAQSER24**.

Nació como migración del sistema Laravel anterior (`scava`) a un stack
JavaScript moderno. El sistema viejo ya no está en uso.

## Datos generales

| Concepto | Valor |
|---|---|
| Sitio público | https://maqserv24.com |
| Panel de administración | https://admin.maqserv24.com |
| API | https://api.maqserv24.com |
| Hosting | Servidor cPanel propio (3 apps Node.js + MySQL en la misma cuenta) |
| Dominio | GoDaddy (DNS apuntando al hosting) |
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
| Pagos | MercadoPago (Checkout Pro + webhook firmado) y transferencia |
| Correo | SMTP de cPanel (puerto 587) con Nodemailer |
| Mapas / distancias | Google Distance Matrix si hay llave; OpenStreetMap (Nominatim) si no |
| Runtime | Node.js ≥ 20 (CI compila con Node 22) |

## Estructura del monorepo

```
apps/
  web/      → sitio público: catálogo, cotizadores, carrito, checkout, cuenta, blog
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

- Catálogo por las 5 categorías de servicio, sectores, detalle de producto con
  ficha técnica, opiniones y preguntas.
- **Cotizadores** de maquinaria y de triturados (`/cotizador`). Cotizar exige
  cuenta; la solicitud se vuelve un servicio con precio congelado que se le
  ofrece al proveedor dueño del equipo.
- Carrito y checkout: venta y renta por periodo × cantidad, IVA configurable,
  traslado calculado por kilómetro.
- Cuenta del cliente: pedidos, cotizaciones, favoritos, perfil y campana de
  notificaciones. Rastreo de pedidos en `/rastreo`.
- Portal del aliado (`/aliado`, por enlace firmado) para aceptar o rechazar servicios.
- Blog (Bitácora), contacto, Quiénes somos, términos y privacidad.

**Panel de administración**

- Órdenes con flujo de envío (guía, traslado, sucursal) e historial de eventos,
  pagos, cotizaciones, servicios, agenda y disponibilidad.
- Catálogo: productos, categorías, proveedores, reseñas y preguntas.
- Cotizador: tabulador de tarifas editable e historial de documentos emitidos.
- **Diseño configurable** sin recompilar: marca, hero, secciones del home,
  contacto, pie, FAQ, textos legales y temas.
- Clientes, mensajes de contacto, correo, indicadores, blog.
- Administradores con **5 roles** (Dirección General, Operaciones, Red de
  Aliados, Comercial y Atención, Marca y Crecimiento), permisos editables por
  módulo y bitácora.

**Apagado a propósito** (interruptores en `packages/config`, nada borrado):
marketplace de vendedores y retiros (`MARKETPLACE_ACTIVO`), boletín
(`NEWSLETTER_ACTIVO`) y sincronización con Perfex CRM (`CRM_ACTIVO`).

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
- Webhook de MercadoPago verificado por firma y monto; órdenes idempotentes.
- Rate limit en la API, CORS restringido y secreto compartido entre proxy y API (`PROXY_SECRET`).
- Subidas de archivos validadas y guardadas fuera de las apps (`MEDIA_DIR`).

## Tareas programadas

GitHub Actions (`.github/workflows/tareas-programadas.yml`) llama una vez al día a
la API (protegida con `TASKS_SECRET`) para:

- cancelar órdenes impagas vencidas y devolver su stock;
- enviar recordatorios a los aliados.

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
| Pagos | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ORDER_EXPIRY_MP_HOURS`, `ORDER_EXPIRY_TRANSFER_HOURS` |
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
