import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { slugify } from '@maqserv/config';
import { z } from 'zod';
import { AdminGuard } from './admin-auth';
import { estadoDocumentos, estaVerificado, mesesEnRed } from '../catalog/provider-trust';

/**
 * RED DE ALIADOS — alta y expediente de proveedores.
 *
 * Modelo del documento institucional, sección 15. Lo que este controlador NO
 * permite, a propósito: marcar a alguien como "verificado" a mano. El sello sale
 * del nivel más la vigencia de sus papeles (ver `provider-trust`), porque el
 * documento pide que el sello tenga un significado real y no sea decorativo.
 */

const NIVELES = ['registrado', 'validado', 'activo', 'preferente'] as const;
const TIPOS_DOC = ['fiscal', 'legal', 'seguro', 'tecnico', 'seguridad', 'otro'] as const;

const providerSchema = z.object({
  name: z.string().min(2).max(190),
  level: z.enum(NIVELES).optional(),
  contactName: z.string().max(190).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(190).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  coverage: z.array(z.string().max(120)).max(60).optional(),
  categories: z.array(z.string().max(120)).max(20).optional(),
  responseMinutes: z.coerce.number().int().min(0).max(10080).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

const documentSchema = z.object({
  kind: z.enum(TIPOS_DOC),
  name: z.string().max(190).optional().nullable(),
  file: z.string().max(500).optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

/** `'2026-08-26'` → Date, y cadena vacía → null (un input date vacío manda ''). */
const fecha = (v: string | null | undefined): Date | null =>
  v && v.trim() ? new Date(`${v}T00:00:00Z`) : null;

@Controller('admin/providers')
@UseGuards(AdminGuard)
export class AdminProvidersController {
  @Get()
  async list() {
    const provs = await prisma.providers.findMany({
      orderBy: [{ status: 'desc' }, { name: 'asc' }],
      include: { provider_documents: { select: { expires_at: true } } },
    });

    // Cuántos equipos tiene cada aliado, en UNA consulta y no una por aliado.
    const conteos = await prisma.products.groupBy({
      by: ['provider_id'],
      where: { status: 1, provider_id: { not: null } },
      _count: { _all: true },
    });
    const equipos = new Map(conteos.map((c) => [c.provider_id, c._count._all]));

    return provs.map((p) => {
      const docs = estadoDocumentos(p.provider_documents);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        level: p.level,
        contactName: p.contact_name,
        phone: p.phone,
        email: p.email,
        city: p.city,
        state: p.state,
        coverage: p.coverage,
        categories: p.categories,
        responseMinutes: p.response_minutes,
        notes: p.notes,
        status: p.status,
        docsStatus: docs,
        verified: estaVerificado(p.level, docs),
        monthsInNetwork: mesesEnRed(p.joined_at),
        documentCount: p.provider_documents.length,
        productCount: equipos.get(p.id) ?? 0,
      };
    });
  }

  @Get(':id/documents')
  async documents(@Param('id', ParseIntPipe) id: number) {
    const docs = await prisma.provider_documents.findMany({
      where: { provider_id: id },
      orderBy: [{ expires_at: 'asc' }, { id: 'asc' }],
    });
    return docs.map((d) => ({
      id: d.id,
      kind: d.kind,
      name: d.name,
      file: d.file,
      issuedAt: d.issued_at ? d.issued_at.toISOString().slice(0, 10) : null,
      expiresAt: d.expires_at ? d.expires_at.toISOString().slice(0, 10) : null,
    }));
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = providerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;

    // El slug sale del nombre, pero dos aliados pueden llamarse parecido y la
    // columna es única: se le agrega un sufijo en vez de reventar con un 500.
    const base = slugify(d.name) || 'aliado';
    let slug = base;
    for (let i = 2; await prisma.providers.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

    return prisma.providers.create({
      data: {
        name: d.name,
        slug,
        level: d.level ?? 'registrado',
        contact_name: d.contactName ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        city: d.city ?? null,
        state: d.state ?? 'Nuevo León',
        coverage: d.coverage ?? [],
        categories: d.categories ?? [],
        response_minutes: d.responseMinutes ?? null,
        notes: d.notes ?? null,
        status: d.status ?? 1,
      },
      select: { id: true, slug: true },
    });
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = providerSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const d = parsed.data;
    const existe = await prisma.providers.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Aliado no encontrado');

    await prisma.providers.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.level !== undefined ? { level: d.level } : {}),
        ...(d.contactName !== undefined ? { contact_name: d.contactName } : {}),
        ...(d.phone !== undefined ? { phone: d.phone } : {}),
        ...(d.email !== undefined ? { email: d.email } : {}),
        ...(d.city !== undefined ? { city: d.city } : {}),
        ...(d.state !== undefined ? { state: d.state } : {}),
        ...(d.coverage !== undefined ? { coverage: d.coverage } : {}),
        ...(d.categories !== undefined ? { categories: d.categories } : {}),
        ...(d.responseMinutes !== undefined ? { response_minutes: d.responseMinutes } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  @Post(':id/documents')
  async addDocument(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Documento inválido');
    const existe = await prisma.providers.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Aliado no encontrado');
    const d = parsed.data;

    const doc = await prisma.provider_documents.create({
      data: {
        provider_id: id,
        kind: d.kind,
        name: d.name ?? null,
        file: d.file ?? null,
        issued_at: fecha(d.issuedAt),
        expires_at: fecha(d.expiresAt),
      },
      select: { id: true },
    });
    return doc;
  }

  @Delete('documents/:docId')
  async removeDocument(@Param('docId', ParseIntPipe) docId: number) {
    await prisma.provider_documents.deleteMany({ where: { id: docId } });
    return { ok: true };
  }

  /**
   * Desasignar es lo único que se ofrece sobre los equipos desde aquí: borrar un
   * aliado que ya atendió servicios dejaría el historial sin dueño, así que para
   * sacarlo de circulación se usa `status = 0`.
   */
  @Delete(':id')
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    await prisma.providers.update({ where: { id }, data: { status: 0, updated_at: new Date() } });
    return { ok: true };
  }
}
