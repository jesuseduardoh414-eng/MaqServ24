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
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { prisma } from '@maqserv/db';
import { COTIZADOR_TIPOS, ESTADO_SOLICITUD_PROVEEDOR, fichaDe, renglonesDe, slugify } from '@maqserv/config';
import { coordenadasDe } from '../freight/direccion';
import { mediaDir } from '../common/media';
import { borrarPrivado, esPrivado, moverPapelAPrivado, rutaDePrivado, tipoDePapel } from '../common/archivos-privados';
import { disponibilidadDe } from '../catalog/availability';
import { lista } from '../common/json-list';
import { z } from 'zod';
import { zCorreo, zTelefono } from '../common/campos';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { QuoterService } from '../quoter/quoter.service';
import { registrarAccion } from './audit';
import { estadoDocumentos, estaVerificado, mesesEnRed, papelesQueFaltan, reemplazados, DIAS_AVISO, TIPOS_DOC } from '../catalog/provider-trust';
import { documentosQueAvisan, textoAviso, urgencia, type AvisoAliado } from '../catalog/document-alerts';
import { historialDe, resumenHistorial, desviacionRespuesta } from '../catalog/provider-history';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { MailerService } from '../notifications/mailer.service';
import { correoAccesoAliado, correoInvitacionAliado } from '../notifications/email-templates';
import { ESTADO_CATEGORIA_PROPUESTA, ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { FreightService } from '../freight/freight.service';
import { ubicarAliado } from '../providers/cobertura-aliado';
import { CATALOGO, resumenPuntualidad, textoPuntualidad } from '../quotes/incidents';
import { imageUrl } from '../catalog/images';

/**
 * RED DE ALIADOS — alta y expediente de proveedores.
 *
 * Modelo del documento institucional, sección 15. Lo que este controlador NO
 * permite, a propósito: marcar a alguien como "verificado" a mano. El sello sale
 * de sus papeles y su vigencia (ver `provider-trust`), porque el documento pide
 * que el sello tenga un significado real y no sea decorativo.
 */

// TIPOS_DOC vive en `provider-trust` (junto a las reglas que evalúan el
// expediente): el portal del aliado también lo usa para renovar sus papeles.
// Desde 2026-10-27 el panel solo pone 'preferente' o 'registrado'; los otros
// dos se aceptan por los aliados que ya los tienen guardados.
const NIVELES = ['registrado', 'validado', 'activo', 'preferente'] as const;

/**
 * INVITAR A LA RED (2026-10-27). La oficina escribe el nombre y el correo o
 * WhatsApp de alguien, y le llega el enlace a "Regístrate como proveedor" con
 * esos datos ya puestos. Lo que él llene entra como solicitud por revisar.
 *
 * No hay tabla de invitaciones (sin SQL): cada invitación queda en la bitácora
 * del panel (`admin_audit`) y de ahí se lee la lista de quién no ha contestado.
 * Se sabe que ya se registró porque aparece un aliado con su correo o su
 * teléfono.
 */
const ACCION_INVITAR = 'aliado.invitar';
const ACCION_QUITAR_INVITACION = 'aliado.invitar.quitar';

const invitacionSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del aliado.').max(190),
  contacto: z.string().trim().max(190).optional().nullable(),
  correo: zCorreo().optional().nullable(),
  telefono: zTelefono().optional().nullable(),
  /** Por dónde sale: el correo lo manda la API; el WhatsApp lo abre el panel. */
  por: z.enum(['correo', 'whatsapp']),
});

type DatosInvitacion = { por: 'correo' | 'whatsapp'; correo: string | null; tel: string | null; contacto: string | null };

const diezDigitos = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '').slice(-10);
const correoNormal = (c: string | null | undefined) => (c ?? '').trim().toLowerCase();

/** "por correo · correo: x@y.com · tel: 81… · contacto: Juan": legible en la bitácora y fácil de leer de vuelta. */
function detalleInvitacion(d: DatosInvitacion): string {
  return [`por ${d.por}`, d.correo ? `correo: ${d.correo}` : null, d.tel ? `tel: ${d.tel}` : null, d.contacto ? `contacto: ${d.contacto}` : null]
    .filter(Boolean)
    .join(' · ');
}

function leerInvitacion(detalle: string | null): DatosInvitacion {
  const partes = (detalle ?? '').split(' · ');
  const de = (k: string) => partes.find((p) => p.startsWith(`${k}: `))?.slice(k.length + 2).trim() || null;
  return { por: partes[0] === 'por whatsapp' ? 'whatsapp' : 'correo', correo: de('correo'), tel: de('tel'), contacto: de('contacto') };
}

/** Quién es, para juntar las veces que se le invitó: su correo, si no su teléfono, si no su nombre. */
const claveInvitado = (nombre: string | null, d: DatosInvitacion) =>
  correoNormal(d.correo) || diezDigitos(d.tel) || correoNormal(nombre);

/** El enlace al registro del sitio, con sus datos ya puestos. */
function urlDeInvitacion(nombre: string, d: DatosInvitacion): string {
  const base = process.env.SITE_URL ?? 'https://maqser24.com';
  const q = new URLSearchParams({ invitacion: '1', nombre });
  if (d.contacto) q.set('contacto', d.contacto);
  if (d.correo) q.set('correo', d.correo);
  if (d.tel) q.set('tel', d.tel);
  return `${base}/proveedores?${q.toString()}`;
}

/** El aliado (de cualquier estado) que ya tiene ese correo o ese teléfono. */
function aliadoCon<T extends { email: string | null; phone: string | null }>(provs: T[], correo: string | null, tel: string | null): T | null {
  const c = correoNormal(correo);
  const t = diezDigitos(tel);
  return provs.find((p) => (c && correoNormal(p.email) === c) || (t.length === 10 && diezDigitos(p.phone) === t)) ?? null;
}

const providerSchema = z.object({
  name: z.string().min(2).max(190),
  level: z.enum(NIVELES).optional(),
  contactName: z.string().max(190).optional().nullable(),
  phone: zTelefono().optional().nullable(),
  email: zCorreo().optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  coverage: z.array(z.string().max(120)).max(60).optional(),
  categories: z.array(z.string().max(120)).max(20).optional(),
  responseMinutes: z.coerce.number().int().min(0).max(10080).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  /** Dirección de su base, para poder geocodificarla. */
  address: z.string().max(500).optional().nullable(),
  /**
   * Ya no se toma de aquí (2026-10-09): el radio se calcula de su base y su
   * lista de municipios (`ubicarAliado`). Se sigue aceptando para no
   * rechazar a un cliente viejo que lo mande, pero se ignora.
   */
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
  async geocodificar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const p = await prisma.providers.findUnique({
      where: { id },
      select: { address: true, city: true, state: true, name: true },
    });
    if (!p) throw new NotFoundException('Aliado no encontrado');

    // A mano (2026-09-25): clic en el mapa, o coordenadas / enlace de Google
    // Maps pegados. Es la salida cuando la dirección no existe en OSM.
    // Si mandaron coordenadas y no sirven, se dice (QA 2026-09-25: se
    // ignoraban y se ubicaba por dirección diciendo "quedó ubicado").
    const trae = typeof body === 'object' && body !== null && ('lat' in body || 'lng' in body);
    const manual = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).safeParse(body ?? {});
    if (trae && !manual.success) throw new BadRequestException('Coordenadas inválidas: latitud entre -90 y 90, longitud entre -180 y 180.');
    const pegado = !manual.success && p.address ? coordenadasDe(p.address) : null;
    const fijo = manual.success ? manual.data : pegado;
    if (fijo) {
      // Mover su base cambia hasta dónde llega: el radio se recalcula aquí mismo.
      const u = await ubicarAliado(id, { buscarBase: false, punto: fijo, geocodificar: (q) => this.freight.geocode(q) });
      return { ok: true, lat: fijo.lat, lng: fijo.lng, precision: 'exacta', radioKm: u.radioKm, mensaje: `${p.name}: ${u.mensaje}` };
    }

    // La ciudad de la ficha solo se agrega si la dirección no trae municipio
    // (sin coma). Antes se pegaba siempre, y "…Apodaca, N.L., Juárez" no
    // existe: la ficha decía Juárez y la dirección Apodaca.
    const dir = p.address?.trim() ?? '';
    // El estado solo no basta: "Nuevo León" cae en el centro del estado
    // y se reportaba como ubicado (QA 2026-09-25).
    if (!dir && !p.city?.trim()) {
      throw new BadRequestException('Sin dirección ni ciudad no hay a dónde ubicarlo. Escribe la dirección o marca el punto en el mapa.');
    }
    // Busca su base y, con ella, calcula hasta dónde llega (ver `ubicarAliado`).
    const u = await ubicarAliado(id, { buscarBase: true, geocodificar: (q) => this.freight.geocode(q) });
    if (!u.ubicado) {
      return {
        ok: false,
        mensaje: u.mensaje || 'No encontramos su dirección. Marca el punto con un clic en el mapa, o pega las coordenadas de Google Maps (clic derecho sobre el lugar → copiar coordenadas).',
      };
    }
    return { ok: true, lat: u.lat, lng: u.lng, radioKm: u.radioKm, mensaje: `${p.name}: ${u.mensaje}` };
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
        // Con estos papeles ya no tiene sello (vencido, o le falta un obligatorio).
        pierdeSello: !estaVerificado(estado),
        serviciosActivos: enObra.get(p.id) ?? 0,
        documentos: docs,
        peor: peor?.urgencia ?? 'por-vencer',
        diasPeor: peor?.diasRestantes ?? DIAS_AVISO,
      };
    });

    return avisos
      // Si lo que vencía ya se renovó, no queda nada que avisar de ese aliado.
      .filter((a) => a.documentos.length > 0)
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

  /** Invitar a alguien a registrarse (ver ACCION_INVITAR, arriba). */
  @Post('invitar')
  async invitar(@Body() body: unknown, @Req() req: AdminRequest) {
    const parsed = invitacionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;
    const datos: DatosInvitacion = { por: d.por, correo: d.correo?.trim() || null, tel: d.telefono?.trim() || null, contacto: d.contacto?.trim() || null };
    if (d.por === 'correo' && !datos.correo) throw new BadRequestException('Escribe su correo para mandarle la invitación.');
    if (d.por === 'whatsapp' && diezDigitos(datos.tel).length !== 10) throw new BadRequestException('Escribe su WhatsApp a 10 dígitos para mandarle la invitación.');

    // A quien ya está no se le invita otra vez: se le dice dónde encontrarlo.
    const provs = await prisma.providers.findMany({ select: { id: true, name: true, email: true, phone: true, status: true } });
    const ya = aliadoCon(provs, datos.correo, datos.tel);
    if (ya) {
      throw new ConflictException(
        ya.status === ESTADO_SOLICITUD_PROVEEDOR
          ? `«${ya.name}» ya se registró: está en «Solicitudes de proveedores», arriba de la lista.`
          : ya.status === 1
            ? `«${ya.name}» ya está en la red con ese correo o teléfono.`
            : `«${ya.name}» está dado de baja: ábrelo en la lista y reactívalo.`,
      );
    }

    const url = urlDeInvitacion(d.nombre, datos);
    let estado = 'whatsapp';
    if (d.por === 'correo' && datos.correo) {
      estado = await this.mailer.enviar({
        kind: 'provider_invite',
        to: datos.correo,
        toName: datos.contacto ?? d.nombre,
        ...correoInvitacionAliado({ nombre: d.nombre, contacto: datos.contacto, url }),
      });
    }
    await registrarAccion(req, 'proveedores', ACCION_INVITAR, d.nombre, detalleInvitacion(datos));
    return {
      ok: true,
      estado,
      url,
      mensaje:
        d.por === 'whatsapp'
          ? `Invitación lista para ${d.nombre}: mándala en el WhatsApp que se abrió. Cuando llene su registro te llega como solicitud.`
          : estado === 'enviado'
            ? `Invitación enviada a ${datos.correo}. Cuando llene su registro te llega como solicitud.`
            : `El correo no salió (${estado}). Copia el enlace y mándaselo por WhatsApp.`,
    };
  }

  /**
   * Las invitaciones de los últimos 90 días que no han terminado en registro,
   * la más reciente primero; las que sí, solo se cuentan.
   */
  @Get('invitaciones')
  async invitaciones() {
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [filas, quitadas, provs] = await Promise.all([
      prisma.admin_audit.findMany({
        where: { modulo: 'proveedores', accion: ACCION_INVITAR, created_at: { gte: desde } },
        orderBy: { created_at: 'desc' },
        take: 300,
      }),
      prisma.admin_audit.findMany({
        where: { modulo: 'proveedores', accion: ACCION_QUITAR_INVITACION, created_at: { gte: desde } },
        select: { detalle: true, created_at: true },
      }),
      prisma.providers.findMany({ select: { id: true, name: true, email: true, phone: true, status: true } }),
    ]);

    const veces = new Map<string, number>();
    for (const f of filas) {
      const k = claveInvitado(f.objetivo, leerInvitacion(f.detalle));
      veces.set(k, (veces.get(k) ?? 0) + 1);
    }
    const vistos = new Set<string>();
    const pendientes = [];
    let registrados = 0;
    for (const f of filas) {
      const d = leerInvitacion(f.detalle);
      const clave = claveInvitado(f.objetivo, d);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      if (aliadoCon(provs, d.correo, d.tel)) { registrados++; continue; }
      // Quitada de la lista después de su última invitación: ya no se enseña.
      if (quitadas.some((q) => q.detalle === clave && q.created_at >= f.created_at)) continue;
      pendientes.push({
        clave,
        nombre: f.objetivo ?? '',
        contacto: d.contacto,
        correo: d.correo,
        telefono: d.tel,
        por: d.por,
        cuando: f.created_at.toISOString(),
        veces: veces.get(clave) ?? 1,
        url: urlDeInvitacion(f.objetivo ?? '', d),
      });
    }
    return { pendientes, registrados };
  }

  /** "Ya no": quita a alguien de las invitaciones sin respuesta. */
  @Post('invitaciones/quitar')
  async quitarInvitacion(@Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({ clave: z.string().min(1).max(190), nombre: z.string().max(190).optional() }).safeParse(body);
    if (!p.success) throw new BadRequestException('Falta a quién quitar.');
    await registrarAccion(req, 'proveedores', ACCION_QUITAR_INVITACION, p.data.nombre ?? p.data.clave, p.data.clave);
    return { ok: true };
  }

  @Get()
  async list() {
    const provs = await prisma.providers.findMany({
      orderBy: [{ status: 'desc' }, { name: 'asc' }],
      include: { provider_documents: { select: { id: true, kind: true, name: true, expires_at: true } } },
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
          is_rental: true, price_unit: true, tipo_id: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.categories.findMany({ select: { id: true, cat_slug: true, cat_name: true, status: true } }),
    ]);
    // El nombre del tipo de cada máquina (2026-10-22): se ve en el expediente.
    const idsTipo = [...new Set(productos.map((e) => e.tipo_id).filter((t): t is number => t != null))];
    const tipoPorId = new Map(
      idsTipo.length ? (await prisma.products.findMany({ where: { id: { in: idsTipo } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]) : [],
    );
    const catPorId = new Map(categorias.map((c) => [c.id, c]));
    // La que propuso el aliado y aún no se decide se lee «(nueva)» (2026-10-28).
    const nombreDeSlug = new Map(categorias.map((c) => [c.cat_slug, c.status === ESTADO_CATEGORIA_PROPUESTA ? `${c.cat_name} (nueva)` : c.cat_name]));
    const hoy = new Date();
    // Con sus reservas y mantenimiento (2026-10-26): sin confirmación periódica,
    // el estado sale de los bloqueos, igual que en Disponibilidad.
    const bloques = productos.length
      ? await prisma.availability_blocks.findMany({
          where: { product_id: { in: productos.map((e) => e.id) }, OR: [{ ends_on: null }, { ends_on: { gte: hoy } }] },
          select: { product_id: true, state: true, starts_on: true, ends_on: true, note: true },
        })
      : [];
    const equiposPor = new Map<number, Array<Record<string, unknown>>>();
    for (const e of productos) {
      const c = catPorId.get(e.category_id);
      const disp = disponibilidadDe(
        { stock: e.stock, location: e.location, blocks: bloques.filter((b) => b.product_id === e.id) },
        hoy,
      );
      const fila = {
        id: e.id,
        name: e.name,
        brand: e.Marca?.trim() || null,
        category: c?.cat_name ?? null,
        categorySlug: c?.cat_slug ?? null,
        tipo: e.tipo_id != null ? tipoPorId.get(e.tipo_id) ?? null : null,
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
        verified: estaVerificado(docs),
        // Qué obligatorio le falta para el sello (2026-10-27): ['fiscal', 'seguro'].
        faltan: papelesQueFaltan(p.provider_documents),
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
   * a mano en algo que se mantiene solo.
   *
   * SIN CORREO (2026-10-05): el botón del panel dice "Generar enlace", pero
   * aquí se rechazaba con "agrégale correo primero" y no había forma de darle
   * acceso a un aliado que sólo usa WhatsApp —que es la mayoría—. Ahora el
   * enlace se genera igual y el panel ofrece mandarlo por WhatsApp.
   */
  /**
   * ACEPTAR UNA SOLICITUD DEL SITIO (2026-10-09).
   *
   * Antes "Aceptar en la red" solo cambiaba su estado, y había que acordarse de
   * abrir su expediente y mandarle el enlace: si no, nunca se enteraba de que
   * lo aceptaron ni podía completar nada. Ahora es el mismo final que el alta
   * del panel: queda en la red, ubicado con su dirección exacta y con sus km,
   * y le sale su invitación al portal. El enlace NO sale antes: mientras es
   * solicitud no tiene portal.
   */
  @Post(':id/aceptar')
  async aceptarSolicitud(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const p = await prisma.providers.findUnique({ where: { id }, select: { name: true, email: true, status: true } });
    if (!p) throw new NotFoundException('Solicitud no encontrada');
    if (p.status !== ESTADO_SOLICITUD_PROVEEDOR) throw new BadRequestException('Esta solicitud ya se atendió.');

    await prisma.providers.update({ where: { id }, data: { status: 1, updated_at: new Date() } });
    await registrarAccion(req, 'proveedores', 'aceptar solicitud de proveedor', p.name);
    // Los equipos que declaró al registrarse (2026-10-26) quedan publicados si
    // traen tipo: son servicios, se cotizan con el tabulador y no llevan precio
    // propio. Los "otro" siguen por revisar hasta que se les ponga tipo.
    await prisma.products.updateMany({
      where: { provider_id: id, status: ESTADO_POR_REVISAR, tipo_id: { not: null } },
      data: { status: 1, availability_confirmed_at: new Date(), updated_at: new Date() },
    });

    const ubicacion = await ubicarAliado(id, { buscarBase: true, geocodificar: (q) => this.freight.geocode(q) }).catch(() => null);
    let acceso: { estado: string; url: string; mensaje: string } | null = null;
    if (p.email?.trim()) {
      try {
        acceso = await this.enviarAcceso(id, req);
      } catch (e) {
        acceso = { estado: 'fallido', url: '', mensaje: `No se pudo mandar su enlace: ${(e as Error).message}` };
      }
    }
    return { ok: true, acceso, ubicacion };
  }

  @Post(':id/acceso')
  async enviarAcceso(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const p = await prisma.providers.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, contact_name: true, status: true, access_version: true },
    });
    if (!p) throw new NotFoundException('Aliado no encontrado');
    if (p.status !== 1) throw new BadRequestException('Este aliado esta dado de baja: su enlace no funcionaria.');

    const token = await firmarAcceso(p.id, p.access_version);
    const url = urlDeAcceso(token);
    // El enlace deja entrar como el aliado 30 días: queda en la bitácora quién
    // lo pidió (auditoría 2026-10-23).
    await registrarAccion(req, 'proveedores', 'aliado.acceso', p.name, p.email?.trim() ? `enviado a ${p.email}` : 'sin correo: enlace copiado en el panel');

    if (!p.email?.trim()) {
      await prisma.providers.update({ where: { id }, data: { access_sent_at: new Date() } });
      return {
        estado: 'sin_correo',
        url,
        mensaje: 'Este aliado no tiene correo: copia el enlace o mándaselo por WhatsApp. Sirve 30 días.',
      };
    }
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
  async revocarAcceso(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const p = await prisma.providers.findUnique({ where: { id }, select: { access_version: true, name: true } });
    if (!p) throw new NotFoundException('Aliado no encontrado');
    await prisma.providers.update({
      where: { id },
      data: { access_version: p.access_version + 1, updated_at: new Date() },
    });
    await registrarAccion(req, 'proveedores', 'aliado.revocar', p.name, 'Los enlaces anteriores dejan de servir');
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
    // Los que ya se renovaron se quedan en el expediente (con su foto), pero
    // marcados: ya no cuentan para el sello (ver `reemplazados`).
    const fuera = reemplazados(docs);
    return docs.map((d) => ({
      id: d.id,
      kind: d.kind,
      name: d.name,
      reemplazado: fuera.has(d),
      file: d.file,
      // La foto que subió el aliado desde su portal, lista para abrirse: es lo
      // que se revisa antes de subirlo a "validado". Por la API y con sesión
      // del panel (auditoría 2026-10-23): el papel ya no tiene dirección pública.
      fileUrl: d.file ? `/api/admin/providers/documents/${d.id}/archivo` : null,
      issuedAt: d.issued_at ? d.issued_at.toISOString().slice(0, 10) : null,
      expiresAt: d.expires_at ? d.expires_at.toISOString().slice(0, 10) : null,
    }));
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: AdminRequest) {
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
      (p.name.trim().toLowerCase() === d.name.trim().toLowerCase() && (p.phone ?? '').replace(/\D/g, '').slice(-10) === (d.phone ?? '').replace(/\D/g, '').slice(-10)),
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
        acceso = await this.enviarAcceso(creado.id, req);
      } catch (e) {
        acceso = { estado: 'fallido', url: '', mensaje: `No se pudo mandar su enlace: ${(e as Error).message}` };
      }
    }
    /**
     * Se ubica en el alta (2026-10-09): con su dirección y su municipio queda
     * en el mapa y con sus km calculados, sin otro paso en el expediente.
     * Como la invitación, nunca tumba el alta.
     */
    const ubicacion = d.address?.trim() || d.city?.trim()
      ? await ubicarAliado(creado.id, { buscarBase: true, geocodificar: (q) => this.freight.geocode(q) }).catch(() => null)
      : null;
    return { ...creado, acceso, ubicacion };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const parsed = providerSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    const d = parsed.data;
    const existe = await prisma.providers.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Aliado no encontrado');

    // Qué cambió de lo que decide dónde está y hasta dónde llega.
    const igual = (a: string | null | undefined, b: string | null | undefined) => (a?.trim() || null) === (b?.trim() || null);
    const baseCambio =
      (d.address !== undefined && !igual(d.address, existe.address)) ||
      (d.city !== undefined && !igual(d.city, existe.city)) ||
      (d.state !== undefined && !igual(d.state, existe.state));
    const coberturaCambio =
      d.coverage !== undefined && JSON.stringify(d.coverage.map((m) => m.trim())) !== JSON.stringify(lista(existe.coverage));

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
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        updated_at: new Date(),
      },
    });

    // El correo es a donde llega su enlace de acceso (entra como el aliado): su
    // cambio queda en la bitácora con el antes y el después (2026-10-27, al
    // poderse editar desde el expediente).
    if (d.email !== undefined && !igual(d.email, existe.email)) {
      await registrarAccion(req, 'proveedores', 'aliado.correo', existe.name, `${existe.email || 'sin correo'} → ${d.email || 'sin correo'}`);
    }

    // Nueva dirección → se busca otra vez su base; solo nuevos municipios →
    // misma base, otro radio. Cambiar el nivel o el teléfono no toca nada de esto.
    const ubicacion = baseCambio || coberturaCambio
      ? await ubicarAliado(id, { buscarBase: baseCambio, geocodificar: (q) => this.freight.geocode(q) }).catch(() => null)
      : null;
    return { ok: true, ubicacion };
  }

  @Post(':id/documents')
  async addDocument(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Documento inválido');
    const existe = await prisma.providers.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Aliado no encontrado');
    const d = parsed.data;

    // Un archivo que se haya subido aparte a `uploads/` (públicos) se trae a la
    // carpeta privada; cualquier otra ruta no se acepta.
    const archivo = d.file?.startsWith('uploads/') ? await moverPapelAPrivado(d.file) : null;
    const doc = await prisma.provider_documents.create({
      data: {
        provider_id: id,
        kind: d.kind,
        name: d.name ?? null,
        file: archivo,
        issued_at: fecha(d.issuedAt),
        expires_at: fecha(d.expiresAt),
      },
      select: { id: true },
    });
    return doc;
  }

  // Publicar y rechazar el equipo de un aliado se quitaron de aquí (2026-10-28):
  // lo que es de un tipo cuenta solo y lo nuevo se decide en Inventario
  // (admin-catalog.controller: nuevos-de-aliados, es-tipo, crear-tipo, no-lo-manejamos).

  @Delete('documents/:docId')
  async removeDocument(@Param('docId', ParseIntPipe) docId: number) {
    const doc = await prisma.provider_documents.findUnique({ where: { id: docId }, select: { file: true } });
    await prisma.provider_documents.deleteMany({ where: { id: docId } });
    await borrarPrivado(doc?.file);
    return { ok: true };
  }

  /**
   * El archivo de un papel, solo para el panel con el módulo Proveedores. Los
   * privados salen de la carpeta privada; uno viejo que siga en `uploads/` (aún
   * sin mover) se sirve igual desde aquí. Fotos y PDF se abren en la pestaña;
   * con `nosniff`, nada se toma por página.
   */
  @Get('documents/:docId/archivo')
  async archivoDocumento(@Param('docId', ParseIntPipe) docId: number) {
    const doc = await prisma.provider_documents.findUnique({ where: { id: docId }, select: { file: true } });
    if (!doc?.file) throw new NotFoundException('Ese papel no tiene archivo.');
    const abs = esPrivado(doc.file)
      ? rutaDePrivado(doc.file)
      : doc.file.startsWith('uploads/') ? join(mediaDir(), 'uploads', basename(doc.file)) : null;
    if (!abs || !existsSync(abs)) throw new NotFoundException('El archivo ya no está.');
    const tipo = tipoDePapel(abs);
    const ext = tipo === 'application/octet-stream' ? 'bin' : abs.split('.').pop();
    return new StreamableFile(createReadStream(abs), {
      type: tipo,
      disposition: `${tipo === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="papel-${docId}.${ext}"`,
    });
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
    const existe = await prisma.providers.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existe) throw new NotFoundException('Aliado no encontrado');
    // Descartar una SOLICITUD borra lo que declaró al registrarse (2026-10-26):
    // nunca fue suyo en la red, y si no, se quedaría "dado de baja" con equipos.
    if (existe.status === ESTADO_SOLICITUD_PROVEEDOR) {
      await prisma.products.deleteMany({ where: { provider_id: id, status: ESTADO_POR_REVISAR } });
    }
    // Las máquinas del CRM también cuentan: son datos capturados que no se tiran.
    const [asignaciones, equipos, papeles, maquinasCrm] = await Promise.all([
      prisma.service_assignments.count({ where: { provider_id: id } }),
      prisma.products.count({ where: { provider_id: id } }),
      prisma.provider_documents.count({ where: { provider_id: id } }),
      // .catch: si la tabla aún no existe (SQL sin correr), descartar no debe fallar.
      prisma.provider_machines.count({ where: { provider_id: id } }).catch(() => 0),
    ]);
    if (asignaciones + equipos + papeles + maquinasCrm === 0) {
      await prisma.email_log.updateMany({ where: { provider_id: id }, data: { provider_id: null } }).catch(() => undefined);
      await prisma.providers.delete({ where: { id } });
      return { ok: true, eliminado: true };
    }
    await prisma.providers.update({ where: { id }, data: { status: 0, updated_at: new Date() } });
    return { ok: true, eliminado: false };
  }
}
