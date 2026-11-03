import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import {
  CAMIONES_DE_FABRICA,
  LINEA_TRITURADOS,
  camionesDe,
  type CatalogoCotizador,
  type EquipoCotizador,
  type ProductoTriturado,
  type ServicioCotizador,
} from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * LISTAS DE PRECIOS DEL 3 DE NOVIEMBRE DE 2026 (las mandó el dueño).
 *
 * Maquinaria: precio por hora nuevo y el flete ida y vuelta vuelve a cobrarse
 * con sus montos por tipo de equipo. Agua: un solo precio en el área
 * metropolitana (las dos zonas iguales). Triturados: precios por tonelada
 * cargado en planta, Arena #4B nueva, ocho zonas de flete por viaje de 14 m³ y
 * el viaje puesto en obra = precio por tonelada × 22 + flete de la zona
 * ("Arena 4 a San Nicolás: $300 × 22 + $3,250 = $9,850"). Tolva 30 m³ (50 ton)
 * y full (90 ton); su flete se cotiza con la ubicación de Google Maps.
 *
 * Corre UNA vez al arrancar, anotado en `platform_settings`
 * (`tabulador_cambios`): lo que se cambie después en Tarifas no se pisa.
 */
const NOMBRE = 'precios-2026-11-03';

/** Precio por hora y flete ida y vuelta de cada equipo; el nombre solo donde cambió. */
const EQUIPOS: Array<{ id: string; es: (n: string) => boolean; hora: number; flete: number; nombre?: string }> = [
  { id: 'retro_cuch', es: (n) => /retro/.test(n) && !/martillo/.test(n), hora: 850, flete: 6500 },
  { id: 'retro_mart', es: (n) => /retro/.test(n) && /martillo/.test(n), hora: 950, flete: 6500 },
  { id: 'exc_cuch', es: (n) => /excavadora/.test(n) && !/retro/.test(n) && !/martillo/.test(n), hora: 1750, flete: 30000 },
  { id: 'exc_mart', es: (n) => /excavadora/.test(n) && !/retro/.test(n) && /martillo/.test(n), hora: 2150, flete: 30000 },
  { id: 'vibro', es: (n) => /vibro|compactador/.test(n), hora: 850, flete: 12500 },
  { id: 'moto', es: (n) => /motoconform/.test(n), hora: 1750, flete: 16000 },
  { id: 'bobcat_cuch', es: (n) => /bob ?cat|minicargador/.test(n) && !/adit|martillo|chango/.test(n), hora: 650, flete: 6000, nombre: 'Bob Cat c/ pala frontal' },
  { id: 'bobcat_adit', es: (n) => /bob ?cat|minicargador/.test(n) && /adit|martillo|chango/.test(n), hora: 750, flete: 6000, nombre: 'Bob Cat c/ aditamento (mano de chango o martillo)' },
];

/** Agua: el mismo precio en todas sus zonas (área metropolitana de Monterrey). */
const AGUA: Array<{ id: string; es: (n: string) => boolean; precio: number }> = [
  { id: 'pipa', es: (n) => /pipa/.test(n) && /\b10\b/.test(n), precio: 3500 },
  { id: 'agua', es: (n) => /pipa/.test(n) && /\b20\b/.test(n), precio: 6000 },
];
const PUNTOS_AGUA = [
  'Precio por viaje dentro del área metropolitana de Monterrey.',
  'Para pedidos especiales de cantidades mayores, solicite costos especiales.',
];

/** Triturados: por tonelada cargado en planta, sin IVA ni flete. */
const MATERIALES: Array<{ id: string; es: (n: string) => boolean; precio: number }> = [
  { id: 'grava2', es: (n) => /grava\s*2/.test(n), precio: 300 },
  { id: 'mixtos', es: (n) => /mixto/.test(n), precio: 300 },
  { id: 'arena4', es: (n) => /arena\s*#?\s*4\b(?!\s*b)/.test(n), precio: 300 },
  { id: 'grava1', es: (n) => /grava\s*1\b/.test(n), precio: 300 },
  { id: 'arena5', es: (n) => /arena\s*#?\s*5/.test(n), precio: 355 },
  { id: 'cnc', es: (n) => /\bcnc\b/.test(n), precio: 150 },
  { id: 'base', es: (n) => /base/.test(n) && !/sub/.test(n), precio: 270 },
  { id: 'subbase', es: (n) => /sub\s*base/.test(n), precio: 265 },
  { id: 'sello38', es: (n) => /sello/.test(n), precio: 310 },
  { id: 'piedra', es: (n) => /piedra/.test(n), precio: 320 },
];
const ARENA_4B = { id: 'arena4b', nombre: 'Arena #4B', precio: 300, busca: /arena\s*#?\s*4\s*b/i };

/** Flete por viaje de 14 m³; el nombre lleva los municipios para elegir la zona sola. */
const ZONAS = [
  { id: 'z1', nombre: 'Zona 1 · Cerca de pedrera Escobedo', flete: 2500 },
  { id: 'z2', nombre: 'Zona 2 · Escobedo, El Carmen, García', flete: 3000 },
  { id: 'z3', nombre: 'Zona 3 · San Nicolás, Hidalgo', flete: 3250 },
  { id: 'z4', nombre: 'Zona 4 · Apodaca, Santa Catarina', flete: 3500 },
  { id: 'z5', nombre: 'Zona 5 · Salinas Victoria, Ciénega de Flores, Zuazua, Monterrey centro', flete: 4000 },
  { id: 'z6', nombre: 'Zona 6 · San Pedro, zona aeropuerto-OMA', flete: 4500 },
  { id: 'z7', nombre: 'Zona 7 · Carretera Nacional, Estanzuela, Icamole, Mina, Guadalupe', flete: 5000 },
  { id: 'z8', nombre: 'Zona 8 · Pesquería, Juárez, Marín, Cadereyta, San Mateo, Santiago', flete: 5500 },
];
const DETALLE_CAMION: Record<string, string> = { tolva: '30 m³ · 50 ton', full: '90 ton' };
const PUNTOS_MATERIAL = [
  'Costos de solo suministro, cargado en planta (pedreras Escobedo), si usted envía su volteo de 14 m³ (20 ton), tolva de 30 m³ (50 ton) o full (90 ton).',
  'Si requiere entrega en obra se suma el flete: envíe la ubicación de su obra en Google Maps para cotizarle el costo del flete por tonelada.',
];

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Injectable()
export class Precios20261103 implements OnApplicationBootstrap {
  private readonly log = new Logger('Precios20261103');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 40_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      await this.quoter.migrarTabulador('maquinaria', async (cat) => (cat.tipo === 'maquinaria' ? maquinaria(cat) : null), NOMBRE);
      const ficha = await this.fichaArena4b();
      await this.quoter.migrarTabulador('triturados', async (cat) => (cat.tipo === 'triturados' ? triturados(cat, ficha) : null), NOMBRE);
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log('Precios del 3 de noviembre: maquinaria (por hora y flete), agua y triturados (materiales, 8 zonas, ×22).');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los precios del 3 de noviembre: ${(e as Error).message}`);
      return false;
    }
  }

  /** La ficha de la Arena #4B en triturados: la que ya exista con ese nombre, o una nueva (sin foto). */
  private async fichaArena4b(): Promise<number | null> {
    const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_TRITURADOS }, select: { id: true } });
    if (!linea) return null;
    const fichas = await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true } });
    const ya = fichas.find((f) => ARENA_4B.busca.test(f.name));
    if (ya) return ya.id;
    const ahora = new Date();
    const nueva = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: linea.id,
        name: ARENA_4B.nombre,
        description: 'Arena #4B. Por tonelada, cargada en planta.',
        cprice: 0,
        is_rental: false,
        price_unit: 'tonelada',
        status: 1,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true },
    });
    return nueva.id;
  }
}

/** Busca el renglón por su id y, si no, por su nombre (los tabuladores viejos pueden tener otro id). */
function buscar<T extends { id: string; nombre: string }>(lista: T[], id: string, es: (n: string) => boolean): T | undefined {
  return lista.find((r) => r.id === id) ?? lista.find((r) => es(plano(r.nombre)));
}

function maquinaria(cat: Extract<CatalogoCotizador, { tipo: 'maquinaria' }>): CatalogoCotizador {
  const fletes = { ...cat.fletes };
  const equipos = cat.equipos.map((e) => ({ ...e }) as EquipoCotizador);
  for (const p of EQUIPOS) {
    const e = buscar(equipos, p.id, p.es);
    if (!e) continue;
    e.precio_hora = p.hora;
    delete e.tarifas;
    if (p.nombre) e.nombre = p.nombre;
    fletes[e.flete_tipo] = p.flete;
  }
  const servicios = cat.servicios.map((s) => ({ ...s }) as ServicioCotizador);
  for (const a of AGUA) {
    const s = buscar(servicios, a.id, a.es);
    if (!s) continue;
    s.precio = a.precio;
    s.presets = [a.precio];
    // Mismas zonas (dónde se ofrece), mismo precio en todas.
    const zonas = Object.keys(s.precios_zona ?? {}).length ? Object.keys(s.precios_zona ?? {}) : (cat.zonas_precio ?? []).map((z) => z.id);
    if (zonas.length) s.precios_zona = Object.fromEntries(zonas.map((z) => [z, a.precio]));
  }
  const pipa = cat.condiciones.pipa;
  const condiciones = pipa
    ? { ...cat.condiciones, pipa: { ...pipa, puntos: [...pipa.puntos, ...PUNTOS_AGUA.filter((p) => !pipa.puntos.includes(p))] } }
    : cat.condiciones;
  return { ...cat, cobrar_flete: true, fletes, equipos, servicios, condiciones };
}

function triturados(cat: Extract<CatalogoCotizador, { tipo: 'triturados' }>, ficha: number | null): CatalogoCotizador {
  const productos = cat.productos.map((p) => ({ ...p }) as ProductoTriturado);
  for (const m of MATERIALES) {
    const p = buscar(productos, m.id, m.es);
    if (p) p.precio_ton = m.precio;
  }
  if (!productos.some((p) => p.id === ARENA_4B.id || ARENA_4B.busca.test(p.nombre))) {
    productos.push({ id: ARENA_4B.id, nombre: ARENA_4B.nombre, precio_ton: ARENA_4B.precio, proveedor_id: null, productos: ficha ? [ficha] : [] });
  }
  // Tolva y full: sus capacidades nuevas; sus precios (si ya había) se quedan.
  const camiones = camionesDe(cat).map((c) => ({ ...c, detalle: DETALLE_CAMION[c.id] ?? c.detalle }));
  const material = cat.condiciones.material;
  return {
    ...cat,
    productos,
    zonas: ZONAS,
    ton_por_viaje: 22,
    camiones: camiones.length ? camiones : CAMIONES_DE_FABRICA.map((c) => ({ ...c, detalle: DETALLE_CAMION[c.id] ?? c.detalle })),
    condiciones: material ? { ...cat.condiciones, material: { ...material, puntos: PUNTOS_MATERIAL } } : cat.condiciones,
  };
}
