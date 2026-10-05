import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma, prisma } from '@maqserv/db';
import { copysSchema, slugify, themeTokensSchema } from '@maqserv/config';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';
import { sinSupabase } from '../common/sin-supabase';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * Editor de temas (sistema de diseño configurable).
 * Flujo: editar BORRADOR (draftTokens/draftCopys) → PUBLICAR (pasa a
 * tokens/copys, sella publishedAt, limpia borrador e invalida el cache
 * ISR del sitio) → o DESCARTAR. Ver spec design-configurable-editor.
 */
@Modulo('diseno')
@Controller('admin/themes')
@UseGuards(AdminGuard)
export class AdminThemesController {
  @Get()
  async list() {
    const rows = await prisma.theme.findMany({ orderBy: { id: 'asc' } });
    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      active: t.active,
      hasDraft: t.draftTokens !== null || t.draftCopys !== null,
      publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
    }));
  }

  @Get(':id')
  async byId(@Param('id', ParseIntPipe) id: number) {
    const t = await prisma.theme.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tema no encontrado');
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      active: t.active,
      // El editor trabaja sobre el borrador si existe; si no, sobre lo publicado.
      // Con las imágenes de Supabase ya traducidas: al guardar, la base se corrige.
      tokens: sinSupabase(t.draftTokens ?? t.tokens),
      copys: sinSupabase(t.draftCopys ?? t.copys),
      hasDraft: t.draftTokens !== null || t.draftCopys !== null,
      publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
    };
  }

  /** Guarda el borrador (valida contra el schema compartido). */
  @Patch(':id/draft')
  async saveDraft(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const schema = z.object({
      tokens: themeTokensSchema.optional(),
      copys: copysSchema.optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Tema inválido');
    }
    const t = await prisma.theme.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    await prisma.theme.update({
      where: { id },
      data: {
        ...(parsed.data.tokens ? { draftTokens: parsed.data.tokens } : {}),
        ...(parsed.data.copys ? { draftCopys: parsed.data.copys } : {}),
      },
    });
    return { ok: true };
  }

  /** Publica el borrador y dispara la revalidación ISR del sitio. */
  @Post(':id/publish')
  async publish(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const t = await prisma.theme.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    if (t.draftTokens === null && t.draftCopys === null) {
      throw new BadRequestException('No hay cambios de borrador que publicar');
    }
    // Validación final: nunca publicar un tema corrupto
    const tokens = themeTokensSchema.parse(t.draftTokens ?? t.tokens);
    const copys = copysSchema.parse(t.draftCopys ?? t.copys);

    await prisma.theme.update({
      where: { id },
      data: {
        tokens,
        copys,
        draftTokens: Prisma.DbNull,
        draftCopys: Prisma.DbNull,
        publishedAt: new Date(),
      },
    });

    // Invalidación bajo demanda del sitio (ver revalidar-sitio.ts).
    const { revalidated, revalidateError } = await revalidarSitio();
    await registrarAccion(req, 'diseno', 'publicar diseño', t.name ?? ('tema ' + id), revalidateError);
    return { ok: true, publishedAt: new Date().toISOString(), revalidated, revalidateError };
  }

  @Post(':id/discard')
  async discard(@Param('id', ParseIntPipe) id: number) {
    await prisma.theme.update({
      where: { id },
      data: { draftTokens: Prisma.DbNull, draftCopys: Prisma.DbNull },
    });
    return { ok: true };
  }

  /** Activa este tema (solo puede haber uno activo). */
  @Post(':id/activate')
  async activate(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const t = await prisma.theme.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    await prisma.$transaction([
      prisma.theme.updateMany({ data: { active: false } }),
      prisma.theme.update({ where: { id }, data: { active: true } }),
    ]);
    return { ok: true };
  }

  /** Duplica un tema (punto de partida para un sector nuevo). */
  @Post()
  async duplicate(@Body() body: { fromId?: number; name?: string }) {
    const fromId = Number(body?.fromId);
    const name = String(body?.name ?? '').trim();
    if (!fromId || name.length < 2) throw new BadRequestException('fromId y name requeridos');
    const src = await prisma.theme.findUnique({ where: { id: fromId } });
    if (!src) throw new NotFoundException('Tema origen no encontrado');
    let slug = slugify(name);
    if (await prisma.theme.findUnique({ where: { slug } })) slug = `${slug}-${Date.now() % 10000}`;
    const created = await prisma.theme.create({
      data: {
        slug,
        name,
        active: false,
        tokens: src.tokens as object,
        copys: src.copys as object,
      },
    });
    return { id: created.id, slug: created.slug };
  }
}
