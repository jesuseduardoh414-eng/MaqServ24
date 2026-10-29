import { Controller, Get, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard, Modulo } from './admin-auth';
import { operadorDe } from '../providers/operador';
import { kmCarretera } from '@maqserv/config';
import { desvioMaximoKm, equiposDeServicios, kmFueraDelTramo, kmRestantes, obraDe } from '../quotes/rastreo';
import { rutaConTiempo, type Ruta } from '../common/rutas';

/**
 * Cuánto espera el mapa a las rutas por calles en cada vuelta. Lo que no
 * alcanza sale en línea recta y queda pidiéndose: a la siguiente vuelta (30 s)
 * ya está guardado. Así la pantalla nunca se queda esperando al servidor de rutas.
 */
const ESPERA_RUTAS_MS = 2_500;
/** La ruta de la base a la obra no cambia: un día. La de la unidad, de donde va: 10 minutos. */
const VIGENCIA_FIJA = 86_400_000;
const VIGENCIA_EN_CAMINO = 10 * 60_000;

/** Cuántos puntos del recorrido se mandan al mapa: la forma del camino, no cada punto. */
const PUNTOS_RECORRIDO = 60;

/** Con aliado y todavía sin terminar, sin contar el que va en camino (ese lleva rastreo). */
const ACTIVOS = ['asignado', 'en_sitio', 'en_curso'] as const;

/** Lo que hace falta de la solicitud para pintarla: la obra, el cliente, el aliado y el equipo. */
const CAMPOS = {
  id: true, quote_number: true, name: true, company_name: true, product_interested: true,
  address: true, region: true, requirements: true, service_state: true,
  client_sites: { select: { name: true, address: true, municipality: true, state: true, lat: true, lng: true, clients: { select: { name: true } } } },
  service_assignments: { where: { state: 'aceptado' }, select: { committed_at: true, providers: { select: { id: true, name: true, phone: true, lat: true, lng: true, address: true, city: true } } } },
} as const;

/**
 * MAPA DE SERVICIOS (2026-10-14; todos los servicios desde el 2026-10-26).
 *
 * Antes solo "en camino": los servicios en traslado con la última ubicación
 * que mandó el teléfono del aliado, la obra a la que van y cuántos km les
 * faltan. Decisión del dueño: el mapa de Servicios en curso enseña TODO lo que
 * se está trabajando ("una máquina en Apodaca con un servicio en una obra de
 * Monterrey"): asignados, en camino, en obra; y como capas, lo que espera
 * aliado y la red de aliados con hasta dónde llega. Ver quotes/rastreo.ts.
 */
@Modulo('servicios')
@Controller('admin/rastreo')
@UseGuards(AdminGuard)
export class AdminRastreoController {
  @Get()
  async unidades() {
    const [qs, activos, porAsignar, aliados] = await Promise.all([
      prisma.quotes.findMany({
        where: { service_state: 'en_traslado' },
        orderBy: { updated_at: 'desc' },
        select: { ...CAMPOS, service_events: { where: { to_state: 'en_traslado' }, orderBy: { id: 'desc' }, take: 1, select: { created_at: true } } },
      }),
      prisma.quotes.findMany({ where: { service_state: { in: [...ACTIVOS] } }, orderBy: { updated_at: 'desc' }, select: CAMPOS }),
      prisma.quotes.findMany({ where: { service_state: 'por_asignar' }, orderBy: { accepted_at: 'asc' }, select: CAMPOS }),
      prisma.providers.findMany({
        where: { status: 1, lat: { not: null }, lng: { not: null } },
        select: { id: true, name: true, lat: true, lng: true, coverage_radius_km: true, city: true },
      }),
    ]);
    const ids = qs.map((q) => q.id);
    const puntos = ids.length
      ? await prisma.service_locations.findMany({ where: { quote_id: { in: ids } }, orderBy: { id: 'desc' }, select: { quote_id: true, lat: true, lng: true, accuracy_m: true, created_at: true } })
      : [];
    const porServicio = new Map<string, typeof puntos>();
    for (const p of puntos) {
      const k = String(p.quote_id);
      const l = porServicio.get(k) ?? [];
      if (l.length < PUNTOS_RECORRIDO) l.push(p);
      porServicio.set(k, l);
    }

    // Qué equipo lleva: el nombre sale de la cotización guardada (los renglones ya resueltos).
    const todos = [...qs, ...activos, ...porAsignar];
    const equipoDeReqs = await equiposDeServicios(todos.map((q) => q.requirements));
    const equipo = (q: (typeof todos)[number]) => equipoDeReqs(q.requirements);
    const operador = (q: (typeof todos)[number]) => { const o = operadorDe(q.requirements); return o ? { nombre: o.nombre, telefono: o.telefono } : null; };
    const linea = (r: Ruta | null) => (r ? { linea: r.linea, km: r.km, min: r.min } : null);
    const cliente = (q: (typeof todos)[number]) => q.client_sites?.clients?.name ?? q.company_name ?? q.name;
    // De dónde sale la máquina: el patio del aliado, si está ubicado.
    const baseDe = (a: (typeof todos)[number]['service_assignments'][number] | undefined) =>
      a?.providers.lat != null && a?.providers.lng != null
        ? { lat: Number(a.providers.lat), lng: Number(a.providers.lng), nombre: a.providers.address ?? a.providers.city ?? 'Base del aliado' }
        : null;

    // Las rutas por calles, todas a la vez (cada una sale de lo guardado o espera su turno).
    const rutasEnCamino = await Promise.all(qs.map((q) => {
      const a = q.service_assignments[0];
      const u = (porServicio.get(String(q.id)) ?? [])[0];
      const desde = u ? { lat: Number(u.lat), lng: Number(u.lng) } : baseDe(a);
      const obra = obraDe(q);
      return desde && obra ? rutaConTiempo(desde, obra, ESPERA_RUTAS_MS, { vigenciaMs: VIGENCIA_EN_CAMINO, precision: 3 }) : Promise.resolve(null);
    }));
    const rutasActivos = await Promise.all(activos.map((q) => {
      const base = baseDe(q.service_assignments[0]);
      const obra = obraDe(q);
      return base && obra ? rutaConTiempo(base, obra, ESPERA_RUTAS_MS, { vigenciaMs: VIGENCIA_FIJA }) : Promise.resolve(null);
    }));

    return {
      unidades: qs.map((q, i) => {
        const a = q.service_assignments[0];
        const ps = porServicio.get(String(q.id)) ?? [];
        const u = ps[0];
        const ultima = u ? { lat: Number(u.lat), lng: Number(u.lng), precision: u.accuracy_m, at: u.created_at.toISOString() } : null;
        const obra = obraDe(q);
        // De dónde salió: el patio del aliado; si no está ubicado, el primer punto que mandó.
        const base = baseDe(a);
        const primero = ps[ps.length - 1];
        const salida = base ?? (primero ? { lat: Number(primero.lat), lng: Number(primero.lng), nombre: 'Donde empezó a compartir' } : null);
        // Qué tan largo es el viaje y qué tan lejos anda del camino directo.
        const kmTramo = salida && obra ? Math.round(kmCarretera(salida, obra)) : null;
        const desvio = ultima && salida && obra ? kmFueraDelTramo(ultima, salida, obra) : null;
        return {
          quoteId: Number(q.id),
          folio: q.quote_number,
          cliente: cliente(q),
          servicio: q.product_interested?.split(' · ')[0] || null,
          equipo: equipo(q),
          aliado: a ? { id: a.providers.id, nombre: a.providers.name, telefono: a.providers.phone } : null,
          // Quien maneja y comparte la ubicación (2026-10-15).
          operador: operador(q),
          salio: q.service_events[0]?.created_at.toISOString() ?? null,
          comprometida: a?.committed_at?.toISOString() ?? null,
          salida,
          obra,
          ultima,
          // Del más viejo al más nuevo: así se dibuja el camino.
          recorrido: [...ps].reverse().map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
          km: kmRestantes(ultima, obra),
          kmTramo,
          desvioKm: desvio != null ? Math.round(desvio * 10) / 10 : null,
          fueraDeRuta: desvio != null && kmTramo != null && desvio > desvioMaximoKm(kmTramo),
          /** Lo que le falta, por calles, con sus km y minutos reales (null: línea recta). */
          rutaFalta: linea(rutasEnCamino[i]),
        };
      }),
      /** Asignados (aún no salen), en obra y trabajando: de la base del aliado a la obra. */
      activos: activos.map((q, i) => {
        const a = q.service_assignments[0];
        return {
          quoteId: Number(q.id),
          folio: q.quote_number,
          etapa: q.service_state as (typeof ACTIVOS)[number],
          cliente: cliente(q),
          equipo: equipo(q) ?? q.product_interested?.split(' · ')[0] ?? null,
          aliado: a ? { id: a.providers.id, nombre: a.providers.name, telefono: a.providers.phone } : null,
          operador: operador(q),
          comprometida: a?.committed_at?.toISOString() ?? null,
          base: baseDe(a),
          obra: obraDe(q),
          /** De la base a la obra, por calles (null: línea recta). */
          ruta: linea(rutasActivos[i]),
        };
      }),
      /** Aceptados que esperan aliado: solo la obra. */
      porAsignar: porAsignar.map((q) => ({
        quoteId: Number(q.id),
        folio: q.quote_number,
        cliente: cliente(q),
        equipo: equipo(q) ?? q.product_interested?.split(' · ')[0] ?? null,
        obra: obraDe(q),
      })),
      /** La red: la base de cada aliado ubicado y hasta dónde llega. */
      aliados: aliados.map((p) => ({
        id: p.id,
        nombre: p.name,
        lat: Number(p.lat),
        lng: Number(p.lng),
        radioKm: p.coverage_radius_km,
        ciudad: p.city,
      })),
    };
  }
}
