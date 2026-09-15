import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { prisma } from '@maqserv/db';

/**
 * Health check que TOCA la base de datos.
 *
 * Antes devolvía `ok` sin verificar nada, y el servicio se veía verde con la
 * base caída (todo endpoint real daba 500) — el incidente costó una sesión
 * entera de diagnóstico. Ahora un `SELECT 1` con tope corto lo delata al primer
 * vistazo: `db: "unreachable"` = problema de conexión, no un bug del código.
 *
 * El HTTP sigue siendo 200 A PROPÓSITO: es el health check de la plataforma y
 * un 5xx aquí pondría al servicio en bucle de reinicios por una caída de la BD
 * que no puede arreglar. El diagnóstico va en el BODY; quien consulte /health
 * ve la verdad.
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
    } catch (err) {
      /**
       * El motivo real, recortado. Sin esto, "unreachable" tapaba por igual una
       * contraseña mal escrita, un usuario sin permisos y un servidor caído; se
       * pierden horas adivinando. Prisma nombra el problema (P1000 credenciales,
       * P1001 no responde, P1003 la base no existe) y con eso se va directo al
       * arreglo.
       *
       * Ojo con la contraseña en `DATABASE_URL`: si trae `@`, `#`, `/`, `:` o
       * `?` hay que escribirla percent-encoded, o la URL se parte y esto falla
       * como si las credenciales estuvieran mal.
       */
      const motivo = (err as Error)?.message?.split('\n')[0]?.slice(0, 200) ?? 'sin detalle';
      return {
        status: 'degraded',
        db: 'unreachable',
        hint: 'Revisa DATABASE_URL: host, usuario, contraseña (percent-encoded) y que el usuario tenga permisos sobre la base.',
        motivo,
        ts: new Date().toISOString(),
      };
    }
  }
}
