import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { LINEA_TRITURADOS, type CatalogoCotizador } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * MIXTOS, MATERIAL NUEVO DE TRITURADOS (2026-10-30, pedido del dueño: "se
 * llama mixtos y tiene el mismo costo que arena 4").
 *
 * Como Triturados20261029: nace con su ficha de tipo en Inventario (sin foto;
 * se le sube ahí) y entra al tabulador con el precio por tonelada que tenga la
 * Arena #4 en ese momento. Corre UNA vez, anotado en `platform_settings`
 * (`tabulador_cambios`): si después se quita a mano, no vuelve a aparecer.
 */
const NOMBRE = 'mixtos-2026-10-30';
const MIXTOS = { id: 'mixtos', nombre: 'Mixtos', busca: /mixto/i };
/** Si la Arena #4 no estuviera en el tabulador, su precio de fábrica. */
const PRECIO_ARENA4 = 300;

@Injectable()
export class Mixtos20261030 implements OnApplicationBootstrap {
  private readonly log = new Logger('Mixtos');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 32_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      let precio = PRECIO_ARENA4;
      const hecho = await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados' || cat.productos.some((p) => p.id === MIXTOS.id || MIXTOS.busca.test(p.nombre))) return null;
        precio = cat.productos.find((p) => p.id === 'arena4' || /arena\s*#?\s*4\b/i.test(p.nombre))?.precio_ton ?? PRECIO_ARENA4;
        const ficha = await this.ficha();
        const productos = [...cat.productos, { id: MIXTOS.id, nombre: MIXTOS.nombre, precio_ton: precio, proveedor_id: null, productos: ficha ? [ficha] : [] }];
        return { ...cat, productos } as CatalogoCotizador;
      }, 'mixtos 2026-10-30');
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      if (hecho) this.log.log(`Triturados: Mixtos agregado a $${precio}/ton (el precio de la Arena #4).`);
      return hecho;
    } catch (e) {
      this.log.warn(`No se pudo agregar Mixtos: ${(e as Error).message}`);
      return false;
    }
  }

  /** La ficha del tipo en triturados: la que ya exista con ese nombre, o una nueva (sin foto). */
  private async ficha(): Promise<number | null> {
    const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_TRITURADOS }, select: { id: true } });
    if (!linea) return null;
    const fichas = await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true } });
    const ya = fichas.find((f) => MIXTOS.busca.test(f.name));
    if (ya) return ya.id;
    const ahora = new Date();
    const nueva = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: linea.id,
        name: MIXTOS.nombre,
        description: 'Mixtos. Por tonelada, cargado en planta; flete opcional.',
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
