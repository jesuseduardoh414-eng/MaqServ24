import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { LINEA_TRITURADOS, type CatalogoCotizador, type ProductoTriturado } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * PRECIOS DE TRITURADOS DEL 2026-10-29.
 *
 * Dirección mandó la lista nueva, por tonelada cargado en planta, sin IVA ni
 * flete. Tres materiales son nuevos (sub base, sello 3/8" y piedra 3" a 12")
 * y nacen con su ficha de tipo en Inventario; Grava 1 se queda en $280. El
 * flete sigue igual y es opcional, salvo que la primera zona ahora cubre desde
 * 0 km ("se cobra como la primera"). Para cotizarlo se pide la ubicación de la
 * obra en Google Maps (eso lo hace el cotizador, no este archivo).
 *
 * Como CobroPorHora: el tabulador vive en la base de cada servidor y esto lo
 * pone al día solo al arrancar la API. Corre UNA vez: queda anotado en
 * `platform_settings` (`tabulador_cambios`), así un material que después se
 * quite a mano no vuelve a aparecer.
 */
const NOMBRE = 'triturados-2026-10-29';

/** id del renglón → precio por tonelada (y nombre, si cambia). */
const PRECIOS: Record<string, { precio: number; nombre?: string }> = {
  grava2: { precio: 290 },
  arena5: { precio: 255 },
  arena4: { precio: 300 },
  cnc: { precio: 150 },
  base: { precio: 270, nombre: 'Base hidráulica 1½" a finos' },
};

const NUEVOS: Array<{ id: string; nombre: string; precio: number; busca: RegExp }> = [
  { id: 'subbase', nombre: 'Sub base hidráulica', precio: 265, busca: /sub ?base/i },
  { id: 'sello38', nombre: 'Sello 3/8"', precio: 310, busca: /sello/i },
  { id: 'piedra', nombre: 'Piedra 3" a 12"', precio: 320, busca: /piedra/i },
];

/** La primera zona de flete cubre desde 0 km: "se cobra como la primera". */
const PRIMERA_ZONA = { de: /^15\s*[–-]\s*20 km/i, a: 'Hasta 20 km' };

/** Lo que dicen las condiciones del material desde hoy (solo si siguen como venían de fábrica). */
const PUNTOS: Array<[string, string]> = [
  ['El costo del material es cargado en planta.', 'El costo del material es por tonelada cargado en planta; no incluye IVA ni flete.'],
  ['El flete se cotiza por tonelada según el área de entrega.', 'El flete es opcional y se cotiza por tonelada según la zona de entrega; para cotizarlo se necesita la ubicación de la obra en Google Maps.'],
];

@Injectable()
export class Triturados20261029 implements OnApplicationBootstrap {
  private readonly log = new Logger('TrituradosPrecios');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 16_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      let creadas = 0;
      const hecho = await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados') return null;
        const productos: ProductoTriturado[] = cat.productos.map((p) => {
          const n = PRECIOS[p.id];
          return n ? { ...p, precio_ton: n.precio, ...(n.nombre ? { nombre: n.nombre } : {}) } : p;
        });
        for (const m of NUEVOS) {
          if (productos.some((p) => p.id === m.id)) continue;
          const ficha = await this.ficha(m.nombre, m.busca);
          if (ficha.creada) creadas++;
          productos.push({ id: m.id, nombre: m.nombre, precio_ton: m.precio, proveedor_id: null, productos: ficha.id ? [ficha.id] : [] });
        }
        const zonas = cat.zonas.map((z, i) => (i === 0 && PRIMERA_ZONA.de.test(z.nombre) ? { ...z, nombre: z.nombre.replace(PRIMERA_ZONA.de, PRIMERA_ZONA.a) } : z));
        const material = cat.condiciones.material;
        const condiciones = material
          ? { ...cat.condiciones, material: { ...material, puntos: material.puntos.map((p) => PUNTOS.find(([antes]) => antes === p.trim())?.[1] ?? p) } }
          : cat.condiciones;
        return { ...cat, productos, zonas, condiciones } as CatalogoCotizador;
      }, 'precios de triturados 2026-10-29');
      await guardarAjuste('tabulador_cambios', [...hechos, NOMBRE], 'arranque de la API');
      if (hecho) this.log.log(`Triturados: precios del 2026-10-29, sub base, sello y piedra (${creadas} ficha${creadas === 1 ? '' : 's'} nueva${creadas === 1 ? '' : 's'}), primera zona desde 0 km.`);
      return hecho;
    } catch (e) {
      this.log.warn(`No se pudieron poner los precios de triturados: ${(e as Error).message}`);
      return false;
    }
  }

  /** La ficha del tipo: la que ya exista en triturados con ese nombre, o una nueva (sin foto: se le sube en Inventario). */
  private async ficha(nombre: string, busca: RegExp): Promise<{ id: number | null; creada: boolean }> {
    const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_TRITURADOS }, select: { id: true } });
    if (!linea) return { id: null, creada: false };
    const fichas = await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true } });
    const ya = fichas.find((f) => busca.test(f.name));
    if (ya) return { id: ya.id, creada: false };
    const ahora = new Date();
    const nueva = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: linea.id,
        name: nombre,
        description: `${nombre}. Por tonelada, cargado en planta; flete opcional.`,
        cprice: 0,
        is_rental: false,
        price_unit: 'tonelada',
        status: 1,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true },
    });
    return { id: nueva.id, creada: true };
  }
}
