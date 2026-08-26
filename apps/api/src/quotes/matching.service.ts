import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { estadoDocumentos, estaVerificado, mesesEnRed } from '../catalog/provider-trust';
import { disponibilidadDe } from '../catalog/availability';
import { historialDe, type AsignacionHistorica } from '../catalog/provider-history';
import { emparejar, motivoSinCobertura, type Coincidencia, type ProveedorCandidato } from './matching';

/**
 * ARMAR LOS CANDIDATOS DE UNA SOLICITUD.
 *
 * Esto vivía dentro del controlador de emparejamiento. Al aparecer el proveedor
 * alterno hicieron falta los mismos candidatos desde otro lado, y copiar
 * doscientas líneas habría garantizado que las dos versiones se separaran a la
 * primera regla nueva: el tablero recomendaría distinto que la pantalla de
 * cotizaciones sin que nadie supiera por qué.
 */

/** Claves donde el cliente escribe dónde es la obra, en orden de preferencia. */
const CLAVES_ZONA = ['obra_ubicacion', 'destino', 'origen'];

export interface ResultadoEmparejamiento {
  quoteNumber: string;
  categoria: string | null;
  zona: string | null;
  coincidencias: Coincidencia[];
  /** Por qué no hay nadie. Null si sí hay. */
  motivo: string | null;
  /** Datos de contacto, por id de aliado. */
  contacto: Map<number, { phone: string | null; contactName: string | null }>;
}

@Injectable()
export class MatchingService {
  async paraCotizacion(quoteId: number): Promise<ResultadoEmparejamiento> {
    const q = await prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!q) throw new NotFoundException('Cotización no encontrada');

    // La zona sale de las respuestas del formulario; si no las hay, de la
    // dirección de entrega, que es lo único que siempre se pide.
    const reqs = (q.requirements ?? {}) as Record<string, string>;
    const zona =
      CLAVES_ZONA.map((k) => reqs[k]).find((v) => v && v.trim()) ?? q.address ?? q.region ?? null;
    const categoria = q.service_category;

    const aliados = await prisma.providers.findMany({
      where: { status: 1 },
      include: { provider_documents: { select: { expires_at: true } } },
    });
    const enCategoria = categoria
      ? aliados.filter((a) => a.categories.includes(categoria))
      : aliados;

    const idsAliados = enCategoria.map((a) => a.id);
    const cat = categoria
      ? await prisma.categories.findUnique({ where: { cat_slug: categoria }, select: { id: true } })
      : null;

    // Equipos, historial y bloqueos: cada uno en UNA consulta para todos los
    // aliados, no una por aliado.
    const [equipos, historial] = await Promise.all([
      idsAliados.length
        ? prisma.products.findMany({
            where: { status: 1, provider_id: { in: idsAliados }, ...(cat ? { category_id: cat.id } : {}) },
            select: {
              id: true, name: true, stock: true, location: true,
              availability_confirmed_at: true, provider_id: true,
            },
          })
        : Promise.resolve([]),
      idsAliados.length
        ? prisma.service_assignments.findMany({
            where: { provider_id: { in: idsAliados } },
            select: {
              provider_id: true, state: true, offered_at: true, responded_at: true, reason: true,
              quotes: { select: { service_state: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const hoy = new Date();
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
    for (const b of bloques) {
      porEquipo.set(b.product_id, [...(porEquipo.get(b.product_id) ?? []), b]);
    }

    const porAliadoHist = new Map<number, AsignacionHistorica[]>();
    for (const a of historial) {
      porAliadoHist.set(a.provider_id, [
        ...(porAliadoHist.get(a.provider_id) ?? []),
        {
          state: a.state,
          offered_at: a.offered_at,
          responded_at: a.responded_at,
          reason: a.reason,
          serviceState: a.quotes.service_state,
        },
      ]);
    }

    const equiposPorAliado = new Map<number, ProveedorCandidato['equipos']>();
    for (const e of equipos) {
      if (e.provider_id === null) continue;
      const disp = disponibilidadDe(
        {
          stock: e.stock,
          location: e.location,
          confirmedAt: e.availability_confirmed_at,
          blocks: porEquipo.get(e.id) ?? [],
        },
        hoy,
      );
      equiposPorAliado.set(e.provider_id, [
        ...(equiposPorAliado.get(e.provider_id) ?? []),
        { id: e.id, name: e.name, state: disp.state, location: disp.location },
      ]);
    }

    const candidatos: ProveedorCandidato[] = enCategoria.map((a) => {
      const docs = estadoDocumentos(a.provider_documents);
      const hist = historialDe(porAliadoHist.get(a.id) ?? []);
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        level: a.level,
        verified: estaVerificado(a.level, docs),
        coverage: a.coverage,
        categories: a.categories,
        responseMinutes: a.response_minutes,
        // El medido le gana al declarado: uno es lo que prometió, el otro lo
        // que cumple.
        responseMinutesReal: hist.minutosRespuestaReal,
        canceladosPropios: hist.cancelados,
        monthsInNetwork: mesesEnRed(a.joined_at),
        equipos: equiposPorAliado.get(a.id) ?? [],
      };
    });

    const coincidencias = emparejar({ categoria, zona }, candidatos);

    return {
      quoteNumber: q.quote_number,
      categoria,
      zona,
      coincidencias,
      motivo:
        coincidencias.length === 0
          ? motivoSinCobertura({ categoria, zona }, aliados.length, enCategoria.length)
          : null,
      contacto: new Map(
        enCategoria.map((a) => [a.id, { phone: a.phone, contactName: a.contact_name }]),
      ),
    };
  }

  /** Forma en la que las pantallas consumen una coincidencia. */
  aJson(r: ResultadoEmparejamiento) {
    return r.coincidencias.map((c) => ({
      providerId: c.proveedor.id,
      name: c.proveedor.name,
      level: c.proveedor.level,
      verified: c.proveedor.verified,
      phone: r.contacto.get(c.proveedor.id)?.phone ?? null,
      contactName: r.contacto.get(c.proveedor.id)?.contactName ?? null,
      responseMinutes: c.proveedor.responseMinutes,
      responseMinutesReal: c.proveedor.responseMinutesReal ?? null,
      coverage: c.proveedor.coverage,
      score: c.puntaje,
      reasons: c.razones,
      warnings: c.advertencias,
      availableEquipment: c.equiposDisponibles,
      equipment: c.proveedor.equipos,
    }));
  }
}
