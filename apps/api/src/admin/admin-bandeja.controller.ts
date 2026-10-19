import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { MailerService } from '../notifications/mailer.service';
import { correoMensajeRespondido } from '../notifications/email-templates';

/** Pendiente: nadie ha contestado · atendido: contestado o resuelto por otro medio · archivado: fuera de la lista. */
type EstadoBandeja = 'pendiente' | 'atendido' | 'archivado';

/**
 * MENSAJES: UNA SOLA BANDEJA (2026-10-14).
 *
 * "Solo vamos a dejar Mensajes, y solo vendrán dudas de los clientes: si un
 * cliente pregunta algo, llega a esa bandeja." Aquí se juntan las dos fuentes
 * que había: lo que escriben por Contacto (`contact_messages`) y las
 * preguntas (`product_questions`: las de Preguntas frecuentes, las de un
 * producto y las que se capturan en el panel). Desde la misma lista se
 * contesta —le llega por correo— y, si le sirve a todos, se publica en
 * Preguntas frecuentes.
 *
 * Las preguntas frecuentes que nacen de un mensaje de Contacto (source
 * 'contacto') no salen como renglón propio: se ven dentro de su mensaje.
 */
@Modulo('comunidad')
@Controller('admin/bandeja')
@UseGuards(AdminGuard)
export class AdminBandejaController {
  constructor(private readonly mailer: MailerService) {}

  @Get()
  async lista() {
    const [mensajes, preguntas] = await Promise.all([
      prisma.contact_messages.findMany({ orderBy: { id: 'desc' }, take: 600 }),
      prisma.product_questions.findMany({ where: { source: { not: 'contacto' } }, orderBy: { id: 'desc' }, take: 600 }),
    ]);
    const idsFaq = mensajes.map((m) => m.faq_id).filter((x): x is number => x != null);
    const idsUsuario = preguntas.map((q) => q.user_id).filter((x): x is number => x != null);
    const idsProducto = preguntas.map((q) => q.product_id).filter((x): x is number => x != null);
    const [faqs, usuarios, productos] = await Promise.all([
      prisma.product_questions.findMany({ where: { id: { in: idsFaq } }, select: { id: true, question: true, answer: true, featured: true } }),
      prisma.users.findMany({ where: { id: { in: idsUsuario } }, select: { id: true, name: true, email: true } }),
      prisma.products.findMany({ where: { id: { in: idsProducto } }, select: { id: true, name: true } }),
    ]);
    const faq = new Map(faqs.map((f) => [f.id, f]));
    const us = new Map(usuarios.map((u) => [u.id, u]));
    const prods = new Map(productos.map((p) => [p.id, p.name]));

    const items = [
      ...mensajes.map((m) => {
        const f = m.faq_id ? faq.get(m.faq_id) : undefined;
        const estado: EstadoBandeja = m.state === 'archivado' ? 'archivado' : m.state === 'nuevo' && !m.answer ? 'pendiente' : 'atendido';
        return {
          key: `m-${m.id}`, tipo: 'contacto' as const, id: m.id, origen: 'contacto',
          nombre: m.name, correo: m.email, telefono: m.phone, empresa: m.company, motivo: m.need, producto: null,
          texto: m.message, respuesta: m.answer, estado,
          atendidoPor: m.handled_by, atendidoEl: m.handled_at,
          publicada: f?.featured === 1,
          faq: f ? { id: f.id, pregunta: f.question, respuesta: f.answer ?? '' } : null,
          fecha: m.created_at,
        };
      }),
      ...preguntas.map((q) => {
        const u = q.user_id ? us.get(q.user_id) : undefined;
        const estado: EstadoBandeja = q.status === 0 ? 'archivado' : q.answer ? 'atendido' : 'pendiente';
        return {
          key: `p-${q.id}`, tipo: 'pregunta' as const, id: q.id, origen: q.source,
          nombre: u?.name ?? q.asker_name ?? null, correo: u?.email ?? q.asker_email ?? null, telefono: null, empresa: null, motivo: null,
          producto: q.product_id ? prods.get(q.product_id) ?? `#${q.product_id}` : null,
          texto: q.question, respuesta: q.answer, estado,
          atendidoPor: null, atendidoEl: q.answered_at,
          publicada: q.featured === 1,
          faq: null,
          fecha: q.created_at,
        };
      }),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

    return { items };
  }

  /** Contestar un mensaje de Contacto: se guarda, se le manda por correo y queda atendido. */
  @Post('contacto/:id/responder')
  async responder(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: { respuesta?: string }) {
    const respuesta = String(body?.respuesta ?? '').trim().slice(0, 4000);
    if (respuesta.length < 2) throw new BadRequestException('Escribe la respuesta.');
    const m = await prisma.contact_messages.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Ese mensaje ya no existe.');
    const ahora = new Date();
    await prisma.contact_messages.update({
      where: { id },
      data: {
        answer: respuesta, answered_at: ahora, state: 'atendido',
        handled_by: (req.adminNombre || 'Panel').slice(0, 190), handled_at: ahora,
      },
    });
    const estado = await this.mailer.enviar({
      kind: 'contact_reply',
      to: m.email,
      toName: m.name,
      ...correoMensajeRespondido({ nombre: m.name.split(/\s+/)[0] ?? null, mensaje: m.message, respuesta }),
    });
    return { ok: true, correo: estado };
  }

  /**
   * Publicar un mensaje de Contacto como pregunta frecuente. La pregunta y la
   * respuesta se escriben de nuevo (limpias, sin datos de la persona): lo que
   * alguien escribió por Contacto suele traer su nombre, su obra o su teléfono.
   */
  @Put('contacto/:id/publicar')
  async publicar(@Param('id', ParseIntPipe) id: number, @Body() body: { pregunta?: string; respuesta?: string }) {
    const pregunta = String(body?.pregunta ?? '').trim().slice(0, 500);
    const respuesta = String(body?.respuesta ?? '').trim().slice(0, 4000);
    if (pregunta.length < 5 || respuesta.length < 2) throw new BadRequestException('Escribe la pregunta y la respuesta como se verán en el sitio.');
    const m = await prisma.contact_messages.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Ese mensaje ya no existe.');
    const ahora = new Date();
    const existe = m.faq_id ? await prisma.product_questions.findUnique({ where: { id: m.faq_id }, select: { id: true } }) : null;
    if (existe) {
      await prisma.product_questions.update({ where: { id: existe.id }, data: { question: pregunta, answer: respuesta, featured: 1, status: 1, updated_at: ahora } });
    } else {
      const f = await prisma.product_questions.create({
        data: {
          product_id: null, user_id: null, source: 'contacto', asker_name: m.name, asker_email: m.email,
          question: pregunta, answer: respuesta, answered_at: ahora, featured: 1, status: 1, created_at: ahora, updated_at: ahora,
        },
      });
      await prisma.contact_messages.update({ where: { id }, data: { faq_id: f.id } });
    }
    return { ok: true };
  }

  /** Quitarla de Preguntas frecuentes (se conserva por si se vuelve a publicar). */
  @Delete('contacto/:id/publicar')
  async despublicar(@Param('id', ParseIntPipe) id: number) {
    const m = await prisma.contact_messages.findUnique({ where: { id }, select: { faq_id: true } });
    if (m?.faq_id) await prisma.product_questions.update({ where: { id: m.faq_id }, data: { featured: 0, updated_at: new Date() } }).catch(() => undefined);
    return { ok: true };
  }
}
