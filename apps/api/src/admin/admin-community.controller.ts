import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Query, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import { AdminGuard, Modulo } from './admin-auth';
import { NotificationsService } from '../notifications/notifications.service';

/** Comunidad: reseñas del sitio, comentarios y preguntas de producto. */
@Modulo('comunidad')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminCommunityController {
  constructor(private readonly notifications: NotificationsService) {}

  // ---- Usuarios ----

  // Clientes: ver `admin-customers.controller.ts`. Vivían aquí, pero no son
  // "comunidad" y la búsqueda distinguía mayúsculas (faltaba el filtro sin mayúsculas; en MySQL la colación utf8mb4_unicode_ci ya lo hace).

  // ---- Reseñas del sitio (status 0 = pendiente de aprobación) ----

  @Get('site-reviews')
  async siteReviews() {
    const rows = await prisma.site_reviews.findMany({ orderBy: { id: 'desc' }, take: 100 });
    const users = await prisma.users.findMany({
      where: { id: { in: rows.map((r) => r.user_id) } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: Number(r.id),
      author: names.get(r.user_id) ?? `#${r.user_id}`,
      rating: r.rating,
      review: r.review,
      status: r.status, // 0 pendiente, 1 aprobada
      createdAt: r.created_at ? r.created_at.toISOString() : null,
    }));
  }

  @Patch('site-reviews/:id')
  async updateSiteReview(@Param('id', ParseIntPipe) id: number, @Body() body: { status?: number }) {
    const status = Number(body?.status);
    if (![0, 1].includes(status)) throw new BadRequestException('status debe ser 0 o 1');
    await prisma.site_reviews.update({ where: { id }, data: { status, updated_at: new Date() } });
    return { ok: true };
  }

  @Delete('site-reviews/:id')
  async deleteSiteReview(@Param('id', ParseIntPipe) id: number) {
    await prisma.site_reviews.delete({ where: { id } });
    return { ok: true };
  }

  // Administradores: ver `admin-admins.controller.ts`. Se separó porque crear un
  // admin exige TAMBIÉN el usuario de Supabase Auth: aquí solo se creaba la fila y
  // el administrador nuevo NO podía entrar.

  // Suscriptores: ver `admin-subscribers.controller.ts` (lista + exportar + sync a
  // Perfex, que era un endpoint sin botón en ningún lado).

  // ---- Comentarios de producto ----

  @Get('comments')
  async comments() {
    const rows = await prisma.comments.findMany({ orderBy: { id: 'desc' }, take: 100 });
    const [users, products] = await Promise.all([
      prisma.users.findMany({
        where: { id: { in: rows.map((r) => r.user_id) } },
        select: { id: true, name: true },
      }),
      prisma.products.findMany({
        where: { id: { in: rows.map((r) => r.product_id) } },
        select: { id: true, name: true },
      }),
    ]);
    const names = new Map(users.map((u) => [u.id, u.name]));
    const prods = new Map(products.map((p) => [p.id, p.name]));
    return rows.map((c) => ({
      id: c.id,
      author: names.get(c.user_id) ?? `#${c.user_id}`,
      product: prods.get(c.product_id) ?? `#${c.product_id}`,
      rating: c.rating ?? 5,
      text: c.text,
      status: c.status, // 1 visible/aprobada, 0 oculta
      verified: c.order_id != null, // proviene de una compra
      createdAt: c.created_at ? c.created_at.toISOString() : null,
    }));
  }

  @Patch('comments/:id')
  async updateComment(@Param('id', ParseIntPipe) id: number, @Body() body: { status?: number }) {
    const status = Number(body?.status);
    if (![0, 1].includes(status)) throw new BadRequestException('status debe ser 0 o 1');
    await prisma.comments.update({ where: { id }, data: { status, updated_at: new Date() } });
    return { ok: true };
  }

  @Delete('comments/:id')
  async deleteComment(@Param('id', ParseIntPipe) id: number) {
    await prisma.comments.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Preguntas de producto (tipo MercadoLibre) ----

  @Get('questions')
  async questions() {
    const rows = await prisma.product_questions.findMany({ orderBy: { id: 'desc' }, take: 200 });
    const [users, products] = await Promise.all([
      prisma.users.findMany({ where: { id: { in: rows.map((r) => r.user_id) } }, select: { id: true, name: true } }),
      prisma.products.findMany({ where: { id: { in: rows.map((r) => r.product_id) } }, select: { id: true, name: true } }),
    ]);
    const names = new Map(users.map((u) => [u.id, u.name]));
    const prods = new Map(products.map((p) => [p.id, p.name]));
    return rows.map((q) => ({
      id: q.id,
      author: names.get(q.user_id) ?? `#${q.user_id}`,
      product: prods.get(q.product_id) ?? `#${q.product_id}`,
      productId: q.product_id,
      question: q.question,
      answer: q.answer,
      answered: q.answer != null,
      status: q.status,
      featured: q.featured === 1,
      createdAt: q.created_at ? q.created_at.toISOString() : null,
    }));
  }

  @Patch('questions/:id')
  async answerQuestion(@Param('id', ParseIntPipe) id: number, @Body() body: { answer?: string; status?: number; featured?: number }) {
    const data: { answer?: string | null; answered_at?: Date | null; status?: number; featured?: number; updated_at: Date } = { updated_at: new Date() };
    if (typeof body?.answer === 'string') {
      const a = body.answer.trim();
      data.answer = a || null;
      data.answered_at = a ? new Date() : null;
      if (!a) data.featured = 0; // sin respuesta no puede estar destacada
    }
    if (body?.status !== undefined) {
      const s = Number(body.status);
      if (![0, 1].includes(s)) throw new BadRequestException('status debe ser 0 o 1');
      data.status = s;
    }
    if (body?.featured !== undefined) {
      const fe = Number(body.featured);
      if (![0, 1].includes(fe)) throw new BadRequestException('featured debe ser 0 o 1');
      data.featured = fe;
    }
    const before = await prisma.product_questions.findUnique({
      where: { id },
      select: { user_id: true, product_id: true, answer: true },
    });
    await prisma.product_questions.update({ where: { id }, data });

    // Aviso solo cuando se responde por primera vez (no al ocultar/destacar ni al reeditar).
    if (data.answer && !before?.answer && before?.user_id) {
      const p = await prisma.products.findUnique({
        where: { id: before.product_id },
        select: { id: true, name: true },
      });
      await this.notifications.push({
        userId: before.user_id,
        type: 'question_answered',
        title: p ? `Respondimos tu pregunta sobre ${p.name}` : 'Respondimos tu pregunta',
        body: data.answer.slice(0, 200),
        link: p ? `/productos/${productSlug(p.name, p.id)}` : null,
        productId: before.product_id,
      });
    }
    return { ok: true };
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id', ParseIntPipe) id: number) {
    await prisma.product_questions.delete({ where: { id } });
    return { ok: true };
  }
}
