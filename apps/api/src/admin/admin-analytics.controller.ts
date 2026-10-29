import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard, Modulo } from './admin-auth';
import { horas, mediana, periodoAnterior } from './analytics';
import { MatchingService } from '../quotes/matching.service';
import { diaLocal } from '../money/cuentas';

/**
 * ¿CÓMO VA EL NEGOCIO? (Indicadores, rediseño del 2026-10-27).
 *
 * Antes: los doce indicadores del documento institucional (sección 25) en
 * doce cuadros iguales. El dueño: "no entiendo nada". Tres ya no se podían
 * medir (dependían de la confirmación periódica de equipos, que se quitó el
 * 2026-10-26), "demanda no cubierta" contaba lo que solo esperaba revisión y
 * ningún número decía si estaba bien o mal.
 *
 * Ahora, en el orden en que se lee: el camino de una solicitud (llegaron →
 * se cotizaron → aceptaron → se terminaron), cuatro tarjetas con semáforo y su
 * meta, dónde nos falta red (solo lo que de verdad nadie pudo tomar), las
 * solicitudes por mes y los clientes que regresan. Cada número se puede abrir
 * para ver qué solicitudes lo forman (`casos`).
 */

/** Metas del semáforo: las de Claude hasta que Dirección diga otras (2026-10-27). */
const METAS = {
  cotizacion: { verde: 4, amarillo: 8, texto: 'Meta: menos de 4 h' }, // horas; menos es mejor
  aceptan: { verde: 30, amarillo: 20, texto: 'Meta: más de 30%' }, // %; más es mejor
  problemas: { verde: 10, amarillo: 20, texto: 'Meta: menos de 10%' }, // %; menos es mejor
};
/** Con menos casos que esto el número no dice nada: va en gris, sin semáforo. */
const MINIMO = 3;

const PERIODOS = ['mes', '90', '180', '365'] as const;
type Periodo = (typeof PERIODOS)[number];
type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';

/** Del periodo elegido: "este mes" va desde el día 1 (en Monterrey); los demás, los últimos N días. */
function rango(p: Periodo): { desde: Date; hasta: Date } {
  const hasta = new Date();
  if (p === 'mes') return { desde: new Date(`${diaLocal(hasta).slice(0, 7)}-01T06:00:00Z`), hasta };
  return { desde: new Date(hasta.getTime() - Number(p) * 86_400_000), hasta };
}
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : null);
function semaforo(valor: number | null, muestra: number, meta: { verde: number; amarillo: number }, menosEsMejor: boolean): Semaforo {
  if (valor === null || muestra < MINIMO) return 'gris';
  if (menosEsMejor) return valor <= meta.verde ? 'verde' : valor <= meta.amarillo ? 'amarillo' : 'rojo';
  return valor >= meta.verde ? 'verde' : valor >= meta.amarillo ? 'amarillo' : 'rojo';
}

/** En qué va una solicitud, en palabras (para la lista de casos). */
const ETAPA: Record<string, string> = {
  por_asignar: 'Buscando aliado', asignado: 'Aliado asignado', en_traslado: 'En camino', en_sitio: 'En la obra',
  en_curso: 'Trabajando', terminado: 'Terminado', cerrado: 'Cerrado', cancelado: 'Cancelado',
};
function enQueVa(q: { status: string | null; service_state: string | null; responded_at: Date | null; accepted_at: Date | null }): string {
  if (q.service_state) return ETAPA[q.service_state] ?? q.service_state;
  if (q.status === 'rejected') return 'Descartada';
  if (q.accepted_at) return 'Aceptada';
  if (q.responded_at) return 'Cotizada, esperando respuesta';
  return 'Por cotizar';
}

@Modulo('indicadores')
@Controller('admin/analytics')
@UseGuards(AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly matching: MatchingService) {}

  @Get()
  async tablero(@Query('periodo') periodoParam?: string) {
    const periodo: Periodo = (PERIODOS as readonly string[]).includes(periodoParam ?? '') ? (periodoParam as Periodo) : '90';
    const { desde, hasta } = rango(periodo);
    const previo = periodoAnterior(desde, hasta);

    const campos = { id: true, created_at: true, responded_at: true, accepted_at: true, service_state: true } as const;
    const [ahora, antes, margenAhora, margenAntes] = await Promise.all([
      prisma.quotes.findMany({ where: { created_at: { gte: desde, lte: hasta } }, select: campos }),
      prisma.quotes.findMany({ where: { created_at: { gte: previo.desde, lte: previo.hasta } }, select: campos }),
      this.margenEntre(desde, hasta),
      this.margenEntre(previo.desde, previo.hasta),
    ]);
    type Q = (typeof ahora)[number];

    // ── El camino de una solicitud ──
    const embudo = (qs: Q[]) => ({
      llegaron: qs.length,
      cotizadas: qs.filter((q) => q.responded_at).length,
      aceptadas: qs.filter((q) => q.accepted_at).length,
      terminadas: qs.filter((q) => q.service_state === 'cerrado').length,
    });
    const e = embudo(ahora);
    const eAntes = embudo(antes);

    // ── Las tarjetas ──
    const tiempos = (qs: Q[]) => qs.filter((q) => q.created_at && q.responded_at).map((q) => horas(q.created_at!, q.responded_at!));
    const cotizacion = mediana(tiempos(ahora));
    // Un servicio con tres incidencias es UN servicio con problemas.
    const problemasDe = async (qs: Q[]) => {
      const terminados = qs.filter((q) => q.service_state === 'cerrado' || q.service_state === 'cancelado');
      const cancelados = terminados.filter((q) => q.service_state === 'cancelado').map((q) => String(q.id));
      const conIncidencia = terminados.length
        ? (await prisma.service_incidents.findMany({ where: { quote_id: { in: terminados.map((q) => q.id) } }, select: { quote_id: true } })).map((i) => String(i.quote_id))
        : [];
      return { terminados: terminados.length, cancelados: cancelados.length, conIncidencia: new Set(conIncidencia).size, afectados: new Set([...cancelados, ...conIncidencia]).size };
    };
    const [prob, probAntes] = await Promise.all([problemasDe(ahora), problemasDe(antes)]);
    const aceptan = pct(e.aceptadas, e.cotizadas);
    const problemas = pct(prob.afectados, prob.terminados);

    const [faltaRed, porMes, clientes, contexto] = await Promise.all([
      this.faltaRed(desde, hasta),
      this.porMes(periodo === '365' ? 12 : 6),
      this.clientes(),
      this.contexto(),
    ]);

    return {
      periodo: { clave: periodo, desde: diaLocal(desde), hasta: diaLocal(hasta) },
      contexto,
      embudo: e,
      embudoAntes: eAntes,
      tarjetas: {
        cotizacion: { valor: cotizacion, muestra: tiempos(ahora).length, antes: mediana(tiempos(antes)), semaforo: semaforo(cotizacion, tiempos(ahora).length, METAS.cotizacion, true), meta: METAS.cotizacion.texto },
        aceptan: { valor: aceptan, muestra: e.cotizadas, antes: pct(eAntes.aceptadas, eAntes.cotizadas), semaforo: semaforo(aceptan, e.cotizadas, METAS.aceptan, false), meta: METAS.aceptan.texto },
        problemas: {
          valor: problemas, muestra: prob.terminados, antes: pct(probAntes.afectados, probAntes.terminados),
          semaforo: semaforo(problemas, prob.terminados, METAS.problemas, true), meta: METAS.problemas.texto,
          cancelados: prob.cancelados, conIncidencia: prob.conIncidencia,
        },
        margen: { valor: margenAhora.valor, servicios: margenAhora.servicios, antes: margenAntes.valor },
      },
      faltaRed,
      porMes,
      clientes,
    };
  }

  /** Margen de los servicios cerrados entre dos fechas: lo cotizado sin IVA menos la parte del aliado (money/). */
  private async margenEntre(d: Date, h: Date) {
    const cerrados = await prisma.quotes.findMany({ where: { service_state: 'cerrado', service_closed_at: { gte: d, lte: h } }, select: { id: true } });
    const cuentas = cerrados.length
      ? await prisma.service_money.findMany({ where: { quote_id: { in: cerrados.map((c) => c.id) } }, select: { subtotal: true, pago_aliado: true } })
      : [];
    return {
      servicios: cuentas.length,
      valor: cuentas.length ? Math.round(cuentas.reduce((a, c) => a + Number(c.subtotal) - Number(c.pago_aliado), 0)) : null,
    };
  }

  /**
   * DÓNDE NOS FALTA RED: solo lo que de verdad nadie pudo tomar. Antes contaba
   * toda solicitud sin aliado ofrecido, y casi todas solo esperaban revisión.
   * Ahora, de las solicitudes del periodo que siguen sin aliado (ni
   * descartadas, ni canceladas, ni cerradas), con la MISMA regla de "Buscar
   * aliado" (matching): nadie de la red llega a esa obra en esa línea; a todos
   * los que llegan ya se les ofreció y dijeron que no; o nadie tiene
   * registrado el equipo que se pidió. Agrupado por línea y municipio.
   */
  private async faltaRed(desde: Date, hasta: Date) {
    const sinAliado = await prisma.quotes.findMany({
      where: {
        created_at: { gte: desde, lte: hasta },
        service_category: { not: null },
        NOT: [{ status: 'rejected' }, { service_state: { in: ['cancelado', 'cerrado'] } }, { service_assignments: { some: { state: 'aceptado' } } }],
      },
      select: {
        id: true, quote_number: true, service_category: true, region: true,
        client_sites: { select: { municipality: true } },
        service_assignments: { select: { provider_id: true, state: true } },
      },
    });
    const cats = await prisma.categories.findMany({ select: { cat_slug: true, cat_name: true } });
    const nombre = new Map(cats.map((c) => [c.cat_slug, c.cat_name]));
    const grupos = new Map<string, { linea: string; lineaNombre: string; municipio: string; motivos: Set<string>; folios: Array<{ id: number; folio: string }> }>();
    for (const q of sinAliado) {
      let motivo: string | null = null;
      try {
        const r = await this.matching.paraCotizacion(Number(q.id));
        const cubren = r.coincidencias.filter((c) => c.cubre);
        const dijeronQueNo = new Set(q.service_assignments.filter((a) => a.state === 'rechazado' || a.state === 'retirado').map((a) => a.provider_id));
        const vivas = q.service_assignments.some((a) => a.state === 'propuesto');
        if (cubren.length === 0) motivo = 'Nadie de la red llega';
        else if (!vivas && cubren.every((c) => dijeronQueNo.has(c.proveedor.id))) motivo = 'Todos los que llegan dijeron que no';
        else if (r.tiposSinAliado.length) motivo = `Nadie tiene registrado: ${r.tiposSinAliado.join(', ')}`;
      } catch {
        continue; // sin datos para emparejar: no se puede afirmar que falte red
      }
      if (!motivo) continue;
      const municipio = q.client_sites?.municipality?.trim() || q.region?.trim() || 'Sin municipio';
      const clave = `${q.service_category}|${municipio}`;
      const g = grupos.get(clave) ?? { linea: q.service_category as string, lineaNombre: nombre.get(q.service_category as string) ?? (q.service_category as string), municipio, motivos: new Set<string>(), folios: [] };
      g.motivos.add(motivo);
      g.folios.push({ id: Number(q.id), folio: q.quote_number });
      grupos.set(clave, g);
    }
    return [...grupos.values()]
      .map((g) => ({ ...g, motivos: [...g.motivos], solicitudes: g.folios.length }))
      .sort((a, b) => b.solicitudes - a.solicitudes);
  }

  /** Solicitudes por mes, los últimos N meses (en Monterrey). */
  private async porMes(n: number) {
    const hoy = diaLocal();
    let [a, m] = hoy.slice(0, 7).split('-').map(Number);
    const meses: string[] = [];
    for (let i = 0; i < n; i++) {
      meses.unshift(`${a}-${String(m).padStart(2, '0')}`);
      m -= 1; if (m === 0) { m = 12; a -= 1; }
    }
    const qs = await prisma.quotes.findMany({ where: { created_at: { gte: new Date(`${meses[0]}-01T06:00:00Z`) } }, select: { created_at: true } });
    const cuenta = new Map(meses.map((x) => [x, 0]));
    for (const q of qs) {
      if (!q.created_at) continue;
      const mes = diaLocal(q.created_at).slice(0, 7);
      if (cuenta.has(mes)) cuenta.set(mes, (cuenta.get(mes) ?? 0) + 1);
    }
    return meses.map((mes) => ({ mes, solicitudes: cuenta.get(mes) ?? 0 }));
  }

  /** Clientes que han pedido más de una vez, en toda su historia: quien vuelve cada semestre también cuenta. */
  private async clientes() {
    const porCliente = await prisma.quotes.groupBy({ by: ['client_id'], where: { client_id: { not: null } }, _count: { _all: true } });
    return { total: porCliente.length, regresan: porCliente.filter((c) => c._count._all > 1).length };
  }

  /** Para leer los números: no es lo mismo 77% con 4 aliados que con 40. */
  private async contexto() {
    const [aliados, equipos, clientes] = await Promise.all([
      prisma.providers.count({ where: { status: 1 } }),
      prisma.products.count({ where: { status: 1, provider_id: { not: null } } }),
      prisma.clients.count({ where: { status: 1 } }),
    ]);
    return { aliadosActivos: aliados, equiposActivos: equipos, clientes };
  }

  /**
   * Las solicitudes detrás de un número: "cada número se puede tocar". Antes
   * se abría el JSON crudo en otra pestaña; ahora el panel lo enseña en una
   * ventana con cada solicitud y en qué va.
   */
  @Get('casos')
  async casos(@Query('clave') clave: string, @Query('periodo') periodoParam?: string) {
    const periodo: Periodo = (PERIODOS as readonly string[]).includes(periodoParam ?? '') ? (periodoParam as Periodo) : '90';
    const { desde, hasta } = rango(periodo);
    const where: Record<string, unknown> = { created_at: { gte: desde, lte: hasta } };
    if (clave === 'cotizadas' || clave === 'cotizacion' || clave === 'aceptan') where.responded_at = { not: null };
    if (clave === 'aceptadas') where.accepted_at = { not: null };
    if (clave === 'terminadas') where.service_state = 'cerrado';
    if (clave === 'problemas') {
      where.service_state = { in: ['cerrado', 'cancelado'] };
      where.OR = [{ service_state: 'cancelado' }, { service_incidents: { some: {} } }];
    }
    const rows = await prisma.quotes.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 80,
      select: {
        id: true, quote_number: true, company_name: true, name: true, service_category: true, created_at: true,
        responded_at: true, accepted_at: true, service_state: true, status: true, client_id: true,
      },
    });
    const [cats, clientes] = await Promise.all([
      prisma.categories.findMany({ select: { cat_slug: true, cat_name: true } }),
      prisma.clients.findMany({ where: { id: { in: rows.map((r) => r.client_id).filter((x): x is number => !!x) } }, select: { id: true, name: true } }),
    ]);
    const linea = new Map(cats.map((c) => [c.cat_slug, c.cat_name]));
    const cliente = new Map(clientes.map((c) => [c.id, c.name]));
    const filas = rows.map((q) => ({
      id: Number(q.id),
      folio: q.quote_number,
      cliente: (q.client_id ? cliente.get(q.client_id) : null) ?? q.company_name?.trim() ?? q.name,
      linea: q.service_category ? linea.get(q.service_category) ?? q.service_category : null,
      fecha: q.created_at ? diaLocal(q.created_at) : null,
      enQueVa: enQueVa(q),
      horasACotizar: q.created_at && q.responded_at ? horas(q.created_at, q.responded_at) : null,
    }));
    // Las más lentas arriba, que son las que se quieren revisar.
    if (clave === 'cotizacion') filas.sort((a, b) => (b.horasACotizar ?? 0) - (a.horasACotizar ?? 0));
    return filas;
  }
}
