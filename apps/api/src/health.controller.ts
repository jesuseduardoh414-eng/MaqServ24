import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { prisma } from '@maqserv/db';

/**
 * Health check que TOCA la base de datos.
 *
 * Antes devolvía `ok` sin verificar nada y Render lo veía verde con el
 * proyecto Supabase PAUSADO (todo endpoint real daba 500) — el incidente costó
 * una sesión entera de diagnóstico. Ahora un `SELECT 1` con tope corto lo
 * delata al primer vistazo: `db: "unreachable"` = Supabase pausado/caído, no
 * un bug del código.
 *
 * El HTTP sigue siendo 200 A PROPÓSITO: es el `healthCheckPath` de Render y un
 * 5xx aquí pondría al servicio en bucle de reinicios (y bloquearía deploys)
 * por una caída de la BD que Render no puede arreglar. El diagnóstico va en el
 * BODY; quien consulte /health ve la verdad.
 */
@Controller('health')
export class HealthController {
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 5_000)),
      ]);
      return { status: 'ok', db: 'ok', ts: new Date().toISOString() };
    } catch {
      return {
        status: 'degraded',
        db: 'unreachable',
        hint: 'Revisa si el proyecto Supabase está pausado (NXDOMAIN del subdominio).',
        ts: new Date().toISOString(),
      };
    }
  }
}
