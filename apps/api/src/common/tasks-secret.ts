import { createHash, timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';

/**
 * ¿`dado` es el secreto? En tiempo constante: con `!==` la respuesta tarda un
 * poco más cuantos más caracteres del principio coinciden, y eso se puede
 * medir para adivinarlo por partes. Se comparan huellas de igual largo para
 * que tampoco se filtre la longitud.
 */
export function mismoSecreto(dado: string | undefined | null, esperado: string): boolean {
  if (typeof dado !== 'string') return false;
  const a = createHash('sha256').update(dado).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

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
  if (!mismoSecreto(dado, esperado)) throw new ForbiddenException('Secreto inválido.');
}
