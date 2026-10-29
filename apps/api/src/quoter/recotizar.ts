import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import {
  COTIZADORES_META,
  alinearATarifa,
  analizarPartidas,
  calcularCotizacion,
  filasDelDocumento,
  ponerPrecio,
  quitarPrecio,
  tieneImporte,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CotizadorTipo,
  type OpcionesCotizador,
  type PartidaAnalizada,
  type PartidaCotizador,
  type FilaDesglose,
  type FilaExplicada,
  type RefTarifa,
  type RenglonCotizacion,
} from '@maqserv/config';
import { sincronizarReserva } from '../quotes/reservas';
import { QuoterService } from './quoter.service';
import { QuoterServicio } from './quoter-servicio';
import { claveDeRenglon } from './parte-del-documento';
import { partidasDe } from './quoter.dto';

/**
 * REVISAR Y CORREGIR EL PRECIO DE UNA SOLICITUD (2026-10-23).
 *
 * Desde que el sitio ya no enseña precios, todo lo que pide un cliente llega a
 * Solicitudes con un precio ESTIMADO que alguien revisa antes de mandárselo.
 * Aquí vive lo que esa revisión necesita:
 *
 *  - El DESGLOSE: cada renglón del documento con de dónde sale su precio
 *    (la ficha del tipo y su tramo, el tipo de flete, la zona…).
 *  - El LÁPIZ, con dos alcances: "solo esta cotización" (un precio especial
 *    que se guarda en la partida, como el costo/hora negociado del panel) y
 *    "corregir la tarifa" (se escribe en el tabulador y se recalculan las
 *    demás solicitudes que siguen por cotizar).
 *  - RECALCULAR EN SU LUGAR: mientras el documento no se ha mandado al
 *    cliente es un borrador, así que se rehace con el mismo folio en vez de
 *    emitir otro. Lo ya mandado o aceptado no se toca: ese precio ya se le
 *    prometió al cliente.
 *  - Las PARTES: el cotizador del sitio parte un documento por línea (la
 *    excavadora por un lado, la pipa por otro). Al recalcular, cada parte
 *    recibe lo suyo; si al volver a cotizar aparece una línea nueva se abre su
 *    parte, y la que se quedó sin renglones se descarta.
 */

/** Estados del documento en los que todavía es un borrador (no lo ha visto el cliente). */
const EDITABLES = ['solicitada', 'borrador'];

export type Alcance = 'esta' | 'tarifa';

/** La fila con su partida y su tarifa (no sale al panel). */
type FilaInterna = FilaExplicada;
export type { FilaDesglose };

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Doc = NonNullable<Awaited<ReturnType<typeof prisma.quoter_quotes.findUnique>>>;

/** Lo que se cambia de la entrega desde la ficha. Lo que no viene, no se toca. */
export interface DatosEntrega {
  obraId?: number | null;
  obraNueva?: { nombre: string; direccion: string; municipio: string } | null;
  /** AAAA-MM-DD; vacío la quita. */
  fechaInicio?: string | null;
  atencion?: string | null;
  telefono?: string | null;
  notas?: string | null;
}
type Solicitud = NonNullable<Awaited<ReturnType<typeof prisma.quotes.findUnique>>>;
/** Lo que hace falta de la solicitud para ligarle un documento (lo que da QuoterService.solicitudLigable). */
type SolicitudALigar = Pick<Solicitud, 'id' | 'requirements' | 'status'>;

@Injectable()
export class Recotizar {
  private readonly log = new Logger('Recotizar');

  constructor(
    private readonly quoter: QuoterService,
    private readonly servicio: QuoterServicio,
  ) {}

  // ---- La ficha de la cotización -----------------------------------------

  /**
   * LA FICHA DE LA COTIZACIÓN (2026-10-23). "Volver a cotizar" ya no abre el
   * cotizador de pasos: abre una pantalla con lo que se está cotizando a
   * detalle, sus costos y el resumen, y ahí mismo se edita. Esto es lo que esa
   * pantalla necesita; el tabulador y las fichas los pide aparte (los mismos
   * que usa el cotizador del panel) y recalcula en el navegador con el motor.
   *
   * `modo`: `editar` mientras no se le ha mandado al cliente (se guarda sobre
   * el mismo documento); `nueva_version` si ya se le mandó y no la ha
   * aceptado (sale un documento nuevo y la solicitud vuelve a "Por cotizar");
   * `ver` si ya la aceptó o está descartada.
   */
  async ficha(quoteId: number) {
    const q = await prisma.quotes.findUnique({
      where: { id: quoteId },
      include: {
        clients: { select: { id: true, name: true } },
        client_sites: { select: { id: true, name: true, address: true, municipality: true } },
      },
    });
    if (!q) throw new NotFoundException('Solicitud no encontrada');
    const req = (q.requirements ?? {}) as Record<string, unknown>;
    const doc = await this.documentoDe(q);
    const pendiente = q.status === 'pending' && !q.accepted_at;
    const respondida = q.status === 'completed' && !q.accepted_at;
    const modo: 'editar' | 'nueva_version' | 'ver' = pendiente && (!doc || EDITABLES.includes(doc.state))
      ? 'editar'
      : doc && (respondida || pendiente) ? 'nueva_version' : 'ver';
    const partes = doc
      ? await prisma.quotes.findMany({
          where: { requirements: { path: '$.folio', equals: doc.folio }, status: { not: 'rejected' } },
          select: { id: true, quote_number: true, service_category: true, total: true },
          orderBy: { id: 'asc' },
        })
      : [];
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return {
      solicitud: {
        id: Number(q.id),
        quoteNumber: q.quote_number,
        status: q.status,
        aceptada: q.accepted_at !== null,
        empresa: q.clients?.name ?? q.company_name ?? q.name,
        contacto: q.name,
        telefono: q.phone,
        correo: q.email,
        obra: q.client_sites
          ? { id: q.client_sites.id, name: q.client_sites.name, address: q.client_sites.address, municipality: q.client_sites.municipality }
          : { id: null, name: texto(req.obra) ?? 'Sin obra', address: q.address, municipality: texto(req.obra_ubicacion) },
        atencion: doc?.attention ?? null,
        fechaInicio: texto(req.fecha_inicio),
        notas: doc?.notes ?? null,
        pide: q.product_interested,
        comentarios: q.comments,
        validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
        // Lo de la solicitud, para "Mandar precio".
        subtotal: Number(q.subtotal),
        freightCost: Number(q.freight_cost),
        tax: Number(q.tax),
        total: Number(q.total),
      },
      modo,
      documento: doc
        ? {
            id: doc.id,
            folio: doc.folio,
            kind: doc.kind,
            state: doc.state,
            partidas: (doc.items ?? []) as unknown as PartidaCotizador[],
            opciones: (doc.options ?? {}) as Partial<OpcionesCotizador>,
            subtotal: Number(doc.subtotal),
            iva: Number(doc.tax),
            total: Number(doc.total),
          }
        : null,
      partes: partes.map((p) => ({ id: Number(p.id), quoteNumber: p.quote_number, linea: p.service_category, total: Number(p.total) })),
      // Para cambiar de obra: las de su empresa.
      obras: q.client_id
        ? (await prisma.client_sites.findMany({
            where: { client_id: q.client_id, status: 1 },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, address: true, municipality: true },
          }))
        : [],
      formulario: doc
        ? null
        : { filas: filasDelFormulario(q).map(sinInternos), subtotal: r2(Number(q.subtotal) + Number(q.freight_cost)), iva: Number(q.tax), total: Number(q.total) },
    };
  }

  /**
   * Guarda lo editado en la ficha: las partidas completas (cantidades, precios
   * especiales, partidas agregadas o quitadas). Mientras no se le ha mandado,
   * sobre el mismo documento; si ya se le mandó, como versión nueva.
   */
  async guardarPartidas(
    quoteId: number,
    crudas: unknown[] | null,
    opciones: Partial<OpcionesCotizador>,
    por: { adminId: number | null; adminNombre: string | null },
    datos: DatosEntrega | null = null,
  ): Promise<{ folio: string | null; total: number; nuevaVersion: boolean }> {
    const q = await prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!q) throw new NotFoundException('Solicitud no encontrada');
    if (q.accepted_at || q.status === 'rejected') throw new BadRequestException('El cliente ya la aceptó o está descartada: ya no se cambia aquí.');
    const doc = await this.documentoDe(q);
    // Primero los datos de la entrega: la versión nueva (si sale) los copia del documento.
    if (datos) await this.aplicarDatos(q, doc, datos);
    if (!doc) {
      if (crudas?.length) throw new BadRequestException('Esta solicitud no tiene documento: cambia sus renglones con el lápiz.');
      const fresca = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { total: true } });
      return { folio: null, total: Number(fresca?.total ?? 0), nuevaVersion: false };
    }
    const tipo = doc.kind as CotizadorTipo;
    const partidas = partidasDe(tipo, crudas ?? ((doc.items ?? []) as unknown[]));
    if (!partidas.length) throw new BadRequestException('La cotización se quedó sin partidas.');
    const pendiente = q.status === 'pending' && !q.accepted_at;
    if (pendiente && EDITABLES.includes(doc.state)) {
      const r = await this.recalcular(doc.id, { partidas, opciones, adminNombre: por.adminNombre });
      return { folio: r.folio, total: Number(r.total), nuevaVersion: false };
    }
    // Ya se le mandó: sale una versión nueva y la solicitud vuelve a "Por cotizar".
    const base = (await prisma.quoter_quotes.findUnique({ where: { id: doc.id } })) ?? doc;
    const cot = await this.quoter.crear(
      {
        tipo,
        cliente: base.client_name,
        obra: base.work,
        atencion: base.attention,
        municipio: base.municipality,
        correo: base.email,
        telefono: base.phone,
        notas: base.notes,
        opciones,
        partidas,
      },
      { origen: 'panel', estado: 'borrador', adminId: por.adminId, adminNombre: por.adminNombre, userId: q.user_id != null ? Number(q.user_id) : null },
    );
    await this.ligar(q, cot);
    return { folio: cot.folio, total: Number(cot.total), nuevaVersion: true };
  }

  /**
   * LOS DATOS DE LA ENTREGA (2026-10-23): "si hay cambios con el envío, de
   * fecha, lugar, etc., también se puede modificar ahí". Cambian en TODAS las
   * partes del documento (es la misma obra y la misma fecha) y en el documento,
   * que es lo que se imprime. La obra es una de su empresa, o una nueva que se
   * da de alta en ella. Las reservas siguen solas a la fecha nueva.
   */
  private async aplicarDatos(q: Solicitud, doc: Doc | null, d: DatosEntrega) {
    const partes = doc
      ? await prisma.quotes.findMany({ where: { requirements: { path: '$.folio', equals: doc.folio }, accepted_at: null, status: { not: 'rejected' } } })
      : [q];
    let obra: { id: number; name: string; address: string | null; municipality: string | null } | null = null;
    if (d.obraId) {
      obra = await prisma.client_sites.findFirst({
        where: { id: d.obraId, client_id: q.client_id ?? -1 },
        select: { id: true, name: true, address: true, municipality: true },
      });
      if (!obra) throw new BadRequestException('Esa obra no es de esta empresa.');
    } else if (d.obraNueva) {
      if (!q.client_id) throw new BadRequestException('Esta solicitud no tiene empresa: no se le puede dar de alta una obra.');
      const municipio = d.obraNueva.municipio.trim();
      obra = await prisma.client_sites.create({
        data: {
          client_id: q.client_id,
          name: d.obraNueva.nombre.trim().slice(0, 190),
          address: [d.obraNueva.direccion.trim(), municipio].filter(Boolean).join(', ').slice(0, 400),
          municipality: municipio.slice(0, 120) || null,
          contact_name: q.name,
          contact_phone: q.phone,
          notes: 'La dio de alta MAQSER24 desde la ficha de la cotización.',
        },
        select: { id: true, name: true, address: true, municipality: true },
      });
    }
    const telefono = d.telefono?.trim() || null;
    for (const p of partes) {
      const req: Record<string, unknown> = { ...((p.requirements ?? {}) as Record<string, unknown>) };
      if (obra) {
        req.obra = obra.name;
        if (obra.municipality) req.obra_ubicacion = obra.municipality;
      }
      if (d.fechaInicio !== undefined) {
        if (d.fechaInicio) req.fecha_inicio = d.fechaInicio;
        else delete req.fecha_inicio;
      }
      await prisma.quotes.update({
        where: { id: p.id },
        data: {
          requirements: req as Prisma.InputJsonValue,
          ...(obra ? { site_id: obra.id, address: obra.address || obra.name, region: obra.municipality ?? p.region } : {}),
          ...(telefono ? { phone: telefono.slice(0, 40) } : {}),
          updated_at: new Date(),
        },
      });
      await sincronizarReserva(Number(p.id));
    }
    if (doc) {
      await prisma.quoter_quotes.update({
        where: { id: doc.id },
        data: {
          ...(obra ? { work: obra.name.slice(0, 190), municipality: obra.municipality?.slice(0, 90) ?? doc.municipality } : {}),
          ...(d.atencion !== undefined ? { attention: d.atencion?.trim().slice(0, 190) || null } : {}),
          ...(d.notas !== undefined ? { notes: d.notas?.trim() || null } : {}),
          ...(telefono ? { phone: telefono.slice(0, 40) } : {}),
          updated_at: new Date(),
        },
      });
    }
  }

  /** Corregir una tarifa desde la ficha: se escribe en el tabulador y se recalcula todo lo que sigue por cotizar. */
  async corregirTarifa(tipo: CotizadorTipo, ref: RefTarifa, valor: number, correo: string) {
    if (!Number.isFinite(valor) || valor <= 0) throw new BadRequestException('Escribe un precio mayor a cero.');
    const t = await this.quoter.corregirTarifa(tipo, ref, valor, correo);
    const recalculadas = await this.recalcularPendientes(tipo, ref, t.antes, valor, -1);
    return { ...t, recalculadas };
  }

  // ---- El lápiz ------------------------------------------------------------

  /**
   * Cambia el precio de UNA fila del desglose. La fila se identifica por su
   * posición y se vuelve a armar aquí: lo que diga el navegador sobre qué
   * tarifa es no se cree.
   */
  async cambiarPrecio(
    quoteId: number,
    fila: number,
    valor: number,
    alcance: Alcance,
    correo: string,
    /** Solo el formulario: las unidades de esa partida (en un documento se editan en la ficha y se guardan juntas). */
    cantidad?: number | null,
  ): Promise<{ concepto: string; antes: number; tarifa: { nombre: string; antes: number | null } | null; recalculadas: number }> {
    if (!Number.isFinite(valor) || valor <= 0) throw new BadRequestException('Escribe un precio mayor a cero.');
    const q = await prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!q) throw new NotFoundException('Solicitud no encontrada');
    if (q.status !== 'pending' || q.accepted_at) {
      throw new BadRequestException('Esta solicitud ya se le mandó al cliente: su precio ya no se cambia aquí. Vuelve a cotizarla.');
    }
    const doc = await this.documentoDe(q);
    if (!doc) return this.cambiarPrecioFormulario(q, fila, valor, alcance, correo, cantidad ?? null);
    if (!EDITABLES.includes(doc.state)) throw new BadRequestException('Ese documento ya se mandó: vuelve a cotizarla para cambiar el precio.');

    const tipo = doc.kind as CotizadorTipo;
    const cat = await this.quoter.catalogo(tipo);
    const calc = (doc.snapshot as { calc?: CalculoCotizacion } | null)?.calc;
    const partidas = structuredClone((doc.items ?? []) as unknown as PartidaCotizador[]);
    const filas = calc ? filasDelDocumento(cat, partidas, calc, await this.quoter.fichasDeRenglones(tipo)) : [];
    const f = filas[fila];
    if (!f?.edicion || f.partida === null) throw new BadRequestException('Ese renglón no se puede editar.');

    if (alcance === 'esta') {
      ponerPrecio(cat, partidas, f.partida, filaClase(calc!.renglones[fila]), valor);
      await this.recalcular(doc.id, { partidas });
      return { concepto: f.concepto, antes: f.edicion.valor, tarifa: null, recalculadas: 0 };
    }

    if (!f.ref) throw new BadRequestException('Ese precio no sale de una tarifa (se escribió a mano): cámbialo solo para esta cotización.');
    const t = await this.quoter.corregirTarifa(tipo, f.ref, valor, correo);
    // Esta fila deja su precio especial (si tenía) y toma la tarifa nueva; lo
    // demás de este documento que traía la tarifa vieja, también.
    quitarPrecio(partidas, f.partida, filaClase(calc!.renglones[fila]), valor);
    const nuevoCat = await this.quoter.catalogo(tipo);
    await this.recalcular(doc.id, { partidas: alinearATarifa(nuevoCat, partidas, f.ref, t.antes, valor) });
    const recalculadas = await this.recalcularPendientes(tipo, f.ref, t.antes, valor, doc.id);
    return { concepto: f.concepto, antes: f.edicion.valor, tarifa: t, recalculadas };
  }

  /**
   * Las demás solicitudes por cotizar del mismo cotizador, con la tarifa nueva.
   * Cada una conserva sus precios especiales; lo que traía la tarifa vieja
   * escrita (el panel llena el precio del servicio o del material al agregarlo)
   * pasa a la nueva. Nunca lanza: la tarifa ya se guardó.
   */
  private async recalcularPendientes(tipo: CotizadorTipo, ref: RefTarifa, antes: number | null, nuevo: number, menos: number): Promise<number> {
    const pendientes = await prisma.quotes.findMany({ where: { status: 'pending', accepted_at: null }, select: { requirements: true } });
    const ids = [...new Set(pendientes
      .map((p) => (p.requirements as { quoterId?: unknown } | null)?.quoterId)
      .filter((id): id is number => typeof id === 'number' && id !== menos))];
    if (!ids.length) return 0;
    const docs = await prisma.quoter_quotes.findMany({ where: { id: { in: ids }, kind: tipo, state: { in: EDITABLES } } });
    const cat = await this.quoter.catalogo(tipo);
    let n = 0;
    for (const d of docs) {
      try {
        const partidas = alinearATarifa(cat, structuredClone(d.items as unknown as PartidaCotizador[]), ref, antes, nuevo);
        const r = await this.recalcular(d.id, { partidas });
        if (Math.abs(Number(r.total) - Number(d.total)) >= 0.01) n += 1;
      } catch (e) {
        this.log.warn(`No se pudo recalcular ${d.folio} con la tarifa nueva: ${(e as Error).message}`);
      }
    }
    return n;
  }

  // ---- Recalcular en su lugar ---------------------------------------------

  /**
   * Rehace el documento (mismo folio) con el tabulador vigente y le pasa a
   * cada parte su importe. `contexto` llega cuando se vuelve a cotizar desde
   * el cotizador del panel: cliente, obra y contacto también pueden cambiar.
   */
  async recalcular(docId: number, cambios: {
    partidas?: PartidaCotizador[];
    opciones?: Partial<OpcionesCotizador>;
    contexto?: { cliente: string; obra?: string | null; atencion?: string | null; municipio?: string | null; correo?: string | null; telefono?: string | null; notas?: string | null };
    adminNombre?: string | null;
  } = {}): Promise<Doc> {
    const doc = await prisma.quoter_quotes.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    const tipo = doc.kind as CotizadorTipo;
    const cat = await this.quoter.catalogo(tipo);
    const partidas = cambios.partidas ?? ((doc.items ?? []) as unknown as PartidaCotizador[]);
    const opciones = cambios.opciones ?? ((doc.options ?? {}) as Partial<OpcionesCotizador>);
    const calc = calcularCotizacion(cat, partidas, opciones);
    if (!tieneImporte(calc)) throw new BadRequestException('Con ese cambio la cotización se queda sin importe. Revisa cantidades y precios.');
    const snapshot = {
      ...((doc.snapshot ?? {}) as Record<string, unknown>),
      calc,
      version: cat.version,
      empresa: cat.empresa,
      firma: cat.firma,
      saludo: cat.saludo,
    };
    const c = cambios.contexto;
    const nuevo = await prisma.quoter_quotes.update({
      where: { id: docId },
      data: {
        items: partidas as unknown as Prisma.InputJsonValue,
        options: opciones as unknown as Prisma.InputJsonValue,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        subtotal: new Prisma.Decimal(calc.subtotal),
        tax: new Prisma.Decimal(calc.iva),
        total: new Prisma.Decimal(calc.total),
        ...(c
          ? {
              client_name: (c.cliente || doc.client_name).slice(0, 190),
              work: c.obra?.slice(0, 190) || null,
              attention: c.atencion?.slice(0, 190) || null,
              municipality: c.municipio?.slice(0, 90) || null,
              email: c.correo?.slice(0, 190) || doc.email,
              phone: c.telefono?.slice(0, 40) || doc.phone,
              notes: c.notas || null,
            }
          : {}),
        ...(cambios.adminNombre ? { admin_name: cambios.adminNombre.slice(0, 190) } : {}),
        updated_at: new Date(),
      },
    });
    await this.reconciliar(nuevo, cat, partidas, opciones, calc);
    return nuevo;
  }

  /**
   * LIGAR UN DOCUMENTO NUEVO A UNA SOLICITUD ("Volver a cotizar" cuando el de
   * antes ya se había mandado): todas las partes del documento anterior pasan
   * al nuevo, regresan a "Por cotizar" para mandarle el precio bueno, y el
   * anterior queda cancelado (no se borra: queda el rastro).
   */
  async ligar(solicitud: SolicitudALigar, cot: Doc): Promise<void> {
    const req = (solicitud.requirements ?? {}) as Record<string, unknown>;
    const folioViejo = typeof req.folio === 'string' && req.folio ? req.folio : null;
    const anterior = typeof req.quoterId === 'number' && req.quoterId !== cot.id ? req.quoterId : null;
    const partes = folioViejo
      ? await prisma.quotes.findMany({ where: { requirements: { path: '$.folio', equals: folioViejo }, accepted_at: null, status: { not: 'rejected' } } })
      : [solicitud];
    for (const p of partes) {
      const r: Record<string, unknown> = { ...((p.requirements ?? {}) as Record<string, unknown>), folio: cot.folio, quoterId: cot.id };
      // Ya no existe "aprobar" (2026-10-23): todo se le responde al cliente.
      delete r.precioAjustado;
      await prisma.quotes.update({
        where: { id: p.id },
        data: {
          requirements: r as Prisma.InputJsonValue,
          ...(p.status === 'completed' ? { status: 'pending' } : {}),
          updated_at: new Date(),
        },
      });
    }
    if (anterior) {
      await prisma.quoter_quotes.updateMany({
        where: { id: anterior, state: { in: ['borrador', 'solicitada', 'enviada'] } },
        data: { state: 'cancelada', updated_at: new Date() },
      });
    }
    const tipo = cot.kind as CotizadorTipo;
    const calc = (cot.snapshot as { calc?: CalculoCotizacion } | null)?.calc;
    if (!calc) throw new BadRequestException('El documento nuevo no trae cálculo.');
    await this.reconciliar(cot, await this.quoter.catalogo(tipo), cot.items as unknown as PartidaCotizador[], (cot.options ?? {}) as Partial<OpcionesCotizador>, calc);
  }

  /** El documento editable ligado a la solicitud, si lo hay (para recotizar con el mismo folio). */
  async documentoEditable(solicitud: SolicitudALigar, tipo: CotizadorTipo): Promise<Doc | null> {
    const doc = await this.documentoDe(solicitud);
    return doc && doc.kind === tipo && EDITABLES.includes(doc.state) ? doc : null;
  }

  private async documentoDe(q: { requirements: unknown }): Promise<Doc | null> {
    const id = (q.requirements as { quoterId?: unknown } | null)?.quoterId;
    return typeof id === 'number' ? prisma.quoter_quotes.findUnique({ where: { id } }) : null;
  }

  /**
   * A cada parte lo suyo. Del cotizador del sitio, una parte por línea (igual
   * que al abrirla, ver QuoterServicio.abrir); de cualquier otro origen (el
   * formulario cotizado con el tabulador) la solicitud es una sola y lleva el
   * documento entero, como siempre.
   */
  private async reconciliar(doc: Doc, cat: CatalogoCotizador, partidas: PartidaCotizador[], opciones: Partial<OpcionesCotizador>, calc: CalculoCotizacion) {
    const partes = await prisma.quotes.findMany({
      where: { requirements: { path: '$.folio', equals: doc.folio }, accepted_at: null, status: { not: 'rejected' } },
      orderBy: { id: 'asc' },
    });
    if (!partes.length) return;
    const principal = partes[0];
    const origen = (principal.requirements as { origen?: unknown } | null)?.origen;
    const ahora = new Date();

    if (origen !== 'cotizador') {
      await prisma.quotes.update({
        where: { id: principal.id },
        data: {
          // El flete ya va dentro de las partidas del documento.
          subtotal: new Prisma.Decimal(calc.subtotal),
          tax: new Prisma.Decimal(calc.iva),
          freight_cost: new Prisma.Decimal(0),
          total: new Prisma.Decimal(calc.total),
          updated_at: ahora,
        },
      });
      await sincronizarReserva(Number(principal.id));
      return;
    }

    const porLinea = new Map<string, PartidaAnalizada[]>();
    for (const a of analizarPartidas(cat, partidas)) porLinea.set(a.linea, [...(porLinea.get(a.linea) ?? []), a]);
    const varias = porLinea.size > 1;
    const tipo = doc.kind as CotizadorTipo;
    const usadas = new Set<bigint>();

    for (const [linea, grupo] of porLinea) {
      const calcLinea = varias ? calcularCotizacion(cat, grupo.map((g) => g.partida), opciones) : calc;
      const parte = partes.find((p) => p.service_category === linea && !usadas.has(p.id))
        ?? (!varias ? partes.find((p) => !usadas.has(p.id)) : undefined);
      if (parte) {
        usadas.add(parte.id);
        await this.actualizarParte(parte, doc, linea, calcLinea, grupo, varias);
        continue;
      }
      // Una línea que el documento no traía: se abre su parte, igual que al llegar.
      const nombreLinea = (await prisma.categories.findUnique({ where: { cat_slug: linea }, select: { cat_name: true } }))?.cat_name ?? linea;
      const abierto = await this.servicio.crearServicio({
        cot: { id: doc.id, folio: doc.folio, work: doc.work, attention: doc.attention, municipality: doc.municipality, phone: doc.phone, notes: doc.notes },
        tipo,
        nombreCotizador: COTIZADORES_META[tipo].titulo.toLowerCase(),
        linea,
        lineaNombre: nombreLinea,
        calc: calcLinea,
        grupo,
        entrada: {
          cuenta: { name: principal.name, email: principal.email, phone: principal.phone },
          cliente: principal.name,
          userId: principal.user_id != null ? Number(principal.user_id) : null,
          // La parte nueva va a la misma empresa y obra que las demás.
          destino: { clientId: principal.client_id ?? null, siteId: principal.site_id ?? null, direccion: null },
        },
        modo: 'por_confirmar',
        parte: true,
      });
      usadas.add(BigInt(abierto.quoteId));
    }

    // Las partes que se quedaron sin renglones: lo que pedían ya no está en el documento.
    for (const p of partes) {
      if (usadas.has(p.id)) continue;
      await prisma.quotes.update({
        where: { id: p.id },
        data: {
          status: 'rejected',
          comments: `${p.comments ?? ''}\nSe quitó de ${doc.folio} al volver a cotizar.`.trim(),
          updated_at: ahora,
        },
      });
      await sincronizarReserva(Number(p.id));
    }
  }

  /** Mismos campos que llena QuoterServicio.crearServicio, con el cálculo nuevo. */
  private async actualizarParte(parte: Solicitud, doc: Doc, linea: string, calc: CalculoCotizacion, grupo: PartidaAnalizada[], varias: boolean) {
    const fletes = r2(calc.desglose.fletes);
    const req: Record<string, unknown> = { ...((parte.requirements ?? {}) as Record<string, unknown>), folio: doc.folio, quoterId: doc.id };
    delete req.precioAjustado;
    const ligados = [...new Set(grupo.flatMap((g) => g.productos))];
    if (ligados.length) req.productos = ligados; else delete req.productos;
    if (varias) req.renglones = [...new Set(calc.renglones.filter((r) => r.id !== undefined).map(claveDeRenglon))];
    else delete req.renglones;
    const diasEquipo = Math.max(0, ...grupo.map(({ partida: p }) => (p.tipo === 'equipo' ? (p.dias ?? 0) + ((p.horas ?? 0) > 0 ? 1 : 0) : 0)));
    if (diasEquipo > 0) req.duracion = `${diasEquipo} ${diasEquipo === 1 ? 'día' : 'días'}`;
    const conceptos = grupo.map((g) => g.concepto);
    const comentarios = (parte.comments ?? '').split('\n')
      .map((l) => (l.startsWith('Conceptos:') ? `Conceptos: ${conceptos.join(' · ')}` : l))
      .join('\n');
    await prisma.quotes.update({
      where: { id: parte.id },
      data: {
        subtotal: new Prisma.Decimal(r2(calc.subtotal - fletes)),
        freight_cost: new Prisma.Decimal(fletes),
        tax: new Prisma.Decimal(r2(calc.iva)),
        total: new Prisma.Decimal(r2(calc.total)),
        included: calc.renglones.map((r) => `${r.concepto} · ${r.cantidad} ${r.unidad} × ${dinero(r.pu)} = ${dinero(r.importe)}`).join('\n'),
        conditions: calc.condiciones.map((b) => [b.titulo, ...b.puntos.map((p) => `- ${p}`)].join('\n')).join('\n\n') || null,
        comments: comentarios || null,
        service_category: linea,
        requirements: req as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
    await sincronizarReserva(Number(parte.id));
  }

  // ---- Formulario (sin documento) ------------------------------------------

  /**
   * Lo pedido por el formulario trae su precio estimado en cart_data: del
   * tabulador (el renglón del cotizador de su tipo) o de la ficha. "Solo esta
   * cotización" cambia el precio de esa partida; "corregir la tarifa" lo cambia
   * donde vive —el renglón del tabulador o la ficha— y lo pasa a las demás
   * solicitudes por cotizar que lo traían.
   */
  private async cambiarPrecioFormulario(q: Solicitud, fila: number, valor: number, alcance: Alcance, correo: string, cantidad: number | null) {
    const filas = filasDelFormulario(q);
    const f = filas[fila];
    if (!f?.edicion || f.partida === null) throw new BadRequestException('Ese renglón no se puede editar.');
    const carrito = leerCarrito(q.cart_data);
    const clave = Object.keys(carrito)[f.partida];
    const entrada = carrito[clave];
    if (!entrada) throw new BadRequestException('Ese renglón ya no está en la solicitud.');

    const unidades = cantidad && cantidad > 0 ? cantidad : undefined;
    if (alcance === 'esta') {
      // Si solo cambió la cantidad, el precio no se vuelve "especial".
      const especial = Math.abs(valor - f.edicion.valor) >= 0.005 || entrada.negociado === true;
      await guardarCarrito(q, { ...carrito, [clave]: conPrecio(entrada, valor, especial, unidades) });
      return { concepto: f.concepto, antes: f.edicion.valor, tarifa: null, recalculadas: 0 };
    }

    // Del tabulador: se corrige el renglón del cotizador, como desde un documento.
    if (entrada.fuente === 'tabulador' && entrada.renglon) {
      const rg = entrada.renglon;
      const cat = await this.quoter.catalogo(rg.tipo);
      // La maquinaria se cobra por hora desde 2026-10-29; lo pedido antes trae su precio por día (`tramo`).
      const ref: RefTarifa = rg.clase === 'equipo' && cat.tipo === 'maquinaria'
        ? { clase: 'equipo', id: rg.id, ...(entrada.porHora ? {} : { tramo: 'dia' }) }
        : rg.clase === 'servicio' ? { clase: 'servicio', id: rg.id } : { clase: 'material', id: rg.id };
      const t = await this.quoter.corregirTarifa(rg.tipo, ref, valor, correo);
      await guardarCarrito(q, { ...carrito, [clave]: conPrecio(entrada, valor, false, unidades) });
      const deFormulario = await this.alinearFormularios(q.id, (e) => e.fuente === 'tabulador' && e.renglon?.tipo === rg.tipo && e.renglon.clase === rg.clase && e.renglon.id === rg.id && !!e.porHora === !!entrada.porHora && Math.abs(Number(e.item?.cprice ?? 0) - (t.antes ?? NaN)) < 0.005, valor);
      const deDocumentos = await this.recalcularPendientes(rg.tipo, ref, t.antes, valor, -1);
      return { concepto: f.concepto, antes: f.edicion.valor, tarifa: t, recalculadas: deFormulario + deDocumentos };
    }

    const fichaId = Number(entrada.fichaId ?? entrada.item?.id);
    const ficha = Number.isInteger(fichaId) ? await prisma.products.findUnique({ where: { id: fichaId }, select: { id: true, name: true, cprice: true, tarifas: true, price_unit: true, provider_id: true } }) : null;
    if (!ficha) throw new BadRequestException('La ficha de ese equipo ya no existe.');
    // Precio único por tipo: el equipo de un aliado no lleva su propio precio.
    if (ficha.provider_id !== null) throw new BadRequestException('Ese equipo es de un aliado: el precio se corrige en la ficha de su tipo.');
    const antes = Number(ficha.cprice);
    // `cprice` es la tarifa de su unidad; la tabla de tarifas de la ficha se mantiene igual.
    const tarifas = leerTarifasFicha(ficha.tarifas);
    if (ficha.price_unit && ficha.price_unit in tarifas) tarifas[ficha.price_unit] = r2(valor);
    await prisma.products.update({
      where: { id: ficha.id },
      data: { cprice: r2(valor), ...(Object.keys(tarifas).length ? { tarifas: JSON.stringify(tarifas) } : {}) },
    });
    await guardarCarrito(q, { ...carrito, [clave]: conPrecio(entrada, valor, false, unidades) });
    const recalculadas = await this.alinearFormularios(q.id, (e) => e.fuente !== 'tabulador' && Number(e.fichaId ?? e.item?.id) === ficha.id, valor);
    return { concepto: f.concepto, antes: f.edicion.valor, tarifa: { nombre: ficha.name, antes }, recalculadas };
  }

  /** Las demás solicitudes del formulario por cotizar con ese precio, mientras no traigan uno especial. */
  private async alinearFormularios(menos: bigint, coincide: (e: EntradaCarrito) => boolean, valor: number): Promise<number> {
    let n = 0;
    const otras = await prisma.quotes.findMany({ where: { status: 'pending', accepted_at: null, id: { not: menos } } });
    for (const o of otras) {
      if (typeof (o.requirements as { quoterId?: unknown } | null)?.quoterId === 'number') continue;
      const c = leerCarrito(o.cart_data);
      let cambio = false;
      for (const [k, e] of Object.entries(c)) {
        if (e.negociado || !coincide(e)) continue;
        c[k] = conPrecio(e, valor, false);
        cambio = true;
      }
      if (cambio) { await guardarCarrito(o, c); n += 1; }
    }
    return n;
  }
}

// ---- Cómo se lee cada renglón (la lógica vive en @maqserv/config, desglose.ts) ----

const sinInternos = ({ partida: _p, ref: _r, ...f }: FilaInterna): FilaDesglose => f;

/** La clase del renglón con la que se sabe qué campo de la partida cambia. */
function filaClase(r: RenglonCotizacion | undefined): string {
  return r?.clase ?? '';
}

// ---- Formulario ------------------------------------------------------------

interface EntradaCarrito {
  qty?: number;
  days?: number;
  unit?: string | null;
  price?: number;
  item?: { id?: number; name?: string; cprice?: number; photo?: string | null };
  /** De dónde salió el precio estimado (QuotesService.create, 2026-10-23). */
  fuente?: 'tabulador' | 'ficha' | null;
  fichaId?: number | null;
  /** El renglón del tabulador del que salió (fuente 'tabulador'). */
  renglon?: { tipo: CotizadorTipo; clase: 'equipo' | 'servicio' | 'material'; id: string } | null;
  /** Lo que se cobra: viajes o piezas del formulario, o equipos en renta. */
  cantidad?: number;
  /** Importes de la partida por separado (sin flete, flete, IVA). Las viejas no los traen. */
  subtotal?: number;
  flete?: number;
  iva?: number;
  /** Precio especial puesto desde el desglose: no lo mueve una tarifa nueva. */
  negociado?: boolean;
  /** Maquinaria del tabulador cobrada por hora (2026-10-29). Sin la marca, su precio es por día. */
  porHora?: boolean;
}

function leerCarrito(raw: string | null): Record<string, EntradaCarrito> {
  try {
    const v = JSON.parse(raw ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, EntradaCarrito>) : {};
  } catch {
    return {};
  }
}

function leerTarifasFicha(raw: unknown): Record<string, number> {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}

const POR_TIEMPO = ['dia', 'semana', 'mes', 'hora'];

/** Lo que se cobra de la partida sin flete: el guardado, o (las viejas) precio × días × equipos. */
function baseDe(e: EntradaCarrito): number {
  if (e.subtotal !== undefined) return Number(e.subtotal);
  return Number(e.item?.cprice ?? 0) * Math.max(0.01, Number(e.days ?? 1)) * Math.max(1, Number(e.qty ?? 1));
}
function fleteDe(e: EntradaCarrito): number {
  return e.flete !== undefined ? Number(e.flete) : Math.max(0, r2(Number(e.price ?? 0) - baseDe(e)));
}
/**
 * Cuántas veces se cobra el precio unitario (días × equipos, viajes,
 * toneladas). Con precio, sale de lo cobrado; sin precio, de lo pedido.
 */
function unidadesDe(e: EntradaCarrito): number {
  const pu = Number(e.item?.cprice ?? 0);
  if (pu > 0) return baseDe(e) / pu;
  const qty = Math.max(1, Number(e.qty ?? 1));
  return POR_TIEMPO.includes(String(e.unit ?? '')) ? Math.max(0.01, Number(e.days ?? 1)) * qty : Number(e.cantidad ?? qty);
}

/** La entrada con su precio unitario (y, si cambian, sus unidades); el flete se conserva y el IVA se ajusta en proporción. */
function conPrecio(e: EntradaCarrito, valor: number, negociado: boolean, nuevasUnidades?: number): EntradaCarrito {
  const unidades = nuevasUnidades ?? unidadesDe(e);
  const flete = fleteDe(e);
  const baseAntes = baseDe(e);
  const base = r2(valor * unidades);
  const iva = Number(e.iva ?? 0) > 0 && baseAntes + flete > 0 ? r2(Number(e.iva) * (base + flete) / (baseAntes + flete)) : Number(e.iva ?? 0);
  return {
    ...e,
    subtotal: base,
    flete,
    iva,
    price: r2(base + flete),
    item: { ...(e.item ?? {}), cprice: r2(valor) },
    // Con la tarifa corregida deja de ser un precio especial: sigue a la tarifa.
    negociado,
  };
}

/** Guarda el carrito y vuelve a sumar los importes de la solicitud. Sin IVA por partida (las viejas), el impuesto se queda. */
async function guardarCarrito(q: Solicitud, carrito: Record<string, EntradaCarrito>) {
  const entradas = Object.values(carrito);
  const subtotal = entradas.reduce((s, e) => s + baseDe(e), 0);
  const flete = entradas.reduce((s, e) => s + fleteDe(e), 0);
  const tax = entradas.every((e) => e.iva !== undefined) ? r2(entradas.reduce((s, e) => s + Number(e.iva ?? 0), 0)) : Number(q.tax ?? 0);
  await prisma.quotes.update({
    where: { id: q.id },
    data: {
      cart_data: JSON.stringify(carrito),
      subtotal: new Prisma.Decimal(r2(subtotal)),
      freight_cost: new Prisma.Decimal(r2(flete)),
      tax: new Prisma.Decimal(tax),
      total: new Prisma.Decimal(r2(subtotal + flete + tax)),
      updated_at: new Date(),
    },
  });
}

function filasDelFormulario(q: Solicitud): FilaInterna[] {
  const filas: FilaInterna[] = [];
  Object.values(leerCarrito(q.cart_data)).forEach((e, i) => {
    const pu = Number(e.item?.cprice ?? 0);
    const base = r2(baseDe(e));
    const unidades = r2(unidadesDe(e));
    const unidad = String(e.unit ?? 'pieza');
    // Del tabulador el precio es por hora (antes del 2026-10-29, por día), por viaje o por tonelada, aunque la ficha se rente por semana.
    const porUnidad = e.fuente === 'tabulador' && e.renglon
      ? e.renglon.clase === 'equipo' ? (e.porHora ? 'hora' : 'día') : e.renglon.clase === 'material' ? 'tonelada' : 'viaje'
      : unidad;
    filas.push({
      concepto: e.item?.name ?? 'Equipo',
      clase: 'ficha',
      cantidad: unidades,
      unidad: porUnidad.toUpperCase(),
      pu,
      importe: base,
      fuente: e.negociado
        ? 'Precio especial solo de esta cotización'
        : e.fuente === 'tabulador' ? 'Tarifa del cotizador (la de la ficha del tipo)' : pu > 0 ? 'Precio de la ficha' : 'La ficha no tiene precio: ponle uno',
      negociado: e.negociado === true,
      // Sin precio la tarifa es 0 y se puede corregir: es justo cuando hace falta ponérselo a la ficha.
      edicion: { unidad: `por ${porUnidad}`, valor: pu, tarifa: pu },
      partida: i,
      ref: null,
    });
    const flete = r2(fleteDe(e));
    if (flete > 0) {
      const qty = Math.max(1, Number(e.qty ?? 1));
      filas.push({
        concepto: `Traslado · ${e.item?.name ?? 'equipo'}`,
        clase: 'flete',
        cantidad: qty,
        unidad: 'SERV',
        pu: r2(flete / qty),
        importe: flete,
        fuente: e.fuente === 'tabulador' ? 'Flete del cotizador' : 'Flete de la ficha',
        negociado: false,
        edicion: null,
        partida: null,
        ref: null,
      });
    }
  });
  return filas;
}
