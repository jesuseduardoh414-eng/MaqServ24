import {
  BadRequestException, Body, Controller, Get, NotFoundException,
  Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard, type AdminRequest } from './admin-auth';
import { supabaseStorage } from '../common/supabase-multer';
import { imageUrl } from '../catalog/images';
import { CATALOGO, RESPONSABLES, SEVERIDADES, TIPOS } from '../quotes/incidents';

/**
 * INCIDENCIAS DE CAMPO (documento institucional, sección 30).
 *
 * "Registro, evidencias, responsables, escalamiento y cierre." Una máquina que
 * llega tarde, una unidad que falla a media jornada, un acceso que no permitió
 * entrar: hoy eso vive en llamadas y desaparece. Lo que no se registra no se
 * puede corregir, y lo que no se puede corregir se repite.
 */

const abrirSchema = z.object({
  quoteId: z.number().int().positive(),
  kind: z.enum(TIPOS),
  severity: z.enum(SEVERIDADES).optional(),
  responsible: z.enum(RESPONSABLES).optional(),
  description: z.string().min(4).max(4000),
  evidence: z.array(z.string().max(500)).max(12).optional(),
});

const cerrarSchema = z.object({
  resolution: z.string().min(4).max(4000),
  /** Al cerrar se puede corregir de quién fue: al abrir no siempre se sabe. */
  responsible: z.enum(RESPONSABLES).optional(),
});

/**
 * Evidencias: FOTOS, y a propósito solo fotos.
 *
 * La evidencia de campo es una foto —la unidad que llegó dañada, el acceso que
 * no permitía entrar, el odómetro—, y el motor de subida valida por los BYTES
 * del archivo, no por lo que diga el navegador. Admitir PDF obligaría a abrir
 * esa validación, que es la que impide que alguien suba cualquier cosa
 * disfrazada de imagen. Si algún día hacen falta documentos, se amplía ahí y no
 * aquí.
 */
const evidenceStorage = supabaseStorage();
const MAX_EVIDENCIAS = 6;

/**
 * Deja siempre la RUTA del bucket, nunca la URL completa.
 *
 * La pantalla recibe las evidencias ya resueltas (para poder pintarlas), así que
 * al reguardarlas devuelve direcciones absolutas. Sin esto, la misma columna
 * acabaría con dos formatos y el día que cambie el almacenamiento solo se
 * arreglarían la mitad.
 */
const aRutaBucket = (v: string): string => {
  const i = v.indexOf('/uploads/');
  return i >= 0 ? v.slice(i + 1) : v;
};

@Controller('admin/incidencias')
@UseGuards(AdminGuard)
export class AdminIncidentsController {
  /** El catálogo, para que la pantalla no lo repita y no se desincronicen. */
  @Get('catalogo')
  catalogo() {
    return {
      tipos: Object.values(CATALOGO),
      severidades: SEVERIDADES,
      responsables: RESPONSABLES,
    };
  }

  @Get()
  async list(@Query('estado') estado?: string, @Query('quoteId') quoteId?: string) {
    const where: Record<string, unknown> = {};
    // Por defecto, sólo las abiertas: una lista de incidencias cerradas es un
    // archivo, y lo que hace falta ver es lo que sigue sin resolverse.
    if (estado === 'todas') delete where.state;
    else where.state = estado === 'cerrada' ? 'cerrada' : 'abierta';
    if (quoteId) where.quote_id = Number(quoteId);

    const rows = await prisma.service_incidents.findMany({
      where,
      orderBy: [{ state: 'asc' }, { opened_at: 'desc' }],
      take: 200,
      include: {
        providers: { select: { id: true, name: true } },
        quotes: { select: { quote_number: true, service_category: true, company_name: true, name: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      quoteId: Number(r.quote_id),
      quoteNumber: r.quotes.quote_number,
      cliente: r.quotes.company_name || r.quotes.name,
      categoria: r.quotes.service_category,
      provider: r.providers ? { id: r.providers.id, name: r.providers.name } : null,
      kind: r.kind,
      kindLabel: CATALOGO[r.kind as keyof typeof CATALOGO]?.label ?? r.kind,
      severity: r.severity,
      responsible: r.responsible,
      description: r.description,
      // Se guardan como ruta del bucket (`uploads/…`) y se sirven resueltas: si
      // el almacenamiento cambia de sitio, las incidencias viejas siguen viéndose.
      evidence: r.evidence.map((e) => imageUrl(e)).filter((u): u is string => !!u),
      state: r.state,
      resolution: r.resolution,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
    }));
  }

  /**
   * Sube las fotos y devuelve sus rutas. Va SEPARADO de abrir la incidencia
   * porque la foto casi nunca llega al mismo tiempo que el aviso: primero
   * llaman para decir que la máquina no entró, y la foto aparece un rato
   * después. Con la subida pegada al alta, esa segunda foto no tendría dónde ir.
   */
  @Post('evidencias')
  @UseInterceptors(
    FilesInterceptor('files', MAX_EVIDENCIAS, { storage: evidenceStorage, limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  subirEvidencias(@UploadedFiles() files?: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No llegó ninguna foto');
    // `path` es lo que se guarda; `url` lo que se pinta. La pantalla no tiene
    // que saber cómo se arma la dirección del bucket.
    return {
      archivos: files.map((f) => ({ path: `uploads/${f.filename}`, url: imageUrl(`uploads/${f.filename}`) })),
    };
  }

  /**
   * Sube fotos Y las suma a una incidencia que ya existe, en una sola llamada.
   * Suma en vez de reemplazar: dos personas mandando fotos del mismo problema
   * no deben pisarse.
   */
  @Post(':id/evidencias')
  @UseInterceptors(
    FilesInterceptor('files', MAX_EVIDENCIAS, { storage: evidenceStorage, limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  async agregarEvidencias(@Param('id', ParseIntPipe) id: number, @UploadedFiles() files?: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No llegó ninguna foto');
    const inc = await prisma.service_incidents.findUnique({ where: { id }, select: { evidence: true } });
    if (!inc) throw new NotFoundException('Incidencia no encontrada');

    const nuevas = files.map((f) => `uploads/${f.filename}`);
    const total = [...inc.evidence.map(aRutaBucket), ...nuevas].slice(0, 12);
    await prisma.service_incidents.update({ where: { id }, data: { evidence: total } });

    return { ok: true, evidence: total.map((e) => imageUrl(e)) };
  }

  @Post()
  async abrir(@Body() body: unknown, @Req() req: AdminRequest) {
    const p = abrirSchema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const d = p.data;

    const q = await prisma.quotes.findUnique({
      where: { id: d.quoteId },
      select: { id: true, quote_number: true },
    });
    if (!q) throw new NotFoundException('Servicio no encontrado');

    // Qué aliado estaba atendiendo cuando pasó. Se resuelve aquí y no se pide:
    // quien captura la incidencia está pensando en lo que pasó, no en a quién
    // se le había asignado.
    const asignado = await prisma.service_assignments.findFirst({
      where: { quote_id: d.quoteId, state: 'aceptado' },
      select: { provider_id: true },
      orderBy: { id: 'desc' },
    });

    const inc = await prisma.service_incidents.create({
      data: {
        quote_id: d.quoteId,
        provider_id: asignado?.provider_id ?? null,
        kind: d.kind,
        severity: d.severity ?? 'media',
        // Ver decisión 1 en `incidents.ts`: "nadie" por defecto, a propósito.
        responsible: d.responsible ?? 'nadie',
        description: d.description.trim(),
        evidence: (d.evidence ?? []).map(aRutaBucket),
        opened_by: req.adminId ?? null,
      },
    });

    // Queda en el historial del servicio: la trazabilidad tiene que poder
    // reconstruir qué pasó, y una incidencia es parte de lo que pasó.
    await prisma.service_events.create({
      data: {
        quote_id: d.quoteId,
        admin_id: req.adminId ?? null,
        to_state: 'incidencia',
        note: `${CATALOGO[d.kind].label}: ${d.description.trim().slice(0, 200)}`,
      },
    });

    return { id: inc.id, ok: true };
  }

  @Patch(':id/cerrar')
  async cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AdminRequest,
  ) {
    const p = cerrarSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('Escribe cómo se resolvió.');

    const inc = await prisma.service_incidents.findUnique({ where: { id } });
    if (!inc) throw new NotFoundException('Incidencia no encontrada');
    if (inc.state === 'cerrada') throw new BadRequestException('Esta incidencia ya estaba cerrada.');

    await prisma.service_incidents.update({
      where: { id },
      data: {
        state: 'cerrada',
        resolution: p.data.resolution.trim(),
        ...(p.data.responsible ? { responsible: p.data.responsible } : {}),
        closed_by: req.adminId ?? null,
        closed_at: new Date(),
      },
    });

    await prisma.service_events.create({
      data: {
        quote_id: inc.quote_id,
        admin_id: req.adminId ?? null,
        to_state: 'incidencia_cerrada',
        note: p.data.resolution.trim().slice(0, 200),
      },
    });

    return { ok: true };
  }

  @Patch(':id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const p = z
      .object({
        severity: z.enum(SEVERIDADES).optional(),
        responsible: z.enum(RESPONSABLES).optional(),
        description: z.string().min(4).max(4000).optional(),
        evidence: z.array(z.string().max(500)).max(12).optional(),
      })
      .safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');
    const d = p.data;

    await prisma.service_incidents.update({
      where: { id },
      data: {
        ...(d.severity ? { severity: d.severity } : {}),
        ...(d.responsible ? { responsible: d.responsible } : {}),
        ...(d.description ? { description: d.description.trim() } : {}),
        ...(d.evidence ? { evidence: d.evidence.map(aRutaBucket) } : {}),
      },
    });
    return { ok: true };
  }
}
