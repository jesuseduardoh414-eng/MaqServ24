import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put,
  Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { asignarOperador, operadorDe } from './operador';
import { guardarUbicacion } from '../quotes/rastreo';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MoneyService } from '../money/money.service';
import { aFacturarPorAliado, parteDelAliado } from '../money/cuentas';
import { reglasDinero } from '../money/reglas';
import { promises as fs } from 'node:fs';
import { Throttle } from '@nestjs/throttler';
import { PREFIJO_PRIVADO, borrarPrivado, facturaStorage, papelStorage, rutaPrivada } from '../common/archivos-privados';
import { esLineaServicio, requestFormFor } from '@maqserv/config';

import { MailerService } from '../notifications/mailer.service';
import { notasDe, pedidoDe, sinContacto, zonaAproximada } from './pedido';
import { avisarPanel } from '../notifications/panel';
import { correoEquipoPropuesto } from '../notifications/email-templates';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { zCorreo, zTelefono } from '../common/campos';
import { imageUrl } from '../catalog/images';
import {
  estadoDocumentos, estaVerificado, mesesEnRed, papelesQueFaltan, papelesVigentes, DIAS_AVISO, DOC_LABEL, TIPOS_DOC, type TipoDoc,
} from '../catalog/provider-trust';
import { disponibilidadDe, PREFIJO_RESERVA } from '../catalog/availability';
import { documentosQueAvisan, textoAviso } from '../catalog/document-alerts';
import { historialDe, resumenHistorial } from '../catalog/provider-history';
import { ServiceService } from '../quotes/service.service';
import { PASOS, avance, esEstado } from '../quotes/service-flow';
import { calcSinPrecios, parteDelDocumento, partidasParaAliado } from '../quoter/parte-del-documento';
import { lista } from '../common/json-list';
import { ProviderLinkGuard, type AliadoRequest } from './provider-access';
import { ESTADO_CATEGORIA_PROPUESTA, ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { categoriaPropuesta } from '../catalog/categorias-propuestas';
import { ubicarAliado } from './cobertura-aliado';
import { MAX_PUNTOS, SEGUNDOS_ENTRE_PUNTOS } from '../quotes/rastreo';

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
 * editarlos, cualquiera se pondría "preferente" en las cinco categorías y el
 * emparejamiento dejaría de significar algo. Su cobertura sí, porque es un
 * hecho suyo que solo él conoce de primera mano.
 */
const perfilSchema = z.object({
  contactName: z.string().max(190).optional().nullable(),
  phone: zTelefono().optional().nullable(),
  email: zCorreo().optional().nullable(),
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

/**
 * Foto (o PDF) del papel: en campo se le toma foto a la póliza, no se escanea.
 * A la carpeta PRIVADA (auditoría 2026-10-23): trae RFC, domicilio y pólizas, y
 * en `uploads/` quedaba pública en media.maqser24.com.
 */
const docStorage = papelStorage();


/**
 * Lo que manda el aliado al ofrecer un equipo. Llega en multipart (trae
 * fotos), así que todo es texto: `atributos` viaja como JSON.
 */
const ofertaSchema = z.object({
  categoria: z.string().min(2).max(120),
  /** La ficha del tipo que eligió de la lista (2026-10-22). Vacío = nuevo, no está en la lista. */
  tipoId: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().positive().optional()),
  /** Qué es, solo si es nuevo (con tipo, el nombre sale del tipo). */
  nombre: z.string().trim().max(160).optional(),
  marca: z.string().trim().max(120).optional(),
  modelo: z.string().trim().max(120).optional(),
  ubicacion: z.string().trim().max(160).optional(),
  unidades: z.coerce.number().int().min(1).max(999).optional(),
  /** Con `categoria: '__nueva__'`: el nombre de la categoría que no está en la lista (2026-10-28). */
  categoriaNueva: z.string().trim().max(100).optional(),
});
/** La categoría "Otra: no está en la lista" del formulario del portal. */
const CATEGORIA_NUEVA = '__nueva__';

/** `'2027-03-01'` → Date; vacío → null (un input date sin llenar manda ''). */
const fecha = (v: string | null | undefined): Date | null =>
  v && v.trim() ? new Date(`${v}T00:00:00Z`) : null;

/** `AAAA-MM-DD` que de verdad es una fecha (antes una mal escrita daba 500 y dejaba la foto suelta). */
const fechaValida = (v: string | null | undefined): boolean =>
  Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && !Number.isNaN(fecha(v)?.getTime()));

@Controller('aliado')
@UseGuards(ProviderLinkGuard)
export class ProviderPortalController {
  constructor(
    private readonly services: ServiceService,
    private readonly mailer: MailerService,
    private readonly money: MoneyService,
  ) {}

  /**
   * SUBIR SU FACTURA de un servicio cerrado (2026-10-22, Fase A). PDF y/o
   * XML, reconocidos por sus bytes y guardados fuera de lo público. En cuanto
   * el cliente pagó y está la factura, el pago se programa solo.
   */
  // Cada subida escribe en disco antes de saber si el servicio es suyo: con
  // tope, un enlace válido no puede llenar la cuota del hosting (auditoría 2026-10-23).
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('facturas/:quoteNumber')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'pdf', maxCount: 1 }, { name: 'xml', maxCount: 1 }], { storage: facturaStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async subirFactura(
    @Req() req: AliadoRequest,
    @Param('quoteNumber') quoteNumber: string,
    @UploadedFiles() archivos?: { pdf?: Express.Multer.File[]; xml?: Express.Multer.File[] },
  ) {
    const pdf = archivos?.pdf?.[0]?.filename;
    const xml = archivos?.xml?.[0]?.filename;
    try {
      return await this.money.recibirFactura(req.providerId, quoteNumber, { pdf, xml });
    } catch (e) {
      // No era suyo, ya estaba pagado…: lo subido no se queda huérfano en disco.
      // Solo con esos rechazos (400/404), que salen ANTES de guardar: con un fallo
      // posterior la base ya apunta al archivo nuevo y borrarlo lo dejaría colgado.
      const estado = (e as { getStatus?: () => number }).getStatus?.();
      if (estado === 400 || estado === 404) {
        await Promise.all([pdf, xml].filter((r): r is string => Boolean(r)).map((r) => fs.unlink(rutaPrivada(r)).catch(() => undefined)));
      }
      throw e;
    }
  }

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
              quote_number: true, service_category: true, address: true, comments: true, requirements: true,
              service_state: true, total: true, created_at: true,
              // Para recortarle su parte del documento del cotizador.
              subtotal: true, freight_cost: true, tax: true, conditions: true,
              client_sites: {
                select: { name: true, address: true, municipality: true, contact_name: true, contact_phone: true, requirements: true },
              },
            },
          },
        },
      }),
      prisma.products.findMany({
        where: { provider_id: id, status: 1 },
        select: {
          id: true, name: true, stock: true, location: true,
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
          // También lo que viene: su mantenimiento programado se ve y se puede quitar.
          where: {
            product_id: { in: equipos.map((e) => e.id) },
            OR: [{ ends_on: null }, { ends_on: { gte: hoy } }],
          },
          select: { id: true, product_id: true, state: true, starts_on: true, ends_on: true, note: true },
          orderBy: { starts_on: 'asc' },
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

    /**
     * La cotización de lo que espera respuesta (2026-10-15): el aliado ve las
     * partidas e importes que el cliente aceptó. Lo que ya trae en curso lleva
     * el folio para abrir el documento (2026-10-19). Solo SU parte
     * (2026-10-19): si el documento traía servicios de otros aliados, esos no
     * se le enseñan.
     */
    const vivas = asignaciones.filter((a) => a.state === 'propuesto' || a.state === 'aceptado');
    const partes = await Promise.all(vivas.map((a) => parteDelDocumento(a.quotes)));
    const reglas = await reglasDinero();
    const cotizacionDe = new Map(
      vivas.map((a, i) => {
        const p = partes[i];
        return [a.id, p ? { folio: p.doc.folio, partidas: partidasParaAliado(p.snapshot.calc) } : null] as const;
      }),
    );

    /**
     * Nombres legibles de sus líneas de servicio: el aliado no tiene por qué
     * leer "maquinaria-pesada". Una consulta para todas.
     */
    const slugs = [
      ...new Set([
        ...lista(p.categories),
        ...asignaciones.map((a) => a.quotes.service_category).filter((c): c is string => !!c),
      ]),
    ];
    const cats = slugs.length
      ? await prisma.categories.findMany({ where: { cat_slug: { in: slugs } }, select: { cat_slug: true, cat_name: true, status: true } })
      : [];
    // La que propuso él y MAQSER24 aún no decide se lee «(en revisión)» (2026-10-28).
    const nombreCat = new Map(cats.map((c) => [c.cat_slug, c.status === ESTADO_CATEGORIA_PROPUESTA ? `${c.cat_name} (en revisión)` : c.cat_name]));
    const cat = (slug: string | null) => (slug ? nombreCat.get(slug) ?? slug : null);

    /**
     * Los TIPOS de cada una de sus líneas (2026-10-22): las fichas sin aliado
     * que llevan el precio. Al ofrecer un equipo el aliado elige de aquí, y así
     * las ofertas le llegan solo de lo que sí tiene.
     */
    const lineasSuyas = await prisma.categories.findMany({
      where: { cat_slug: { in: lista(p.categories) } },
      select: { id: true, cat_slug: true },
    });
    const fichas = lineasSuyas.length
      ? await prisma.products.findMany({
          where: { provider_id: null, status: 1, category_id: { in: lineasSuyas.map((l) => l.id) } },
          select: { id: true, name: true, category_id: true },
          orderBy: { name: 'asc' },
        })
      : [];
    const tipos: Record<string, Array<{ id: number; nombre: string }>> = Object.fromEntries(
      lineasSuyas.map((l) => [l.cat_slug, fichas.filter((f) => f.category_id === l.id).map((f) => ({ id: f.id, nombre: f.name }))]),
    );

    /**
     * SUS COBROS (2026-10-22, Fase A): lo que tiene por facturarle a MAQSER24
     * y cuándo se le paga. Solo lo pendiente y lo pagado en los últimos 60 días.
     */
    const cuentas = await prisma.service_money.findMany({
      where: { provider_id: id, OR: [{ pagado_at: null }, { pagado_at: { gte: new Date(Date.now() - 60 * 86_400_000) } }] },
      orderBy: { created_at: 'desc' },
    });
    const foliosCuentas = cuentas.length
      ? await prisma.quotes.findMany({ where: { id: { in: cuentas.map((c) => c.quote_id) } }, select: { id: true, quote_number: true, product_interested: true } })
      : [];
    const folioDe = new Map(foliosCuentas.map((f) => [String(f.id), f]));
    const cobros = cuentas.map((c) => {
      const factura = !!(c.factura_aliado || c.factura_aliado_xml);
      return {
        folio: folioDe.get(String(c.quote_id))?.quote_number ?? '',
        servicio: folioDe.get(String(c.quote_id))?.product_interested ?? null,
        monto: aFacturarPorAliado(c),
        // Lo que se le paga antes de IVA (2026-10-28): la misma cifra que ve en "Te pagamos … + IVA".
        base: Number(c.pago_aliado),
        conIva: Number(c.iva) > 0,
        estado: c.pagado_at ? 'pagado' : !factura ? 'falta-factura' : c.pagar_el ? 'programado' : 'esperando-cliente',
        pagarEl: c.pagar_el ? c.pagar_el.toISOString().slice(0, 10) : null,
        pagadoAt: c.pagado_at,
      };
    });
    const estadoServicio = (s: string | null) =>
      esEstado(s) ? { stateLabel: PASOS[s].label, progress: avance(s) } : { stateLabel: 'Por asignar', progress: 0 };

    return {
      aliado: {
        id: p.id,
        name: p.name,
        contactName: p.contact_name,
        level: p.level,
        verified: estaVerificado(docs),
        docsStatus: docs,
        coverage: p.coverage,
        categories: p.categories,
        categoryLabels: lista(p.categories).map((c) => cat(c) ?? c),
        joinedAt: p.joined_at,
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
          category: cat(a.quotes.service_category),
          // Por contestar, solo la ZONA: la calle, el nombre de la obra y a quién
          // buscar se ven al aceptar (ver "antes de aceptar" en pedido.ts). La de
          // la obra manda sobre la escrita a mano: esa ya la revisó alguien.
          address: zonaAproximada(a.quotes.client_sites?.address ?? a.quotes.address, a.quotes.client_sites?.municipality),
          site: null,
          // El alcance que escribió MAQSER24 y, debajo, las notas del cliente
          // (acceso, terreno…), sin datos de contacto; lo demás va en `pedido`.
          detail: sinContacto([a.scope, notasDe(a.quotes.comments)].filter(Boolean).join('\n')
            || (pedidoDe(a.quotes.service_category, a.quotes.requirements, a.quotes.comments).length ? null : a.quotes.comments)),
          requirements: a.quotes.client_sites?.requirements ?? [],
          pedido: pedidoDe(a.quotes.service_category, a.quotes.requirements, a.quotes.comments)
            .map((x) => ({ ...x, valor: sinContacto(x.valor) ?? '' })),
          offeredAt: a.offered_at,
          // Lo que se le paga (2026-10-22): es lo primero que pregunta antes de
          // decir que sí. Su parte, ya sin la comisión; no el precio al cliente.
          pago: parteDelAliado(a.quotes, reglas),
          documento: cotizacionDe.get(a.id)?.folio ?? null,
          partidas: cotizacionDe.get(a.id)?.partidas ?? [],
        })),

      /** Lo que ya es suyo y sigue corriendo, con los datos de la obra. */
      enCurso: asignaciones
        .filter((a) => a.state === 'aceptado' && !enCurso.includes(a.quotes.service_state ?? ''))
        .map((a) => ({
          assignmentId: a.id,
          quoteNumber: a.quotes.quote_number,
          category: cat(a.quotes.service_category),
          state: a.quotes.service_state,
          ...estadoServicio(a.quotes.service_state),
          documento: cotizacionDe.get(a.id)?.folio ?? null,
          committedAt: a.committed_at,
          pago: parteDelAliado(a.quotes, reglas),
          site: a.quotes.client_sites?.name ?? null,
          address: a.quotes.client_sites?.address ?? a.quotes.address,
          contactName: a.quotes.client_sites?.contact_name ?? null,
          contactPhone: a.quotes.client_sites?.contact_phone ?? null,
          requirements: a.quotes.client_sites?.requirements ?? [],
          pedido: pedidoDe(a.quotes.service_category, a.quotes.requirements, a.quotes.comments),
          // Quién maneja la unidad (2026-10-15): su enlace es para él, no para la empresa.
          operador: (() => { const o = operadorDe(a.quotes.requirements); return o ? { nombre: o.nombre, telefono: o.telefono } : null; })(),
        })),

      /**
       * Sus equipos y qué tan viejo es el dato. El documento pide "confirmación
       * periódica y marca de antigüedad": aquí es donde el aliado la ejerce sin
       * que nadie le llame.
       */
      /**
       * Lo que ofreció y MAQSER24 todavía no revisa (`status = 2`). Se le
       * enseña para que sepa que llegó y no lo mande dos veces.
       */
      propuestas: (
        await prisma.products.findMany({
          where: { provider_id: id, status: ESTADO_POR_REVISAR },
          select: { id: true, name: true, Marca: true, photo: true, created_at: true, category_id: true },
          orderBy: { id: 'desc' },
        })
      ).map((e) => ({ id: e.id, name: e.name, brand: e.Marca, image: imageUrl(e.photo), createdAt: e.created_at })),

      /** Los tipos que puede elegir al ofrecer un equipo, por línea (slug). */
      tipos,

      /** Lo que tiene por facturar y cuándo se le paga (2026-10-22). */
      cobros,

      equipos: equipos.map((e) => {
        const suyos = porEquipo.get(e.id) ?? [];
        const d = disponibilidadDe({ stock: e.stock, location: e.location, blocks: suyos }, hoy);
        // Su mantenimiento (de hoy o el próximo): lo puso él o MAQSER24, no un servicio.
        const mant = suyos.find((b) => b.state === 'mantenimiento' && !(b.note ?? '').startsWith(PREFIJO_RESERVA)) ?? null;
        return {
          id: e.id,
          name: e.name,
          state: d.state,
          location: d.location,
          /** Hasta cuándo sigue ocupado (AAAA-MM-DD), si hoy no está libre. */
          hasta: d.until,
          mantenimiento: mant
            ? {
                id: mant.id,
                desde: mant.starts_on.toISOString().slice(0, 10),
                hasta: mant.ends_on ? mant.ends_on.toISOString().slice(0, 10) : null,
                nota: mant.note,
              }
            : null,
        };
      }),

      /** Sus papeles, con los que urgen arriba. */
      documentos: {
        estado: docs,
        // Los obligatorios que le faltan (2026-10-22): el portal se los pide por nombre.
        faltan: papelesQueFaltan(p.provider_documents, hoy).map((k) => DOC_LABEL[k]),
        avisos: avisos.map((a) => ({ ...a, expiresAt: a.expiresAt.toISOString().slice(0, 10), texto: textoAviso(a) })),
        diasAviso: DIAS_AVISO,
        // El expediente COMPLETO, no solo lo que urge: para renovar hay que ver
        // qué se entregó y cuándo vence, incluido lo que está en regla. Sin lo
        // que ya renovó (2026-10-19): la constancia vieja junto a la nueva
        // parecía que la renovación no había servido de nada.
        lista: papelesVigentes(p.provider_documents)
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
      /**
       * Sus últimos trabajos contestados: qué se le ofreció y en qué quedó. Es
       * su historial a la vista, no solo un número de "cómo vas".
       */
      recientes: asignaciones
        .filter((a) => a.state !== 'propuesto')
        .slice(0, 8)
        .map((a) => ({
          quoteNumber: a.quotes.quote_number,
          category: cat(a.quotes.service_category),
          site: a.quotes.client_sites?.name ?? null,
          answer: a.state,
          reason: a.reason,
          respondedAt: a.responded_at,
          ...estadoServicio(a.quotes.service_state),
          pago: parteDelAliado(a.quotes, reglas),
        })),
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
      .object({
        estado: z.enum(['aceptado', 'rechazado']),
        motivo: z.string().max(500).optional(),
        /**
         * Cuándo se compromete a llegar (ISO, fecha y hora local). Es contra lo
         * que se mide su puntualidad; antes el portal no lo pedía y el
         * compromiso quedaba vacío.
         */
        llegada: z.string().max(40).optional(),
      })
      .safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');
    let committedAt: Date | null = null;
    if (p.data.estado === 'aceptado' && p.data.llegada) {
      const d = new Date(p.data.llegada);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('La fecha de llegada no es válida.');
      committedAt = d;
    }

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
      committedAt,
      // adminId null = lo movió el aliado, no una persona de operaciones. El
      // historial tiene que poder distinguirlo.
      adminId: null,
    });
  }

  /**
   * EL DOCUMENTO DE LA COTIZACIÓN, para el aliado (2026-10-19): el que
   * imprime el cliente (folio, partidas, condiciones, firma), pero solo con SU
   * parte: si el documento traía servicios de otros aliados, esos renglones e
   * importes no salen. Solo el de SUS solicitudes y mientras le tocan —por
   * contestar o aceptadas—: lo que rechazó o se le dio a otro ya no es asunto suyo.
   */
  @Get('solicitudes/:assignmentId/documento')
  async documento(@Req() req: AliadoRequest, @Param('assignmentId', ParseIntPipe) assignmentId: number) {
    const a = await prisma.service_assignments.findFirst({
      where: { id: assignmentId, provider_id: req.providerId, state: { in: ['propuesto', 'aceptado'] } },
      select: {
        state: true,
        quotes: {
          select: { quote_number: true, requirements: true, subtotal: true, freight_cost: true, tax: true, total: true, conditions: true },
        },
      },
    });
    const p = a ? await parteDelDocumento(a.quotes) : null;
    if (!a || !p) throw new NotFoundException('Esta solicitud no tiene documento de cotización.');
    // Mientras no la acepte: ni quién es el cliente, ni la obra, ni a quién
    // buscar (ver "antes de aceptar" en pedido.ts); del documento, solo lo que
    // se pinta (partidas, empresa, firma), nada más del guardado.
    // Nunca los importes: son el precio al cliente (decisión de Dirección,
    // 2026-10-23). Lo suyo lo ve como "Te pagamos" en el portal.
    const s = p.snapshot as Record<string, unknown>;
    const documento = { calc: calcSinPrecios(p.snapshot.calc), emitida: s.emitida, empresa: s.empresa, firma: s.firma, saludo: s.saludo };
    if (a.state === 'propuesto') {
      return {
        folio: p.doc.folio,
        tipo: p.doc.kind,
        quoteNumber: a.quotes.quote_number,
        cliente: 'Se muestra al aceptar',
        obra: null,
        atencion: null,
        municipio: p.doc.municipality,
        notas: sinContacto(p.doc.notes),
        parcial: p.parcial,
        documento,
      };
    }
    return {
      folio: p.doc.folio,
      tipo: p.doc.kind,
      quoteNumber: a.quotes.quote_number,
      cliente: p.doc.client_name,
      obra: p.doc.work,
      atencion: p.doc.attention,
      municipio: p.doc.municipality,
      notas: p.doc.notes,
      parcial: p.parcial,
      documento,
    };
  }

  /**
   * EL ALIADO REPORTA EL AVANCE (2026-09-25): "¿cómo sabe el cliente cuando la
   * máquina ya salió, al igual que el proveedor y el sistema?". Antes solo
   * operaciones movía el servicio en el tablero; ahora quien trae la máquina
   * dice "salí", "llegué", "empecé" y "terminé". Pasa por el mismo `mover`:
   * el cliente recibe campana y correo, y el panel su aviso. CERRAR (con
   * horas/viajes) sigue siendo de MAQSER24.
   */
  @Patch('servicios/:quoteNumber/avance')
  async avance(@Req() req: AliadoRequest, @Param('quoteNumber') quoteNumber: string, @Body() body: unknown) {
    const p = z.object({ estado: z.enum(['en_traslado', 'en_sitio', 'en_curso', 'terminado']) }).safeParse(body);
    if (!p.success) throw new BadRequestException('Paso inválido');
    const q = await prisma.quotes.findFirst({ where: { quote_number: quoteNumber.slice(0, 40) }, select: { id: true } });
    // Solo el aliado que la ACEPTÓ puede reportarla: cambiar el folio en la URL no sirve.
    const suya = q
      ? await prisma.service_assignments.findFirst({ where: { quote_id: q.id, provider_id: req.providerId, state: 'aceptado' }, select: { id: true } })
      : null;
    if (!q || !suya) throw new BadRequestException('Ese servicio no es tuyo.');
    const prov = await prisma.providers.findUnique({ where: { id: req.providerId }, select: { name: true } });
    return this.services.mover(Number(q.id), p.data.estado, { adminId: null, porAliado: prov?.name ?? 'El aliado', note: `Lo reportó ${prov?.name ?? 'el aliado'} desde su portal` });
  }

  /**
   * EL OPERADOR DE LA UNIDAD (2026-10-15, ver operador.ts). El aliado dice quién
   * la maneja y le manda SU enlace por WhatsApp: con él avisa que salió y que
   * llegó, y comparte la ubicación, sin ver nada más del aliado. Volver a
   * mandarlo invalida el enlace anterior.
   */
  @Put('servicios/:quoteNumber/operador')
  async operador(@Req() req: AliadoRequest, @Param('quoteNumber') quoteNumber: string, @Body() body: unknown) {
    const p = z.object({ nombre: z.string().trim().min(2, 'Escribe el nombre del operador').max(120), telefono: zTelefono().optional().nullable() }).safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const q = await prisma.quotes.findFirst({ where: { quote_number: quoteNumber.slice(0, 40) }, select: { id: true, service_state: true } });
    const suya = q
      ? await prisma.service_assignments.findFirst({ where: { quote_id: q.id, provider_id: req.providerId, state: 'aceptado' }, select: { id: true } })
      : null;
    if (!q || !suya) throw new BadRequestException('Ese servicio no es tuyo.');
    if (q.service_state === 'cerrado' || q.service_state === 'cancelado') throw new BadRequestException('Ese servicio ya terminó.');
    return asignarOperador(Number(q.id), { nombre: p.data.nombre, telefono: p.data.telefono ?? null });
  }

  /**
   * DÓNDE VA LA UNIDAD (2026-10-14). Mientras el servicio está "en traslado",
   * el teléfono del aliado manda su ubicación cada pocos minutos desde este
   * portal. Fuera de esa ventana se rechaza con `detener: true`: el teléfono
   * deja de mandar y no se guarda la ubicación de nadie que no vaya en camino.
   */
  @Post('servicios/:quoteNumber/ubicacion')
  async ubicacionUnidad(@Req() req: AliadoRequest, @Param('quoteNumber') quoteNumber: string, @Body() body: unknown) {
    const p = z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      precision: z.number().min(0).max(100_000).optional(),
    }).safeParse(body);
    if (!p.success) throw new BadRequestException('Ubicación inválida');
    const q = await prisma.quotes.findFirst({ where: { quote_number: quoteNumber.slice(0, 40) }, select: { id: true, service_state: true } });
    const suya = q
      ? await prisma.service_assignments.findFirst({ where: { quote_id: q.id, provider_id: req.providerId, state: 'aceptado' }, select: { id: true } })
      : null;
    if (!q || !suya) throw new BadRequestException('Ese servicio no es tuyo.');
    // Un punto cada pocos segundos y los últimos del recorrido (quotes/rastreo.ts).
    return guardarUbicacion(q, req.providerId, p.data);
  }

  /**
   * MANTENIMIENTO (2026-10-26). Ya no se le pide confirmar cada 14 días que su
   * equipo sigue libre ("Sigue libre" se quitó): él avisa cuando una máquina
   * sale de circulación, porque es el primero en saberlo. Mientras dure no se
   * le ofrece ese equipo; MAQSER24 se entera por la campana, y si choca con un
   * servicio ya apartado se le dice para que busque otra.
   */
  @Post('equipos/:productId/mantenimiento')
  async mantenimiento(@Req() req: AliadoRequest, @Param('productId', ParseIntPipe) productId: number, @Body() body: unknown) {
    const p = z
      .object({
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige desde cuándo'),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        nota: z.string().trim().max(300).optional().nullable(),
      })
      .safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Revisa las fechas.');
    const { desde, hasta, nota } = p.data;
    const hoyMty = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
    if (desde < hoyMty) throw new BadRequestException('La fecha de inicio ya pasó: elige hoy o después.');
    if (hasta && hasta < desde) throw new BadRequestException('La fecha de regreso debe ser después del inicio.');

    const e = await prisma.products.findUnique({ where: { id: productId }, select: { provider_id: true, name: true, status: true } });
    if (!e || e.provider_id !== req.providerId || e.status !== 1) throw new BadRequestException('Ese equipo no es tuyo.');

    const inicio = new Date(`${desde}T00:00:00Z`);
    const fin = hasta ? new Date(`${hasta}T00:00:00Z`) : null;
    await prisma.availability_blocks.create({
      data: { product_id: productId, state: 'mantenimiento', starts_on: inicio, ends_on: fin, note: nota?.trim() || 'Lo marcó el aliado' },
    });

    // ¿Choca con algo que un servicio ya apartó?
    const choques = await prisma.availability_blocks.findMany({
      where: {
        product_id: productId,
        note: { startsWith: PREFIJO_RESERVA },
        OR: [{ ends_on: null }, { ends_on: { gte: inicio } }],
        ...(fin ? { starts_on: { lte: fin } } : {}),
      },
      select: { note: true },
    });
    const folios = choques.map((b) => (b.note as string).slice(PREFIJO_RESERVA.length));
    const aliado = await prisma.providers.findUnique({ where: { id: req.providerId }, select: { name: true } });
    const fecha = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    void avisarPanel({
      modulo: 'proveedores',
      evento: folios.length ? 'choque_reserva' : 'mantenimiento',
      titulo: `${aliado?.name ?? 'Un aliado'} puso en mantenimiento su ${e.name}`,
      cuerpo: `${fecha(desde)} → ${hasta ? fecha(hasta) : 'sin fecha de regreso'}${folios.length ? ` · Choca con ${folios.join(', ')}: hay que buscar otra máquina.` : ''}`,
      link: '/disponibilidad',
    });
    return { ok: true, choques: folios };
  }

  /** "Ya está lista": quita su mantenimiento antes de tiempo. */
  @Delete('equipos/:productId/mantenimiento/:blockId')
  async quitarMantenimiento(
    @Req() req: AliadoRequest,
    @Param('productId', ParseIntPipe) productId: number,
    @Param('blockId', ParseIntPipe) blockId: number,
  ) {
    const e = await prisma.products.findUnique({ where: { id: productId }, select: { provider_id: true, name: true } });
    if (!e || e.provider_id !== req.providerId) throw new BadRequestException('Ese equipo no es tuyo.');
    const b = await prisma.availability_blocks.findUnique({ where: { id: blockId }, select: { product_id: true, state: true, note: true } });
    if (!b || b.product_id !== productId || b.state !== 'mantenimiento' || (b.note ?? '').startsWith(PREFIJO_RESERVA)) {
      throw new BadRequestException('Ese mantenimiento ya no existe.');
    }
    await prisma.availability_blocks.delete({ where: { id: blockId } });
    const aliado = await prisma.providers.findUnique({ where: { id: req.providerId }, select: { name: true } });
    void avisarPanel({
      modulo: 'proveedores',
      evento: 'mantenimiento',
      titulo: `${aliado?.name ?? 'Un aliado'}: su ${e.name} ya está lista`,
      cuerpo: 'Terminó el mantenimiento; ya se le puede ofrecer.',
      link: '/disponibilidad',
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
      data: { location: p.data.location.trim() || null },
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

    /**
     * El correo y el teléfono NO se cambian desde aquí (auditoría 2026-10-23 y
     * 2026-10-28). A ese correo salen solos los enlaces nuevos (ofertas,
     * recordatorios, pagos), y al teléfono el "Mandar por WhatsApp" del panel:
     * quien tuviera un enlace reenviado ponía los suyos, y al revocarle el
     * acceso el siguiente aviso le mandaba un enlace válido otra vez. Antes se
     * podía poner correo si no había, y el teléfono siempre. Los cambia la
     * oficina en el panel; mandarlos iguales (el formulario los manda) sí pasa.
     */
    if (d.email !== undefined || d.phone !== undefined) {
      const actual = await prisma.providers.findUnique({ where: { id: req.providerId }, select: { email: true, phone: true } });
      const digitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
      const mismoCorreo = d.email === undefined || (limpio(d.email) ?? '').toLowerCase() === (actual?.email ?? '').trim().toLowerCase();
      const mismoTel = d.phone === undefined || digitos(limpio(d.phone)) === digitos(actual?.phone);
      if (!mismoCorreo || !mismoTel) {
        throw new BadRequestException('Tu correo y tu teléfono los cambia MAQSER24: escríbenos y lo hacemos. Así nadie más puede quedarse con tus avisos.');
      }
    }

    await prisma.providers.update({
      where: { id: req.providerId },
      data: {
        ...(d.contactName !== undefined ? { contact_name: limpio(d.contactName) } : {}),
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
    // Sus km salen de su lista (2026-10-09): si cambió sus zonas, se recalculan
    // desde la MISMA base. Su punto en el mapa no se mueve desde aquí.
    if (d.coverage !== undefined) await ubicarAliado(req.providerId, { buscarBase: false }).catch(() => null);
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
  /**
   * OFRECER UN EQUIPO (2026-09-24; una sola pantalla desde 2026-10-28).
   *
   * Nada de lo que ofrece un aliado se publica: el sitio enseña solo las
   * fichas de MAQSER24. Su equipo es capacidad, y lo que hace falta saber es de
   * qué tipo es, cuántas unidades tiene y dónde está:
   *  - Si eligió un tipo de la lista, queda activo en ese momento y le llegan
   *    las solicitudes de ese tipo, sin que nadie lo revise.
   *  - Si no está en la lista, queda "Nuevo" (ESTADO_POR_REVISAR) y MAQSER24
   *    decide en Inventario si es igual a un tipo que ya existe o si se vuelve
   *    un servicio nuevo (un volteo de 20 t donde solo había de 10 t).
   * Antes eran siete pasos con ficha técnica, horario, precios y fotos
   * obligatorias que el cliente ya no ve (revisión de Proveedores, 2026-10-28).
   */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('equipos')
  async ofrecerEquipo(@Req() req: AliadoRequest, @Body() body: unknown) {
    const parsed = ofertaSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Revisa los datos del equipo.');
    const d = parsed.data;

    const p = await prisma.providers.findUnique({ where: { id: req.providerId }, select: { id: true, name: true, categories: true } });
    if (!p) throw new BadRequestException('Aliado no encontrado');
    // UNA CATEGORÍA QUE NO ESTÁ EN LA LISTA (2026-10-28): se propone (o se usa
    // la que otro aliado ya propuso con ese nombre), queda en su expediente y su
    // equipo sale "Nuevo". MAQSER24 la decide en Categorías.
    let propuesta: { slug: string; nombre: string } | null = null;
    if (d.categoria === CATEGORIA_NUEVA) {
      const nombreCat = d.categoriaNueva?.trim() ?? '';
      if (nombreCat.length < 3) throw new BadRequestException('Escribe el nombre de la categoría.');
      propuesta = await categoriaPropuesta(nombreCat);
      d.categoria = propuesta.slug;
      if (!lista(p.categories).includes(propuesta.slug)) {
        await prisma.providers.update({ where: { id: p.id }, data: { categories: [...lista(p.categories), propuesta.slug], updated_at: new Date() } });
      }
    }
    // Solo en sus líneas: son las que MAQSER24 le validó. Servicio si la
    // categoría es una línea; producto si es cualquier otra (2026-09-25).
    const esProducto = !esLineaServicio(d.categoria);
    if (!propuesta && !lista(p.categories).includes(d.categoria)) {
      throw new BadRequestException(esProducto
        ? 'Esa categoría de productos no está en tu expediente. Escríbenos para agregarla.'
        : 'Esa línea de servicio no está en tu expediente. Escríbenos para agregarla.');
    }
    const categoria = await prisma.categories.findUnique({ where: { cat_slug: d.categoria }, select: { id: true, cat_name: true } });
    if (!categoria) throw new BadRequestException(esProducto ? 'Categoría desconocida.' : 'Línea de servicio desconocida.');
    // El tipo tiene que ser una ficha viva de ESA línea; si no, cuenta como nuevo.
    const tipo = d.tipoId && !esProducto
      ? await prisma.products.findFirst({
          where: { id: d.tipoId, provider_id: null, status: 1, category_id: categoria.id },
          select: { id: true, name: true, is_rental: true, price_unit: true },
        })
      : null;
    const base = tipo?.name ?? d.nombre?.trim() ?? '';
    if (base.length < 3) throw new BadRequestException('Escribe qué equipo es.');

    const ahora = new Date();
    const creado = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: p.id,
        category_id: categoria.id,
        tipo_id: tipo?.id ?? null,
        // Como en el registro del sitio: "Volteo 14 m³ Kenworth T800".
        name: [base, d.marca, d.modelo].filter(Boolean).join(' ').slice(0, 200),
        Marca: d.marca || null,
        description: `Lo ofreció desde su portal (${ahora.toISOString().slice(0, 10)}).`,
        cprice: 0,
        // Maquinaria y transporte se rentan; materiales, triturados y asfalto se venden.
        is_rental: tipo?.is_rental ?? (d.categoria === 'maquinaria-pesada' || d.categoria === 'transporte-y-servicios-de-obra'),
        price_unit: tipo?.price_unit ?? null,
        location: d.ubicacion || null,
        stock: d.unidades ?? 1,
        status: tipo ? 1 : ESTADO_POR_REVISAR,
        ...(tipo ? { availability_confirmed_at: ahora } : {}),
        featured: 0,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true, name: true },
    });
    if (tipo) return { ok: true, id: creado.id, nuevo: false };

    // Lo nuevo: la campana y el correo llevan a donde se decide (Inventario, o
    // Categorías si propuso una categoría que no existe).
    void avisarPanel({
      modulo: 'catalogo',
      evento: 'oferta_aliado',
      titulo: propuesta ? `${p.name} propuso una categoría nueva: ${propuesta.nombre}` : `${p.name} ofreció algo nuevo: ${creado.name}`,
      cuerpo: propuesta
        ? `Con «${creado.name}» · decide en Categorías si es la misma que otra, si la autorizas o si no la manejas`
        : `${categoria.cat_name} · decide en Inventario si es igual a un tipo o un servicio nuevo`,
      link: propuesta ? '/categorias' : '/productos',
    });
    // Avisar al equipo de MAQSER24; nunca tumba la oferta, que ya quedó guardada.
    const interno = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null;
    if (interno) {
      const panel = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
      void this.mailer
        .enviar({
          kind: 'provider_offer_review',
          to: interno,
          providerId: p.id,
          ...correoEquipoPropuesto({ aliado: p.name, equipo: creado.name, marca: d.marca || null, linea: propuesta ? `${propuesta.nombre} (categoría nueva)` : categoria.cat_name, url: `${panel}${propuesta ? '/categorias' : '/productos'}` }),
        })
        .catch(() => undefined);
    }
    return { ok: true, id: creado.id, nuevo: true };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('documentos')
  @UseInterceptors(FileInterceptor('file', { storage: docStorage, limits: { fileSize: 8 * 1024 * 1024 } }))
  async subirDocumento(
    @Req() req: AliadoRequest,
    @Body() body: unknown,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const p = documentoSchema.safeParse(body);
    // Un papel sin archivo, o una póliza sin vigencia, contaba como "al día" y
    // devolvía el sello (auditoría 2026-10-23): se exige la foto o el PDF, y la
    // fecha de la póliza.
    const problema = !p.success
      ? 'Elige qué documento es y hasta cuándo vale.'
      : !file
        ? 'Sube la foto o el PDF del documento.'
        : p.data.expiresAt?.trim() && !fechaValida(p.data.expiresAt)
          ? 'Escribe la fecha de vencimiento como AAAA-MM-DD.'
          : p.data.kind === 'seguro' && !fechaValida(p.data.expiresAt)
            ? 'Escribe hasta cuándo vale la póliza.'
            : null;
    if (problema) {
      if (file) await borrarPrivado(`${PREFIJO_PRIVADO}${file.filename}`);
      throw new BadRequestException(problema);
    }
    const d = p.data!;

    const doc = await prisma.provider_documents.create({
      data: {
        provider_id: req.providerId,
        kind: d.kind,
        name: d.name?.trim() || DOC_LABEL[d.kind],
        file: file ? `${PREFIJO_PRIVADO}${file.filename}` : null,
        issued_at: new Date(),
        expires_at: fecha(d.expiresAt),
      },
      select: { id: true, kind: true, name: true, expires_at: true, file: true },
    });

    // El estado nuevo del expediente viaja de vuelta: el aliado acaba de subir
    // un papel para recuperar el sello y tiene que ver si lo consiguió.
    const todos = await prisma.provider_documents.findMany({
      where: { provider_id: req.providerId },
      select: { id: true, kind: true, name: true, expires_at: true },
    });

    return {
      ok: true,
      documento: {
        id: doc.id,
        kind: doc.kind,
        kindLabel: DOC_LABEL[doc.kind as TipoDoc] ?? doc.kind,
        name: doc.name,
        expiresAt: doc.expires_at ? doc.expires_at.toISOString().slice(0, 10) : null,
        // El archivo ya no tiene dirección pública: el aliado solo sabe que lo entregó.
        tieneArchivo: Boolean(doc.file),
      },
      estadoDocumentos: estadoDocumentos(todos),
    };
  }
}
