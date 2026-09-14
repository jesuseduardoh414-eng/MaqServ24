import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mediaDir } from './common/media';
import { AppModule } from './app.module';

async function bootstrap() {
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

  // Archivos subidos (MEDIA_DIR). En cPanel los sirve Apache desde el subdominio
  // media.* y esta ruta no se usa; en local y como respaldo, la API los sirve aquí.
  // `maxAge`: son inmutables (el nombre lleva timestamp), que el navegador los guarde.
  app.useStaticAssets(mediaDir(), { prefix: '/media/', maxAge: '7d', index: false });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API escuchando en el puerto ${port}`);
}

bootstrap();
