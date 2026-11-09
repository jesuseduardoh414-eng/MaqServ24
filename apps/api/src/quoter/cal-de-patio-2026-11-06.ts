import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { CONDICIONES_CAL, LINEA_TRITURADOS, type ProductoTriturado } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * LA CAL DE PATIO (2026-11-06, la mandó el dueño): «Cal de patio, $1,650 / ton,
 * ya puesta en obra, área metropolitana de Monterrey», con sus condiciones
 * («Pedido mínimo. En la cal las tolvas vienen entre 25 y 32 toneladas. Se
 * pide el pago de 28 toneladas para hacer la programación. Se tarda máximo 48
 * horas después del pago. Ya cuando llegue se realiza ajuste, para arriba o
 * para abajo.»).
 *
 * Va en triturados como material «en obra»: su precio ya trae el flete, se
 * cobran mínimo 28 ton y sale como una tarjeta más junto a la grava y los
 * demás materiales, en cualquier forma. Se le crea su ficha en Inventario (sin foto) y se
 * agrega el bloque de condiciones `cal` si falta. Corre UNA vez al arrancar
 * (`tabulador_cambios`); lo que se cambie después en su ficha no se pisa.
 */
const NOMBRE = 'cal-de-patio-2026-11-06';
const CAL = { id: 'cal_patio', nombre: 'Cal de patio', precio: 1650, minimo: 28, busca: /\bcal\b/i };

@Injectable()
export class CalDePatio20261106 implements OnApplicationBootstrap {
  private readonly log = new Logger('CalDePatio20261106');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de los precios del 3 de noviembre (40 s), que reescriben los materiales.
    setTimeout(() => void this.poner(), 50_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      const ficha = await this.ficha();
      await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados') return null;
        const ya = cat.productos.some((p) => p.id === CAL.id || CAL.busca.test(p.nombre));
        const productos: ProductoTriturado[] = ya
          ? cat.productos
          : [...cat.productos, { id: CAL.id, nombre: CAL.nombre, precio_ton: CAL.precio, en_obra: true, minimo_ton: CAL.minimo, proveedor_id: null, productos: ficha ? [ficha] : [] }];
        const condiciones = cat.condiciones.cal ? cat.condiciones : { ...cat.condiciones, cal: CONDICIONES_CAL };
        if (ya && cat.condiciones.cal) return null;
        return { ...cat, productos, condiciones };
      }, NOMBRE);
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log(`Triturados: Cal de patio a $${CAL.precio}/ton puesta en obra (mínimo ${CAL.minimo} ton) y sus condiciones.`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudo agregar la cal de patio: ${(e as Error).message}`);
      return false;
    }
  }

  /** La ficha de la cal en triturados: la que ya exista con ese nombre, o una nueva (sin foto). */
  private async ficha(): Promise<number | null> {
    const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_TRITURADOS }, select: { id: true } });
    if (!linea) return null;
    const fichas = await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true } });
    const ya = fichas.find((f) => CAL.busca.test(f.name));
    if (ya) return ya.id;
    const ahora = new Date();
    const nueva = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: linea.id,
        name: CAL.nombre,
        description: 'Cal de patio. Por tonelada, ya puesta en obra en el área metropolitana de Monterrey. Pedido mínimo de 28 toneladas (una tolva de 25 a 32 ton, se ajusta al llegar).',
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
