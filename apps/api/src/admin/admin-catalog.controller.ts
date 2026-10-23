import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mediaStorage, videoStorage } from '../common/media-multer';
import { borrarSubidas, copiarSubida } from '../common/media';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { z } from 'zod';
import { Prisma, prisma } from '@maqserv/db';
import { sanitizeUserHtml } from '../common/sanitize';
import { productSlug, slugify } from '@maqserv/config';

/**
 * El JSON de atributos, o null si viene vacio o roto.
 *
 * NUNCA lanza: una ficha tecnica mal formada no puede impedir dar de alta un
 * equipo. Se pierde la ficha, no el producto.
 */
function leerAtributos(v: string | undefined): object | null {
  if (!v || !v.trim()) return null;
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';
import { QuoterService } from '../quoter/quoter.service';
import { horarioSchema, tarifasDe } from '@maqserv/config';
import { ESTADO_ELIMINADO } from '../catalog/ofertas';
import { AJUSTE_MARGEN, guardarAjuste, margenAliadoPct } from '../common/platform-settings';
import { imageUrl } from '../catalog/images';
import { ordenDeCategorias } from '../catalog/categories.service';

const photoStorage = mediaStorage();
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|avif)$/;
/** Tope del video de una tarjeta de categoría. Debe caber en `middlewareClientMaxBodySize` del panel. */
const VIDEO_MAX_MB = 30;

/**
 * Booleano que llega por multipart (todo es texto). OJO: `z.coerce.boolean`
 * convierte "false" en true (cualquier texto no vacío es verdadero), y así
 * guardar cualquier ficha la marcaba como destacada. Aquí "false"/"0"/"" = false.
 */
const boolTexto = () =>
  z.preprocess((v) => (typeof v === 'string' ? ['true', '1', 'on', 'si', 'sí'].includes(v.trim().toLowerCase()) : v), z.boolean());

const productSchema = z.object({
  name: z.string().min(2).max(250),
  categoryId: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0),
  oldPrice: z.coerce.number().min(0).optional(),
  // Se pinta con dangerouslySetInnerHTML en la ficha pública: se limpia aquí (QA 2026-09-25).
  description: z.string().min(1).max(20000).transform((s) => sanitizeUserHtml(s)),
  stock: z.coerce.number().int().min(0).optional(),
  brand: z.string().max(190).optional(),
  isRental: boolTexto().optional(),
  rentalFreight: z.coerce.number().min(0).optional(),
  /** Unidad del precio. Cadena vacia = por pieza, y hay que poder guardarla. */
  priceUnit: z.string().max(20).optional(),
  /**
   * Ficha tecnica estructurada. Llega como JSON en un campo del formulario
   * porque el alta usa multipart (sube la foto) y ahi todo es texto.
   */
  attributes: z.string().max(4000).optional(),
  featured: boolTexto().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  lote: z.string().max(190).optional(),
  caducidad: z.string().optional(), // ISO date
  short: z.string().max(5000).optional(), // Corto (resumen)
  specs: z.string().max(20000).optional(), // JSON [{label,value}]
  /**
   * De qué proveedor (aliado) es el equipo. Llega como texto porque el alta es
   * multipart: '' = sin proveedor (la ficha del tipo, no una máquina). Es lo que usa
   * el emparejamiento para saber qué equipos tiene cada aliado; antes solo se
   * podía poner por SQL (2026-09-23).
   */
  providerId: z.string().max(20).optional(),
  /**
   * La ficha del TIPO de esta máquina de aliado (2026-10-22). Texto por lo
   * mismo que providerId: '' = sin tipo. Una ficha no lleva tipo.
   */
  tipoId: z.string().max(20).optional(),
  /** Dónde está el equipo (patio, ciudad). Lo captura el aliado al ofrecerlo. */
  location: z.string().max(160).optional(),
  /** Precio al público por unidad, JSON {"dia": 6500}. Al guardarlo, `cprice` = la tarifa de `priceUnit`. */
  tarifas: z.string().max(2000).optional(),
  /** Lo que cobra el aliado por unidad, JSON. Editable por si se negoció. */
  costoAliado: z.string().max(2000).optional(),
  minimo: z.coerce.number().int().min(0).max(100000).optional(),
  /** JSON del horario; vacío = sin horario (atiende siempre). */
  horario: z.string().max(400).optional(),
});

/** JSON de tarifas del formulario (texto) → objeto limpio; '' → {} (quitar precios). */
function leerTarifas(v: string | undefined): Record<string, number> | undefined {
  if (v === undefined) return undefined;
  if (!v.trim()) return {};
  try { return tarifasDe(JSON.parse(v)); } catch { throw new BadRequestException('Tarifas inválidas'); }
}
function leerHorario(v: string | undefined): object | null | undefined {
  if (v === undefined) return undefined;
  if (!v.trim()) return null;
  try {
    const h = horarioSchema.safeParse(JSON.parse(v));
    if (!h.success) throw new Error();
    return h.data;
  } catch { throw new BadRequestException('Horario inválido'); }
}

/** '' → null (ficha del tipo); '12' → 12; cualquier otra cosa → error. */
function leerProveedor(v: string | undefined): number | null | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('Proveedor inválido');
  return n;
}

/**
 * '' → null (sin tipo); '12' → 12. Tiene que ser una ficha (sin aliado) de la
 * MISMA línea: una retro no puede ser "del tipo" de una pipa.
 */
async function leerTipo(v: string | undefined, categoriaId: number): Promise<number | null | undefined> {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('Tipo inválido');
  const f = await prisma.products.findFirst({ where: { id: n, provider_id: null, category_id: categoriaId }, select: { id: true } });
  if (!f) throw new BadRequestException('Ese tipo no es de la misma línea que el equipo.');
  return n;
}

/** El proveedor tiene que existir y estar activo: un id suelto no se guarda. */
async function exigirProveedor(id: number | null | undefined): Promise<void> {
  if (!id) return;
  const p = await prisma.providers.findUnique({ where: { id }, select: { status: true } });
  if (!p || p.status !== 1) throw new BadRequestException('Ese proveedor no existe o está dado de baja');
}

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  status: z.coerce.number().int().min(0).max(1).optional(),
  // Una línea bajo el nombre en las tarjetas del sitio. Vacío = sin línea.
  description: z.string().max(300).optional(),
});

/** Gestión de catálogo (productos + categorías) — solo administradores. */
@Modulo('catalogo')
@Controller('admin/catalog')
@UseGuards(AdminGuard)
export class AdminCatalogController {
  constructor(private readonly quoter: QuoterService) {}

  // ---- Productos ----

  @Get('products')
  async products(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    // El gestor del admin pide todo en una sola consulta (pageSize alto) para no
    // encadenar N peticiones; cap de 500 para no traer un catálogo enorme de golpe.
    const size = Math.min(500, Math.max(1, Number(pageSize ?? 20) || 20));
    const where: Record<string, unknown> = { status: { not: ESTADO_ELIMINADO } };
    if (search) where.name = { contains: search };
    const [total, rows, cats] = await Promise.all([
      prisma.products.count({ where }),
      prisma.products.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (p - 1) * size,
        take: size,
        select: {
          id: true, name: true, cprice: true, stock: true, status: true,
          featured: true, photo: true, is_rental: true, category_id: true, Marca: true,
        },
      }),
      // Categorías dentro del mismo Promise.all: era un RTT regalado.
      prisma.categories.findMany({ select: { id: true, cat_name: true } }),
    ]);
    const catMap = new Map(cats.map((c) => [c.id, c.cat_name]));
    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / size)),
      items: rows.map((r) => ({
        id: r.id,
        slug: productSlug(r.name, r.id),
        name: r.name,
        brand: r.Marca,
        price: r.cprice,
        stock: r.stock,
        status: r.status,
        featured: r.featured === 1,
        isRental: r.is_rental,
        image: imageUrl(r.photo),
        categoryName: catMap.get(r.category_id) ?? null,
      })),
    };
  }

  @Get('products/:id')
  async productById(@Param('id', ParseIntPipe) id: number) {
    const p = await prisma.products.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    return {
      id: p.id,
      name: p.name,
      categoryId: p.category_id,
      price: p.cprice,
      oldPrice: p.pprice,
      description: p.description,
      stock: p.stock,
      brand: p.Marca,
      isRental: p.is_rental,
      priceUnit: p.price_unit,
      attributes: p.attributes ?? null,
      rentalFreight: p.rental_freight ? Number(p.rental_freight) : null,
      featured: p.featured === 1,
      status: p.status,
      lote: p.lote,
      caducidad: p.caducidad ? p.caducidad.toISOString().slice(0, 10) : null,
      short: p.Corto ?? null,
      specs: (() => { try { const a = JSON.parse(p.specs ?? '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })(),
      image: imageUrl(p.photo),
      providerId: p.provider_id ?? null,
      tipoId: p.tipo_id ?? null,
      location: p.location ?? null,
      tarifas: tarifasDe(p.tarifas),
      costoAliado: tarifasDe(p.costo_aliado),
      minimo: p.minimo ?? null,
      horario: p.horario ?? null,
    };
  }

  /** Ajustes del catálogo: hoy, el margen de MAQSER24 sobre el costo del aliado. */
  @Get('ajustes')
  async ajustes() {
    return { margenPct: await margenAliadoPct() };
  }

  // Cambiar el margen mueve el precio al cliente de TODO lo publicado: es una
  // herramienta de precio, no de catálogo. Leerlo sí queda en catálogo, para el
  // "Proponer con margen" de la ficha (QA 2026-09-25). Guardarlo es de
  // 'tarifas', como el resto de los precios (solo Dirección, 2026-10-22; antes
  // 'cotizador' dejaba a Operaciones cambiarlo sin rastro, auditoría 2026-10-23).
  @Modulo('tarifas')
  @Patch('ajustes')
  async guardarAjustes(@Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({ margenPct: z.coerce.number().min(0).max(300) }).safeParse(body);
    if (!p.success) throw new BadRequestException('Margen inválido (0 a 300 %)');
    const antes = await margenAliadoPct();
    await guardarAjuste(AJUSTE_MARGEN, p.data.margenPct, req.adminEmail);
    await registrarAccion(req, 'tarifas', 'margen.cambiar', 'Margen sobre el costo del aliado', `antes: ${antes} % · ahora: ${p.data.margenPct} %`);
    return { margenPct: p.data.margenPct };
  }

  /**
   * Los aliados activos, para el selector "de quién es el equipo" de la ficha.
   * Va en el módulo de catálogo (y no en el de proveedores) para que quien
   * puede editar la ficha pueda asignarla sin tener el módulo entero de la red.
   */
  /**
   * Las fichas de TIPO (sin aliado) de todas las líneas, para el selector
   * "Tipo" de una máquina de aliado (2026-10-22). El formulario filtra por la
   * línea del equipo.
   */
  @Get('tipos')
  async tipos() {
    return prisma.products.findMany({
      where: { provider_id: null, status: { in: [0, 1] } },
      select: { id: true, name: true, category_id: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * CREAR UN TIPO desde la máquina de un aliado (2026-10-22): cuando el aliado
   * eligió "Otro" porque su equipo no estaba en la lista. Nace la ficha sin
   * aliado en la misma línea, sin precio y sin foto (la foto es del aliado: si
   * su equipo se borra, se borraría con él), y la máquina queda ligada a ella.
   * El precio se le pone después en la ficha ("Precio en el cotizador").
   */
  @Post('products/:id/crear-tipo')
  async crearTipo(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const nombre = z.object({ nombre: z.string().trim().min(3, 'Escribe el nombre del tipo').max(190) }).safeParse(body ?? {});
    if (!nombre.success) throw new BadRequestException(nombre.error.issues[0]?.message ?? 'Nombre inválido');
    const u = await prisma.products.findUnique({
      where: { id },
      select: { id: true, provider_id: true, category_id: true, is_rental: true, price_unit: true, photo: true },
    });
    if (!u) throw new NotFoundException();
    if (!u.provider_id) throw new BadRequestException('Solo una máquina de aliado se clasifica en un tipo.');
    const repetido = await prisma.products.findFirst({
      where: { provider_id: null, category_id: u.category_id, name: nombre.data.nombre, status: { in: [0, 1] } },
      select: { id: true },
    });
    const ahora = new Date();
    const ficha = repetido ?? await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: u.category_id,
        name: nombre.data.nombre,
        description: nombre.data.nombre,
        // La ficha nueva sale en el catálogo: que no salga sin foto (2026-10-22).
        photo: await copiarSubida(u.photo, 'tipo'),
        cprice: 0,
        is_rental: u.is_rental,
        price_unit: u.price_unit,
        status: 1,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true },
    });
    await prisma.products.update({ where: { id }, data: { tipo_id: ficha.id, updated_at: ahora } });
    return { id: ficha.id, nombre: nombre.data.nombre, yaExistia: !!repetido };
  }

  @Get('providers')
  async providersForSelect() {
    return prisma.providers.findMany({
      where: { status: 1 },
      select: { id: true, name: true, level: true },
      orderBy: { name: 'asc' },
    });
  }

  @Post('products')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 8 * 1024 * 1024 } }))
  async createProduct(@Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) throw new BadRequestException('Foto inválida');
    const d = parsed.data;
    const providerId = leerProveedor(d.providerId) ?? null;
    await exigirProveedor(providerId);
    // Solo una máquina de aliado lleva tipo; la ficha ES el tipo.
    const tipoId = providerId ? (await leerTipo(d.tipoId, d.categoryId)) ?? null : null;
    const tarifas = leerTarifas(d.tarifas);
    const costo = leerTarifas(d.costoAliado);
    const horario = leerHorario(d.horario);
    const created = await prisma.products.create({
      data: {
        user_id: 0, // producto de la casa
        provider_id: providerId,
        tipo_id: tipoId,
        category_id: d.categoryId,
        name: d.name,
        description: d.description,
        // Con tarifas, el precio mostrado es el de la unidad principal.
        cprice: tarifas && d.priceUnit ? (tarifas[d.priceUnit] ?? 0) : d.price,
        pprice: d.oldPrice ?? null,
        stock: d.stock ?? null,
        tarifas: (tarifas ?? undefined) as never,
        costo_aliado: (costo ?? undefined) as never,
        minimo: d.minimo ?? null,
        horario: (horario ?? undefined) as never,
        Marca: d.brand ?? null,
        is_rental: d.isRental ?? false,
        price_unit: d.priceUnit?.trim() || null,
        attributes: leerAtributos(d.attributes) as never,
        rental_freight: d.rentalFreight ?? null,
        featured: d.featured ? 1 : 0,
        status: d.status ?? 1,
        lote: d.lote ?? null,
        caducidad: d.caducidad ? new Date(d.caducidad) : null,
        Corto: d.short ?? null,
        specs: d.specs ?? null,
        location: d.location?.trim() || null,
        photo: photo ? `uploads/${photo.filename}` : null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { id: created.id };
  }

  @Patch('products/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 8 * 1024 * 1024 } }))
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const exists = await prisma.products.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    const parsed = productSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) throw new BadRequestException('Foto inválida');
    const d = parsed.data;
    const providerId = leerProveedor(d.providerId);
    await exigirProveedor(providerId);
    // El tipo (2026-10-22): sin aliado no lleva; si cambia de línea y no
    // mandaron otro, se suelta (sería de otra línea).
    const proveedorFinal = providerId !== undefined ? providerId : exists.provider_id;
    const lineaFinal = d.categoryId ?? exists.category_id;
    let tipoId = proveedorFinal ? await leerTipo(d.tipoId, lineaFinal) : (exists.tipo_id !== null ? null : undefined);
    if (tipoId === undefined && proveedorFinal && d.categoryId !== undefined && d.categoryId !== exists.category_id) tipoId = null;
    const tarifas = leerTarifas(d.tarifas);
    const costo = leerTarifas(d.costoAliado);
    const horario = leerHorario(d.horario);
    // La unidad principal que quedará: la nueva o la que ya tenía.
    const unidadFinal = d.priceUnit !== undefined ? d.priceUnit.trim() || null : exists.price_unit;
    await prisma.products.update({
      where: { id },
      data: {
        ...(providerId !== undefined ? { provider_id: providerId } : {}),
        ...(tipoId !== undefined ? { tipo_id: tipoId } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.categoryId !== undefined ? { category_id: d.categoryId } : {}),
        ...(tarifas !== undefined
          ? { cprice: unidadFinal ? (tarifas[unidadFinal] ?? 0) : (d.price ?? exists.cprice) }
          : d.price !== undefined ? { cprice: d.price } : {}),
        ...(tarifas !== undefined ? { tarifas: tarifas as never } : {}),
        ...(costo !== undefined ? { costo_aliado: costo as never } : {}),
        ...(d.minimo !== undefined ? { minimo: d.minimo } : {}),
        ...(horario !== undefined ? { horario: (horario ?? Prisma.JsonNull) as never } : {}),
        ...(d.oldPrice !== undefined ? { pprice: d.oldPrice } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.stock !== undefined ? { stock: d.stock } : {}),
        ...(d.brand !== undefined ? { Marca: d.brand } : {}),
        ...(d.isRental !== undefined ? { is_rental: d.isRental } : {}),
        // Se compara con undefined, no con truthy: '' es un valor valido
        // ("por pieza") y con `|| null` no habria forma de quitar la unidad.
        ...(d.priceUnit !== undefined ? { price_unit: d.priceUnit.trim() || null } : {}),
        ...(d.attributes !== undefined ? { attributes: leerAtributos(d.attributes) as never } : {}),
        ...(d.rentalFreight !== undefined ? { rental_freight: d.rentalFreight } : {}),
        ...(d.featured !== undefined ? { featured: d.featured ? 1 : 0 } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.lote !== undefined ? { lote: d.lote } : {}),
        ...(d.caducidad !== undefined ? { caducidad: d.caducidad ? new Date(d.caducidad) : null } : {}),
        ...(d.short !== undefined ? { Corto: d.short } : {}),
        ...(d.specs !== undefined ? { specs: d.specs } : {}),
        ...(d.location !== undefined ? { location: d.location.trim() || null } : {}),
        ...(photo ? { photo: `uploads/${photo.filename}` } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    // Antes era solo baja lógica (status 0 = "Inactivo") y la ficha seguía en
    // la lista. Órdenes y cotizaciones guardan copia del carrito, no dependen
    // de la fila; solo las rentas apuntan al equipo. Con rentas se oculta
    // (ESTADO_ELIMINADO) para no romper el historial; sin ellas se borra.
    const antes = await prisma.products.findUnique({ where: { id }, select: { provider_id: true } });
    const rentas = await prisma.rental_periods.count({ where: { product_id: id } });
    if (rentas > 0) {
      await prisma.products.update({ where: { id }, data: { status: ESTADO_ELIMINADO, featured: 0, updated_at: new Date() } });
      return { ok: true, archived: true };
    }
    await prisma.$transaction([
      prisma.galleries.deleteMany({ where: { product_id: id } }),
      prisma.wishlists.deleteMany({ where: { product_id: id } }),
      prisma.product_clicks.deleteMany({ where: { product_id: id } }),
      prisma.availability_blocks.deleteMany({ where: { product_id: id } }),
      prisma.comments.deleteMany({ where: { product_id: id } }),
      prisma.product_questions.deleteMany({ where: { product_id: id } }),
      prisma.reviews.deleteMany({ where: { product_id: id } }),
      // Si era una ficha de tipo, sus máquinas quedan "sin tipo" (2026-10-22).
      prisma.products.updateMany({ where: { tipo_id: id }, data: { tipo_id: null } }),
      prisma.products.delete({ where: { id } }),
    ]);
    // Borrado de verdad: sale también del tabulador (2026-10-19). Archivado no
    // hace falta: un renglón con su ficha de baja ya no se ofrece al cotizar.
    if (antes) await this.quoter.quitarDelTabulador(id, antes.provider_id === null, req.adminEmail);
    return { ok: true, archived: false };
  }

  // ---- Galería del producto (máx. 6 imágenes) ----

  @Get('products/:id/gallery')
  async gallery(@Param('id', ParseIntPipe) id: number) {
    const rows = await prisma.galleries.findMany({ where: { product_id: id }, orderBy: { id: 'asc' } });
    return rows.map((g) => ({ id: Number(g.id), url: imageUrl(g.photo) }));
  }

  @Post('products/:id/gallery')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 8 * 1024 * 1024 } }))
  async addGallery(@Param('id', ParseIntPipe) id: number, @UploadedFile() photo?: Express.Multer.File) {
    const prod = await prisma.products.findUnique({ where: { id } });
    if (!prod) throw new NotFoundException();
    if (!photo) throw new BadRequestException('Falta la imagen');
    if (!IMAGE_TYPES.test(photo.mimetype)) throw new BadRequestException('Imagen inválida');
    const count = await prisma.galleries.count({ where: { product_id: id } });
    if (count >= 6) throw new BadRequestException('Máximo 6 imágenes por producto');
    const path = `uploads/${photo.filename}`;
    const g = await prisma.galleries.create({ data: { product_id: id, photo: path, created_at: new Date(), updated_at: new Date() } });
    return { id: Number(g.id), url: imageUrl(path) };
  }

  @Delete('products/:id/gallery/:galleryId')
  async deleteGallery(@Param('id', ParseIntPipe) id: number, @Param('galleryId') galleryId: string) {
    await prisma.galleries.deleteMany({ where: { id: BigInt(galleryId), product_id: id } });
    return { ok: true };
  }

  // ---- Categorías ----

  @Get('categories')
  async categories() {
    const [cats, counts] = await Promise.all([
      prisma.categories.findMany({ orderBy: [{ sort_order: 'asc' }, { cat_name: 'asc' }] }),
      prisma.products.groupBy({ by: ['category_id'], _count: { _all: true } }),
    ]);
    const countMap = new Map(counts.map((c) => [c.category_id, c._count._all]));
    return ordenDeCategorias(cats).map((c) => ({
      id: c.id,
      name: c.cat_name,
      slug: c.cat_slug,
      status: c.status,
      image: imageUrl(c.photo),
      video: imageUrl(c.video),
      description: c.description ?? null,
      productCount: countMap.get(c.id) ?? 0,
    }));
  }

  @Post('categories')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async createCategory(@Body() body: unknown, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) throw new BadRequestException('Foto inválida');
    const slug = slugify(parsed.data.name);
    const dup = await prisma.categories.findUnique({ where: { cat_slug: slug } });
    if (dup) throw new BadRequestException('Ya existe una categoría con ese nombre');
    // La nueva entra al final del orden del sitio; con 0 caía donde le tocara por nombre.
    const ultima = await prisma.categories.aggregate({ _max: { sort_order: true } });
    const c = await prisma.categories.create({
      data: {
        cat_name: parsed.data.name,
        cat_slug: slug,
        status: parsed.data.status ?? 1,
        photo: photo ? `uploads/${photo.filename}` : null,
        description: parsed.data.description?.trim() || null,
        sort_order: (ultima._max.sort_order ?? 0) + 1,
      },
    });
    return { id: c.id, slug: c.cat_slug };
  }

  /**
   * Orden de las tarjetas en el inicio y en /categorias (flechas de Catálogo →
   * Categorías). Recibe TODOS los ids en el orden nuevo y numera 1..n.
   */
  @Post('categories/orden')
  async reorderCategories(@Body() body: unknown) {
    const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const ids = [...new Set(parsed.data.ids)];
    await prisma.$transaction(
      ids.map((id, i) => prisma.categories.updateMany({ where: { id }, data: { sort_order: i + 1 } })),
    );
    return { ok: true };
  }

  @Patch('categories/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: photoStorage, limits: { fileSize: 4 * 1024 * 1024 } }))
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const parsed = categorySchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    await prisma.categories.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { cat_name: parsed.data.name } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description.trim() || null } : {}),
        ...(photo ? { photo: `uploads/${photo.filename}` } : {}),
      },
    });
    return { ok: true };
  }

  /**
   * Video en bucle de la tarjeta (2026-10-19). Va aparte del PATCH para que un
   * archivo de varios MB no viaje cada vez que se corrige el nombre. El video
   * anterior se borra del disco: pesan mucho para dejarlos huérfanos.
   */
  @Post('categories/:id/video')
  @UseInterceptors(FileInterceptor('video', { storage: videoStorage(), limits: { fileSize: VIDEO_MAX_MB * 1024 * 1024 } }))
  async uploadCategoryVideo(@Param('id', ParseIntPipe) id: number, @UploadedFile() video?: Express.Multer.File) {
    if (!video) throw new BadRequestException('Falta el video');
    const path = `uploads/${video.filename}`;
    const cat = await prisma.categories.findUnique({ where: { id }, select: { video: true } });
    if (!cat) {
      await borrarSubidas([path]);
      throw new NotFoundException();
    }
    await prisma.categories.update({ where: { id }, data: { video: path } });
    if (cat.video && cat.video !== path) void borrarSubidas([cat.video]);
    return { ok: true, video: imageUrl(path) };
  }

  @Delete('categories/:id/video')
  async deleteCategoryVideo(@Param('id', ParseIntPipe) id: number) {
    const cat = await prisma.categories.findUnique({ where: { id }, select: { video: true } });
    if (!cat) throw new NotFoundException();
    await prisma.categories.update({ where: { id }, data: { video: null } });
    void borrarSubidas([cat.video]);
    return { ok: true };
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    const inUse = await prisma.products.count({ where: { category_id: id } });
    if (inUse > 0) throw new BadRequestException(`La categoría tiene ${inUse} producto(s); muévelos primero`);
    const borrada = await prisma.categories.delete({ where: { id } });
    void borrarSubidas([borrada.video]);
    return { ok: true };
  }
}
