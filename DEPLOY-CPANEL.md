# Despliegue en cPanel — MAQSER24

Alternativa a [`DEPLOY.md`](DEPLOY.md) (Vercel + Render). Aquí todo corre en **un
solo servidor con cPanel**, creando la cuenta desde **WHM** y apuntando el
dominio que está en **GoDaddy**.

> **Antes de nada, lee la fase 0.** Esto no es un sitio PHP: son **tres procesos
> Node.js**. Un cPanel de solo PHP/MySQL **no puede correrlo**, y eso no se
> arregla con configuración. Si tu servidor no trae Node, la fase 0 te lo dice en
> 5 minutos y te ahorra el resto.

## Lo que hay que montar

| App | Qué es | Subdominio | Arranque | Carpeta en el servidor |
|---|---|---|---|---|
| `web` | Tienda (Next.js) | `maqserv24.com` | `server.js` | `~/nodeapps/web` |
| `admin` | Panel (Next.js) | `admin.maqserv24.com` | `server.js` | `~/nodeapps/admin` |
| `api` | API (NestJS) | `api.maqserv24.com` | `dist/main.js` | `~/nodeapps/api` |

La base de datos y los archivos **siguen en Supabase**. cPanel no hospeda datos
aquí: su MySQL no se usa. Por eso las tres apps son *stateless* y se pueden
borrar y volver a subir sin perder nada.

---

## Fase 0 — ¿Este servidor puede? (bloqueante, 5 min)

Necesitas las cuatro cosas. Si falta la primera, **para aquí**.

1. **Node.js 20 o superior.** En cPanel se llama **Setup Node.js App**
   (*Configurar aplicación Node.js*), sección **Software**. Lo da CloudLinux; un
   revendedor **no puede instalarlo**, solo el dueño del servidor (root).
2. **Memoria.** Tres procesos Node piden en conjunto ~600 MB – 1 GB. Con un
   límite LVE de 512 MB verás errores 508 intermitentes y no hay arreglo desde tu
   lado.
3. **Disco.** ~600 MB solo de aplicaciones, más lo que subas después.
4. **SSH** (opcional pero cómodo). Los paquetes van autocontenidos, así que se
   puede hacer todo por el File Manager; con SSH es mucho más rápido.

**Cómo comprobar el punto 1 sin tener aún la cuenta:** crea la cuenta (fase 1 —
es gratis y reversible), entra a su cPanel y busca "Node" en el buscador de
arriba. Si no aparece **Setup Node.js App**, el servidor no sirve para esto:
pídeselo al dueño del servidor o usa un VPS/hosting con Node.

Con SSH lo confirmas directo:

```bash
ls /opt/alt/ | grep alt-nodejs     # CloudLinux: alt-nodejs20, alt-nodejs22…
node -v
```

---

## Fase 1 — Crear la cuenta de cPanel desde WHM

1. Entra a WHM: `https://IP-DEL-SERVIDOR:2087` (o el host que te dieron), con tu
   usuario de revendedor.
2. Busca **Create a New Account** (*Crear una cuenta nueva*), en **Account Functions**.
3. **Domain Information**
   - **Domain**: `maqserv24.com` — el dominio raíz, **sin `www` y sin `https://`**.
   - **Username**: lo propone solo. **Anótalo**: es el dueño de `/home/maqserv24`.
   - **Password**: usa *Password Generator* y **guárdalo** en tu gestor.
   - **Email**: tu correo real (ahí llegan los avisos de cuota).
4. **Package**: elige uno con **≥ 10 GB de disco**. Si usas *Select Options
   Manually*, pon el disco y deja el ancho de banda sin límite.
5. **Settings**: marca **Shell Access** si aparece. Si no, lo activas después en
   WHM → *Manage Shell Access*.
6. **DNS Settings**: deja las casillas como vienen. En la fase 3 vamos a apuntar
   el dominio con **registros A desde GoDaddy**, así que da igual qué
   nameservers tenga el servidor.
7. **Create**. Al terminar, WHM te muestra la **IP** de la cuenta: **apúntala**,
   la necesitas en la fase 3.

> Si no ves la IP, está en WHM → *List Accounts*, columna **IP Address**.

Entra ya a cPanel (WHM → *List Accounts* → icono de cPanel) y haz la comprobación
de la fase 0: busca "Node" arriba.

---

## Fase 2 — Crear los subdominios

En cPanel → **Domains** → **Create A Domain**, dos veces:

| Dominio | Raíz del documento |
|---|---|
| `admin.maqserv24.com` | `/home/maqserv24/admin.maqserv24.com` |
| `api.maqserv24.com` | `/home/maqserv24/api.maqserv24.com` |

**Desmarca "Share document root"** para que cada uno tenga la suya. El
dominio principal ya existe con raíz `/home/maqserv24/public_html`.

Esas carpetas quedan casi vacías: el código de las apps **no va ahí**, va en
`~/nodeapps/…`. Es lo normal con Passenger — cPanel pone en la raíz del documento
un `.htaccess` que reenvía a la app.

---

## Fase 3 — Apuntar el dominio desde GoDaddy

Vamos con **registros A**, no con nameservers. Razón práctica: así puedes mover
las apps **una por una** y dejar la tienda actual funcionando hasta el final.

1. GoDaddy → **Mis productos** → tu dominio → **DNS** / *Administrar zonas DNS*.
2. **Primero, baja el TTL** de los registros que ya existen a `600` (10 min) y
   guarda. Espera a que pase el TTL viejo (suele ser 1 h). Esto hace que el
   cambio real de después sea casi inmediato en vez de tardar horas.
3. Agrega o edita:

   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | A | `api` | `IP-DEL-SERVIDOR` | 600 |
   | A | `admin` | `IP-DEL-SERVIDOR` | 600 |
   | A | `@` | `IP-DEL-SERVIDOR` | 600 |
   | A | `www` | `IP-DEL-SERVIDOR` | 600 |

   Borra cualquier **CNAME** o **A** anterior con esos mismos nombres: un nombre
   no puede tener las dos cosas. Si el dominio apunta hoy a Vercel, ahí está el
   registro que hay que reemplazar.

   **Orden recomendado:** primero solo `api` y `admin`. Déjalos funcionando y
   probados, y cambia `@` y `www` al final — ese es el que tumba la tienda si
   algo sale mal.

4. Comprobar (desde tu PC, PowerShell):

   ```powershell
   Resolve-DnsName api.maqserv24.com -Type A
   ```

   Cuando devuelva la IP del servidor, está listo.

> **Correo:** si algún día vas a usar correo `@maqserv24.com`, los registros MX
> también tienen que apuntar aquí. Hoy la plataforma **no manda correos** (no hay
> SMTP configurado), así que no bloquea nada.

---

## Fase 4 — Compilar y empaquetar

El servidor **no compila**: le subimos las apps ya construidas y completas, sin
`npm install`. Es a propósito — cPanel usa `npm`, que no sabe resolver los
`workspace:*` de pnpm, y un hosting compartido no suele tener RAM para un
`next build`.

### 4A · En GitHub Actions (recomendado)

Compila en Linux, que es lo mismo que corre el servidor. **Evita de un golpe los
dos problemas que tiene compilar en Windows** (symlinks y el binario de `sharp`).

1. GitHub → **Settings** → *Secrets and variables* → **Actions** → pestaña
   **Variables**. Agrega, porque Next **incrusta en el build** todo lo que empieza
   por `NEXT_PUBLIC_` (ponerlas solo en cPanel no sirve):

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SITE_URL` → `https://maqserv24.com`
   - `API_URL` → `https://api.maqserv24.com`

2. Pestaña **Actions** → **Empaquetar para cPanel** → **Run workflow**.
3. Al terminar, baja el artefacto `cpanel` del resumen: trae `web.tar.gz`,
   `admin.tar.gz` y `api.tar.gz`.

### 4B · En tu PC (Windows)

Funciona, pero **Windows bloquea los symlinks** y `next build --standalone` los
necesita. Hay que activarlo una vez:

> **Configuración → Sistema → Para programadores → Modo de programador: Activado.**
> Luego cierra y vuelve a abrir la terminal.

Sin eso, el build muere con `EPERM ... symlink` a los pocos minutos. El script lo
detecta antes de empezar y te avisa.

```bash
cd servmaq-platform
node scripts/empaquetar-cpanel.cjs          # las tres apps
node scripts/empaquetar-cpanel.cjs api      # solo una
node scripts/empaquetar-cpanel.cjs --zip    # además genera los .zip
```

Deja en `dist-cpanel/` una carpeta por app, lista para subir tal cual. El script
resuelve cuatro cosas que, sin él, rompen el despliegue en silencio:

1. **Symlinks** → los aplana a archivos reales (dentro de un ZIP llegan rotos).
2. **Motor de Prisma** → `pnpm deploy` reinstala `@prisma/client` sin generar; se
   repone el cliente con sus binarios de Linux.
3. **Estáticos de Next** → `standalone` no incluye `.next/static` ni `public`; sin
   copiarlos el sitio carga sin CSS ni imágenes.
4. **`sharp` de Linux** → compilando en Windows solo se instala el binario de
   Windows, y `next/image` fallaría en el servidor. Lo descarga.

---

## Fase 5 — Subir los archivos

Las carpetas destino son `~/nodeapps/web`, `~/nodeapps/admin` y `~/nodeapps/api`.

**Con SSH** (rápido, recomendado):

```bash
ssh maqserv24@IP-DEL-SERVIDOR "mkdir -p ~/nodeapps/{web,admin,api}"
scp dist-cpanel/api.tar.gz maqserv24@IP-DEL-SERVIDOR:~/
ssh maqserv24@IP-DEL-SERVIDOR "tar -xzf ~/api.tar.gz -C ~/nodeapps/api && rm ~/api.tar.gz"
```

**Sin SSH**, por el File Manager de cPanel: crea las carpetas, sube
el `.zip` / `.tar.gz` dentro de cada una y usa **Extract**. Son cientos de MB, así
que si la subida se corta usa FTP (FileZilla) para el archivo comprimido y extrae
desde cPanel.

---

## Fase 6 — Crear las tres aplicaciones Node

cPanel → **Software** → **Setup Node.js App** → **Create Application**, una vez
por app:

| Campo | `web` | `admin` | `api` |
|---|---|---|---|
| Node.js version | la más alta ≥ 20 | igual | igual |
| Application mode | Production | Production | Production |
| Application root | `nodeapps/web` | `nodeapps/admin` | `nodeapps/api` |
| Application URL | `maqserv24.com` | `admin.maqserv24.com` | `api.maqserv24.com` |
| Application startup file | `server.js` | `server.js` | `dist/main.js` |

> ⚠️ **No toques el botón "Run NPM Install".** Los paquetes ya vienen completos;
> ese botón intentaría resolver dependencias `workspace:*` que no existen fuera
> del monorepo y **te dejaría la app rota**.

El puerto lo inyecta Passenger en `PORT`; las tres apps ya lo leen. No configures
puertos a mano.

---

## Fase 7 — Variables de entorno

En la misma pantalla de cada app, sección **Environment variables**. Los valores
reales están en tu `packages/db/.env` y en los `.env.example` de cada app.

**`api`** (la más larga):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | pooler **:5432** (modo sesión — ver `apps/api/.env.example`, vale 4x en velocidad) |
| `DIRECT_URL` | pooler :5432 sin parámetros |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_KEY` | service_role (**secreto**) |
| `IMAGE_BASE_URL` | `https://<ref>.supabase.co/storage/v1/object/public/media` |
| `SITE_URL` | `https://maqserv24.com` |
| `API_PUBLIC_URL` | `https://api.maqserv24.com` |
| `CORS_ORIGINS` | `https://maqserv24.com,https://admin.maqserv24.com` |
| `MP_ACCESS_TOKEN` | access token de MercadoPago |
| `REVALIDATE_SECRET` | cadena aleatoria larga (**misma que en `web`**) |
| `PROXY_SECRET` | cadena aleatoria larga (**misma que en `web` y `admin`**) |
| `PROVIDER_LINK_SECRET` | cadena aleatoria larga |
| `TASKS_SECRET` | cadena aleatoria, **mínimo 16 caracteres** |

**`web`**: `NODE_ENV=production`, `API_URL=https://api.maqserv24.com`,
`SITE_URL=https://maqserv24.com`, `REVALIDATE_SECRET`, `PROXY_SECRET`.

**`admin`**: `NODE_ENV=production`, `API_URL=https://api.maqserv24.com`, `PROXY_SECRET`.

> **Las `NEXT_PUBLIC_*` no van aquí y ya está**: Next las incrusta **durante el
> build**, no al arrancar. Si las cambias, hay que **volver a compilar y subir**.
> Ponerlas en cPanel no tiene ningún efecto.

Cuatro cosas que, si faltan, rompen de formas que cuesta diagnosticar:

- **`CORS_ORIGINS`** — la API **no arranca** sin esto en producción. Es a propósito.
- **`TASKS_SECRET`** — sin él las rutas `/tareas/*` **no existen** (403). Las tareas
  diarias no corren y quedan pedidos apartando equipo sin pagar.
- **`PROVIDER_LINK_SECRET`** — sin él, el portal del aliado devuelve 500 disfrazado
  de "este enlace ya no sirve".
- **`REVALIDATE_SECRET`** — sin él, la web puede quedarse servida desde caché
  durante horas aunque la base ya tenga otra cosa.

Guarda y pulsa **Restart** en cada app.

---

## Fase 8 — HTTPS

Con el DNS ya apuntando (fase 3):

1. cPanel → **SSL/TLS Status** → selecciona los tres dominios → **Run AutoSSL**.
2. Cuando salgan en verde: cPanel → **Dominios** → activa **Forzar redirección
   HTTPS** en los tres.

Si AutoSSL falla, casi siempre es que el DNS todavía no propagó. Espera y repite.

---

## Fase 9 — Tareas programadas (el cron)

Sustituyen al workflow de GitHub que hoy dispara contra Render.

cPanel → **Cron Jobs** → **Add New Cron Job**. Dos entradas:

```
0 8 * * * curl -s -X POST -H "x-tasks-secret: TU_TASKS_SECRET" https://api.maqserv24.com/tareas/ordenes-vencidas > /dev/null 2>&1
5 8 * * * curl -s -X POST -H "x-tasks-secret: TU_TASKS_SECRET" https://api.maqserv24.com/tareas/recordatorios > /dev/null 2>&1
```

- La hora es la **del servidor**, no la tuya. Compruébala con `date` por SSH y
  ajusta para que caiga a las 08:00 de Ciudad de México.
- **Apaga el workflow viejo** (`.github/workflows/tareas-programadas.yml`,
  Actions → *Tareas programadas* → `···` → *Disable workflow*) o las tareas
  correrán dos veces al día.

Para probar sin esperar: pega el mismo `curl` en SSH. Un `403 "Secreto inválido"`
significa que el valor del cron y el de la app no coinciden; un `403 "no están
habilitadas"` es que falta `TASKS_SECRET` en la app.

---

## Fase 10 — Cerrar

1. **MercadoPago** → panel → Webhooks: apunta la notificación a
   `https://api.maqserv24.com/payments/mercadopago/webhook`.
2. Deja Vercel y Render encendidos unos días por si hay que volver atrás. Cuando
   todo esté probado, bórralos.

---

## Fase 11 — Correo `@maqserv24.com` (opcional)

cPanel sí hospeda correo, y aquí resuelve dos cosas distintas:

- **Buzones para personas** (`contacto@`, `ventas@`): cPanel → **Email Accounts**
  → *Create*. Se leen por webmail (`maqserv24.com/webmail`) o por IMAP desde
  Gmail/Outlook. Con esto, el correo que publica el sitio (Diseño → Contacto)
  puede **por fin existir de verdad**: hoy el publicado no tiene buzón detrás.
- **Correo saliente de la plataforma**: los recordatorios a aliados llevan tiempo
  programados pero **nunca han salido**. `MailerService` los registra en
  `email_log` como "simulado" porque nunca hubo SMTP. Un buzón de aquí lo
  destraba.

### DNS (en GoDaddy, no en cPanel)

Como la autoridad DNS se queda en GoDaddy (fase 3), los registros de correo van
**allá**. cPanel te da los valores exactos ya calculados en
**Email → Email Deliverability → Manage**; cópialos de ahí en vez de escribirlos
a mano.

| Tipo | Nombre | Valor |
|---|---|---|
| A | `mail` | `IP-DEL-SERVIDOR` |
| MX | `@` | `mail.maqserv24.com` (prioridad 0) |
| TXT | `@` | el SPF que da Email Deliverability |
| TXT | `default._domainkey` | el DKIM que da Email Deliverability |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:contacto@maqserv24.com` |

> **Ojo antes de tocar el MX:** si el dominio ya recibe correo en otro lado
> (Google Workspace, Outlook), cambiar el MX **lo corta**. Revisa qué MX tiene
> hoy en GoDaddy antes de reemplazarlo.

Sin SPF y DKIM bien puestos, Gmail y Outlook mandan todo a spam o lo rechazan.

### Encender el envío de la plataforma

Crea un buzón dedicado (p. ej. `avisos@maqserv24.com`) y agrega a la app **api**:

| Variable | Valor |
|---|---|
| `MAIL_ENABLED` | `true` — freno explícito; sin esto nada sale |
| `SMTP_HOST` | `mail.maqserv24.com` |
| `SMTP_PORT` | `465` (el código usa TLS implícito en 465 y STARTTLS en 587) |
| `SMTP_USER` | `avisos@maqserv24.com` — la dirección **completa**, no solo el nombre |
| `SMTP_PASS` | la contraseña del buzón |
| `MAIL_FROM` | `avisos@maqserv24.com` |
| `MAIL_FROM_NAME` | `MAQSER24` |

Restart, y comprueba en el panel admin → **Correo**: te dice si está configurado,
si está encendido, y deja mandar una prueba. Cada intento queda en `email_log`
con su estado real (`enviado` / `fallido` / `simulado`).

> **Lo que no te va a gustar:** este servidor es compartido y su IP la usan
> muchas cuentas. Si alguna manda spam, la reputación es de todos. Para avisos
> internos da igual; para correo que el cliente **tiene que** recibir
> (confirmación de pedido, pago), un servicio dedicado tipo Resend o Brevo
> entrega bastante mejor — y se configura en estas mismas variables SMTP, solo
> cambiando host, usuario y contraseña.

---

## Verificación final

```bash
curl -s https://api.maqserv24.com/health          # {"status":"ok",...}
curl -sI https://maqserv24.com | head -1          # HTTP/2 200
curl -sI https://admin.maqserv24.com | head -1    # HTTP/2 200
```

Y a mano, que es donde salen los fallos de verdad:

- La tienda carga **con estilos e imágenes** (si se ve sin CSS, faltó
  `.next/static`; si fallan solo las imágenes, es `sharp`).
- Un producto abre y se agrega al carrito.
- Entras al panel con tu cuenta.
- Una imagen del catálogo carga (eso prueba Supabase Storage).

Si una app no levanta: cPanel → Setup Node.js App → el log de errores de esa
aplicación. Casi siempre es una variable de entorno que falta.

---

## Qué cambia respecto a Vercel + Render

Vale la pena saberlo antes, no después:

- **Se acaba el despliegue automático.** Hoy un `git push` actualiza la web sola.
  Aquí cada cambio es: compilar → comprimir → subir → *Restart*. Son unos 15 min.
- **Se acaba el CDN.** Vercel servía desde el nodo más cercano al visitante; ahora
  todo sale de un servidor. Fuera de su región, el sitio se sentirá más lento.
- **Se acaba el escalado.** Un pico de tráfico ya no reparte carga: si el servidor
  se satura, se cae.
- **Ganas** un solo lugar que administrar, un solo costo, y **se acaba la siesta
  del plan free de Render** (esos ~30-50 s de la primera petición, que también
  hacían fallar webhooks de MercadoPago).
