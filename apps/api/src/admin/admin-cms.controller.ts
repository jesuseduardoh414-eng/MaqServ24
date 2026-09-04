import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ICON_TYPES, supabaseStorage } from '../common/supabase-multer';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { productSlug, themeTokensSchema } from '@maqserv/config';
import { AdminGuard } from './admin-auth';
import { imageUrl, normLegacyText } from '../catalog/images';

const photoStorage = supabaseStorage();
/** Marca (favicon/isotipo): es el único sitio donde SVG e ICO tienen sentido. */
const iconStorage = supabaseStorage(ICON_TYPES);
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|avif)$/;
const photoOk = (f?: Express.Multer.File) => {
  if (f && !IMAGE_TYPES.test(f.mimetype)) throw new BadRequestException('Imagen inválida');
};

/** Parsea la columna legacy `inf_sitio.imagenes` (JSON array de paths) a string[]. */
const parseInfImgs = (raw: string | null | undefined): string[] => {
  try { const p = JSON.parse(raw ?? '[]'); return Array.isArray(p) ? p.map(String) : []; } catch { return []; }
};

const blogSchema = z.object({
  title: z.string().min(2).max(250),
  details: z.string().min(4),
  source: z.string().max(250).optional(),
  category: z.string().max(50).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  metaTag: z.string().max(500).optional(),
  metaDescription: z.string().max(1000).optional(),
});

const faqSchema = z.object({
  title: z.string().min(2).max(250),
  text: z.string().min(2),
  status: z.coerce.number().int().min(0).max(1).optional(), // 1 visible, 0 oculta
});

const heroSchema = z.object({
  badge: z.string().max(190).optional(),
  title: z.string().max(250).optional(),
  subtitle: z.string().max(2000).optional(),
  feature1: z.string().max(190).optional(),
  feature2: z.string().max(190).optional(),
});

const itemSchema = z.object({
  title: z.string().min(2).max(190),
  text: z.string().min(2),
  placement: z.enum(['both', 'home', 'about']).optional(),
});

const settingsSchema = z.object({
  email: z.string().email().max(190).optional(),
  phone: z.string().max(50).optional(),
  street: z.string().max(400).optional(),
});

/** CMS del sitio: blog, FAQ, hero, servicios, why-choose-us y ajustes. */
@Controller('admin/cms')
@UseGuards(AdminGuard)
export class AdminCmsController {
  // ---- Blog ----

  @Get('blogs')
  async blogs() {
    // Sin `details`: el listado no pinta el cuerpo del artículo y esa columna
    // puede traer artículos enteros en HTML.
    const rows = await prisma.blogs.findMany({
      orderBy: { id: 'desc' },
      select: { id: true, title: true, status: true, category: true, source: true, photo: true, views: true, created_at: true },
    });
    return rows.map((b) => ({
      id: b.id,
      slug: productSlug(b.title, b.id),
      title: b.title,
      status: b.status,
      category: b.category ?? 'General',
      author: b.source && b.source.trim() ? b.source.trim() : null,
      image: imageUrl(b.photo),
      views: b.views ?? 0,
      createdAt: b.created_at ? b.created_at.toISOString() : null,
    }));
  }

  @Get('blogs/:id')
  async blog(@Param('id', ParseIntPipe) id: number) {
    const b = await prisma.blogs.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    return {
      id: b.id, title: b.title, details: b.details, source: b.source,
      category: b.category ?? 'General',
      status: b.status, metaTag: b.meta_tag, metaDescription: b.meta_description,
      image: imageUrl(b.photo),
    };
  }

  @Post('blogs')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  async createBlog(@Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = blogSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    photoOk(photo);
    const b = await prisma.blogs.create({
      data: {
        title: parsed.data.title,
        details: parsed.data.details,
        source: parsed.data.source ?? '',
        category: parsed.data.category ?? 'General',
        status: parsed.data.status ?? 1,
        meta_tag: parsed.data.metaTag ?? null,
        meta_description: parsed.data.metaDescription ?? null,
        photo: photo ? `uploads/${photo.filename}` : null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { id: b.id };
  }

  @Patch('blogs/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  async updateBlog(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = blogSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(photo);
    const d = parsed.data;
    await prisma.blogs.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.details !== undefined ? { details: d.details } : {}),
        ...(d.source !== undefined ? { source: d.source } : {}),
        ...(d.category !== undefined ? { category: d.category } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.metaTag !== undefined ? { meta_tag: d.metaTag } : {}),
        ...(d.metaDescription !== undefined ? { meta_description: d.metaDescription } : {}),
        ...(photo ? { photo: `uploads/${photo.filename}` } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  @Delete('blogs/:id')
  async deleteBlog(@Param('id', ParseIntPipe) id: number) {
    await prisma.blogs.delete({ where: { id } });
    return { ok: true };
  }

  // ---- FAQ ----

  @Get('faqs')
  async faqs() {
    const rows = await prisma.faqs.findMany({ orderBy: { id: 'asc' } });
    // Limpia el HTML legacy para editar texto plano; al reguardar queda normalizado.
    const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    return rows.map((f) => ({ id: f.id, title: strip(f.title), text: strip(f.text), status: f.status }));
  }

  @Post('faqs')
  async createFaq(@Body() body: unknown) {
    const parsed = faqSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const f = await prisma.faqs.create({ data: parsed.data });
    return { id: f.id };
  }

  @Patch('faqs/:id')
  async updateFaq(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = faqSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    await prisma.faqs.update({ where: { id }, data: parsed.data });
    return { ok: true };
  }

  @Delete('faqs/:id')
  async deleteFaq(@Param('id', ParseIntPipe) id: number) {
    await prisma.faqs.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Hero de la home ----

  @Get('hero')
  async hero() {
    const h = await prisma.hero_sections.findFirst({ orderBy: { id: 'desc' } });
    return h
      ? { id: h.id, badge: h.badge, title: h.title, subtitle: h.subtitle, feature1: h.feature1, feature2: h.feature2, image: imageUrl(h.image) }
      : null;
  }

  @Patch('hero')
  @UseInterceptors(FileInterceptor('image', { storage: photoStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  async updateHero(@Body() body: unknown, @UploadedFile() image?: Express.Multer.File) {
    const parsed = heroSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(image);
    const clear = (body as { clearImage?: string })?.clearImage === 'true';
    const existing = await prisma.hero_sections.findFirst({ orderBy: { id: 'desc' } });
    const data = {
      ...parsed.data,
      ...(image ? { image: `uploads/${image.filename}` } : clear ? { image: null } : {}),
      updated_at: new Date(),
    };
    if (existing) {
      await prisma.hero_sections.update({ where: { id: existing.id }, data });
    } else {
      await prisma.hero_sections.create({ data: { ...data, created_at: new Date() } });
    }
    return { ok: true };
  }

  // ---- Subida genérica de imágenes (bloques del constructor: hero/promo, etc.) ----

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: photoStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Falta el archivo');
    photoOk(file);
    return { url: imageUrl(`uploads/${file.filename}`) };
  }

  // ---- Identidad de marca (logos/favicon en el tema activo) ----

  @Get('branding')
  async branding() {
    const theme = await prisma.theme.findFirst({ where: { active: true } });
    const tokens = (theme?.tokens ?? {}) as { branding?: Record<string, string | null> };
    return tokens.branding ?? {};
  }

  @Patch('branding')
  // `iconStorage` es quien decide de verdad: mira los bytes y acepta PNG/JPG/WebP/AVIF/
  // GIF + SVG/ICO, rechazando un SVG con `<script>` dentro (ver image-sniff).
  @UseInterceptors(FileInterceptor('asset', { storage: iconStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async updateBranding(
    @Body() body: { slot?: string; clear?: string },
    @UploadedFile() asset?: Express.Multer.File,
  ) {
    const SLOTS = ['logoLight', 'logoDark', 'favicon', 'icon', 'logoAlt'] as const;
    const slot = String(body?.slot ?? '') as (typeof SLOTS)[number];
    if (!SLOTS.includes(slot)) throw new BadRequestException('Slot de marca inválido');

    const theme = await prisma.theme.findFirst({ where: { active: true } });
    if (!theme) throw new NotFoundException('No hay tema activo');

    const url = body?.clear === 'true' ? null : asset ? imageUrl(`uploads/${asset.filename}`) : undefined;
    if (url === undefined) throw new BadRequestException('Falta el archivo');

    const tokens = themeTokensSchema.parse(theme.tokens);
    const branding = { ...tokens.branding, [slot]: url };

    // Escribir en publicado Y en el borrador (si existe) para que publicar
    // después no borre la marca recién subida.
    const data: { tokens: object; draftTokens?: object } = { tokens: { ...tokens, branding } };
    if (theme.draftTokens !== null) {
      const draft = themeTokensSchema.parse(theme.draftTokens);
      data.draftTokens = { ...draft, branding: { ...draft.branding, [slot]: url } };
    }
    await prisma.theme.update({ where: { id: theme.id }, data });
    return { ok: true, branding };
  }

  // ---- Servicios ----

  @Get('services')
  async services() {
    const rows = await prisma.services.findMany({ orderBy: { id: 'asc' } });
    return rows.map((s) => ({ id: s.id, title: s.title, text: s.text, image: imageUrl(s.photo) }));
  }

  @Post('services')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async createService(@Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(photo);
    const s = await prisma.services.create({
      data: { title: parsed.data.title, text: parsed.data.text, photo: photo ? `uploads/${photo.filename}` : '' },
    });
    return { id: s.id };
  }

  @Patch('services/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async updateService(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = itemSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(photo);
    await prisma.services.update({
      where: { id },
      data: { ...parsed.data, ...(photo ? { photo: `uploads/${photo.filename}` } : {}) },
    });
    return { ok: true };
  }

  @Delete('services/:id')
  async deleteService(@Param('id', ParseIntPipe) id: number) {
    await prisma.services.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Why choose us ----

  @Get('why-choose-us')
  async whyChooseUs() {
    const rows = await prisma.why_choose_us.findMany({ orderBy: { order: 'asc' } });
    return rows.map((w) => ({
      id: Number(w.id), title: w.title, text: w.description, status: w.status, image: imageUrl(w.photo),
      placement: (w.placement === 'home' || w.placement === 'about' ? w.placement : 'both'),
    }));
  }

  @Post('why-choose-us')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async createWhy(@Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(photo);
    const max = await prisma.why_choose_us.aggregate({ _max: { order: true } });
    const w = await prisma.why_choose_us.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.text,
        order: (max._max.order ?? 0) + 1,
        status: true,
        placement: parsed.data.placement ?? 'both',
        photo: photo ? `uploads/${photo.filename}` : null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { id: Number(w.id) };
  }

  @Patch('why-choose-us/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async updateWhy(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = itemSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(photo);
    await prisma.why_choose_us.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.text !== undefined ? { description: parsed.data.text } : {}),
        ...(parsed.data.placement !== undefined ? { placement: parsed.data.placement } : {}),
        ...(photo ? { photo: `uploads/${photo.filename}` } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  @Delete('why-choose-us/:id')
  async deleteWhy(@Param('id', ParseIntPipe) id: number) {
    await prisma.why_choose_us.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Sectores estratégicos ----

  @Get('sectors')
  async sectors() {
    const rows = await prisma.strategic_sectors.findMany({ orderBy: { id: 'asc' } });
    return rows.map((s) => ({
      id: Number(s.id),
      title: s.title,
      status: s.status,
      image: imageUrl(s.image),
    }));
  }

  @Get('sectors/:id')
  async sectorById(@Param('id', ParseIntPipe) id: number) {
    const s = await prisma.strategic_sectors.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    return {
      id: Number(s.id),
      title: s.title,
      description: s.description,
      trayectoria: s.trayectoria,
      esencia: s.esencia,
      servicios: s.servicios,
      excelencia: s.excelencia,
      serviciosLista: s.servicios_lista,
      status: s.status,
      image: imageUrl(s.image),
    };
  }

  @Post('sectors')
  async createSector(@Body() body: { title?: string }) {
    const title = String(body?.title ?? '').trim();
    if (title.length < 2) throw new BadRequestException('Título requerido');
    const s = await prisma.strategic_sectors.create({
      data: { title, status: 1, created_at: new Date(), updated_at: new Date() },
    });
    return { id: Number(s.id) };
  }

  @Patch('sectors/:id')
  @UseInterceptors(FileInterceptor('image', { storage: photoStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  async updateSector(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const schema = z.object({
      title: z.string().min(2).max(190).optional(),
      description: z.string().max(20000).optional(),
      trayectoria: z.string().max(20000).optional(),
      esencia: z.string().max(20000).optional(),
      servicios: z.string().max(20000).optional(),
      excelencia: z.string().max(20000).optional(),
      serviciosLista: z.string().max(5000).optional(), // una línea por servicio
      status: z.coerce.number().int().min(0).max(1).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    photoOk(image);
    const d = parsed.data;
    await prisma.strategic_sectors.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.trayectoria !== undefined ? { trayectoria: d.trayectoria } : {}),
        ...(d.esencia !== undefined ? { esencia: d.esencia } : {}),
        ...(d.servicios !== undefined ? { servicios: d.servicios } : {}),
        ...(d.excelencia !== undefined ? { excelencia: d.excelencia } : {}),
        ...(d.serviciosLista !== undefined ? { servicios_lista: d.serviciosLista } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(image ? { image: `uploads/${image.filename}` } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  @Delete('sectors/:id')
  async deleteSector(@Param('id', ParseIntPipe) id: number) {
    await prisma.strategic_sectors.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Quiénes somos (inf_sitio) ----

  @Get('inf-sitio')
  async infSitio() {
    const r = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
    if (!r) return null;
    return {
      frase: r.frase, titulo: r.titulo, descripcion: normLegacyText(r.descripcion),
      mision: normLegacyText(r.mision), vision: normLegacyText(r.vision), objetivos: normLegacyText(r.objetivos),
      imagenes: parseInfImgs(r.imagenes).map((x) => imageUrl(x)).filter((u): u is string => !!u),
    };
  }

  @Post('inf-sitio/image')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  async addInfSitioImage(@UploadedFile() photo?: Express.Multer.File) {
    if (!photo) throw new BadRequestException('Falta la imagen');
    photoOk(photo);
    const r = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
    const arr = parseInfImgs(r?.imagenes);
    arr.push(`uploads/${photo.filename}`);
    if (r) await prisma.inf_sitio.update({ where: { id: r.id }, data: { imagenes: JSON.stringify(arr), updated_at: new Date() } });
    else await prisma.inf_sitio.create({ data: { imagenes: JSON.stringify(arr), created_at: new Date(), updated_at: new Date() } });
    return { imagenes: arr.map((x) => imageUrl(x)).filter((u): u is string => !!u) };
  }

  @Delete('inf-sitio/image/:index')
  async removeInfSitioImage(@Param('index', ParseIntPipe) index: number) {
    const r = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
    if (!r) return { imagenes: [] };
    const arr = parseInfImgs(r.imagenes);
    if (index >= 0 && index < arr.length) arr.splice(index, 1);
    await prisma.inf_sitio.update({ where: { id: r.id }, data: { imagenes: JSON.stringify(arr), updated_at: new Date() } });
    return { imagenes: arr.map((x) => imageUrl(x)).filter((u): u is string => !!u) };
  }

  @Patch('inf-sitio')
  async updateInfSitio(@Body() body: unknown) {
    const schema = z.object({
      frase: z.string().max(250).optional(),
      titulo: z.string().max(250).optional(),
      descripcion: z.string().max(10000).optional(),
      mision: z.string().max(5000).optional(),
      vision: z.string().max(5000).optional(),
      objetivos: z.string().max(5000).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const existing = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
    if (existing) {
      await prisma.inf_sitio.update({ where: { id: existing.id }, data: { ...parsed.data, updated_at: new Date() } });
    } else {
      await prisma.inf_sitio.create({ data: { ...parsed.data, created_at: new Date(), updated_at: new Date() } });
    }
    return { ok: true };
  }

  // ---- Ajustes de contacto (generalsettings) ----

  @Get('settings')
  async settings() {
    const gs = await prisma.generalsettings.findFirst({
      select: { id: true, email: true, phone: true, street: true },
    });
    return gs ?? null;
  }

  @Patch('settings')
  async updateSettings(@Body() body: unknown) {
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const gs = await prisma.generalsettings.findFirst({ select: { id: true } });
    if (!gs) throw new NotFoundException('No hay registro de generalsettings');
    await prisma.generalsettings.update({ where: { id: gs.id }, data: parsed.data });
    return { ok: true };
  }
}
