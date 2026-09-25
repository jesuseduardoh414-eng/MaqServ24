import { Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { puedeVerCon, type ModuloAdmin, type PermisosOverride, type RolAdmin } from '@maqserv/config';

/**
 * AVISOS DEL PANEL (2026-09-25).
 *
 * "¿Cómo puedo saber dentro del sistema que ya me cotizaron? Pon
 * notificaciones en tiempo real." Hasta hoy MAQSER24 se enteraba por correo:
 * el panel no avisaba de nada y los contadores del menú solo cambiaban al
 * navegar.
 *
 * Van en la misma tabla `notifications` que los avisos al cliente, pero sin
 * `user_id` (no son de un cliente) y con `type = "panel:<módulo>:<evento>"`.
 * Así no hace falta SQL, la campana del cliente nunca los ve (filtra por su
 * `user_id`) y cada administrador ve solo los de los módulos que su rol puede
 * abrir. El "leído" es del equipo: si alguien ya atendió la solicitud, al
 * resto se le apaga.
 */

const PREFIJO = 'panel:';
const LIMITE = 30;
const log = new Logger('AvisosPanel');

export type EventoPanel = 'avance' | 'solicitud' | 'respuesta_aliado' | 'oferta_aliado' | 'mensaje' | 'cotizacion';

export interface AvisoPanel {
  id: number;
  modulo: string;
  evento: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string | null;
}

/** Nunca lanza: un aviso que falla no debe tumbar la solicitud que lo originó. */
export async function avisarPanel(input: {
  modulo: ModuloAdmin;
  evento: EventoPanel;
  titulo: string;
  cuerpo?: string | null;
  link?: string | null;
}): Promise<void> {
  try {
    const ahora = new Date();
    await prisma.notifications.create({
      data: {
        user_id: null,
        type: `${PREFIJO}${input.modulo}:${input.evento}`.slice(0, 40),
        title: input.titulo.slice(0, 160),
        body: input.cuerpo?.slice(0, 2000) ?? null,
        link: input.link?.slice(0, 200) ?? null,
        is_read: false,
        created_at: ahora,
        updated_at: ahora,
      },
    });
  } catch (err) {
    log.warn(`No se pudo crear el aviso del panel (${input.evento}): ${(err as Error).message}`);
  }
}

/** Filtro de los avisos que este rol puede ver (por módulo). */
function dondePuede(rol: RolAdmin, permisos: PermisosOverride) {
  const modulos = ['servicios', 'cotizaciones', 'proveedores', 'comunidad'] as ModuloAdmin[];
  const suyos = modulos.filter((m) => puedeVerCon(rol, m, permisos));
  return {
    user_id: null,
    OR: suyos.length ? suyos.map((m) => ({ type: { startsWith: `${PREFIJO}${m}:` } })) : [{ id: -1 }],
  };
}

export async function avisosDelPanel(
  rol: RolAdmin,
  permisos: PermisosOverride,
  despuesDe?: number,
): Promise<{ items: AvisoPanel[]; unread: number; ultimo: number }> {
  const where = dondePuede(rol, permisos);
  const [rows, unread, ultimo] = await Promise.all([
    prisma.notifications.findMany({
      where: despuesDe ? { ...where, id: { gt: despuesDe } } : where,
      orderBy: { id: 'desc' },
      take: LIMITE,
      select: { id: true, type: true, title: true, body: true, link: true, is_read: true, created_at: true },
    }),
    prisma.notifications.count({ where: { ...where, is_read: false } }),
    prisma.notifications.findFirst({ where, orderBy: { id: 'desc' }, select: { id: true } }),
  ]);
  return {
    items: rows.map((r) => {
      const [, modulo = '', evento = ''] = (r.type ?? '').split(':');
      return {
        id: r.id,
        modulo,
        evento,
        title: r.title ?? '',
        body: r.body,
        link: r.link,
        isRead: r.is_read,
        createdAt: r.created_at ? r.created_at.toISOString() : null,
      };
    }),
    unread,
    ultimo: ultimo?.id ?? 0,
  };
}

/** Sin `id` marca como leídos todos los que este rol ve. */
export async function marcarAvisosPanel(rol: RolAdmin, permisos: PermisosOverride, id?: number): Promise<{ unread: number }> {
  const where = dondePuede(rol, permisos);
  await prisma.notifications.updateMany({
    where: { ...where, is_read: false, ...(id ? { id } : {}) },
    data: { is_read: true, updated_at: new Date() },
  });
  return { unread: await prisma.notifications.count({ where: { ...where, is_read: false } }) };
}
