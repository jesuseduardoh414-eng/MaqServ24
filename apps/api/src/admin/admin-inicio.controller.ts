import { Controller, Get, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard, Modulo } from './admin-auth';
import { estadoDocumentos } from '../catalog/provider-trust';
import { DIAS_FRESCURA } from '../catalog/availability';
import { ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { PASOS, esEstado } from '../quotes/service-flow';

const DIA = 24 * 60 * 60 * 1000;

/** En curso = ya hay aliado y todavía no termina. */
const EN_CURSO = ['asignado', 'en_traslado', 'en_sitio', 'en_curso'] as const;

/**
 * INICIO DEL PANEL (rediseño, 2026-10-08).
 *
 * Lo que necesita ver quien entra, en el orden del flujo del menú (Recibir,
 * Cotizar, Ejecutar, Cobrar y medir), en UNA sola consulta. Va aparte de
 * `admin/dashboard` a propósito: ese lo pide el menú cada vez que suena la
 * campana para pintar contadores y tiene que seguir siendo ligero; este se
 * pide una vez, al abrir el Inicio.
 *
 * Responde a cualquier rol (`inicio`): son conteos, no expedientes. La página
 * enseña a cada quien solo los bloques de sus módulos.
 */
@Modulo('inicio')
@Controller('admin/inicio')
@UseGuards(AdminGuard)
export class AdminInicioController {
  @Get()
  async resumen() {
    const ahora = new Date();
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);
    const en7 = new Date(hoy.getTime() + 8 * DIA);
    const hace24h = new Date(ahora.getTime() - DIA);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    // El mes anterior se compara a la MISMA altura del mes (día 8 contra día 8):
    // contra el mes completo, cualquier mes en curso se vería en caída.
    const mismaAlturaAnterior = new Date(inicioMesAnterior.getTime() + (ahora.getTime() - inicioMes.getTime()));

    const [
      sinResponder, esperandoCliente, mensajes, porEstado,
      propuestas, propuestasViejas, incidencias,
      proximos, recientes,
      solicitudesMes, solicitudesMesAnterior, aceptadasMes, cerradosMes, valorMes,
      aliados, fichas, fichasConfirmadas, ofertas, estadosDePapeles,
      resenas, preguntas, categorias,
    ] = await Promise.all([
      prisma.quotes.count({ where: { status: 'pending' } }),
      // Ya con precio y dentro de su vigencia: la pelota está del lado del cliente.
      // (El "solicitada" del cotizador no se cuenta: es el mismo pedido que ya
      // aparece por asignar, y contarlo dos veces confundía.)
      prisma.quotes.count({ where: { status: 'completed', accepted_at: null, OR: [{ valid_until: null }, { valid_until: { gte: hoy } }] } }),
      // Una sola bandeja (2026-10-14): lo de Contacto más las preguntas sin contestar.
      Promise.all([
        prisma.contact_messages.count({ where: { state: 'nuevo' } }),
        prisma.product_questions.count({ where: { answer: null, status: 1, source: { not: 'contacto' } } }),
      ]).then(([a, b]) => a + b),
      prisma.quotes.groupBy({ by: ['service_state'], where: { service_state: { not: null } }, _count: { _all: true } }),
      // Ofrecidos a un aliado que no ha contestado. Pasadas 24 h es un servicio
      // detenido: el cliente ya aceptó y nadie le ha dicho quién va.
      prisma.service_assignments.count({ where: { state: 'propuesto' } }),
      prisma.service_assignments.count({ where: { state: 'propuesto', offered_at: { lt: hace24h } } }),
      prisma.service_incidents.count({ where: { state: 'abierta' } }),
      prisma.service_assignments.findMany({
        // Un servicio cancelado ya no viene (2026-10-22).
        where: { state: 'aceptado', committed_at: { gte: hoy, lt: en7 }, quotes: { service_state: { not: 'cancelado' } } },
        orderBy: { committed_at: 'asc' },
        take: 8,
        include: {
          providers: { select: { name: true } },
          quotes: {
            select: {
              quote_number: true, company_name: true, name: true, service_category: true, service_state: true,
              client_sites: { select: { name: true, municipality: true } },
            },
          },
        },
      }),
      prisma.quotes.findMany({
        orderBy: { id: 'desc' },
        take: 6,
        select: {
          id: true, quote_number: true, company_name: true, name: true, service_category: true,
          status: true, service_state: true, created_at: true, total: true,
        },
      }),
      prisma.quotes.count({ where: { created_at: { gte: inicioMes } } }),
      prisma.quotes.count({ where: { created_at: { gte: inicioMesAnterior, lt: mismaAlturaAnterior } } }),
      // Lo cancelado no cuenta como aceptado (2026-10-22: inflaba el mes).
      prisma.quotes.count({ where: { accepted_at: { gte: inicioMes }, OR: [{ service_state: null }, { service_state: { not: 'cancelado' } }] } }),
      prisma.quotes.count({ where: { service_closed_at: { gte: inicioMes } } }),
      prisma.quotes.aggregate({ where: { accepted_at: { gte: inicioMes }, OR: [{ service_state: null }, { service_state: { not: 'cancelado' } }] }, _sum: { total: true } }),
      prisma.providers.count({ where: { status: 1 } }),
      // Solo las máquinas de aliados se confirman; la ficha del tipo no (2026-10-22).
      prisma.products.count({ where: { status: 1, provider_id: { not: null } } }),
      prisma.products.count({ where: { status: 1, provider_id: { not: null }, availability_confirmed_at: { gte: new Date(ahora.getTime() - DIAS_FRESCURA * DIA) } } }),
      prisma.products.count({ where: { status: ESTADO_POR_REVISAR } }),
      // Se cuentan ALIADOS, no papeles: tres vencidos del mismo son una llamada.
      // Con la misma regla que Proveedores (2026-10-22): un papel renovado deja
      // de contar el viejo, y sin constancia fiscal o póliza no hay sello.
      prisma.providers
        .findMany({ where: { status: 1 }, select: { provider_documents: { select: { id: true, kind: true, name: true, expires_at: true } } } })
        .then((ps) => ps.map((p) => estadoDocumentos(p.provider_documents, ahora))),
      // Más las de servicio por revisar (sin su tabla todavía, solo las del sitio).
      Promise.all([
        prisma.site_reviews.count({ where: { status: 0 } }),
        prisma.service_reviews.count({ where: { status: 0 } }).catch(() => 0),
      ]).then(([a, b]) => a + b),
      prisma.product_questions.count({ where: { answer: null, status: 1 } }),
      prisma.categories.findMany({ select: { cat_slug: true, cat_name: true } }),
    ]);

    const nombreCat = new Map(categorias.map((c) => [c.cat_slug, c.cat_name]));

    // Dinero que pide una acción hoy (2026-10-22, Fase A/C): cobros vencidos y
    // aliados a los que ya toca pagar. Con catch: sin las tablas (SQL aún no
    // corrido) el inicio sigue cargando.
    const hoyMty = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(ahora)}T00:00:00Z`);
    const [cobrosVencidos, pagosHoy] = await Promise.all([
      prisma.service_money.count({ where: { cobrado_at: null, vence: { lt: hoyMty } } }).catch(() => 0),
      prisma.service_money.findMany({ where: { pagado_at: null, pagar_el: { lte: hoyMty } }, select: { provider_id: true }, distinct: ['provider_id'] })
        .then((r) => r.length).catch(() => 0),
    ]);
    const estados: Record<string, number> = {};
    for (const r of porEstado) if (r.service_state) estados[r.service_state] = r._count._all;
    const enCurso = EN_CURSO.reduce((n, s) => n + (estados[s] ?? 0), 0);

    return {
      flujo: {
        recibir: { sinResponder, esperandoCliente, mensajes },
        asignar: { porAsignar: estados.por_asignar ?? 0, propuestas, propuestasViejas },
        ejecutar: {
          enCurso,
          enTraslado: estados.en_traslado ?? 0,
          enSitio: (estados.en_sitio ?? 0) + (estados.en_curso ?? 0),
          terminados: estados.terminado ?? 0,
          incidencias,
        },
        medir: {
          cerradosMes,
          valorMes: Number(valorMes._sum.total ?? 0),
          conversionMes: solicitudesMes > 0 ? Math.round((aceptadasMes / solicitudesMes) * 100) : null,
        },
      },
      mes: { solicitudes: solicitudesMes, solicitudesAnterior: solicitudesMesAnterior, aceptadas: aceptadasMes, cerrados: cerradosMes },
      red: {
        aliados, fichas, fichasConfirmadas, ofertas,
        papelesVencidos: estadosDePapeles.filter((e) => e === 'vencido').length,
        papelesPorVencer: estadosDePapeles.filter((e) => e === 'por-vencer').length,
        papelesFaltan: estadosDePapeles.filter((e) => e === 'incompleto').length,
        diasFrescura: DIAS_FRESCURA,
      },
      sitio: { resenas, preguntas },
      dinero: { cobrosVencidos, pagosHoy },
      proximos: proximos.map((a) => ({
        id: a.id,
        fecha: a.committed_at!.toISOString(),
        folio: a.quotes.quote_number,
        obra: a.quotes.client_sites?.name ?? null,
        municipio: a.quotes.client_sites?.municipality ?? null,
        cliente: a.quotes.company_name || a.quotes.name,
        categoria: nombreCat.get(a.quotes.service_category ?? '') ?? a.quotes.service_category,
        aliado: a.providers.name,
        estado: esEstado(a.quotes.service_state) ? PASOS[a.quotes.service_state].label : 'Asignado',
      })),
      recientes: recientes.map((q) => ({
        id: Number(q.id),
        folio: q.quote_number,
        cliente: q.company_name || q.name,
        categoria: nombreCat.get(q.service_category ?? '') ?? q.service_category,
        // Una solicitud sin servicio todavía está en manos de quien cotiza; con
        // servicio, manda su estado operativo.
        estado: esEstado(q.service_state)
          ? PASOS[q.service_state].label
          : q.status === 'pending' ? 'Sin responder' : q.status === 'rejected' ? 'Rechazada' : 'Cotizada',
        tono: q.service_state === 'cancelado' || q.status === 'rejected'
          ? 'mal'
          : q.service_state === 'cerrado' ? 'bien'
          : !q.service_state && q.status === 'pending' ? 'atiende'
          : 'neutro',
        fecha: q.created_at ? q.created_at.toISOString() : null,
        total: Number(q.total),
      })),
    };
  }
}
