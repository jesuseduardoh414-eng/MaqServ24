import { Controller, Get, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { LINEAS_SERVICIO, centroDeMunicipio, kmCarretera, normalizarNombre, RADIO_MINIMO_KM } from '@maqserv/config';
import { lista } from '../common/json-list';
import { AdminGuard, Modulo } from './admin-auth';

const DIAS = 90;
/** Claves donde el cliente escribe dónde es la obra (las mismas que el emparejamiento). */
const CLAVES_ZONA = ['obra_ubicacion', 'destino', 'origen'];
/** Monterrey: el centro de la operación. Un aliado más lejos que esto queda fuera del mapa (lo alejaría). */
const CENTRO = { lat: 25.6866, lng: -100.3161 };
const FUERA_KM = 400;
/** Ya hay aliado trabajándolo: la solicitud se cubrió. */
const CON_ALIADO = new Set(['asignado', 'en_traslado', 'en_sitio', 'en_curso', 'terminado', 'cerrado']);

const idMunicipio = (estado: string, nombre: string) => `${normalizarNombre(estado)}|${normalizarNombre(nombre)}`;
/** "Rentadora Cerro de la Silla, S.A. de C.V." → "Rentadora Cerro de la Silla", sin pasar de 24 letras. */
function corto(nombre: string): string {
  const limpio = nombre.replace(/,?\s*(s\.?\s*a\.?(\s*de\s*c\.?\s*v\.?)?|s\.?\s*de\s*r\.?\s*l\.?.*|s\.?\s*c\.?)\s*$/i, '').trim();
  if (limpio.length <= 24) return limpio;
  const palabras = limpio.split(/\s+/);
  let out = '';
  for (const p of palabras) { if ((out + ' ' + p).trim().length > 24) break; out = (out + ' ' + p).trim(); }
  return out || limpio.slice(0, 24);
}

/**
 * MAPA Y COBERTURA (2026-10-14) — los datos reales del diseño del 9 de octubre.
 *
 * Cruza dónde llega la red (base, radio y municipios de cada aliado activo)
 * contra dónde está la demanda (las solicitudes de los últimos 90 días, cada
 * una en su municipio). La pantalla calcula con esto los huecos y los
 * municipios que dependen de un solo aliado; aquí solo se juntan los datos y
 * se resuelve cada texto de ubicación a su municipio con la misma tabla de
 * cabeceras que el alta de aliados (@maqserv/config, cobertura.ts).
 *
 * "Llega" es la misma regla que el emparejamiento: el municipio está en su
 * lista, o su cabecera queda dentro de su radio por carretera. La pregunta 6.1
 * del documento para Dirección (¿lista, distancia o las dos?) sigue abierta;
 * mientras tanto el mapa dice lo mismo que el emparejamiento.
 */
@Modulo('proveedores')
@Controller('admin/cobertura')
@UseGuards(AdminGuard)
export class AdminCoberturaController {
  // Se ve dentro de Zonas y cobertura (2026-10-26): cualquiera del panel.
  @Modulo('inicio')
  @Get()
  async datos() {
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - DIAS * 24 * 60 * 60 * 1000);

    const [provs, quotes] = await Promise.all([
      prisma.providers.findMany({
        where: { status: 1 },
        select: { id: true, name: true, city: true, state: true, lat: true, lng: true, coverage_radius_km: true, coverage: true, categories: true },
      }),
      prisma.quotes.findMany({
        where: { created_at: { gte: desde } },
        orderBy: { created_at: 'desc' },
        select: {
          id: true, quote_number: true, created_at: true, name: true, company_name: true, product_interested: true,
          service_category: true, service_state: true, status: true, accepted_at: true, valid_until: true,
          requirements: true, address: true, region: true, site_id: true,
          client_sites: { select: { id: true, name: true, municipality: true, state: true, lat: true, lng: true, clients: { select: { name: true } } } },
          service_assignments: { select: { state: true, provider_id: true } },
        },
      }),
    ]);

    // Municipios: los que aparecen en la demanda, en las bases y en las listas de los aliados.
    const municipios = new Map<string, { id: string; nombre: string; estado: string; lat: number; lng: number }>();
    const registrar = (c: { nombre: string; estado: string; lat: number; lng: number } | null) => {
      if (!c) return null;
      const id = idMunicipio(c.estado, c.nombre);
      if (!municipios.has(id)) municipios.set(id, { id, nombre: c.nombre, estado: c.estado, lat: c.lat, lng: c.lng });
      return id;
    };

    const lineasValidas = new Set<string>(LINEAS_SERVICIO);
    const aliados: Array<{
      id: number; nombre: string; corto: string; municipio: string | null; lat: number | null; lng: number | null;
      lineas: string[]; municipios: string[]; municipiosTexto: string[]; radioKm: number | null;
      /** Su base está tan lejos que, con él, el mapa se alejaba y Monterrey se volvía un punto. */
      fuera: boolean;
    }> = [];
    const fueraDelMapa: Array<{ nombre: string; plaza: string }> = [];
    let sinUbicar = 0;
    for (const p of provs) {
      const lat = p.lat != null ? Number(p.lat) : null;
      const lng = p.lng != null ? Number(p.lng) : null;
      const base = lat != null && lng != null ? { lat, lng } : null;
      const texto = lista(p.coverage).map(String).filter(Boolean);
      const resueltos = texto.map((t) => registrar(centroDeMunicipio(t, p.state, base))).filter((x): x is string => !!x);
      const baseId = p.city ? registrar(centroDeMunicipio(p.city, p.state, base)) : null;
      const fuera = !!base && kmCarretera(base, CENTRO) > FUERA_KM * 1.32;
      if (fuera) {
        fueraDelMapa.push({ nombre: p.name, plaza: p.city ?? p.state ?? '' });
      }
      if (!base) sinUbicar++;
      aliados.push({
        id: p.id, nombre: p.name, corto: corto(p.name), municipio: baseId, lat, lng,
        lineas: lista(p.categories).map(String).filter((l) => lineasValidas.has(l)),
        municipios: [...new Set(resueltos)],
        // Lo que escribió y no está en la tabla de cabeceras: se compara como texto, igual que el emparejamiento.
        municipiosTexto: texto.map((t) => normalizarNombre(t.split(',')[0] ?? t)).filter((t) => t.length > 2),
        radioKm: base ? p.coverage_radius_km ?? RADIO_MINIMO_KM : null,
        fuera,
      });
    }

    const obras = new Map<string, { id: string; nombre: string; cliente: string; municipio: string; lat: number | null; lng: number | null }>();
    const solicitudes: Array<{
      folio: string; fecha: string; obra: string; linea: string; detalle: string;
      aliado: number | null; estado: 'cubierta' | 'pendiente' | 'perdida'; nota?: string;
    }> = [];
    let sinUbicacion = 0;
    let sinLinea = 0;
    for (const q of quotes) {
      const linea = q.service_category && lineasValidas.has(q.service_category) ? q.service_category : null;
      if (!linea) { sinLinea++; continue; }
      const s = q.client_sites;
      const reqs = (q.requirements ?? {}) as Record<string, unknown>;
      const zona = [s?.municipality ? `${s.municipality}${s.state ? `, ${s.state}` : ''}` : null, ...CLAVES_ZONA.map((k) => (typeof reqs[k] === 'string' ? (reqs[k] as string) : null)), q.address, q.region]
        .find((v) => v && v.trim()) ?? null;
      const punto = s?.lat != null && s?.lng != null ? { lat: Number(s.lat), lng: Number(s.lng) } : null;
      const muni = zona ? registrar(centroDeMunicipio(zona, null, punto)) : null;
      if (!muni) { sinUbicacion++; continue; }

      const obraId = s ? `o${s.id}` : `q${q.id}`;
      if (!obras.has(obraId)) {
        obras.set(obraId, {
          id: obraId,
          nombre: s?.name ?? (typeof reqs.obra === 'string' && reqs.obra.trim() ? reqs.obra : 'Obra sin registrar'),
          cliente: s?.clients?.name ?? q.company_name ?? q.name,
          municipio: muni,
          lat: punto?.lat ?? null,
          lng: punto?.lng ?? null,
        });
      }
      const aceptada = q.service_assignments.find((a) => a.state === 'aceptado');
      const cubierta = !!aceptada || CON_ALIADO.has(q.service_state ?? '');
      const vencida = !q.accepted_at && q.valid_until != null && q.valid_until < hoy && q.status === 'completed';
      const perdida = !cubierta && (q.service_state === 'cancelado' || vencida);
      solicitudes.push({
        folio: q.quote_number,
        fecha: (q.created_at ?? hoy).toISOString().slice(0, 10),
        obra: obraId,
        linea,
        // Solo la línea de lo que pidió: lo que sigue a " · " es interno ("cotizador de maquinaria · MQ-…").
        detalle: q.product_interested?.split(' · ')[0] || '',
        aliado: aceptada?.provider_id ?? null,
        estado: cubierta ? 'cubierta' : perdida ? 'perdida' : 'pendiente',
        ...(perdida ? { nota: q.service_state === 'cancelado' ? 'Se canceló.' : 'La cotización venció sin que el cliente la aceptara.' } : {}),
      });
    }

    return {
      hoy: hoy.toISOString().slice(0, 10),
      desde: desde.toISOString().slice(0, 10),
      municipios: [...municipios.values()],
      aliados,
      obras: [...obras.values()],
      solicitudes,
      fueraDelMapa,
      sinUbicar,
      sinUbicacion,
      sinLinea,
    };
  }
}
