import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { COTIZADOR_TIPOS, fichaDe, ligarProducto, renglonesDe, slugify, tarifasDe, tarifasPropuestas } from '@maqserv/config';
import { margenAliadoPct } from '../common/platform-settings';
import { disponibilidadDe } from '../catalog/availability';
import { lista } from '../common/json-list';
import { z } from 'zod';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { QuoterService } from '../quoter/quoter.service';
import { registrarAccion } from './audit';
import { estadoDocumentos, estaVerificado, mesesEnRed, DIAS_AVISO, TIPOS_DOC } from '../catalog/provider-trust';
import { documentosQueAvisan, textoAviso, urgencia, type AvisoAliado } from '../catalog/document-alerts';
import { historialDe, resumenHistorial, desviacionRespuesta } from '../catalog/provider-history';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { MailerService } from '../notifications/mailer.service';
import { correoAccesoAliado, correoEquipoPublicado, correoEquipoRechazado } from '../notifications/email-templates';
import { ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { FreightService } from '../freight/freight.service';
import { CATALOGO, resumenPuntualidad, textoPuntualidad } from '../quotes/incidents';
import { imageUrl } from '../catalog/images';

/**
 * RED DE ALIADOS — alta y expediente de proveedores.
 *
 * Modelo del documento institucional, sección 15. Lo que este controlador NO
 * permite, a propósito: marcar a alguien como "verificado" a mano. El sello sale
 * del nivel más la vigencia de sus papeles (ver `provider-trust`), porque el
 * documento pide que el sello tenga un significado real y no sea decorativo.
 */

// TIPOS_DOC vive en `provider-trust` (junto a las reglas que evalúan el
// expediente): el portal del aliado también lo usa para renovar sus papeles.
const NIVELES = ['registrado', 'validado', 'activo', 'preferente'] as const;

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
  /** Dirección de su base, para poder geocodificarla. */
  address: z.string().max(500).optional().nullable(),
  /** Hasta dónde llega desde ahí. Null = sólo vale su lista de municipios. */
  coverageRadiusKm: z.coerce.number().int().min(1).max(1500).optional().nullable(),
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

@Modulo('proveedores')
@Controller('admin/providers')
@UseGuards(AdminGuard)
export class AdminProvidersController {
  constructor(
    private readonly mailer: MailerService,
    private readonly freight: FreightService,
    private readonly quoter: QuoterService,
  ) {}

  /**
   * Los renglones de los dos cotizadores, para decir "este equipo cuenta como
   * tal renglón" al publicar. Trae la línea de cada uno: el panel solo ofrece
   * los de la línea del equipo.
   */
  @Get('cotizador/renglones')
  async renglonesCotizador() {
    const out = [];
    for (const tipo of COTIZADOR_TIPOS) out.push(...renglonesDe(await this.quoter.catalogo(tipo)));
    return out;
  }

  /**
   * AVISOS DE EXPEDIENTE (documento institucional, sección 23).
   *
   * "La plataforma requiere alertas y reglas que impidan tratar como verificado
   * un expediente desactualizado." Las reglas ya estaban; esto es la alerta.
   *
   * Va ANTES de las rutas con `:id` a propósito: si se declarara después, Nest
   * podría leer "alerts" como un id y la ruta nunca respondería.
   */
  /**
   * Poner al aliado en el mapa.
   *
   * Reusa el MISMO geocodificador que el cotizador de traslado, con su cache y
   * su reintento por componentes: tener dos seria tener dos formas de fallar y
   * dos resultados distintos para la misma direccion.
   */
  @Post(':id/geocodificar')
  async geocodificar(@Param('id', ParseIntPipe) id: number) {
    const p = await prisma.providers.findUnique({
      where: { id },
      select: { address: true, city: true, state: true, name: true },
    });
    if (!p) throw new NotFoundException('Aliado no encontrado');

    // Si no capturaron direccion, se intenta con ciudad y estado: es peor
    // precision pero mejor que nada, y el radio absorbe el error.
    const consulta = [p.address, p.city, p.state].map((x) => x?.trim()).filter(Boolean).join(', ');
    if (!consulta) {
      throw new BadRequestException('Sin dirección ni ciudad no hay a dónde ubicarlo.');
    }

    const punto = await this.freight.geocode(consulta);
    if (!punto) {
      return {
        ok: false,
        mensaje: `No encontramos "${consulta}". Prueba con una direccion mas simple: calle y municipio bastan.`,
      };
    }

    await prisma.providers.update({
      where: { id },
      data: { lat: punto.lat, lng: punto.lon, updated_at: new Date() },
    });
    return {
      ok: true,
      lat: punto.lat,
      lng: punto.lon,
      mensaje: `${p.name} quedó ubicado. Falta decirle hasta cuántos km llega.`,
    };
  }

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

    /**
     * QUÉ OFRECE CADA ALIADO (2026-09-24): sus máquinas con tipo, marca, ficha
     * técnica, foto y disponibilidad. Antes solo había un "N equipo(s)" y para
     * saber qué tenía había que buscarlo en el catálogo. Dos consultas para
     * todos los aliados, no una por aliado.
     */
    const [productos, categorias] = await Promise.all([
      prisma.products.findMany({
        // Activos y los que el aliado ofreció desde su portal y esperan revisión.
        where: { status: { in: [1, ESTADO_POR_REVISAR] }, provider_id: { not: null } },
        select: {
          id: true, name: true, Marca: true, category_id: true, attributes: true, photo: true, status: true,
          stock: true, location: true, availability_confirmed_at: true, provider_id: true,
          is_rental: true, price_unit: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.categories.findMany({ select: { id: true, cat_slug: true, cat_name: true } }),
    ]);
    const catPorId = new Map(categorias.map((c) => [c.id, c]));
    const nombreDeSlug = new Map(categorias.map((c) => [c.cat_slug, c.cat_name]));
    const hoy = new Date();
    const equiposPor = new Map<number, Array<Record<string, unknown>>>();
    for (const e of productos) {
      const c = catPorId.get(e.category_id);
      const disp = disponibilidadDe(
        { stock: e.stock, location: e.location, confirmedAt: e.availability_confirmed_at, blocks: [] },
        hoy,
      );
      const fila = {
        id: e.id,
        name: e.name,
        brand: e.Marca?.trim() || null,
        category: c?.cat_name ?? null,
        categorySlug: c?.cat_slug ?? null,
        rental: e.is_rental,
        // Capacidad, modelo, implementos… lo que la ficha técnica tenga lleno.
        specs: fichaDe(c?.cat_slug, (e.attributes ?? null) as Record<string, unknown> | null),
        image: imageUrl(e.photo),
        availability: disp.state,
        location: disp.location,
        confirmedAt: e.availability_confirmed_at,
        // Lo ofreció el aliado desde su portal y aún no se publica.
        pending: e.status === ESTADO_POR_REVISAR,
      };
      const k = e.provider_id as number;
      equiposPor.set(k, [...(equiposPor.get(k) ?? []), fila]);
    }

    return provs.map((p) => {
      const docs = estadoDocumentos(p.provider_documents);
      const suyos = equiposPor.get(p.id) ?? [];
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
        address: p.address,
        lat: p.lat != null ? Number(p.lat) : null,
        lng: p.lng != null ? Number(p.lng) : null,
        coverageRadiusKm: p.coverage_radius_km,
        notes: p.notes,
        status: p.status,
        docsStatus: docs,
        verified: estaVerificado(p.level, docs),
        monthsInNetwork: mesesEnRed(p.joined_at),
        documentCount: p.provider_documents.length,
        productCount: suyos.filter((e) => !e.pending).length,
        pendingCount: suyos.filter((e) => e.pending).length,
        // Nombres legibles de sus líneas ("Renta de maquinaria pesada", no el slug).
        categoryLabels: lista(p.categories).map((s) => nombreDeSlug.get(s) ?? s),
        equipment: suyos,
      };
    });
  }

  /**
   * Mandarle al aliado su enlace de acceso.
   *
   * Es el paso que convierte la red de un directorio que operaciones mantiene
   * a mano en algo que se mantiene solo. Sin correo del aliado no hay a donde
   * mandarlo, y se dice asi en vez de fallar en silencio.
   */
  @Post(':id/acceso')
  async enviarAcceso(@Param('id', ParseIntPipe) id: number) {
    const p = await prisma.providers.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, contact_name: true, status: true, access_version: true },
    });
    if (!p) throw new NotFoundException('Aliado no encontrado');
    if (p.status !== 1) throw new BadRequestException('Este aliado esta dado de baja: su enlace no funcionaria.');
    if (!p.email?.trim()) {
      throw new BadRequestException('Este aliado no tiene correo. Agregaselo primero.');
    }

    const token = await firmarAcceso(p.id, p.access_version);
    const url = urlDeAcceso(token);
    const porContestar = await prisma.service_assignments.count({
      where: { provider_id: id, state: 'propuesto' },
    });

    const plantilla = correoAccesoAliado({
      aliado: p.name,
      contacto: p.contact_name,
      url,
      dias: 30,
      porContestar,
    });
    const estado = await this.mailer.enviar({
      kind: 'provider_access',
      to: p.email,
      toName: p.contact_name,
      providerId: p.id,
      ...plantilla,
    });

    await prisma.providers.update({ where: { id }, data: { access_sent_at: new Date() } });

    return {
      estado,
      // La URL se devuelve SIEMPRE, tambien cuando el correo no salio: mientras
      // el envio este apagado, esta es la unica forma de darle acceso a un
      // aliado — se le pasa por WhatsApp y funciona igual.
      url,
      mensaje:
        estado === 'enviado'
          ? `Enlace enviado a ${p.email}.`
          : `El correo no salio (${estado}). Copia el enlace y mandaselo por otro medio.`,
    };
  }

  /**
   * Revocar lo emitido. Sube `access_version` y con eso TODOS los enlaces
   * anteriores dejan de servir — es lo que se usa cuando a un aliado se le va
   * el encargado con el correo en el telefono.
   */
  @Post(':id/revocar-acceso')
  async revocarAcceso(@Param('id', ParseIntPipe) id: number) {
    const p = await prisma.providers.findUnique({ where: { id }, select: { access_version: true } });
    if (!p) throw new NotFoundException('Aliado no encontrado');
    await prisma.providers.update({
      where: { id },
      data: { access_version: p.access_version + 1, updated_at: new Date() },
    });
    return { ok: true, mensaje: 'Los enlaces que se le hayan mandado antes ya no sirven.' };
  }

  /**
   * HISTORIAL DE CUMPLIMIENTO (documento institucional, seccion 23).
   *
   * El expediente dice si tiene los papeles. Esto dice si CUMPLE, que es otra
   * cosa: se puede estar en regla y no contestar nunca, o aceptar y cancelar.
   */
  @Get(':id/history')
  async history(@Param('id', ParseIntPipe) id: number) {
    const [prov, asigs, incidencias] = await Promise.all([
      prisma.providers.findUnique({
        where: { id },
        select: { id: true, name: true, response_minutes: true },
      }),
      prisma.service_assignments.findMany({
        where: { provider_id: id },
        orderBy: { id: 'desc' },
        include: { quotes: { select: { service_state: true, quote_number: true, service_category: true } } },
      }),
      /**
       * Incidencias donde se le marco RESPONSABLE. Las demas quedan en el
       * expediente del servicio: un aliado que aguanto una obra caotica no
       * debe salir peor puntuado por haber estado ahi.
       */
      prisma.service_incidents.findMany({
        where: { provider_id: id },
        select: { id: true, kind: true, severity: true, responsible: true, state: true, description: true, opened_at: true },
        orderBy: { opened_at: 'desc' },
      }),
    ]);
    if (!prov) throw new NotFoundException('Aliado no encontrado');

    const h = historialDe(
      asigs.map((a) => ({
        state: a.state,
        offered_at: a.offered_at,
        responded_at: a.responded_at,
        reason: a.reason,
        serviceState: a.quotes.service_state,
      })),
    );

    // Puntualidad: la mitad que faltaba. Hasta que existio el compromiso de
    // llegada, esto se reportaba como no medible — que era honesto pero era un
    // hueco.
    const punt = resumenPuntualidad(asigs.map((a) => ({ committed_at: a.committed_at, arrived_at: a.arrived_at })));
    const suyas = incidencias.filter((i) => i.responsible === 'aliado');

    return {
      ...h,
      resumen: resumenHistorial(h),
      puntualidad: {
        ...punt,
        texto: textoPuntualidad(punt),
      },
      incidencias: {
        total: incidencias.length,
        // Solo las suyas cuentan contra el: ver decision 2 en incidents.ts.
        propias: suyas.length,
        abiertas: incidencias.filter((i) => i.state === 'abierta').length,
        recientes: incidencias.slice(0, 6).map((i) => ({
          id: i.id,
          kind: i.kind,
          label: CATALOGO[i.kind as keyof typeof CATALOGO]?.label ?? i.kind,
          severity: i.severity,
          responsible: i.responsible,
          state: i.state,
          description: i.description,
          openedAt: i.opened_at,
        })),
      },
      // Los dos numeros juntos a proposito: uno es lo que el aliado prometio,
      // el otro lo que cumple. Ensenar solo el declarado es repetir lo que
      // alguien escribio a mano; ensenar solo el real esconde el compromiso.
      minutosRespuestaDeclarado: prov.response_minutes,
      desviacionRespuesta: desviacionRespuesta(prov.response_minutes, h.minutosRespuestaReal),
      // Las ultimas para poder mirar caso por caso cuando un numero extrana.
      recientes: asigs.slice(0, 8).map((a) => ({
        quoteNumber: a.quotes.quote_number,
        category: a.quotes.service_category,
        state: a.state,
        serviceState: a.quotes.service_state,
        reason: a.reason,
        offeredAt: a.offered_at,
        respondedAt: a.responded_at,
      })),
    };
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
      // La foto que subió el aliado desde su portal, lista para abrirse: es lo
      // que se revisa antes de subirlo a "validado".
      fileUrl: imageUrl(d.file),
      issuedAt: d.issued_at ? d.issued_at.toISOString().slice(0, 10) : null,
      expiresAt: d.expires_at ? d.expires_at.toISOString().slice(0, 10) : null,
    }));
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = providerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;

    /**
     * NO DUPLICAR (2026-09-25): el alta tarda (manda la invitación) y un
     * segundo clic creaba el mismo aliado dos veces. Se rechaza si ya hay uno
     * activo con el mismo correo, o con el mismo nombre y teléfono.
     */
    const correo = d.email?.trim().toLowerCase() || null;
    const activos = await prisma.providers.findMany({ where: { status: 1 }, select: { name: true, email: true, phone: true } });
    const repetido = activos.find((p) =>
      (correo && p.email?.trim().toLowerCase() === correo) ||
      (p.name.trim().toLowerCase() === d.name.trim().toLowerCase() && (p.phone ?? '').replace(/D/g, '') === (d.phone ?? '').replace(/D/g, '')),
    );
    if (repetido) throw new ConflictException(`Ya existe el aliado «${repetido.name}» con esos datos. Ábrelo desde la lista en vez de darlo de alta otra vez.`);

    // El slug sale del nombre, pero dos aliados pueden llamarse parecido y la
    // columna es única: se le agrega un sufijo en vez de reventar con un 500.
    const base = slugify(d.name) || 'aliado';
    let slug = base;
    for (let i = 2; await prisma.providers.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

    const creado = await prisma.providers.create({
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
        address: d.address?.trim() || null,
        coverage_radius_km: d.coverageRadiusKm ?? null,
        notes: d.notes ?? null,
        status: d.status ?? 1,
      },
      select: { id: true, slug: true },
    });

    /**
     * LA INVITACIÓN SALE CON EL ALTA (decisión del cliente, 2026-09-24).
     *
     * Antes el alta solo guardaba la ficha y había que volver a su tarjeta a
     * pulsar "Mandarle su enlace": el paso se olvidaba y el aliado nunca se
     * enteraba de que existía, ni podía subir sus papeles. Ahora, si la ficha
     * trae correo, el enlace sale en el acto. `enviarAcceso: false` lo evita,
     * para registrar a un prospecto sin avisarle todavía.
     *
     * Nunca tumba el alta: si el correo falla, la ficha queda guardada y el
     * botón de su tarjeta sigue ahí para reintentar.
     */
    const quiereAcceso = (body as { enviarAcceso?: unknown })?.enviarAcceso !== false;
    let acceso: { estado: string; url: string; mensaje: string } | null = null;
    if (quiereAcceso && d.email?.trim() && (d.status ?? 1) === 1) {
      try {
        acceso = await this.enviarAcceso(creado.id);
      } catch (e) {
        acceso = { estado: 'fallido', url: '', mensaje: `No se pudo mandar su enlace: ${(e as Error).message}` };
      }
    }
    return { ...creado, acceso };
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
        // Condicionales, como el resto del update: sin esto, editar el telefono
        // le borraria la direccion y las coordenadas dejarian de tener sentido.
        ...(d.address !== undefined ? { address: d.address?.trim() || null } : {}),
        ...(d.coverageRadiusKm !== undefined ? { coverage_radius_km: d.coverageRadiusKm } : {}),
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

  /**
   * PUBLICAR un equipo que el aliado ofreció desde su portal: pasa a activo y
   * sale en el sitio. Se revisa (y se corrige en su ficha) antes de pulsar.
   * La disponibilidad queda confirmada hoy: el aliado la acaba de declarar.
   */
  @Post('equipos/:productId/publicar')
  async publicarEquipo(@Param('productId', ParseIntPipe) productId: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const e = await prisma.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, status: true, provider_id: true, tarifas: true, costo_aliado: true, price_unit: true },
    });
    if (!e || e.status !== ESTADO_POR_REVISAR) throw new NotFoundException('Ese equipo no está por revisar.');

    // Publicar directo = salir en el cotizador CON precio (2026-09-25). Si
    // nadie abrió "Revisar y corregir", el precio al cliente sale del costo
    // del aliado + el margen vigente; sin esto la máquina se recomendaba
    // "sin precio" aunque el aliado sí dijo cuánto cobra.
    let precios: { tarifas: Record<string, number>; cprice: number } | null = null;
    if (Object.keys(tarifasDe(e.tarifas)).length === 0) {
      const costo = tarifasDe(e.costo_aliado);
      if (Object.keys(costo).length > 0) {
        const tarifas = tarifasPropuestas(costo, await margenAliadoPct());
        const principal = e.price_unit && tarifas[e.price_unit] ? e.price_unit : Object.keys(tarifas)[0];
        precios = { tarifas, cprice: tarifas[principal] ?? 0 };
      }
    }

    // Opcional: a qué renglón del cotizador pertenece. Así, cuando un cliente
    // lo cotice, la solicitud le llega a este aliado sin capturar nada más.
    const r = z
      .object({ renglon: z.object({ tipo: z.enum(COTIZADOR_TIPOS), id: z.string().min(1).max(80) }).nullable().optional() })
      .safeParse(body ?? {});
    if (!r.success) throw new BadRequestException('Renglón del cotizador inválido');
    if (r.data.renglon) {
      const { tipo, id } = r.data.renglon;
      const nuevo = ligarProducto(await this.quoter.catalogo(tipo), id, productId);
      if (!nuevo) throw new BadRequestException('Ese renglón ya no existe en el cotizador.');
      await this.quoter.guardarCatalogo(tipo, nuevo, req.adminEmail);
      void registrarAccion(req, 'cotizador', 'ligar equipo a renglón', `${tipo}:${id}`, `producto ${productId}`);
    }
    await prisma.products.update({
      where: { id: productId },
      data: {
        status: 1, availability_confirmed_at: new Date(), updated_at: new Date(),
        ...(precios ? { tarifas: precios.tarifas as never, cprice: precios.cprice } : {}),
      },
    });
    if (e.provider_id) {
      const p = await prisma.providers.findUnique({ where: { id: e.provider_id }, select: { email: true, contact_name: true } });
      if (p?.email) {
        void this.mailer
          .enviar({ kind: 'provider_offer_published', to: p.email, toName: p.contact_name, providerId: e.provider_id, ...correoEquipoPublicado({ contacto: p.contact_name, equipo: e.name }) })
          .catch(() => undefined);
      }
    }
    return { ok: true };
  }

  /**
   * RECHAZAR con motivo: se le avisa al aliado por correo y la propuesta se
   * borra (con su galería). Puede volver a ofrecerlo corregido.
   */
  @Post('equipos/:productId/rechazar')
  async rechazarEquipo(@Param('productId', ParseIntPipe) productId: number, @Body() body: unknown) {
    const motivo = z.object({ motivo: z.string().trim().min(4, 'Escribe el motivo: el aliado lo recibe por correo.').max(1000) }).safeParse(body);
    if (!motivo.success) throw new BadRequestException(motivo.error.issues[0]?.message ?? 'Falta el motivo');
    const e = await prisma.products.findUnique({ where: { id: productId }, select: { id: true, name: true, status: true, provider_id: true } });
    if (!e || e.status !== ESTADO_POR_REVISAR) throw new NotFoundException('Ese equipo no está por revisar.');
    await prisma.galleries.deleteMany({ where: { product_id: productId } });
    await prisma.products.delete({ where: { id: productId } });
    if (e.provider_id) {
      const p = await prisma.providers.findUnique({ where: { id: e.provider_id }, select: { email: true, contact_name: true } });
      if (p?.email) {
        void this.mailer
          .enviar({ kind: 'provider_offer_rejected', to: p.email, toName: p.contact_name, providerId: e.provider_id, ...correoEquipoRechazado({ contacto: p.contact_name, equipo: e.name, motivo: motivo.data.motivo }) })
          .catch(() => undefined);
      }
    }
    return { ok: true };
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
  /**
   * ELIMINAR UN ALIADO (2026-09-25). Si no tiene historial (servicios
   * ofrecidos, equipos ni papeles) se borra de verdad: es un alta por error
   * o duplicada. Si ya tiene historial se da de baja (`status = 0`) para no
   * dejar servicios sin dueño.
   */
  @Delete(':id')
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    const [asignaciones, equipos, papeles] = await Promise.all([
      prisma.service_assignments.count({ where: { provider_id: id } }),
      prisma.products.count({ where: { provider_id: id } }),
      prisma.provider_documents.count({ where: { provider_id: id } }),
    ]);
    if (asignaciones + equipos + papeles === 0) {
      await prisma.email_log.updateMany({ where: { provider_id: id }, data: { provider_id: null } }).catch(() => undefined);
      await prisma.providers.delete({ where: { id } });
      return { ok: true, eliminado: true };
    }
    await prisma.providers.update({ where: { id }, data: { status: 0, updated_at: new Date() } });
    return { ok: true, eliminado: false };
  }
}
