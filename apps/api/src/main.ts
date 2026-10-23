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
import { ZodErrorFilter } from './common/zod-filter';
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
  // subido y lo ejecute como HTML). CSP "nada de nada" (auditoría 2026-10-23): no
  // servimos páginas, así que si alguna respuesta llegara a abrirse como HTML no
  // ejecuta scripts ni se deja enmarcar. No afecta a <img>/<video> de otros dominios.
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Sin PROXY_SECRET, cualquiera que llame directo a la API puede inventarse
  // `x-client-ip` en cada petición y saltarse TODOS los límites por IP (login,
  // contacto, cotizar). Se dice al arrancar, no solo con la primera visita.
  if (isProd && !process.env.PROXY_SECRET?.trim()) {
    console.error('SEGURIDAD: falta PROXY_SECRET en producción; los límites por IP se pueden evadir. Configúralo en api, web y admin.');
  }
  // Las sesiones (AUTH_SECRET) y los enlaces que se reparten afuera
  // (PROVIDER_LINK_SECRET: aliado, operador, aceptar, reseña) deben firmarse con
  // llaves DISTINTAS y largas: si caen a la misma JWT_SECRET, cada enlace que
  // sale por correo es una muestra de la llave que firma las sesiones del panel.
  // Se avisa y no se detiene el arranque: tumbar la API por esto sería peor.
  if (isProd) {
    const sesiones = process.env.AUTH_SECRET ?? process.env.JWT_SECRET ?? '';
    const enlaces = process.env.PROVIDER_LINK_SECRET ?? process.env.JWT_SECRET ?? '';
    if (!process.env.AUTH_SECRET || !process.env.PROVIDER_LINK_SECRET || sesiones === enlaces || sesiones.length < 32 || enlaces.length < 32) {
      console.error('SEGURIDAD: AUTH_SECRET y PROVIDER_LINK_SECRET deben existir, ser distintas y tener 32+ caracteres cada una.');
    }
  }

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
  app.useGlobalFilters(new ZodErrorFilter());

  // Archivos subidos (MEDIA_DIR). En cPanel los sirve Apache desde el subdominio
  // media.* y esta ruta no se usa; en local y como respaldo, la API los sirve aquí.
  // `maxAge`: son inmutables (el nombre lleva timestamp), que el navegador los guarde.
  app.useStaticAssets(mediaDir(), {
    prefix: '/media/',
    maxAge: '7d',
    index: false,
    // Lo que no es imagen se DESCARGA, nunca se abre en el navegador: un .html
    // o .svg subido antes del arreglo de extensiones no puede ejecutar nada
    // bajo nuestro dominio (QA 2026-09-25).
    setHeaders: (res, ruta) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Los videos de categoría (mp4/webm) se sirven en línea como las fotos:
      // se reproducen dentro de un <video> y no ejecutan nada.
      if (!/\.(png|jpe?g|webp|avif|gif|ico|mp4|webm)$/i.test(ruta)) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      }
    },
  });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API escuchando en el puerto ${port}`);
}

/**
 * Una promesa rechazada que nadie atrapó (un aviso en segundo plano, un `void`
 * que falla) tumba el proceso en Node ≥ 15. Con la API como una sola instancia,
 * eso es una caída para todos provocable desde fuera si alguna ruta la dispara.
 * Se registra y se sigue; un error síncrono no atrapado sí deja caer el proceso
 * (el estado ya no es confiable) y Passenger lo levanta.
 */
process.on('unhandledRejection', (motivo) => {
  console.error('Promesa rechazada sin atrapar:', motivo instanceof Error ? motivo.stack : motivo);
});

bootstrap();
