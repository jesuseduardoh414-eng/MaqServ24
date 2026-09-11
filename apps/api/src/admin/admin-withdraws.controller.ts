import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Query, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { WITHDRAW_STATES, type WithdrawState } from '@maqserv/types';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Marketplace → Retiros: pagarle a los vendedores.
 *
 * El dinero YA se le descontó al vendedor cuando lo pidió (`POST /vendor/withdraws`
 * descuenta `current_balance` en la misma transacción, para que no pueda pedir dos
 * veces lo mismo). Así que aquí solo hay dos salidas:
 *   · `completed` = ya le transferiste  → el saldo se queda descontado.
 *   · `rejected`  = no procede          → se le REGRESA el saldo.
 * Por eso rechazar mueve dinero real y no puede ejecutarse dos veces.
 */
const STATES = Object.keys(WITHDRAW_STATES) as WithdrawState[];
const PAGE_SIZE = 20;

@Modulo('marketplace')
@Controller('admin/withdraws')
@UseGuards(AdminGuard)
export class AdminWithdrawsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@Query('state') state?: string, @Query('page') page?: string) {
    const st = STATES.includes(state as WithdrawState) ? (state as WithdrawState) : null;
    const where = st ? { status: st } : {};
    const p = Math.max(1, Number(page ?? 1) || 1);

    const [total, rows, byState, pendingSum] = await Promise.all([
      prisma.withdraws.count({ where }),
      // Antes traía 100 sin paginar: los retiros viejos desaparecían en silencio.
      prisma.withdraws.findMany({ where, orderBy: { id: 'desc' }, skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.withdraws.groupBy({ by: ['status'], _count: { _all: true } }),
      // Lo que de verdad importa de esta pantalla: cuánto dinero está esperando salir.
      prisma.withdraws.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
    ]);

    const counts: Record<string, number> = { all: 0 };
    for (const r of byState) {
      counts[r.status] = r._count._all;
      counts.all += r._count._all;
    }

    const ids = [...new Set(rows.map((w) => w.user_id).filter((v): v is number => v !== null))];
    const users = ids.length
      ? await prisma.users.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, shop_name: true, current_balance: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts,
      pendingAmount: pendingSum._sum.amount ?? 0,
      items: rows.map((w) => {
        const u = w.user_id ? byId.get(w.user_id) : null;
        return {
          id: w.id,
          vendorId: w.user_id,
          vendor: u ? u.shop_name ?? u.name : w.user_id ? `#${w.user_id}` : null,
          vendorBalance: u?.current_balance ?? null,
          amount: w.amount ?? 0,
          method: w.method,
          // Aquí es donde el vendedor pone su CLABE: es el dato con el que le pagas.
          reference: w.reference,
          status: w.status,
          note: w.admin_note,
          createdAt: w.created_at ? w.created_at.toISOString() : null,
        };
      }),
    };
  }

  /** `completed` = pagado; `rejected` = reembolsa el saldo descontado al solicitar. */
  @Patch(':id')
  async update(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const schema = z.object({
      status: z.enum(['completed', 'rejected']),
      note: z.string().trim().max(500).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('status debe ser completed o rejected');
    const { status, note } = parsed.data;

    const w = await prisma.withdraws.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Retiro no encontrado');
    if (w.status !== 'pending') throw new BadRequestException('El retiro ya fue procesado');

    /**
     * Esto mueve dinero: la marca y el reembolso van en UNA transacción, y el
     * `status: 'pending'` del where es el candado. Antes era leer-y-luego-escribir:
     * dos admins haciendo clic a la vez (Pagado y Rechazar) pasaban ambos la
     * comprobación → se marcaba pagado Y se reembolsaba el saldo. Con `updateMany`
     * condicionado, el segundo encuentra `count: 0` y la transacción se revierte.
     */
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.withdraws.updateMany({
        where: { id, status: 'pending' },
        data: { status, admin_note: note || null, updated_at: new Date() },
      });
      if (claimed.count === 0) throw new BadRequestException('El retiro ya fue procesado');

      if (status === 'rejected' && w.user_id && w.amount) {
        await tx.users.update({
          where: { id: w.user_id },
          data: { current_balance: { increment: Math.round(w.amount) } },
        });
      }
    });

    // El vendedor nunca se enteraba de qué pasó con su dinero.
    const money = `$${(w.amount ?? 0).toLocaleString('es-MX')}`;
    await this.notifications.push({
      userId: w.user_id,
      type: 'withdraw',
      title: status === 'completed' ? `Te pagamos tu retiro de ${money}` : `Rechazamos tu retiro de ${money}`,
      body: status === 'completed'
        ? note || 'Ya salió la transferencia. Revisa tu cuenta.'
        : note || 'Te regresamos el monto a tu saldo disponible.',
      link: '/vendedor/retiros',
    });

    // Dinero que sale: de las acciones del panel, la que más merece nombre y fecha.
    await registrarAccion(
      req,
      'marketplace',
      status === 'completed' ? 'pagar retiro' : 'rechazar retiro',
      `retiro ${id} · ${money}`,
      note ?? null,
    );
    return { ok: true };
  }
}
