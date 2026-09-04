import { ForbiddenException } from '@nestjs/common';

/**
 * Guardia compartida de las rutas de TAREAS PROGRAMADAS (/tareas/*).
 *
 * - Sin `TASKS_SECRET` configurado (o menor a 16 chars), las rutas NO existen:
 *   nada de defaults para endpoints que disparan correos o cancelan órdenes.
 * - El secreto se acepta de preferencia por la cabecera `x-tasks-secret` (un
 *   query string queda en logs de acceso/proxies); `?secret=` se conserva por
 *   compatibilidad con crons ya configurados.
 */
export function comprobarTasksSecret(query: string | undefined, header: string | undefined): void {
  const esperado = process.env.TASKS_SECRET;
  if (!esperado || esperado.length < 16) {
    throw new ForbiddenException('Las tareas programadas no están habilitadas.');
  }
  const dado = header ?? query;
  if (dado !== esperado) throw new ForbiddenException('Secreto inválido.');
}
