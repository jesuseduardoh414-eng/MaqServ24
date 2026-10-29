import { prisma } from '@maqserv/db';
import { centroDeMunicipio, kmCarretera } from '@maqserv/config';

/**
 * RASTREO DE LA UNIDAD EN CAMINO (2026-10-14).
 *
 * "¿Dónde va la unidad?" Hasta hoy el sistema sabía QUE iba en camino (el
 * aliado marca "Ya salió la unidad") pero no DÓNDE. Ahora, mientras el
 * servicio está en traslado, el teléfono del aliado manda su ubicación desde
 * el portal; Operaciones la ve en un mapa y el cliente, a cuántos km va.
 *
 * Solo en traslado: antes no hay nada que rastrear y después ya llegó. Fuera
 * de esa ventana no se guarda ni se enseña la ubicación de nadie.
 */

/** Cuántos puntos se guardan por servicio: suficientes para el recorrido de un viaje largo. */
export const MAX_PUNTOS = 200;
/** Más seguido que esto no aporta nada y llena la tabla. */
export const SEGUNDOS_ENTRE_PUNTOS = 20;
/** Claves donde el cliente escribe dónde es la obra (las mismas que el emparejamiento). */
const CLAVES_ZONA = ['obra_ubicacion', 'destino', 'origen'];

export interface PuntoObra { lat: number; lng: number; aproximada: boolean; nombre: string | null; direccion: string | null }

/** Dónde es la obra: sus coordenadas si se registraron; si no, el centro de su municipio (aproximada). */
export function obraDe(q: {
  address: string | null;
  region: string | null;
  requirements: unknown;
  client_sites?: { name: string; address: string | null; municipality: string | null; state: string | null; lat: unknown; lng: unknown } | null;
}): PuntoObra | null {
  const s = q.client_sites;
  const nombre = s?.name ?? null;
  const direccion = s?.address ?? q.address ?? null;
  if (s?.lat != null && s?.lng != null) return { lat: Number(s.lat), lng: Number(s.lng), aproximada: false, nombre, direccion };
  const reqs = (q.requirements ?? {}) as Record<string, unknown>;
  // Se prueba cada dato, y si no, cada pieza separada por comas (el municipio
  // suele ir al final: "Av. Miguel Alemán 1500, Apodaca"). Antes se tomaba el
  // primero que hubiera, y una obra guardada con "Nuevo León" de municipio se
  // quedaba sin mapa (2026-10-15).
  const candidatos = [s?.municipality ? `${s.municipality}${s.state ? `, ${s.state}` : ''}` : null, ...CLAVES_ZONA.map((k) => (typeof reqs[k] === 'string' ? (reqs[k] as string) : null)), q.address, q.region]
    .filter((v): v is string => !!v && !!v.trim());
  let c: ReturnType<typeof centroDeMunicipio> = null;
  for (const t of candidatos) {
    c = centroDeMunicipio(t) ?? t.split(',').map((p) => p.trim()).filter(Boolean).reverse().map((p) => centroDeMunicipio(p)).find((x) => x) ?? null;
    if (c) break;
  }
  return c ? { lat: c.lat, lng: c.lng, aproximada: true, nombre: nombre ?? c.nombre, direccion } : null;
}

export async function ultimaUbicacion(quoteId: bigint | number) {
  const u = await prisma.service_locations.findFirst({
    where: { quote_id: BigInt(quoteId) },
    orderBy: { id: 'desc' },
    select: { lat: true, lng: true, accuracy_m: true, created_at: true },
  });
  return u ? { lat: Number(u.lat), lng: Number(u.lng), precision: u.accuracy_m, at: u.created_at.toISOString() } : null;
}

/** Km por carretera que le faltan, o null si falta alguno de los dos puntos. */
export const kmRestantes = (u: { lat: number; lng: number } | null, o: PuntoObra | null) =>
  u && o ? Math.round(kmCarretera(u, o)) : null;

/**
 * Km en línea recta del punto al tramo salida→obra. Plano local: en un viaje
 * dentro de la zona el error es de metros y no vale una fórmula esférica.
 */
export function kmFueraDelTramo(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const kx = 111.32 * Math.cos((a.lat * Math.PI) / 180);
  const ky = 110.57;
  const [px, py] = [(p.lng - a.lng) * kx, (p.lat - a.lat) * ky];
  const [bx, by] = [(b.lng - a.lng) * kx, (b.lat - a.lat) * ky];
  const largo2 = bx * bx + by * by;
  const t = largo2 ? Math.max(0, Math.min(1, (px * bx + py * by) / largo2)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * Más lejos que esto del camino directo y está "fuera de ruta". Holgado a
 * propósito: la carretera no va en línea recta y un rodeo por la autopista es
 * normal; lo que se busca es la unidad que va para otro lado.
 */
export const desvioMaximoKm = (kmTramo: number) => Math.max(5, kmTramo * 0.35);

/**
 * Guarda un punto del recorrido (2026-10-15: lo usan el aliado y el operador).
 * Solo en traslado; un punto cada SEGUNDOS_ENTRE_PUNTOS y los últimos MAX_PUNTOS.
 * `detener` le dice al teléfono que deje de mandar.
 */
export async function guardarUbicacion(
  q: { id: bigint; service_state: string | null },
  providerId: number,
  p: { lat: number; lng: number; precision?: number },
): Promise<{ ok: boolean; detener?: boolean }> {
  if (q.service_state !== 'en_traslado') return { ok: false, detener: true };
  const ultimo = await prisma.service_locations.findFirst({ where: { quote_id: q.id }, orderBy: { id: 'desc' }, select: { created_at: true } });
  if (ultimo && Date.now() - ultimo.created_at.getTime() < SEGUNDOS_ENTRE_PUNTOS * 1000) return { ok: true };
  await prisma.service_locations.create({
    data: { quote_id: q.id, provider_id: providerId, lat: p.lat, lng: p.lng, accuracy_m: p.precision != null ? Math.round(p.precision) : null },
  });
  const viejos = await prisma.service_locations.findMany({ where: { quote_id: q.id }, orderBy: { id: 'desc' }, skip: MAX_PUNTOS, select: { id: true } });
  if (viejos.length) await prisma.service_locations.deleteMany({ where: { id: { in: viejos.map((v) => v.id) } } });
  return { ok: true };
}

/**
 * Qué equipo lleva cada servicio (2026-10-26): los renglones de equipo o
 * material de su cotización guardada ("Retroexcavadora c/ cucharón"). Lo usan
 * el Mapa de servicios y las tarjetas de Servicios en curso, para que digan lo
 * mismo. Devuelve una función: con los `requirements` de un servicio, su equipo.
 */
export async function equiposDeServicios(requirements: unknown[]): Promise<(r: unknown) => string | null> {
  const cotizacionDe = (r: unknown) => {
    const id = Number((r as Record<string, unknown> | null)?.quoterId);
    return Number.isInteger(id) && id > 0 ? id : null;
  };
  const ids = [...new Set(requirements.map(cotizacionDe).filter((x): x is number => x != null))];
  const cots = ids.length ? await prisma.quoter_quotes.findMany({ where: { id: { in: ids } }, select: { id: true, snapshot: true } }) : [];
  const nombres = new Map(cots.map((c) => {
    const renglones = ((c.snapshot as { calc?: { renglones?: Array<{ clase?: string; nombre?: string }> } } | null)?.calc?.renglones ?? []);
    const n = [...new Set(renglones.filter((x) => x.clase === 'equipo' || x.clase === 'material').map((x) => x.nombre).filter(Boolean))];
    return [c.id, n.join(', ') || null] as const;
  }));
  return (r) => {
    const id = cotizacionDe(r);
    return id != null ? nombres.get(id) ?? null : null;
  };
}
