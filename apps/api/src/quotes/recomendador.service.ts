import { Injectable } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import {
  atiendeEn, desajustes, fichaDe, horarioDe, importeMaquina, productSlug, renglonesDe, tarifasDe, textoHorario,
  esUnidadDeTiempo, UNIDADES, catalogoCotizadorSchema, checkoutSchema,
} from '@maqserv/config';
import { lista } from '../common/json-list';
import { imageUrl } from '../catalog/images';
import { disponibilidadDe } from '../catalog/availability';
import { FreightService } from '../freight/freight.service';
import { coberturaDe, distanciaKm } from './matching';

/**
 * RECOMENDADOR DE MÁQUINAS (decisión del cliente, 2026-09-25).
 *
 * El cliente dice qué necesita, dónde, cuándo y por cuánto tiempo; esto le
 * devuelve las máquinas reales del catálogo que SÍ le sirven, con precio y
 * flete, ordenadas por lo que más le conviene. Él elige una y la solicitud le
 * llega al dueño de esa máquina. Se acabó el "¿a quién se lo mando?".
 *
 * CUATRO REGLAS, EN ORDEN:
 *
 *  1. Sirve: es de la línea (y del tipo, si lo dijo) y alcanza lo que pide la
 *     obra (`desajustes`: 20 t pedidas, 15 t ofrecidas = no).
 *  2. Llega: el aliado cubre la zona de la obra (radio en km desde su patio,
 *     o su lista de municipios). Aquí SÍ se descarta, a diferencia del
 *     emparejamiento interno: al cliente no se le enseña lo que no le van a
 *     poder llevar.
 *  3. Puede: está libre esas fechas (bloqueos y reservas contra sus unidades)
 *     y atiende ese día a esa hora.
 *  4. Cuesta: tarifa por unidad × lo pedido (respetando el mínimo) + flete
 *     desde SU patio + IVA si aplica. Sin tarifa, se enseña como "precio por
 *     confirmar", al final de la lista.
 *
 * El cliente ve dónde está la máquina y a cuántos km, pero NO el nombre del
 * aliado: MAQSER24 es quien vende.
 */

export interface ObraEntrada {
  siteId?: number | null;
  direccion?: string | null;
  municipio?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface EntradaRecomendacion {
  linea: string;
  tipo?: string | null;
  requisitos?: Record<string, string> | null;
  obra: ObraEntrada;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM */
  hora?: string | null;
  unidad: string;
  unidades: number;
  equipos?: number;
  /** Máquina preferida (viene de su tarjeta): se evalúa aunque el tipo no coincida. */
  productoId?: number | null;
  /** Solo esta máquina (al solicitar). */
  soloProductoId?: number | null;
}

export interface MaquinaRecomendada {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  specs: Array<{ label: string; valor: string }>;
  ubicacion: string | null;
  km: number | null;
  horario: string | null;
  confirmada: boolean;
  preferida: boolean;
  renta: boolean;
  /** null = sin tarifa para esa unidad: "precio por confirmar". */
  precioUnitario: number | null;
  unidad: string;
  unidadesCobradas: number;
  equipos: number;
  subtotal: number | null;
  flete: number | null;
  fleteTexto: string;
  iva: number;
  total: number | null;
  notaMinimo: string | null;
  porque: string[];
  /** Interno: nunca se manda al cliente tal cual. */
  providerId: number;
  providerName: string;
}

export interface ResultadoRecomendacion {
  obra: { lat: number; lng: number } | null;
  zona: string | null;
  fecha: string;
  fin: string;
  unidad: string;
  unidades: number;
  maquinas: MaquinaRecomendada[];
  descartadas: { noSirven: number; noLlegan: number; ocupadas: number; fueraDeHorario: number };
  tipoNoEncontrado: boolean;
}

const FACTOR_CARRETERA = 1.32;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Días de calendario que ocupa lo pedido: 3 días = 3; 2 semanas = 14; 1 mes = 30; 4 viajes = 1. */
export function diasQueOcupa(unidad: string, unidades: number): number {
  const n = Math.max(1, Math.ceil(unidades));
  switch (unidad) {
    case 'dia': return n;
    case 'semana': return n * 7;
    case 'mes': return n * 30;
    default: return 1;
  }
}

const soloFecha = (d: Date) => d.toISOString().slice(0, 10);
export function fechaFin(fecha: string, unidad: string, unidades: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + diasQueOcupa(unidad, unidades) - 1);
  return soloFecha(d);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Injectable()
export class RecomendadorService {
  constructor(private readonly freight: FreightService) {}

  async recomendar(e: EntradaRecomendacion): Promise<ResultadoRecomendacion> {
    const unidad = e.unidad in UNIDADES ? e.unidad : 'dia';
    const unidades = Math.max(0.5, Number(e.unidades) || 1);
    const equipos = Math.max(1, Math.floor(e.equipos ?? 1));
    const fin = fechaFin(e.fecha, unidad, unidades);

    // ── Dónde es la obra ──
    const obra = await this.resolverObra(e.obra);
    const punto = obra.lat != null && obra.lng != null ? { lat: obra.lat, lon: obra.lng } : null;

    // ── Máquinas de la línea (o solo la pedida) ──
    const cat = await prisma.categories.findUnique({ where: { cat_slug: e.linea }, select: { id: true } });
    const where = e.soloProductoId
      ? { id: e.soloProductoId, status: 1, provider_id: { not: null } }
      : { status: 1, provider_id: { not: null }, ...(cat ? { category_id: cat.id } : {}) };
    const productos = await prisma.products.findMany({
      where,
      select: {
        id: true, name: true, Marca: true, photo: true, attributes: true, location: true, stock: true,
        availability_confirmed_at: true, provider_id: true, is_rental: true, rental_freight: true,
        tarifas: true, minimo: true, horario: true, description: true,
      },
    });
    if (productos.length === 0) return this.vacio(obra, e.fecha, fin, unidad, unidades, false);

    // ── Tipo: por renglón del tabulador (productos ligados) o por nombre ──
    let candidatos = productos;
    let tipoNoEncontrado = false;
    if (e.tipo && !e.soloProductoId) {
      const ligados = await this.productosDelRenglon(e.tipo);
      const palabra = norm(e.tipo).split(/[^a-z0-9]+/).find((w) => w.length >= 4) ?? '';
      const coincide = productos.filter(
        (p) => ligados.has(p.id) || (palabra && norm(p.name).includes(palabra)) || p.id === e.productoId,
      );
      if (coincide.length > 0) candidatos = coincide;
      else tipoNoEncontrado = true;
    }

    // ── Aliados, bloqueos y configuración de flete, todo de golpe ──
    const idsAliados = [...new Set(candidatos.map((p) => p.provider_id as number))];
    const inicio = new Date(`${e.fecha}T00:00:00Z`);
    const finD = new Date(`${fin}T00:00:00Z`);
    const [aliados, bloqueos, cfg] = await Promise.all([
      prisma.providers.findMany({
        where: { id: { in: idsAliados }, status: 1 },
        select: { id: true, name: true, city: true, coverage: true, lat: true, lng: true, coverage_radius_km: true, address: true },
      }),
      prisma.availability_blocks.findMany({
        where: {
          product_id: { in: candidatos.map((p) => p.id) },
          starts_on: { lte: finD },
          OR: [{ ends_on: null }, { ends_on: { gte: inicio } }],
        },
        select: { product_id: true, state: true, starts_on: true, ends_on: true },
      }),
      this.freight.config(),
    ]);
    const aliadoDe = new Map(aliados.map((a) => [a.id, a]));
    const bloqueosDe = new Map<number, typeof bloqueos>();
    for (const b of bloqueos) bloqueosDe.set(b.product_id, [...(bloqueosDe.get(b.product_id) ?? []), b]);
    const tax = await this.tasaIva();
    const hoy = new Date();

    const descartadas = { noSirven: 0, noLlegan: 0, ocupadas: 0, fueraDeHorario: 0 };
    const maquinas: MaquinaRecomendada[] = [];

    for (const p of candidatos) {
      const aliado = aliadoDe.get(p.provider_id as number);
      if (!aliado) continue;
      const porque: string[] = [];

      // 1. Sirve
      const faltas = desajustes(e.linea, p.attributes as Record<string, unknown> | null, e.requisitos ?? null);
      if (faltas.length > 0) { descartadas.noSirven += 1; continue; }

      // 2. Llega
      const cob = coberturaDe(
        { coverage: lista(aliado.coverage), lat: aliado.lat != null ? Number(aliado.lat) : null, lng: aliado.lng != null ? Number(aliado.lng) : null, coverageRadiusKm: aliado.coverage_radius_km },
        { categoria: e.linea, zona: obra.zona, punto },
      );
      if (!cob.cubre && !e.soloProductoId) { descartadas.noLlegan += 1; continue; }
      let km = cob.km;
      if (km === null && punto && aliado.lat != null && aliado.lng != null) {
        km = Math.round(distanciaKm({ lat: Number(aliado.lat), lon: Number(aliado.lng) }, punto) * FACTOR_CARRETERA * 10) / 10;
      }
      if (km !== null) porque.push(`A ${km} km de tu obra`);
      else if (cob.como === 'municipio') porque.push(`Cubre ${obra.zona}`);

      // 3. Puede: fechas y horario
      const suyos = bloqueosDe.get(p.id) ?? [];
      const bloqueado = suyos.some((b) => b.state !== 'reservado');
      if (bloqueado) { descartadas.ocupadas += 1; continue; }
      const reservas = suyos.filter((b) => b.state === 'reservado').length;
      const unidadesTotales = p.stock ?? 1;
      if (reservas + equipos > unidadesTotales) { descartadas.ocupadas += 1; continue; }
      const horario = p.horario ? horarioDe(p.horario) : null;
      if (horario && !atiendeEn(horario, e.fecha, e.hora)) { descartadas.fueraDeHorario += 1; continue; }
      const disp = disponibilidadDe({ stock: p.stock, location: p.location, confirmedAt: p.availability_confirmed_at, blocks: [] }, hoy);
      const confirmada = disp.state === 'disponible' || disp.state === 'limitada';
      porque.push(confirmada ? 'Libre en esas fechas' : 'Disponibilidad por confirmar');
      if (horario) porque.push(`Atiende ${textoHorario(horario)}`);

      // 4. Cuesta
      const tarifas = tarifasDe(p.tarifas);
      const imp = importeMaquina({ tarifas, unidad, unidades, equipos, minimo: p.minimo });
      const flete = this.flete({ km, cfg, esRenta: p.is_rental, tarifaKm: p.rental_freight ? Number(p.rental_freight) : null, equipos });
      const subtotal = imp?.subtotal ?? null;
      const base = subtotal !== null ? subtotal + (flete.costo ?? 0) : null;
      const iva = base !== null && tax > 0 ? r2(base * tax / 100) : 0;
      const total = base !== null ? r2(base + iva) : null;

      maquinas.push({
        id: p.id,
        slug: productSlug(p.name, p.id),
        name: p.name,
        brand: p.Marca?.trim() || null,
        image: imageUrl(p.photo),
        specs: fichaDe(e.linea, (p.attributes ?? null) as Record<string, unknown> | null),
        ubicacion: p.location?.trim() || aliado.city || null,
        km,
        horario: horario ? textoHorario(horario) : null,
        confirmada,
        preferida: p.id === e.productoId,
        renta: p.is_rental,
        precioUnitario: imp?.precioUnitario ?? null,
        unidad,
        unidadesCobradas: imp?.unidadesCobradas ?? unidades,
        equipos,
        subtotal,
        flete: flete.costo,
        fleteTexto: flete.texto,
        iva,
        total,
        notaMinimo: imp?.notaMinimo ?? null,
        porque,
        providerId: aliado.id,
        providerName: aliado.name,
      });
    }

    // Orden: la preferida primero; luego por total (sin precio al final); luego por km.
    maquinas.sort((a, b) => {
      if (a.preferida !== b.preferida) return a.preferida ? -1 : 1;
      if ((a.total === null) !== (b.total === null)) return a.total === null ? 1 : -1;
      if (a.total !== null && b.total !== null && a.total !== b.total) return a.total - b.total;
      return (a.km ?? 9999) - (b.km ?? 9999);
    });

    return {
      obra: punto ? { lat: punto.lat, lng: punto.lon } : null,
      zona: obra.zona,
      fecha: e.fecha,
      fin,
      unidad,
      unidades,
      maquinas,
      descartadas,
      tipoNoEncontrado,
    };
  }

  private vacio(obra: { lat: number | null; lng: number | null; zona: string | null }, fecha: string, fin: string, unidad: string, unidades: number, tipoNoEncontrado: boolean): ResultadoRecomendacion {
    return {
      obra: obra.lat != null && obra.lng != null ? { lat: obra.lat, lng: obra.lng } : null,
      zona: obra.zona, fecha, fin, unidad, unidades, maquinas: [],
      descartadas: { noSirven: 0, noLlegan: 0, ocupadas: 0, fueraDeHorario: 0 }, tipoNoEncontrado,
    };
  }

  /** La obra: su obra guardada (ya geocodificada), o la dirección que escribió. */
  private async resolverObra(o: ObraEntrada): Promise<{ lat: number | null; lng: number | null; zona: string | null; direccion: string | null }> {
    if (o.siteId) {
      const s = await prisma.client_sites.findUnique({ where: { id: o.siteId }, select: { lat: true, lng: true, municipality: true, address: true } });
      if (s) {
        let lat = s.lat != null ? Number(s.lat) : null;
        let lng = s.lng != null ? Number(s.lng) : null;
        if ((lat === null || lng === null) && (s.address || s.municipality)) {
          const g = await this.freight.geocode([s.address, s.municipality].filter(Boolean).join(', '));
          if (g) { lat = g.lat; lng = g.lon; }
        }
        return { lat, lng, zona: s.municipality ?? s.address ?? null, direccion: s.address };
      }
    }
    if (o.lat != null && o.lng != null) return { lat: o.lat, lng: o.lng, zona: o.municipio ?? o.direccion ?? null, direccion: o.direccion ?? null };
    const texto = [o.direccion, o.municipio].filter((x) => x && x.trim()).join(', ');
    const g = texto ? await this.freight.geocode(texto) : null;
    return { lat: g?.lat ?? null, lng: g?.lon ?? null, zona: o.municipio?.trim() || o.direccion?.trim() || null, direccion: o.direccion ?? null };
  }

  /** Productos ligados a un renglón del tabulador cuyo nombre coincide con el tipo. */
  private async productosDelRenglon(tipo: string): Promise<Set<number>> {
    const out = new Set<number>();
    const filas = await prisma.quoter_catalogs.findMany({ select: { data: true } }).catch(() => []);
    const t = norm(tipo);
    for (const f of filas) {
      const parsed = catalogoCotizadorSchema.safeParse(f.data);
      if (!parsed.success) continue;
      for (const r of renglonesDe(parsed.data)) {
        if (norm(r.nombre) === t) r.productos.forEach((id) => out.add(id));
      }
    }
    return out;
  }

  /**
   * Flete desde el patio del aliado. Mismas reglas que el traslado del checkout
   * (Panel → Traslado), pero el origen es el aliado, no la base de MAQSER24.
   */
  private flete(d: { km: number | null; cfg: Awaited<ReturnType<FreightService['config']>>; esRenta: boolean; tarifaKm: number | null; equipos: number }): { costo: number | null; texto: string } {
    const { cfg } = d;
    if (!cfg.enabled || (cfg.rentalOnly && !d.esRenta)) return { costo: 0, texto: 'Sin traslado' };
    if (cfg.mode === 'flat') return { costo: r2(Math.max(cfg.minCharge, cfg.base + cfg.flatAmount * (cfg.perUnit ? d.equipos : 1))), texto: cfg.label };
    if (cfg.mode === 'quote') return { costo: null, texto: cfg.quoteText };
    if (d.km === null) return { costo: null, texto: 'Traslado a cotizar' };
    if (cfg.maxKm > 0 && d.km > cfg.maxKm) return { costo: null, texto: `Fuera de ${cfg.maxKm} km: traslado a cotizar` };
    const cobrados = r2(Math.max(0, d.km - cfg.freeKm) * (cfg.roundTrip ? 2 : 1));
    const tarifa = d.tarifaKm ?? cfg.ratePerKm;
    const variable = cobrados * tarifa * (cfg.perUnit ? d.equipos : 1);
    return { costo: r2(Math.max(cfg.minCharge, cfg.base + variable)), texto: `${cfg.label} · ${d.km} km` };
  }

  /** IVA del checkout (Panel → Pagos): 0 si está apagado o ya incluido. */
  private async tasaIva(): Promise<number> {
    try {
      const row = await prisma.theme.findFirst({ where: { active: true }, select: { tokens: true } });
      const tokens = (row?.tokens ?? {}) as { checkout?: unknown };
      const t = checkoutSchema.parse(tokens.checkout ?? {}).tax;
      return t.enabled && !t.included ? Number(t.rate) || 0 : 0;
    } catch {
      return 0;
    }
  }
}

/** Texto de lo pedido: "3 días", "2 viajes", "15 toneladas". */
export function textoPedido(unidad: string, unidades: number): string {
  const u = UNIDADES[unidad];
  if (!u) return String(unidades);
  const n = unidades.toLocaleString('es-MX', { maximumFractionDigits: u.decimales });
  return `${n} ${unidades === 1 ? u.singular : u.plural}`;
}

export const esTiempo = esUnidadDeTiempo;
