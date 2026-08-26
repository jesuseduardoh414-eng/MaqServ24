import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';

/** Al agregar un tipo, darle ícono en `NotificationsBell` (si no, sale sin ícono). */
export type NotificationType =
  | 'quote_answered' | 'order_status' | 'payment_confirmed' | 'question_answered'
  /** Avance del servicio despues de aceptar la cotizacion. */
  | 'service_status'
  /** Retiro pagado o rechazado (vendedor). */
  | 'withdraw';

export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string | null;
}

const LIST_LIMIT = 30;

/**
 * Avisos al cliente (campana del sitio). Escribe en `notifications`, que ya venía
 * con RLS por usuario (`notif_own_select`) y en la publicación de Supabase Realtime,
 * así que el INSERT llega solo al dueño y sin recargar.
 *
 * Las filas legacy (2021) no tienen `type` ni `user_id`: se filtran en `list()`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Nunca lanza: un aviso que falla no debe tumbar el pago, la orden ni la
   * respuesta del admin. Solo se registra en el log.
   */
  async push(input: {
    userId: number | null | undefined;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    orderId?: number | null;
    productId?: number | null;
  }): Promise<void> {
    if (!input.userId) return; // invitado: no hay a quién avisarle
    try {
      const now = new Date();
      await prisma.notifications.create({
        data: {
          user_id: input.userId,
          type: input.type,
          title: input.title.slice(0, 160),
          body: input.body?.slice(0, 2000) ?? null,
          link: input.link?.slice(0, 200) ?? null,
          order_id: input.orderId ?? null,
          product_id: input.productId ?? null,
          is_read: false,
          created_at: now,
          updated_at: now,
        },
      });
    } catch (err) {
      this.logger.warn(`No se pudo crear el aviso (${input.type}): ${(err as Error).message}`);
    }
  }

  async list(userId: number): Promise<{ items: NotificationDto[]; unread: number }> {
    const where = { user_id: userId, type: { not: null } }; // `type: null` = filas legacy
    const [rows, unread] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: { id: 'desc' },
        take: LIST_LIMIT,
        select: { id: true, type: true, title: true, body: true, link: true, is_read: true, created_at: true },
      }),
      prisma.notifications.count({ where: { ...where, is_read: false } }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type ?? '',
        title: r.title ?? '',
        body: r.body,
        link: r.link,
        isRead: r.is_read,
        createdAt: r.created_at ? r.created_at.toISOString() : null,
      })),
      unread,
    };
  }

  /** Sin `id` marca todas como leídas. El `user_id` del where evita marcar ajenas. */
  async markRead(userId: number, id?: number): Promise<{ unread: number }> {
    await prisma.notifications.updateMany({
      where: { user_id: userId, type: { not: null }, is_read: false, ...(id ? { id } : {}) },
      data: { is_read: true, updated_at: new Date() },
    });
    const unread = await prisma.notifications.count({
      where: { user_id: userId, type: { not: null }, is_read: false },
    });
    return { unread };
  }
}
