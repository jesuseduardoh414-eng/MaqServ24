import { nombreCorto } from '../common/nombre-corto';
import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { avisarPanel } from '../notifications/panel';

const askSchema = z.object({ question: z.string().min(5).max(500) });

/**
 * Preguntas de producto (tipo MercadoLibre). Publicamente se ven solo las
 * RESPONDIDAS y visibles; cualquier cliente con sesion puede preguntar y el
 * admin responde desde el panel (Clientes -> Preguntas).
 */
@Controller('catalog/products/:id/questions')
export class ProductQuestionsController {
  @Get()
  async list(@Param('id', ParseIntPipe) productId: number) {
    const rows = await prisma.product_questions.findMany({
      where: { product_id: productId, status: 1, answer: { not: null } },
      orderBy: { id: 'desc' },
      take: 50,
    });
    const users = await prisma.users.findMany({
      where: { id: { in: rows.map((r) => r.user_id).filter((x): x is number => x != null) } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      // Solo nombre e inicial del apellido: es público (auditoría 2026-10-23).
      author: nombreCorto((r.user_id ? names.get(r.user_id) : null) ?? r.asker_name),
      question: r.question,
      answer: r.answer,
      date: r.created_at ? r.created_at.toISOString() : null,
      answeredAt: r.answered_at ? r.answered_at.toISOString() : null,
    }));
  }

  // Límite propio como el resto de los formularios (contacto 5/min, cotizar
  // 5/min…): era el ÚNICO sin tope dedicado y un cliente autenticado podía
  // inyectar cientos de preguntas por minuto directo al panel de moderación.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  @UseGuards(JwtGuard)
  async ask(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) productId: number, @Body() body: unknown) {
    const parsed = askSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos invalidos');
    const product = await prisma.products.findFirst({ where: { id: productId, status: 1 } });
    if (!product) throw new BadRequestException('Producto no disponible');
    await prisma.product_questions.create({
      data: { product_id: productId, user_id: req.userId, source: 'producto', question: parsed.data.question, answer: null, status: 1, created_at: new Date(), updated_at: new Date() },
    });
    // Antes llegaba al panel sin avisar: se veía solo si alguien abría Preguntas.
    void avisarPanel({ modulo: 'comunidad', evento: 'pregunta', titulo: `Pregunta sobre ${product.name}`, cuerpo: parsed.data.question.slice(0, 300), link: '/mensajes' });
    return { ok: true };
  }
}
