import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post,
  Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { supabaseStorage } from '../common/supabase-multer';
import { imageUrl } from '../catalog/images';
import {
  estadoDocumentos, estaVerificado, mesesEnRed, DIAS_AVISO, DOC_LABEL, TIPOS_DOC, type TipoDoc,
} from '../catalog/provider-trust';
import { disponibilidadDe, DIAS_FRESCURA } from '../catalog/availability';
import { documentosQueAvisan, textoAviso } from '../catalog/document-alerts';
import { historialDe, resumenHistorial } from '../catalog/provider-history';
import { ServiceService } from '../quotes/service.service';
import { ProviderLinkGuard, type AliadoRequest } from './provider-access';

/**
 * EL PORTAL DEL ALIADO (documento institucional, sección 20).
 *
 * Lo que el documento pide que el aliado pueda hacer solo: "recibir solicitudes
 * que realmente correspondan a su oferta; contestar disponibilidad y
 * condiciones; conocer asignaciones; y mantener historial".
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. TODO se filtra por el aliado del enlace, nunca por lo que mande el
 *    cliente. Un portal donde el id viaja en el cuerpo es un portal donde
 *    cualquiera lee las solicitudes de la competencia.
 *
 * 2. Contestar una solicitud pasa por el MISMO `ServiceService` que usa
 *    operaciones. Si el aliado tuviera su propio camino, el historial contaría
 *    distinto según quién apretó el botón — y el historial es lo que después
 *    ordena el emparejamiento.
 */
/**
 * Lo que el aliado puede cambiar de su propia ficha: cómo localizarlo y hasta
 * dónde llega.
 *
 * Lo que NO aparece aquí es tan importante como lo que sí. El nivel, las
 * categorías y el estado de alta se quedan fuera a propósito: son el criterio
 * con el que la plataforma decide a quién proponer. Si el aliado pudiera
 * editarlos, cualquiera se pondría "preferente" en las seis categorías y el
 * emparejamiento dejaría de significar algo. Su cobertura sí, porque es un
 * hecho suyo que solo él conoce de primera mano.
 */
const perfilSchema = z.object({
  contactName: z.string().max(190).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(190).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  coverage: z.array(z.string().max(120)).max(60).optional(),
  responseMinutes: z.coerce.number().int().min(0).max(10080).optional().nullable(),
});

const documentoSchema = z.object({
  kind: z.enum(TIPOS_DOC),
  name: z.string().max(190).optional(),
  expiresAt: z.string().max(20).optional(),
});

/** Foto del papel: en campo se le toma foto a la póliza, no se escanea. */
const docStorage = supabaseStorage();

/** `'2027-03-01'` → Date; vacío → null (un input date sin llenar manda ''). */
const fecha = (v: string | null | undefined): Date | null =>
  v && v.trim() ? new Date(`${v}T00:00:00Z`) : null;

@Controller('aliado')
@UseGuards(ProviderLinkGuard)
export class ProviderPortalController {
  constructor(private readonly services: ServiceService) {}

  /** Todo lo que el aliado ve al abrir su enlace. */
  @Get()
  async portal(@Req() req: AliadoRequest) {
    const id = req.providerId;
    const hoy = new Date();

    const p = await prisma.providers.findUnique({
      where: { id },
      include: { provider_documents: { select: { id: true, kind: true, name: true, expires_at: true } } },
    });
    if (!p) throw new BadRequestException('Aliado no encontrado');

    const [asignaciones, equipos, historialCrudo] = await Promise.all([
      prisma.service_assignments.findMany({
        where: { provider_id: id },
        orderBy: { id: 'desc' },
        take: 40,
        include: {
          quotes: {
            select: {
              quote_number: true, service_category: true, address: true, comments: true,
              service_state: true, total: true,
              client_sites: {
                select: { name: true, address: true, contact_name: true, contact_phone: true, requirements: true },
              },
            },
          },
        },
      }),
      prisma.products.findMany({
        where: { provider_id: id, status: 1 },
        select: {
          id: true, name: true, stock: true, location: true, availability_confirmed_at: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.service_assignments.findMany({
        where: { provider_id: id },
        select: {
          state: true, offered_at: true, responded_at: true, reason: true,
          quotes: { select: { service_state: true } },
        },
      }),
    ]);

    const bloques = equipos.length
      ? await prisma.availability_blocks.findMany({
          where: {
            product_id: { in: equipos.map((e) => e.id) },
            starts_on: { lte: hoy },
            OR: [{ ends_on: null }, { ends_on: { gte: hoy } }],
          },
          select: { product_id: true, state: true, starts_on: true, ends_on: true },
        })
      : [];
    const porEquipo = new Map<number, typeof bloques>();
    for (const b of bloques) porEquipo.set(b.product_id, [...(porEquipo.get(b.product_id) ?? []), b]);

    const docs = estadoDocumentos(p.provider_documents, hoy);
    const avisos = documentosQueAvisan(p.provider_documents, hoy);
    const hist = historialDe(
      historialCrudo.map((h) => ({
        state: h.state,
        offered_at: h.offered_at,
        responded_at: h.responded_at,
        reason: h.reason,
        serviceState: h.quotes.service_state,
      })),
    );

    const enCurso = ['cerrado', 'cancelado'];

    return {
      aliado: {
        id: p.id,
        name: p.name,
        contactName: p.contact_name,
        level: p.level,
        verified: estaVerificado(p.level, docs),
        docsStatus: docs,
        coverage: p.coverage,
        categories: p.categories,
        monthsInNetwork: mesesEnRed(p.joined_at),
        // Editables desde el portal. Van aquí para que la pantalla rellene el
        // formulario con lo que hay y el aliado corrija, en vez de recapturar.
        phone: p.phone,
        email: p.email,
        city: p.city,
        address: p.address,
        responseMinutes: p.response_minutes,
      },

      /**
       * Lo que espera respuesta. Va primero porque es lo único con lo que el
       * aliado puede hacer algo AHORA; el resto es consulta.
       */
      porContestar: asignaciones
        .filter((a) => a.state === 'propuesto')
        .map((a) => ({
          assignmentId: a.id,
          quoteNumber: a.quotes.quote_number,
          category: a.quotes.service_category,
          // La dirección de la obra manda sobre la escrita a mano: la de la
          // obra ya la revisó alguien.
          address: a.quotes.client_sites?.address ?? a.quotes.address,
          site: a.quotes.client_sites?.name ?? null,
          detail: a.scope ?? a.quotes.comments,
          requirements: a.quotes.client_sites?.requirements ?? [],
          offeredAt: a.offered_at,
        })),

      /** Lo que ya es suyo y sigue corriendo, con los datos de la obra. */
      enCurso: asignaciones
        .filter((a) => a.state === 'aceptado' && !enCurso.includes(a.quotes.service_state ?? ''))
        .map((a) => ({
          quoteNumber: a.quotes.quote_number,
          category: a.quotes.service_category,
          state: a.quotes.service_state,
          site: a.quotes.client_sites?.name ?? null,
          address: a.quotes.client_sites?.address ?? a.quotes.address,
          contactName: a.quotes.client_sites?.contact_name ?? null,
          contactPhone: a.quotes.client_sites?.contact_phone ?? null,
          requirements: a.quotes.client_sites?.requirements ?? [],
        })),

      /**
       * Sus equipos y qué tan viejo es el dato. El documento pide "confirmación
       * periódica y marca de antigüedad": aquí es donde el aliado la ejerce sin
       * que nadie le llame.
       */
      equipos: equipos.map((e) => {
        const d = disponibilidadDe(
          { stock: e.stock, location: e.location, confirmedAt: e.availability_confirmed_at, blocks: porEquipo.get(e.id) ?? [] },
          hoy,
        );
        const dias = e.availability_confirmed_at
          ? Math.floor((hoy.getTime() - e.availability_confirmed_at.getTime()) / 86400000)
          : null;
        return {
          id: e.id,
          name: e.name,
          state: d.state,
          location: d.location,
          diasSinConfirmar: dias,
          // El texto dice el plazo, no sólo el color: en una pantalla de
          // teléfono a media obra, el color se pierde.
          confirmacion:
            dias === null
              ? 'Nunca se ha confirmado'
              : dias === 0
                ? 'Confirmado hoy'
                : dias > DIAS_FRESCURA
                  ? `Sin confirmar desde hace ${dias} días`
                  : `Confirmado hace ${dias} día${dias === 1 ? '' : 's'}`,
        };
      }),

      /** Sus papeles, con los que urgen arriba. */
      documentos: {
        estado: docs,
        avisos: avisos.map((a) => ({ ...a, expiresAt: a.expiresAt.toISOString().slice(0, 10), texto: textoAviso(a) })),
        diasAviso: DIAS_AVISO,
        // El expediente COMPLETO, no solo lo que urge: para renovar hay que ver
        // qué se entregó y cuándo vence, incluido lo que está en regla.
        lista: p.provider_documents
          .map((d) => ({
            id: d.id,
            kind: d.kind,
            kindLabel: DOC_LABEL[d.kind as TipoDoc] ?? d.kind,
            name: d.name,
            expiresAt: d.expires_at ? d.expires_at.toISOString().slice(0, 10) : null,
          }))
          .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999')),
        tipos: TIPOS_DOC.map((t) => ({ clave: t, label: DOC_LABEL[t] })),
      },

      /**
       * Su propio historial de cumplimiento.
       *
       * Si el sistema lo va a ordenar con esos números, tiene derecho a verlos.
       * Enseñárselos también es la única forma de que pueda discutirlos.
       */
      cumplimiento: {
        resumen: resumenHistorial(hist),
        ofrecidos: hist.ofrecidos,
        aceptados: hist.aceptados,
        completados: hist.completados,
        cancelados: hist.cancelados,
        minutosRespuestaReal: hist.minutosRespuestaReal,
        minutosRespuestaDeclarado: p.response_minutes,
        confiable: hist.confiable,
      },
    };
  }

  /** Contestar una solicitud. Pasa por el mismo servicio que usa operaciones. */
  @Patch('solicitudes/:assignmentId')
  async responder(
    @Req() req: AliadoRequest,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() body: unknown,
  ) {
    const p = z
      .object({ estado: z.enum(['aceptado', 'rechazado']), motivo: z.string().max(500).optional() })
      .safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');

    // Decisión 1: la propuesta tiene que ser SUYA. Sin esto, cambiar el número
    // en la URL contestaría por otro aliado.
    const a = await prisma.service_assignments.findUnique({
      where: { id: assignmentId },
      select: { provider_id: true },
    });
    if (!a || a.provider_id !== req.providerId) {
      throw new BadRequestException('Esa solicitud no es tuya.');
    }

    return this.services.responder(assignmentId, p.data.estado, {
      reason: p.data.motivo,
      // adminId null = lo movió el aliado, no una persona de operaciones. El
      // historial tiene que poder distinguirlo.
      adminId: null,
    });
  }

  /**
   * "Sigue disponible". No cambia el inventario: dice que lo que hay sigue
   * siendo cierto hoy. Son dos cosas distintas y mezclarlas haría que confirmar
   * pareciera un ajuste de existencias.
   */
  @Patch('equipos/:productId/confirmar')
  async confirmar(@Req() req: AliadoRequest, @Param('productId', ParseIntPipe) productId: number) {
    const e = await prisma.products.findUnique({ where: { id: productId }, select: { provider_id: true } });
    if (!e || e.provider_id !== req.providerId) throw new BadRequestException('Ese equipo no es tuyo.');

    await prisma.products.update({
      where: { id: productId },
      data: { availability_confirmed_at: new Date() },
    });
    return { ok: true };
  }

  /** Dónde está el equipo. Cambia a qué solicitudes se le puede proponer. */
  @Patch('equipos/:productId/ubicacion')
  async ubicacion(
    @Req() req: AliadoRequest,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: unknown,
  ) {
    const p = z.object({ location: z.string().max(190) }).safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');

    const e = await prisma.products.findUnique({ where: { id: productId }, select: { provider_id: true } });
    if (!e || e.provider_id !== req.providerId) throw new BadRequestException('Ese equipo no es tuyo.');

    await prisma.products.update({
      where: { id: productId },
      data: {
        location: p.data.location.trim() || null,
        // Mover un equipo es afirmar dónde está: confirmar de paso evita que
        // el aliado tenga que apretar dos botones para decir una sola cosa.
        availability_confirmed_at: new Date(),
      },
    });
    return { ok: true };
  }

  /**
   * Sus propios datos. Antes esto solo se podía cambiar llamando a la oficina,
   * que es justo lo que el documento (20) pide quitar de en medio.
   *
   * Solo se escribe lo que vino: un formulario que manda tres campos no puede
   * borrar los otros cuatro por omisión.
   */
  @Patch('perfil')
  async perfil(@Req() req: AliadoRequest, @Body() body: unknown) {
    const p = perfilSchema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const d = p.data;
    const limpio = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);

    await prisma.providers.update({
      where: { id: req.providerId },
      data: {
        ...(d.contactName !== undefined ? { contact_name: limpio(d.contactName) } : {}),
        ...(d.phone !== undefined ? { phone: limpio(d.phone) } : {}),
        ...(d.email !== undefined ? { email: limpio(d.email) } : {}),
        ...(d.city !== undefined ? { city: limpio(d.city) } : {}),
        // La dirección NO se geocodifica aquí: mover el punto en el mapa cambia
        // a qué obras se le propone, y eso lo revisa la oficina desde el panel.
        ...(d.address !== undefined ? { address: limpio(d.address) } : {}),
        ...(d.coverage !== undefined
          ? { coverage: d.coverage.map((c) => c.trim()).filter(Boolean) }
          : {}),
        ...(d.responseMinutes !== undefined ? { response_minutes: d.responseMinutes } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }

  /**
   * Renovar un papel. Crea uno nuevo en vez de sobrescribir el vencido: el
   * expediente es un historial, y saber que la póliza anterior venció en marzo
   * es parte de lo que se audita.
   *
   * El sello de verificado se recalcula solo (`estadoDocumentos`), así que subir
   * la renovación devuelve el sello sin que nadie tenga que aprobarlo a mano.
   */
  @Post('documentos')
  @UseInterceptors(FileInterceptor('file', { storage: docStorage, limits: { fileSize: 8 * 1024 * 1024 } }))
  async subirDocumento(
    @Req() req: AliadoRequest,
    @Body() body: unknown,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const p = documentoSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('Elige qué documento es y hasta cuándo vale.');
    const d = p.data;

    const doc = await prisma.provider_documents.create({
      data: {
        provider_id: req.providerId,
        kind: d.kind,
        name: d.name?.trim() || DOC_LABEL[d.kind],
        file: file ? `uploads/${file.filename}` : null,
        issued_at: new Date(),
        expires_at: fecha(d.expiresAt),
      },
      select: { id: true, kind: true, name: true, expires_at: true, file: true },
    });

    // El estado nuevo del expediente viaja de vuelta: el aliado acaba de subir
    // un papel para recuperar el sello y tiene que ver si lo consiguió.
    const todos = await prisma.provider_documents.findMany({
      where: { provider_id: req.providerId },
      select: { expires_at: true },
    });

    return {
      ok: true,
      documento: {
        id: doc.id,
        kind: doc.kind,
        kindLabel: DOC_LABEL[doc.kind as TipoDoc] ?? doc.kind,
        name: doc.name,
        expiresAt: doc.expires_at ? doc.expires_at.toISOString().slice(0, 10) : null,
        file: imageUrl(doc.file),
      },
      estadoDocumentos: estadoDocumentos(todos),
    };
  }
}
