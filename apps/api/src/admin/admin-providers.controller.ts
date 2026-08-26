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
import { estadoDocumentos, estaVerificado, mesesEnRed, DIAS_AVISO } from '../catalog/provider-trust';
import { documentosQueAvisan, textoAviso, urgencia, type AvisoAliado } from '../catalog/document-alerts';

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
  /**
   * AVISOS DE EXPEDIENTE (documento institucional, sección 23).
   *
   * "La plataforma requiere alertas y reglas que impidan tratar como verificado
   * un expediente desactualizado." Las reglas ya estaban; esto es la alerta.
   *
   * Va ANTES de las rutas con `:id` a propósito: si se declarara después, Nest
   * podría leer "alerts" como un id y la ruta nunca respondería.
   */
  @Get('alerts')
  async alerts() {
    const limite = new Date(Date.now() + DIAS_AVISO * 24 * 60 * 60 * 1000);

    // Solo los aliados que tienen ALGO por vencer o vencido: traer a los 6 y
    // filtrarlos aquí sirve hoy, pero con doscientos sería traer doscientos
    // para mostrar tres.
    const provs = await prisma.providers.findMany({
      where: { provider_documents: { some: { expires_at: { not: null, lte: limite } } } },
      include: {
        provider_documents: {
          select: { id: true, kind: true, name: true, expires_at: true },
        },
      },
    });
    if (provs.length === 0) return [];

    /**
     * Obras corriendo de cada aliado. Es lo que separa "hay un trámite
     * pendiente" de "hay una obra expuesta", y por eso se pide: sin este dato
     * el aviso no sabe a quién poner arriba.
     */
    const activos = await prisma.service_assignments.groupBy({
      by: ['provider_id'],
      where: {
        state: 'aceptado',
        provider_id: { in: provs.map((p) => p.id) },
        quotes: { service_state: { notIn: ['cerrado', 'cancelado'] } },
      },
      _count: { _all: true },
    });
    const enObra = new Map(activos.map((a) => [a.provider_id, a._count._all]));

    const hoy = new Date();
    const avisos: AvisoAliado[] = provs.map((p) => {
      const docs = documentosQueAvisan(p.provider_documents, hoy);
      const peor = docs[0];
      const estado = estadoDocumentos(p.provider_documents, hoy);
      return {
        providerId: p.id,
        name: p.name,
        level: p.level,
        activo: p.status === 1,
        // Pierde el sello si con estos papeles ya no califica, PERO llegaría a
        // calificar por nivel: si nunca estuvo verificado, no hay nada que perder.
        pierdeSello: !estaVerificado(p.level, estado) && estaVerificado(p.level, 'al-dia'),
        serviciosActivos: enObra.get(p.id) ?? 0,
        documentos: docs,
        peor: peor?.urgencia ?? 'por-vencer',
        diasPeor: peor?.diasRestantes ?? DIAS_AVISO,
      };
    });

    return avisos
      .sort((a, b) => urgencia(b) - urgencia(a))
      .map((a) => ({
        ...a,
        documentos: a.documentos.map((d) => ({
          ...d,
          expiresAt: d.expiresAt.toISOString().slice(0, 10),
          texto: textoAviso(d),
        })),
      }));
  }

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
