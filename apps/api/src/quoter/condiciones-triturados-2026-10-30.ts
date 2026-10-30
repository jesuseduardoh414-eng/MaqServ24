import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * CONDICIONES COMERCIALES DE TRITURADOS (2026-10-30, pedido del dueño).
 *
 * Quedan: costo más IVA (esa línea la pone el cálculo, según la factura) y
 * pago en efectivo de contado. Se agrega "Aceptamos tarjetas de crédito." y
 * sale "Se paga al entregar el material en su obra.". La leyenda para
 * negociar el costo ya no va en triturados (la quitó el motor, quoter.ts).
 *
 * Corrige el tabulador guardado una sola vez, al arrancar; queda anotado en
 * `platform_settings` (`tabulador_cambios`) como los cambios del 29, así lo
 * que se edite después en Tarifas no se vuelve a pisar.
 */
const NOMBRE = 'condiciones-triturados-2026-10-30';
const TARJETAS = 'Aceptamos tarjetas de crédito.';

/** Lo que ya no va: entregar y pagar en obra, y negociar el costo (por si alguien lo escribió). */
const fuera = (p: string) => /se paga al entregar el material/i.test(p) || /negociar el costo/i.test(p);

@Injectable()
export class CondicionesTriturados20261030 implements OnApplicationBootstrap {
  private readonly log = new Logger(CondicionesTriturados20261030.name);

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 24_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados' || !cat.condiciones.general) return null;
        const antes = cat.condiciones.general.puntos;
        const puntos = antes.filter((p) => !fuera(p));
        if (!puntos.some((p) => /tarjetas? de cr[eé]dito/i.test(p))) {
          // Justo después del pago en efectivo, si está; si no, al final.
          const i = puntos.findIndex((p) => /efectivo/i.test(p));
          puntos.splice(i >= 0 ? i + 1 : puntos.length, 0, TARJETAS);
        }
        if (puntos.length === antes.length && puntos.every((p, i) => p === antes[i])) return null;
        return { ...cat, condiciones: { ...cat.condiciones, general: { ...cat.condiciones.general, puntos } } };
      }, 'condiciones de triturados 2026-10-30');
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log('Triturados: condiciones comerciales al día (tarjetas de crédito; sin pago en obra ni leyenda de negociar).');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner al día las condiciones de triturados: ${(e as Error).message}`);
      return false;
    }
  }
}
