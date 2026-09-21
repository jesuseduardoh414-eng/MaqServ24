/**
 * Hilos de libuv: 2 en vez de los 4 por defecto. Va ANTES de cualquier import
 * porque Node crea el grupo de hilos la primera vez que alguien lo usa y ya no
 * lo cambia. Esta API casi no lo toca (Prisma hace su propia E/S; bcryptjs es
 * JavaScript puro), así que sobran. Y en la jaula de CloudLinux cada hilo cuenta
 * como un proceso: con tres apps Node en 100 ranuras, cada uno pesa.
 * Se respeta si el entorno ya lo fijó.
 */
process.env.UV_THREADPOOL_SIZE ??= '2';
/**
 * Hilos del motor de Prisma (Rust/Tokio): por defecto abre UNO POR NÚCLEO del
 * servidor. En un hosting compartido de muchos núcleos son decenas de hilos
 * parados, y en la jaula de CloudLinux cada uno ocupa una ranura de NPROC.
 * Tokio lee esta variable al crear su runtime; tiene que estar puesta antes de
 * que se cargue la librería del motor (es decir, antes de cualquier import).
 * Medido el 2026-09-21: 53/100 ranuras con solo api y web en reposo.
 */
process.env.TOKIO_WORKER_THREADS ??= '2';

import 'reflect-metadata';
import { join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mediaDir } from './common/media';
import { TrimPipe } from './common/trim.pipe';
import { AppModule } from './app.module';

/**
 * Variables de `apps/api/.env`, si existe.
 *
 * Hasta ahora llegaban DE REBOTE: las cargaba Prisma desde `packages/db/.env`
 * al crear su cliente, y de paso quedaban en `process.env` para toda la API.
 * Funcionaba, pero convertía el .env del paquete de base de datos en el cajón
 * de todo —y hacía que seguir `apps/api/.env.example`, que es lo que cualquiera
 * haría, no sirviera de nada: el archivo quedaba ahí sin que nadie lo leyera.
 *
 * En producción (cPanel, Render) no hay archivo y las variables vienen del
 * entorno: por eso el fallo es silencioso a propósito.
 */
function cargarEnvLocal(): void {
  // Dos candidatos: junto al compilado (dist/../.env) y junto a donde se lanzó
  // el proceso. Con turbo/nest --watch no siempre coinciden.
  for (const ruta of [join(__dirname, '..', '.env'), resolve(process.cwd(), '.env')]) {
    try {
      process.loadEnvFile(ruta);
      console.log(`Variables locales cargadas de ${ruta}`);
      return;
    } catch {
      /* siguiente candidato */
    }
  }
}

async function bootstrap() {
  cargarEnvLocal();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  // Render/Vercel meten la petición por su balanceador: sin esto `req.ip` sería la IP
  // del balanceador y el límite por IP no distinguiría a nadie. `1` = un solo salto
  // de confianza (el de la plataforma), que es la topología real; confiar en toda la
  // cadena dejaría que cualquiera se inventara su IP con un X-Forwarded-For.
  app.set('trust proxy', 1);

  // Cabeceras de seguridad. La API devuelve JSON y además sirve `/media/`: lo que
  // más pesa aquí es `nosniff` (que el navegador no adivine el tipo de un archivo
  // subido y lo ejecute como HTML). CSP va apagado: no servimos páginas.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  /**
   * Orígenes permitidos por CORS. En prod se pasan por CORS_ORIGINS (coma-separado:
   * dominios de la tienda y del admin en Vercel).
   *
   * Antes, si CORS_ORIGINS faltaba en producción, esto caía EN SILENCIO a un regex de
   * localhost sin anclar (`/localhost:\d+$/` acepta `http://evil-localhost:3000`).
   * Un fallo de configuración no debe degradar la seguridad sin avisar: en producción
   * revienta el arranque, que es ruidoso y se arregla en 1 minuto.
   */
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isProd && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS es obligatorio en producción (dominios de web y admin separados por coma)');
  }
  app.enableCors({ origin: corsOrigins.length > 0 ? corsOrigins : [/^http:\/\/localhost:\d+$/] });

  // Espacios de los extremos fuera, en TODO lo que entra (ver trim.pipe.ts):
  // una contraseña pegada con un espacio al final no puede parecer incorrecta.
  app.useGlobalPipes(new TrimPipe());

  // Archivos subidos (MEDIA_DIR). En cPanel los sirve Apache desde el subdominio
  // media.* y esta ruta no se usa; en local y como respaldo, la API los sirve aquí.
  // `maxAge`: son inmutables (el nombre lleva timestamp), que el navegador los guarde.
  app.useStaticAssets(mediaDir(), { prefix: '/media/', maxAge: '7d', index: false });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API escuchando en el puerto ${port}`);
}

bootstrap();
