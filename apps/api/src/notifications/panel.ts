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
 * abrir. El "leído" es de cada administrador (2026-10-05, ver más abajo).
 */

const PREFIJO = 'panel:';
const LIMITE = 30;
const log = new Logger('AvisosPanel');

export type EventoPanel = 'avance' | 'solicitud' | 'respuesta_aliado' | 'oferta_aliado' | 'mensaje' | 'cotizacion' | 'registro_proveedor';

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

/**
 * "LEÍDO" DE CADA ADMINISTRADOR (2026-10-05).
 *
 * Antes el leído era del equipo: si Operaciones abría un aviso, a Dirección se
 * le apagaba aunque nunca lo hubiera visto. Ahora cada quien lleva el suyo.
 *
 * Sin tabla nueva (no hay que correr SQL en phpMyAdmin): un renglón de control
 * por administrador en la misma `notifications`, `user_id NULL` y
 * `type = "panel-leido:<adminId>"` —no empieza con "panel:<módulo>:", así que
 * ningún filtro de avisos lo ve, y la campana del cliente filtra por su
 * `user_id`—. Guarda "leídos hasta el aviso N" más los sueltos que marcó por
 * encima de N; "Marcar todos" sube N y vacía la lista, así nunca crece.
 *
 * La primera vez se arranca desde el leído del equipo que ya existía: lo que
 * el equipo ya atendió no le vuelve a salir como nuevo a nadie.
 */
const MARCA = 'panel-leido:';
const MAX_SUELTOS = 300;

interface Leido { hasta: number; ids: number[] }

async function leerMarca(adminId: number, where: ReturnType<typeof dondePuede>): Promise<{ rowId: number | null; leido: Leido }> {
  const row = await prisma.notifications.findFirst({
    where: { user_id: null, type: `${MARCA}${adminId}` },
    orderBy: { id: 'asc' },
    select: { id: true, body: true },
  });
  if (row) {
    try {
      const d = JSON.parse(row.body ?? '{}') as Partial<Leido>;
      return { rowId: row.id, leido: { hasta: Number(d.hasta) || 0, ids: Array.isArray(d.ids) ? d.ids.filter(Number.isInteger) : [] } };
    } catch {
      return { rowId: row.id, leido: { hasta: 0, ids: [] } };
    }
  }
  // Sin marca todavía: lo que el equipo ya dio por leído cuenta como leído.
  const leidoEquipo = await prisma.notifications.findFirst({
    where: { ...where, is_read: true },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  return { rowId: null, leido: { hasta: leidoEquipo?.id ?? 0, ids: [] } };
}

async function guardarMarca(adminId: number, rowId: number | null, leido: Leido): Promise<void> {
  const ids = [...new Set(leido.ids.filter((i) => i > leido.hasta))].sort((a, b) => b - a).slice(0, MAX_SUELTOS);
  const body = JSON.stringify({ hasta: leido.hasta, ids });
  const ahora = new Date();
  if (rowId) {
    await prisma.notifications.update({ where: { id: rowId }, data: { body, updated_at: ahora } });
  } else {
    await prisma.notifications.create({
      data: { user_id: null, type: `${MARCA}${adminId}`, title: 'Control de avisos leídos', body, is_read: true, created_at: ahora, updated_at: ahora },
    });
  }
}

/** Avisos que este admin no ha leído: por encima de su marca y fuera de sus sueltos. */
function noLeidos(where: ReturnType<typeof dondePuede>, leido: Leido) {
  return { ...where, id: { gt: leido.hasta, ...(leido.ids.length ? { notIn: leido.ids } : {}) } };
}

export async function avisosDelPanel(
  adminId: number,
  rol: RolAdmin,
  permisos: PermisosOverride,
  despuesDe?: number,
): Promise<{ items: AvisoPanel[]; unread: number; ultimo: number }> {
  const where = dondePuede(rol, permisos);
  const [rows, { leido }, ultimo] = await Promise.all([
    prisma.notifications.findMany({
      where: despuesDe ? { ...where, id: { gt: despuesDe } } : where,
      orderBy: { id: 'desc' },
      // Al consultar lo nuevo se traen más: si se juntaron más de 30 entre dos vueltas no se pierde ninguno (QA 2026-09-28).
      take: despuesDe ? 200 : LIMITE,
      select: { id: true, type: true, title: true, body: true, link: true, created_at: true },
    }),
    leerMarca(adminId, where),
    prisma.notifications.findFirst({ where, orderBy: { id: 'desc' }, select: { id: true } }),
  ]);
  const sueltos = new Set(leido.ids);
  const unread = await prisma.notifications.count({ where: noLeidos(where, leido) });
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
        isRead: r.id <= leido.hasta || sueltos.has(r.id),
        createdAt: r.created_at ? r.created_at.toISOString() : null,
      };
    }),
    unread,
    ultimo: ultimo?.id ?? 0,
  };
}

/** Sin `id` marca como leídos todos los que este admin ve. Sólo para él. */
export async function marcarAvisosPanel(adminId: number, rol: RolAdmin, permisos: PermisosOverride, id?: number): Promise<{ unread: number }> {
  const where = dondePuede(rol, permisos);
  const { rowId, leido } = await leerMarca(adminId, where);
  if (id) {
    // Sólo ids de avisos que este rol puede ver: nada de marcar ajenos.
    const existe = await prisma.notifications.findFirst({ where: { ...where, id }, select: { id: true } });
    if (existe && id > leido.hasta) leido.ids.push(id);
  } else {
    const ultimo = await prisma.notifications.findFirst({ where, orderBy: { id: 'desc' }, select: { id: true } });
    leido.hasta = Math.max(leido.hasta, ultimo?.id ?? 0);
    leido.ids = [];
  }
  await guardarMarca(adminId, rowId, leido);
  return { unread: await prisma.notifications.count({ where: noLeidos(where, leido) }) };
}
