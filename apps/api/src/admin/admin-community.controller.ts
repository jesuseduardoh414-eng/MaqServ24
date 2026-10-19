import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { productSlug } from '@maqserv/config';
import { AdminGuard, Modulo } from './admin-auth';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { correoPreguntaRespondida } from '../notifications/email-templates';

/** Por dónde llegó una pregunta capturada en el panel. */
const ORIGENES_PREGUNTA = ['correo', 'whatsapp', 'telefono', 'otro'];

/** Comunidad: reseñas del sitio, comentarios y preguntas de producto. */
@Modulo('comunidad')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminCommunityController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

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

  // ---- Reseñas de servicio (0 por revisar · 1 publicada · 2 oculta) ----
  // Las deja el cliente al cerrar su servicio (ver reviews/service-reviews.controller.ts).

  @Get('service-reviews')
  async serviceReviews() {
    const rows = await prisma.service_reviews.findMany({ orderBy: [{ status: 'asc' }, { id: 'desc' }], take: 200 });
    const [quotes, provs] = await Promise.all([
      prisma.quotes.findMany({
        where: { id: { in: rows.map((r) => r.quote_id) } },
        select: { id: true, quote_number: true, product_interested: true, service_category: true, company_name: true, email: true },
      }),
      prisma.providers.findMany({ where: { id: { in: rows.map((r) => r.provider_id).filter((x): x is number => x != null) } }, select: { id: true, name: true } }),
    ]);
    const q = new Map(quotes.map((x) => [x.id, x]));
    const p = new Map(provs.map((x) => [x.id, x.name]));
    return rows.map((r) => {
      const s = q.get(r.quote_id);
      return {
        id: r.id,
        folio: s?.quote_number ?? null,
        servicio: s?.product_interested || s?.service_category || null,
        empresa: s?.company_name ?? null,
        correo: s?.email ?? null,
        aliado: r.provider_id ? p.get(r.provider_id) ?? null : null,
        author: r.author,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      };
    });
  }

  @Patch('service-reviews/:id')
  async updateServiceReview(@Param('id', ParseIntPipe) id: number, @Body() body: { status?: number }) {
    const status = Number(body?.status);
    if (![0, 1, 2].includes(status)) throw new BadRequestException('status debe ser 0, 1 o 2');
    await prisma.service_reviews.update({ where: { id }, data: { status, updated_at: new Date() } });
    return { ok: true };
  }

  @Delete('service-reviews/:id')
  async deleteServiceReview(@Param('id', ParseIntPipe) id: number) {
    await prisma.service_reviews.delete({ where: { id } });
    return { ok: true };
  }

  // Administradores: ver `admin-admins.controller.ts`. Se separó porque crear un
  // admin exige TAMBIÉN el usuario de Supabase Auth: aquí solo se creaba la fila y
  // el administrador nuevo NO podía entrar.

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

  // ---- Preguntas: de producto, del sitio y las que se capturan aquí ----
  //
  // 2026-10-12: además de las de producto (con sesión), llegan las generales de
  // Preguntas frecuentes (sin cuenta, con nombre y correo) y las que Operaciones
  // captura cuando llegan por correo o WhatsApp. Al responder por primera vez se
  // le avisa a quien preguntó; `featured` la publica en Preguntas frecuentes.

  @Get('questions')
  async questions() {
    const rows = await prisma.product_questions.findMany({ orderBy: { id: 'desc' }, take: 300 });
    const ids = (k: 'user_id' | 'product_id') => rows.map((r) => r[k]).filter((x): x is number => x != null);
    const [users, products] = await Promise.all([
      prisma.users.findMany({ where: { id: { in: ids('user_id') } }, select: { id: true, name: true, email: true } }),
      prisma.products.findMany({ where: { id: { in: ids('product_id') } }, select: { id: true, name: true } }),
    ]);
    const us = new Map(users.map((u) => [u.id, u]));
    const prods = new Map(products.map((p) => [p.id, p.name]));
    return rows.map((q) => {
      const u = q.user_id ? us.get(q.user_id) : undefined;
      return {
        id: q.id,
        author: u?.name ?? q.asker_name ?? 'Sin nombre',
        email: u?.email ?? q.asker_email ?? null,
        product: q.product_id ? prods.get(q.product_id) ?? `#${q.product_id}` : null,
        productId: q.product_id,
        source: q.source,
        question: q.question,
        answer: q.answer,
        answered: q.answer != null,
        status: q.status,
        featured: q.featured === 1,
        createdAt: q.created_at ? q.created_at.toISOString() : null,
      };
    });
  }

  /** Capturar una pregunta que llegó por correo, WhatsApp o teléfono (y, si ya se tiene, su respuesta). */
  @Post('questions')
  async createQuestion(@Body() body: Record<string, unknown>) {
    const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
    const pregunta = txt(body?.question, 500);
    const respuesta = txt(body?.answer, 4000);
    const source = ORIGENES_PREGUNTA.includes(String(body?.source)) ? String(body?.source) : 'otro';
    const correo = txt(body?.askerEmail, 190).toLowerCase() || null;
    if (pregunta.length < 5) throw new BadRequestException('Escribe la pregunta.');
    if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(correo)) throw new BadRequestException('El correo no es válido.');
    const ahora = new Date();
    const q = await prisma.product_questions.create({
      data: {
        product_id: null, user_id: null, source, asker_name: txt(body?.askerName, 190) || null, asker_email: correo,
        question: pregunta, answer: respuesta || null, answered_at: respuesta ? ahora : null,
        // Sin respuesta no se publica: en Preguntas frecuentes no hay preguntas sin contestar.
        featured: respuesta && Number(body?.featured) === 1 ? 1 : 0,
        status: 1, created_at: ahora, updated_at: ahora,
      },
    });
    if (respuesta && correo && body?.notify === true) {
      await this.avisarRespuesta({ nombre: q.asker_name, correo, pregunta, respuesta, productId: null });
    }
    return { ok: true, id: q.id };
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
      select: { user_id: true, product_id: true, answer: true, question: true, asker_name: true, asker_email: true },
    });
    if (!before) throw new BadRequestException('Esa pregunta ya no existe.');
    await prisma.product_questions.update({ where: { id }, data });

    // Aviso solo cuando se responde por primera vez (no al ocultar/destacar ni al reeditar).
    if (data.answer && !before.answer) {
      const p = before.product_id
        ? await prisma.products.findUnique({ where: { id: before.product_id }, select: { id: true, name: true } })
        : null;
      if (before.user_id) {
        await this.notifications.push({
          userId: before.user_id,
          type: 'question_answered',
          title: p ? `Respondimos tu pregunta sobre ${p.name}` : 'Respondimos tu pregunta',
          body: data.answer.slice(0, 200),
          link: p ? `/productos/${productSlug(p.name, p.id)}` : '/preguntas-frecuentes',
          productId: before.product_id,
        });
      }
      // Y por correo: la campana solo la ve quien vuelve al sitio, y quien
      // preguntó sin cuenta no tiene campana.
      const u = before.user_id ? await prisma.users.findUnique({ where: { id: before.user_id }, select: { name: true, email: true } }) : null;
      const correo = u?.email ?? before.asker_email;
      if (correo) {
        await this.avisarRespuesta({ nombre: u?.name ?? before.asker_name, correo, pregunta: before.question, respuesta: data.answer, productId: p ? p.id : null, producto: p?.name });
      }
    }
    return { ok: true };
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id', ParseIntPipe) id: number) {
    await prisma.product_questions.delete({ where: { id } });
    return { ok: true };
  }

  private async avisarRespuesta(d: { nombre: string | null; correo: string; pregunta: string; respuesta: string; productId: number | null; producto?: string }) {
    const url = d.productId && d.producto ? `/productos/${productSlug(d.producto, d.productId)}` : '/preguntas-frecuentes';
    await this.mailer.enviar({
      kind: 'question_answered',
      to: d.correo,
      toName: d.nombre,
      ...correoPreguntaRespondida({ nombre: d.nombre?.split(/\s+/)[0] ?? null, pregunta: d.pregunta, respuesta: d.respuesta, url }),
    });
  }
}
