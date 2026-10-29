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
import { horarioSchema, puedeVerCon, tarifasDe } from '@maqserv/config';
import { permisosVigentes } from './permisos';
import { ESTADO_CATEGORIA_PROPUESTA, ESTADO_ELIMINADO, ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { lista } from '../common/json-list';
import { MailerService } from '../notifications/mailer.service';
import { correoEquipoPublicado, correoEquipoRechazado } from '../notifications/email-templates';
import { AJUSTE_MARGEN, guardarAjuste, margenAliadoPct } from '../common/platform-settings';
import { imageUrl } from '../catalog/images';
import { ordenDeCategorias } from '../catalog/categories.service';

/**
 * Los tipos que se parecen a lo que escribió el aliado (2026-10-28): cuántas
 * palabras comparten, y las palabras pesan más que las medidas ("Volteo 20 t"
 * se parece a "Volteo 14 m³" aunque el tonelaje sea otro). Las palabras que
 * no dicen qué máquina es ("de", "hidráulica") no cuentan: si no, una grúa
 * hidráulica se parecía a una excavadora hidráulica.
 */
const NO_CUENTAN = new Set(['de', 'del', 'la', 'el', 'las', 'los', 'con', 'para', 'sin', 'y', 'hidraulica', 'hidraulico', 'electrica', 'electrico', 'renta', 'servicio']);
function parecidos<T extends { nombre: string }>(nombre: string, tipos: T[]): T[] {
  const palabras = (x: string) =>
    new Set(
      x.toLowerCase().replace(/³/g, '3').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((w) => (w.length > 2 || /\d/.test(w)) && !NO_CUENTAN.has(w)),
    );
  const mias = palabras(nombre);
  return tipos
    .map((t) => {
      let puntos = 0;
      // Medidas ("20", "m3"): 1 punto; palabras ("volteo", "pipa"): 3.
      for (const w of palabras(t.nombre)) if (mias.has(w)) puntos += /\d/.test(w) ? 1 : 3;
      return { t, puntos };
    })
    .filter((x) => x.puntos >= 3)
    .sort((a, b) => b.puntos - a.puntos)
    .map((x) => x.t);
}

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

/**
 * LOS PRECIOS SOLO LOS CAMBIA QUIEN TIENE "TARIFAS" (decisión de Dirección,
 * 2026-10-23; de fábrica, solo Dirección). Operaciones sigue dando de alta y
 * editando fichas, pero lo que es precio al cliente —precio, tarifas, mínimo,
 * flete, precio anterior y, al editar, la unidad con la que se cobra ("por
 * viaje" → "por hora" cambia el precio aunque el número sea el mismo)— no se
 * escribe aunque venga en el formulario. Al CREAR sí se pone la unidad: la
 * ficha nace sin precio y Dirección lo pone después. Lo que cobra el aliado
 * (`costoAliado`) sí se guarda: es un dato que da él.
 */
async function sinPreciosSiNoPuede<T extends { price?: number; tarifas?: string; minimo?: number; rentalFreight?: number; oldPrice?: number; priceUnit?: string }>(
  req: AdminRequest,
  d: T,
  alCrear: boolean,
): Promise<{ datos: T; puede: boolean }> {
  if (puedeVerCon(req.adminRol, 'tarifas', await permisosVigentes())) return { datos: d, puede: true };
  const { price: _p, tarifas: _t, minimo: _m, rentalFreight: _f, oldPrice: _o, ...resto } = d;
  void _p; void _t; void _m; void _f; void _o;
  const datos = { ...resto } as T;
  if (!alCrear) delete datos.priceUnit;
  return { datos, puede: false };
}

/** Lo que es precio de una ficha, comparable (vacío y 0 cuentan igual), para la bitácora. */
function preciosDe(p: { cprice: unknown; tarifas: unknown; minimo: unknown; rental_freight: unknown; pprice: unknown; price_unit: string | null }): Record<string, string> {
  const n = (v: unknown) => String(Number(v ?? 0) || 0);
  const t = tarifasDe(p.tarifas);
  return {
    precio: n(p.cprice),
    tarifas: JSON.stringify(Object.fromEntries(Object.entries(t).sort(([a], [b]) => a.localeCompare(b)))),
    minimo: n(p.minimo),
    flete: n(p.rental_freight),
    anterior: n(p.pprice),
    unidad: p.price_unit ?? '',
  };
}

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
  constructor(
    private readonly quoter: QuoterService,
    private readonly mailer: MailerService,
  ) {}

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
   * LO NUEVO QUE OFRECEN LOS ALIADOS (2026-10-28, revisión de Proveedores).
   *
   * Nada de lo que ofrece un aliado se publica: lo que es de un tipo de la
   * lista cuenta solo (le llegan las solicitudes de ese tipo). Lo que no está
   * en la lista queda "Nuevo" (ESTADO_POR_REVISAR) y se decide aquí, en
   * Inventario, donde viven los servicios de MAQSER24, y no en Proveedores:
   *  - "Es el mismo que…": se liga a un tipo que ya existe (es-tipo).
   *  - "Crear servicio nuevo": nace la ficha de MAQSER24, APAGADA, y la máquina
   *    queda ligada (crear-tipo). Sale en el sitio cuando tenga su precio y se
   *    prenda: un volteo de 20 t no cuesta lo mismo que uno de 10 t.
   *  - "No lo manejamos": se quita y se le avisa al aliado con el motivo.
   * Con los parecidos que ya existen al lado, para no crear repetidos.
   */
  @Get('nuevos-de-aliados')
  async nuevosDeAliados() {
    let nuevos = await prisma.products.findMany({
      where: { status: ESTADO_POR_REVISAR, provider_id: { not: null } },
      select: { id: true, name: true, stock: true, location: true, category_id: true, provider_id: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });
    if (!nuevos.length) return { nuevos: [], tipos: {} };
    const [catsNuevos, aliadosActivos] = await Promise.all([
      prisma.categories.findMany({ where: { id: { in: [...new Set(nuevos.map((n) => n.category_id))] } }, select: { id: true, status: true } }),
      prisma.providers.findMany({ where: { status: 1, id: { in: [...new Set(nuevos.map((n) => n.provider_id as number))] } }, select: { id: true } }),
    ]);
    const propuestas = new Set(catsNuevos.filter((c) => c.status === ESTADO_CATEGORIA_PROPUESTA).map((c) => c.id));
    const activos = new Set(aliadosActivos.map((p) => p.id));
    nuevos = nuevos.filter((n) => !propuestas.has(n.category_id) && activos.has(n.provider_id as number));
    if (!nuevos.length) return { nuevos: [], tipos: {} };
    const idsCat = [...new Set(nuevos.map((n) => n.category_id))];
    const [provs, cats, tipos] = await Promise.all([
      prisma.providers.findMany({ where: { id: { in: [...new Set(nuevos.map((n) => n.provider_id as number))] } }, select: { id: true, name: true } }),
      prisma.categories.findMany({ where: { id: { in: idsCat } }, select: { id: true, cat_name: true } }),
      prisma.products.findMany({
        where: { provider_id: null, status: { in: [0, 1] }, category_id: { in: idsCat } },
        select: { id: true, name: true, category_id: true, status: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const tiposDe = (cat: number) => tipos.filter((t) => t.category_id === cat).map((t) => ({ id: t.id, nombre: t.name, activo: t.status === 1 }));
    return {
      nuevos: nuevos.map((n) => ({
        id: n.id,
        nombre: n.name,
        unidades: n.stock,
        donde: n.location,
        desde: n.created_at,
        categoryId: n.category_id,
        linea: cats.find((c) => c.id === n.category_id)?.cat_name ?? '',
        aliado: { id: n.provider_id, nombre: provs.find((p) => p.id === n.provider_id)?.name ?? '' },
        parecidos: parecidos(n.name, tiposDe(n.category_id)).slice(0, 3),
      })),
      // Todos los tipos de cada línea, para "Es el mismo que…".
      tipos: Object.fromEntries(idsCat.map((c) => [c, tiposDe(c)])),
    };
  }

  /** "Es el mismo que…": la máquina nueva se liga a un tipo que ya existe. */
  @Post('products/:id/es-tipo')
  async esTipo(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const b = z.object({ tipoId: z.coerce.number().int().positive() }).safeParse(body ?? {});
    if (!b.success) throw new BadRequestException('Elige el tipo.');
    const m = await this.maquinaDeAliado(id);
    const tipo = await prisma.products.findFirst({
      where: { id: b.data.tipoId, provider_id: null, category_id: m.category_id, status: { in: [0, 1] } },
      select: { id: true, name: true },
    });
    if (!tipo) throw new BadRequestException('Ese tipo no es de la misma línea.');
    await this.darDeAlta(m, tipo, req);
    return { ok: true, tipo: tipo.name };
  }

  /**
   * "Crear servicio nuevo" (y "Crear tipo nuevo" en la ficha de la máquina,
   * 2026-10-22). Nace la ficha sin aliado en la misma línea, sin precio y
   * APAGADA desde 2026-10-28: sale en el sitio cuando se le pone su precio y
   * se prende. La foto se copia (la del aliado se borraría con su equipo). La
   * máquina queda ligada y, si era nueva, ya le llegan las solicitudes.
   */
  @Post('products/:id/crear-tipo')
  async crearTipo(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const nombre = z.object({ nombre: z.string().trim().min(3, 'Escribe el nombre del servicio').max(190) }).safeParse(body ?? {});
    if (!nombre.success) throw new BadRequestException(nombre.error.issues[0]?.message ?? 'Nombre inválido');
    const u = await this.maquinaDeAliado(id);
    const repetido = await prisma.products.findFirst({
      where: { provider_id: null, category_id: u.category_id, name: nombre.data.nombre, status: { in: [0, 1] } },
      select: { id: true, name: true },
    });
    const ahora = new Date();
    const ficha = repetido ?? await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: u.category_id,
        name: nombre.data.nombre,
        description: nombre.data.nombre,
        photo: await copiarSubida(u.photo, 'tipo'),
        cprice: 0,
        is_rental: u.is_rental,
        price_unit: u.price_unit,
        status: 0,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true, name: true },
    });
    if (!repetido) await registrarAccion(req, 'catalogo', 'tipo.crear', ficha.name, `desde el equipo «${u.name}» de un aliado; nace apagado`);
    await this.darDeAlta(u, ficha, req);
    return { id: ficha.id, nombre: ficha.name, yaExistia: !!repetido };
  }

  /** "No lo manejamos": se quita lo nuevo y al aliado le llega el motivo. */
  @Post('products/:id/no-lo-manejamos')
  async noLoManejamos(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const motivo = z.object({ motivo: z.string().trim().min(4, 'Escribe el motivo: el aliado lo recibe por correo.').max(1000) }).safeParse(body ?? {});
    if (!motivo.success) throw new BadRequestException(motivo.error.issues[0]?.message ?? 'Falta el motivo');
    const e = await this.maquinaDeAliado(id);
    if (e.status !== ESTADO_POR_REVISAR) throw new BadRequestException('Solo se quita lo nuevo; lo demás se da de baja desde su ficha.');
    // También se borran las fotos del disco (QA 2026-09-25: quedaban huérfanas).
    const fotos = [...(await prisma.galleries.findMany({ where: { product_id: id }, select: { photo: true } })).map((g) => g.photo), e.photo];
    await prisma.galleries.deleteMany({ where: { product_id: id } });
    await prisma.products.delete({ where: { id } });
    void borrarSubidas(fotos);
    await registrarAccion(req, 'catalogo', 'aliado.equipo.quitar', e.name, motivo.data.motivo);
    const p = await prisma.providers.findUnique({ where: { id: e.provider_id as number }, select: { email: true, contact_name: true } });
    if (p?.email) {
      void this.mailer
        .enviar({ kind: 'provider_offer_rejected', to: p.email, toName: p.contact_name, providerId: e.provider_id, ...correoEquipoRechazado({ contacto: p.contact_name, equipo: e.name, motivo: motivo.data.motivo }) })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  /** La máquina de un aliado (no una ficha de MAQSER24), o 404 / 400. */
  private async maquinaDeAliado(id: number) {
    const m = await prisma.products.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, provider_id: true, category_id: true, is_rental: true, price_unit: true, photo: true },
    });
    if (!m) throw new NotFoundException();
    if (!m.provider_id) throw new BadRequestException('Solo una máquina de aliado se clasifica en un tipo.');
    return m;
  }

  /** Liga la máquina a su tipo; si era nueva, queda activa y se le avisa al aliado. */
  private async darDeAlta(m: { id: number; name: string; status: number; provider_id: number | null }, tipo: { id: number; name: string }, req: AdminRequest) {
    const eraNueva = m.status === ESTADO_POR_REVISAR;
    const ahora = new Date();
    await prisma.products.update({
      where: { id: m.id },
      data: { tipo_id: tipo.id, updated_at: ahora, ...(eraNueva ? { status: 1, availability_confirmed_at: ahora } : {}) },
    });
    if (!eraNueva) return;
    await registrarAccion(req, 'catalogo', 'aliado.equipo.tipo', m.name, `queda como «${tipo.name}»`);
    const p = m.provider_id ? await prisma.providers.findUnique({ where: { id: m.provider_id }, select: { email: true, contact_name: true } }) : null;
    if (p?.email) {
      void this.mailer
        .enviar({ kind: 'provider_offer_published', to: p.email, toName: p.contact_name, providerId: m.provider_id, ...correoEquipoPublicado({ contacto: p.contact_name, equipo: m.name, tipo: tipo.name }) })
        .catch(() => undefined);
    }
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
  async createProduct(@Body() body: unknown, @Req() req: AdminRequest, @UploadedFile() photo?: Express.Multer.File) {
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) throw new BadRequestException('Foto inválida');
    // Sin "Tarifas", la ficha nace sin precio: lo pone Dirección.
    const { datos: sinPrecio } = await sinPreciosSiNoPuede(req, parsed.data, true);
    const d = { ...sinPrecio, price: sinPrecio.price ?? 0 };
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
    @Req() req: AdminRequest,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const exists = await prisma.products.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    const parsed = productSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    if (photo && !IMAGE_TYPES.test(photo.mimetype)) throw new BadRequestException('Foto inválida');
    // Sin "Tarifas" los precios no se tocan (ver `sinPreciosSiNoPuede`).
    const { datos: d, puede: puedePrecios } = await sinPreciosSiNoPuede(req, parsed.data, false);
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
    // Quien sí puede cambiar precios deja rastro de qué cambió (auditoría 2026-10-23).
    if (puedePrecios) {
      const despues = await prisma.products.findUnique({ where: { id }, select: { cprice: true, tarifas: true, minimo: true, rental_freight: true, pprice: true, price_unit: true } });
      const a = preciosDe(exists);
      const b = despues ? preciosDe(despues) : a;
      const cambios = Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}: ${a[k] || '—'} → ${b[k] || '—'}`);
      if (cambios.length) await registrarAccion(req, 'tarifas', 'precio.ficha', exists.name, cambios.join(' · '));
    }
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

  /**
   * CATEGORÍAS NUEVAS QUE PROPONEN LOS ALIADOS (2026-10-28, revisión de
   * Inventario y Categorías). Lo que escribieron en "Otra: no está en la
   * lista" al registrarse o en su portal. Solo de aliados ya aceptados: las de
   * una solicitud esperan a que la aceptes. Con las categorías parecidas al
   * lado, para no duplicar ("Renta de grúas" → Renta de maquinaria pesada).
   */
  @Get('categorias-nuevas')
  async categoriasNuevas() {
    const props = await prisma.categories.findMany({
      where: { status: ESTADO_CATEGORIA_PROPUESTA },
      select: { id: true, cat_name: true, cat_slug: true },
      orderBy: { id: 'asc' },
    });
    const existentes = await prisma.categories.findMany({
      where: { status: { in: [0, 1] } },
      select: { id: true, cat_name: true, status: true, sort_order: true },
      orderBy: [{ sort_order: 'asc' }, { cat_name: 'asc' }],
    });
    const categorias = existentes.map((c) => ({ id: c.id, nombre: c.cat_name, activa: c.status === 1 }));
    if (!props.length) return { nuevas: [], categorias };
    const [provs, equipos] = await Promise.all([
      prisma.providers.findMany({ where: { status: 1 }, select: { id: true, name: true, categories: true } }),
      prisma.products.findMany({
        where: { category_id: { in: props.map((c) => c.id) }, provider_id: { not: null } },
        select: { id: true, name: true, stock: true, category_id: true, provider_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);
    const nuevas = props
      .map((c) => {
        const suyos = provs.filter((p) => lista(p.categories).includes(c.cat_slug));
        if (!suyos.length) return null;
        const eq = equipos.filter((e) => e.category_id === c.id && suyos.some((p) => p.id === e.provider_id));
        return {
          id: c.id,
          nombre: c.cat_name,
          desde: eq[0]?.created_at ?? null,
          aliados: suyos.map((p) => ({ id: p.id, nombre: p.name })),
          equipos: eq.map((e) => ({ id: e.id, nombre: e.name, unidades: e.stock })),
          parecidas: parecidos(c.cat_name, categorias).slice(0, 3),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { nuevas, categorias };
  }

  /**
   * "Es la misma que…": sus equipos pasan a esa categoría (siguen "Nuevo" y se
   * deciden en Inventario) y, en el expediente de cada aliado, la propuesta se
   * cambia por ella. La propuesta se borra.
   */
  @Post('categories/:id/es-la-misma')
  async categoriaEsLaMisma(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const b = z.object({ categoriaId: z.coerce.number().int().positive() }).safeParse(body ?? {});
    if (!b.success) throw new BadRequestException('Elige la categoría.');
    const prop = await this.categoriaPropuesta(id);
    const destino = await prisma.categories.findFirst({ where: { id: b.data.categoriaId, status: { in: [0, 1] } }, select: { id: true, cat_name: true, cat_slug: true } });
    if (!destino) throw new BadRequestException('Esa categoría no existe.');
    const movidos = await prisma.products.updateMany({ where: { category_id: prop.id }, data: { category_id: destino.id, updated_at: new Date() } });
    await this.cambiarEnExpedientes(prop.cat_slug, destino.cat_slug);
    await prisma.categories.delete({ where: { id: prop.id } });
    await registrarAccion(req, 'catalogo', 'categoria.nueva.misma', prop.cat_name, `es la misma que «${destino.cat_name}»; ${movidos.count} equipo(s) pasan a ella`);
    return { ok: true, destino: destino.cat_name, equipos: movidos.count };
  }

  /** "Autorizar": queda como categoría de MAQSER24, APAGADA; sus equipos siguen "Nuevo" en Inventario. */
  @Post('categories/:id/autorizar')
  async autorizarCategoria(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const prop = await this.categoriaPropuesta(id);
    // El slug provisional ("gruas-nueva") se queda: ya está en el expediente de sus aliados.
    await prisma.categories.update({ where: { id: prop.id }, data: { status: 0 } });
    await registrarAccion(req, 'catalogo', 'categoria.nueva.autorizar', prop.cat_name, 'nace apagada');
    return { ok: true, nombre: prop.cat_name };
  }

  /** "No la manejamos": se quitan la categoría y sus equipos; a cada aliado le llega el motivo. */
  @Post('categories/:id/no-la-manejamos')
  async categoriaNoLaManejamos(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const motivo = z.object({ motivo: z.string().trim().min(4, 'Escribe el motivo: el aliado lo recibe por correo.').max(1000) }).safeParse(body ?? {});
    if (!motivo.success) throw new BadRequestException(motivo.error.issues[0]?.message ?? 'Falta el motivo');
    const prop = await this.categoriaPropuesta(id);
    const suyos = await prisma.products.findMany({ where: { category_id: prop.id }, select: { id: true, photo: true, provider_id: true } });
    const ids = suyos.map((e) => e.id);
    const fotos = [...(await prisma.galleries.findMany({ where: { product_id: { in: ids } }, select: { photo: true } })).map((g) => g.photo), ...suyos.map((e) => e.photo)];
    await prisma.galleries.deleteMany({ where: { product_id: { in: ids } } });
    await prisma.availability_blocks.deleteMany({ where: { product_id: { in: ids } } });
    await prisma.products.deleteMany({ where: { id: { in: ids } } });
    void borrarSubidas(fotos);
    const avisados = await this.cambiarEnExpedientes(prop.cat_slug, null);
    await prisma.categories.delete({ where: { id: prop.id } });
    await registrarAccion(req, 'catalogo', 'categoria.nueva.quitar', prop.cat_name, motivo.data.motivo);
    const aliados = await prisma.providers.findMany({ where: { id: { in: avisados }, status: 1 }, select: { id: true, email: true, contact_name: true } });
    for (const p of aliados) {
      if (!p.email) continue;
      void this.mailer
        .enviar({ kind: 'provider_offer_rejected', to: p.email, toName: p.contact_name, providerId: p.id, ...correoEquipoRechazado({ contacto: p.contact_name, equipo: `la categoría «${prop.cat_name}»`, motivo: motivo.data.motivo }) })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  /** Una categoría propuesta por un aliado, o 404 / 400. */
  private async categoriaPropuesta(id: number) {
    const c = await prisma.categories.findUnique({ where: { id }, select: { id: true, cat_name: true, cat_slug: true, status: true } });
    if (!c) throw new NotFoundException();
    if (c.status !== ESTADO_CATEGORIA_PROPUESTA) throw new BadRequestException('Esa categoría ya se decidió.');
    return c;
  }

  /** En el expediente de cada aliado, cambia (o quita, con null) un slug. Devuelve a quiénes tocó. */
  private async cambiarEnExpedientes(slug: string, por: string | null): Promise<number[]> {
    const provs = await prisma.providers.findMany({ select: { id: true, categories: true } });
    const tocados: number[] = [];
    for (const p of provs) {
      const suyas = lista(p.categories);
      if (!suyas.includes(slug)) continue;
      const nuevas = [...new Set(suyas.map((s) => (s === slug ? por : s)).filter((s): s is string => !!s))];
      await prisma.providers.update({ where: { id: p.id }, data: { categories: nuevas, updated_at: new Date() } });
      tocados.push(p.id);
    }
    return tocados;
  }

  @Get('categories')
  async categories() {
    const [cats, counts] = await Promise.all([
      // Sin las que propuso un aliado (2026-10-28): van en «Categorías nuevas».
      prisma.categories.findMany({ where: { status: { not: ESTADO_CATEGORIA_PROPUESTA } }, orderBy: [{ sort_order: 'asc' }, { cat_name: 'asc' }] }),
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
