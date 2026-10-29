import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { LINEA_MAQUINARIA, precioHoraDe, type CatalogoCotizador, type EquipoCotizador } from '@maqserv/config';
import { QuoterService } from './quoter.service';

/**
 * LA MAQUINARIA PASA A COBRARSE POR HORA (2026-10-29).
 *
 * "Todos esos costos son por hora, que así es como se cobra por cada uno."
 * Dirección mandó la lista nueva: un solo precio por hora sin descuentos por
 * semana o mes, mínimo de 8 horas por equipo, sin flete por ahora ("deja el
 * campo") y dos equipos nuevos, el Bob Cat con cucharón y con aditamentos.
 *
 * El tabulador vive en la base de datos de cada servidor. Esto lo convierte
 * solo al arrancar la API, para que nadie tenga que capturar la lista otra vez
 * en producción. Corre UNA vez: la marca es que algún equipo siga sin
 * `precio_hora`; ya convertido, los precios se cambian desde la ficha de cada
 * tipo, como siempre. Un equipo que no está en la lista toma su tarifa día
 * entre la jornada, que es lo que ya cobraba por hora.
 *
 * Como PapelesPrivados: corre unos segundos después de arrancar y nunca lanza.
 */
const LISTA: Record<string, number> = {
  retro_cuch: 800,
  retro_mart: 900,
  exc_cuch: 1650,
  exc_mart: 1950,
  moto: 1650,
  vibro: 750,
};

const BOBCAT = {
  ficha: 'Bob Cat (minicargador)',
  descripcion: 'Minicargador tipo Bob Cat con operador y diésel, con cucharón o con aditamentos.',
  flete: 'Minicargador',
  renglones: [
    { id: 'bobcat_cuch', nombre: 'Bob Cat c/ cucharón', precio_hora: 650 },
    { id: 'bobcat_adit', nombre: 'Bob Cat c/ aditamentos', precio_hora: 700 },
  ],
};

/** El primer punto de la renta ahora lo escribe el motor (por hora, con su mínimo). */
const PUNTO_POR_JORNADA = /^El costo de la renta del equipo es por jornada/i;

const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CobroPorHora implements OnApplicationBootstrap {
  private readonly log = new Logger(CobroPorHora.name);

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.convertir(), 8_000).unref();
  }

  async convertir(): Promise<boolean> {
    try {
      const hecho = await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria' || cat.equipos.every((e) => e.precio_hora !== undefined)) return null;

        const equipos: EquipoCotizador[] = cat.equipos.map((e) => {
          const { tarifas: _antes, ...resto } = e;
          return { ...resto, precio_hora: LISTA[e.id] ?? r2(precioHoraDe(cat, e)) };
        });

        const fletes = { ...cat.fletes };
        if (!cat.equipos.some((e) => e.id.startsWith('bobcat'))) {
          const fichaId = await this.fichaBobCat();
          if (fichaId) {
            if (!(BOBCAT.flete in fletes)) fletes[BOBCAT.flete] = 0;
            for (const r of BOBCAT.renglones) {
              equipos.push({ ...r, icono: 'minicargador', flete_tipo: BOBCAT.flete, proveedor_id: null, productos: [fichaId] });
            }
          }
        }

        const renta = cat.condiciones.renta;
        const condiciones = renta
          ? { ...cat.condiciones, renta: { ...renta, puntos: renta.puntos.filter((p) => !PUNTO_POR_JORNADA.test(p.trim())) } }
          : cat.condiciones;

        const { tiers: _tramos, ...general } = cat;
        return {
          ...general,
          minimo_horas: cat.minimo_horas ?? 8,
          cobrar_flete: cat.cobrar_flete ?? false,
          fletes,
          equipos,
          condiciones,
        } as CatalogoCotizador;
      }, 'cobro por hora 2026-10-29');
      if (hecho) this.log.log('Maquinaria: tabulador pasado a cobro por hora (lista del 2026-10-29, mínimo 8 h, sin flete, Bob Cat).');
      return hecho;
    } catch (e) {
      this.log.warn(`No se pudo pasar la maquinaria a cobro por hora: ${(e as Error).message}`);
      return false;
    }
  }

  /** La ficha del tipo Bob Cat: la que ya exista en maquinaria, o una nueva. Null si no hay línea de maquinaria. */
  private async fichaBobCat(): Promise<number | null> {
    const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_MAQUINARIA }, select: { id: true } });
    if (!linea) return null;
    const fichas = await prisma.products.findMany({
      where: { provider_id: null, category_id: linea.id },
      select: { id: true, name: true },
    });
    const ya = fichas.find((f) => /bob ?cat|minicargador/i.test(f.name));
    if (ya) return ya.id;
    const ahora = new Date();
    const nueva = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: linea.id,
        name: BOBCAT.ficha,
        description: BOBCAT.descripcion,
        cprice: 0,
        is_rental: true,
        price_unit: 'dia',
        minimo: 1,
        status: 1,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true },
    });
    return nueva.id;
  }
}
