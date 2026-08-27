import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard } from './admin-auth';
import { DIAS_FRESCURA } from '../catalog/availability';
import {
  dias, horas, indicador, mediana, noMedible, periodoAnterior, porcentaje,
  type Indicador,
} from './analytics';

/**
 * TABLERO DE INDICADORES (documento institucional, sección 25).
 *
 * Los doce que nombra el documento, calculados sobre lo que la plataforma ya
 * venía guardando. Tres no son calculables todavía y se dicen como tales, con
 * su motivo: rellenarlos con una aproximación silenciosa sería peor que
 * dejarlos en blanco, porque nadie volvería a preguntarse por ellos.
 */
@Controller('admin/analytics')
@UseGuards(AdminGuard)
export class AdminAnalyticsController {
  @Get()
  async tablero(
    @Query('dias') diasParam?: string,
    @Query('categoria') categoria?: string,
    @Query('zona') zona?: string,
  ) {
    const largo = Math.min(365, Math.max(7, Number(diasParam ?? 90) || 90));
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - largo * 86400000);
    const previo = periodoAnterior(desde, hasta);

    // El filtro de zona mira la obra primero y la dirección después: la obra la
    // revisó alguien, la dirección la escribió el cliente a las once de la noche.
    const filtroZona = zona?.trim()
      ? {
          OR: [
            { client_sites: { municipality: { contains: zona.trim(), mode: 'insensitive' as const } } },
            { address: { contains: zona.trim(), mode: 'insensitive' as const } },
            { region: { contains: zona.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};
    const filtroCat = categoria?.trim() ? { service_category: categoria.trim() } : {};

    const enPeriodo = (d: Date, h: Date) => ({
      created_at: { gte: d, lte: h },
      ...filtroCat,
      ...filtroZona,
    });

    const campos = {
      id: true, quote_number: true, created_at: true, responded_at: true,
      accepted_at: true, service_state: true, client_id: true, total: true,
      service_category: true,
    } as const;

    const [solicitudes, previas, equipos, aliados] = await Promise.all([
      prisma.quotes.findMany({ where: enPeriodo(desde, hasta), select: campos }),
      prisma.quotes.findMany({ where: enPeriodo(previo.desde, previo.hasta), select: campos }),
      prisma.products.findMany({
        where: { status: 1 },
        select: { id: true, availability_confirmed_at: true, provider_id: true },
      }),
      prisma.providers.count({ where: { status: 1 } }),
    ]);

    const ids = solicitudes.map((q) => q.id);
    const incidencias = ids.length
      ? await prisma.service_incidents.findMany({
          where: { quote_id: { in: ids } },
          select: { quote_id: true, state: true, severity: true },
        })
      : [];
    const asignaciones = ids.length
      ? await prisma.service_assignments.findMany({
          where: { quote_id: { in: ids } },
          select: { quote_id: true, provider_id: true, state: true },
        })
      : [];
    const conAliado = new Set(asignaciones.map((a) => String(a.quote_id)));

    // ── Cálculos ────────────────────────────────────────────────────────
    const total = solicitudes.length;
    const respondidas = solicitudes.filter((q) => q.responded_at !== null);
    const aceptadas = solicitudes.filter((q) => q.accepted_at !== null);
    const cerrados = solicitudes.filter((q) => q.service_state === 'cerrado').length;
    const cancelados = solicitudes.filter((q) => q.service_state === 'cancelado').length;
    const terminados = cerrados + cancelados;

    const tiemposCotizacion = respondidas
      .filter((q) => q.created_at)
      .map((q) => horas(q.created_at!, q.responded_at!));

    const conCategoria = solicitudes.filter((q) => q.service_category);
    const cubiertas = conCategoria.filter((q) => conAliado.has(String(q.id))).length;

    const frescos = equipos.filter(
      (e) =>
        e.availability_confirmed_at &&
        dias(e.availability_confirmed_at, hasta) <= DIAS_FRESCURA,
    ).length;

    const antiguedades = equipos
      .filter((e) => e.availability_confirmed_at)
      .map((e) => dias(e.availability_confirmed_at!, hasta));

    // Clientes que pidieron más de una vez EN LA VIDA, no sólo en el periodo:
    // la repetición es una señal de relación, y una ventana de tres meses
    // dejaría fuera a quien vuelve cada semestre.
    const porCliente = await prisma.quotes.groupBy({
      by: ['client_id'],
      where: { client_id: { not: null } },
      _count: { _all: true },
    });
    const clientesTotales = porCliente.length;
    const clientesRepiten = porCliente.filter((c) => c._count._all > 1).length;

    const anterior = {
      solicitudes: previas.length,
      conversion: porcentaje(previas.filter((q) => q.accepted_at).length, previas.length),
      cotizacion: mediana(
        previas.filter((q) => q.responded_at && q.created_at).map((q) => horas(q.created_at!, q.responded_at!)),
      ),
    };

    const lista: Indicador[] = [
      indicador({
        clave: 'solicitudes',
        label: 'Solicitudes recibidas',
        revela: 'Tamaño y ritmo de la demanda.',
        valor: total,
        formato: 'conteo',
        muestra: total,
        anterior: anterior.solicitudes,
        exigeMuestra: false,
      }),
      indicador({
        clave: 'cobertura',
        label: 'Tasa de cobertura',
        revela: 'Qué porcentaje de solicitudes encuentra oferta compatible.',
        valor: porcentaje(cubiertas, conCategoria.length),
        formato: 'porcentaje',
        muestra: conCategoria.length,
        subirEsBueno: true,
        nota: 'Se cuenta como cubierta la solicitud a la que se le pudo ofrecer al menos un aliado.',
      }),
      noMedible({
        clave: 'primera-respuesta',
        label: 'Tiempo a primera respuesta',
        revela: 'Velocidad real del sistema.',
        formato: 'horas',
        // No es lo mismo que el tiempo a cotización, y fingir que sí sería
        // enseñar el mismo número con dos nombres.
        motivo:
          'No se registra cuándo se contacta al cliente por primera vez, sólo cuándo se le pone precio. Hará falta anotar el primer contacto —una llamada, un correo— para separarlo del tiempo a cotización.',
      }),
      indicador({
        clave: 'cotizacion',
        label: 'Tiempo a cotización',
        revela: 'Eficiencia comercial y operativa.',
        valor: mediana(tiemposCotizacion),
        formato: 'horas',
        muestra: respondidas.length,
        anterior: anterior.cotizacion,
        subirEsBueno: false,
        nota: 'Mediana, no promedio: una cotización que tardó semanas no debe hacer parecer lenta a toda la operación.',
      }),
      indicador({
        clave: 'conversion',
        label: 'Conversión cotización → servicio',
        revela: 'Calidad de oferta y competitividad.',
        valor: porcentaje(aceptadas.length, total),
        formato: 'porcentaje',
        muestra: total,
        anterior: anterior.conversion,
        subirEsBueno: true,
      }),
      indicador({
        clave: 'disponibilidad',
        label: 'Disponibilidad confirmada',
        revela: 'Confiabilidad del inventario.',
        valor: porcentaje(frescos, equipos.length),
        formato: 'porcentaje',
        muestra: equipos.length,
        subirEsBueno: true,
        nota: `Equipos confirmados en los últimos ${DIAS_FRESCURA} días. Pasado ese plazo el dato deja de ser confiable y el equipo aparece como "por confirmar".`,
      }),
      noMedible({
        clave: 'utilizacion',
        label: 'Utilización por proveedor/equipo',
        revela: 'Aprovechamiento de capacidad.',
        formato: 'porcentaje',
        motivo:
          'El inventario lleva cantidades ("3 compactadores"), no unidades identificables. Sin saber cuál unidad estuvo en cuál obra no se puede decir qué porcentaje del tiempo trabajó.',
      }),
      indicador({
        clave: 'cancelaciones',
        label: 'Cancelaciones e incidencias',
        revela: 'Calidad operacional.',
        // Un servicio con tres incidencias es UN servicio con problemas, no
        // tres: se cuentan servicios afectados y no incidencias sueltas, si no
        // una obra mala inflaria el indicador ella sola.
        valor: porcentaje(
          new Set([
            ...solicitudes.filter((q) => q.service_state === 'cancelado').map((q) => String(q.id)),
            ...incidencias.map((i) => String(i.quote_id)),
          ]).size,
          terminados,
        ),
        formato: 'porcentaje',
        muestra: terminados,
        subirEsBueno: false,
        nota: `Servicios terminados que se cancelaron o tuvieron alguna incidencia. En el periodo: ${cancelados} cancelado(s) y ${new Set(incidencias.map((i) => String(i.quote_id))).size} servicio(s) con incidencia.`,
      }),
      indicador({
        clave: 'repeticion',
        label: 'Repetición de clientes',
        revela: 'Valor y satisfacción sostenida.',
        valor: porcentaje(clientesRepiten, clientesTotales),
        formato: 'porcentaje',
        muestra: clientesTotales,
        subirEsBueno: true,
        nota: 'Clientes con más de una solicitud, en toda su historia y no sólo en este periodo: quien vuelve cada semestre también cuenta.',
      }),
      noMedible({
        clave: 'margen',
        label: 'Margen / contribución',
        revela: 'Sostenibilidad económica.',
        formato: 'dinero',
        bloqueado: true,
        motivo:
          'Falta definir cómo gana dinero la plataforma. El documento (sección 26) deja los porcentajes fuera a propósito: se definen por categoría y etapa. Hasta que exista esa definición, sólo se conoce el precio al cliente y no la contribución.',
      }),
      indicador({
        clave: 'no-cubierta',
        label: 'Demanda no cubierta',
        revela: 'Dónde ampliar red o categorías.',
        valor: conCategoria.length - cubiertas,
        formato: 'conteo',
        muestra: conCategoria.length,
        subirEsBueno: false,
        exigeMuestra: false,
        nota: 'Solicitudes a las que no se les pudo ofrecer ningún aliado. Es el dato que debe dirigir el reclutamiento.',
      }),
      indicador({
        clave: 'actualizacion',
        label: 'Actualización de proveedores',
        revela: 'Salud de la información de oferta.',
        valor: mediana(antiguedades),
        formato: 'dias',
        muestra: antiguedades.length,
        subirEsBueno: false,
        nota: `Días desde la última confirmación, en mediana. Más de ${DIAS_FRESCURA} significa que el catálogo está hablando de memoria.`,
      }),
    ];

    return {
      periodo: {
        dias: largo,
        desde: desde.toISOString().slice(0, 10),
        hasta: hasta.toISOString().slice(0, 10),
      },
      filtros: { categoria: categoria ?? null, zona: zona ?? null },
      // Contexto para leer los números: 12% de conversión con 3 aliados en la
      // red dice algo distinto que con 30.
      contexto: { aliadosActivos: aliados, equiposActivos: equipos.length, clientes: clientesTotales },
      indicadores: lista,
    };
  }

  /**
   * Los casos detrás de un indicador.
   *
   * "Cada indicador se puede abrir para ver los casos que lo componen": un
   * número que no se puede auditar se discute en una junta y no se resuelve.
   */
  @Get('casos')
  async casos(
    @Query('clave') clave: string,
    @Query('dias') diasParam?: string,
    @Query('categoria') categoria?: string,
  ) {
    const largo = Math.min(365, Math.max(7, Number(diasParam ?? 90) || 90));
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - largo * 86400000);
    const base = {
      created_at: { gte: desde, lte: hasta },
      ...(categoria?.trim() ? { service_category: categoria.trim() } : {}),
    };

    const where: Record<string, unknown> = { ...base };
    if (clave === 'conversion') where.accepted_at = { not: null };
    if (clave === 'cotizacion') where.responded_at = { not: null };
    if (clave === 'cancelaciones') where.service_state = 'cancelado';
    if (clave === 'no-cubierta') {
      where.service_category = categoria?.trim() ?? { not: null };
      where.service_assignments = { none: {} };
    }

    const rows = await prisma.quotes.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 60,
      select: {
        id: true, quote_number: true, company_name: true, name: true,
        service_category: true, total: true, created_at: true,
        responded_at: true, accepted_at: true, service_state: true, address: true,
      },
    });

    return rows.map((q) => ({
      id: Number(q.id),
      quoteNumber: q.quote_number,
      cliente: q.company_name || q.name,
      categoria: q.service_category,
      zona: q.address,
      total: Number(q.total),
      createdAt: q.created_at,
      respondedAt: q.responded_at,
      acceptedAt: q.accepted_at,
      serviceState: q.service_state,
      horasACotizar: q.created_at && q.responded_at ? horas(q.created_at, q.responded_at) : null,
    }));
  }
}
