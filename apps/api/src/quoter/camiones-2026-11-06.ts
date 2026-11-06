import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CAMIONES_DE_FABRICA } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * LOS CAMIONES DEL PEDIDO GRANDE (2026-11-06, el dueño: "tolva, full, camión
 * de 7 metros cúbicos, camión de 14 metros cúbicos"). El tabulador guardado
 * trae solo tolva y full; aquí se le agregan los que falten de fábrica, al
 * final y sin tocar los que ya están. Corre UNA vez al arrancar
 * (`tabulador_cambios`).
 */
const NOMBRE = 'camiones-2026-11-06';

@Injectable()
export class Camiones20261106 implements OnApplicationBootstrap {
  private readonly log = new Logger('Camiones20261106');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de los precios del 3 de noviembre (40 s), que dejaron tolva y full guardados.
    setTimeout(() => void this.poner(), 48_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      const agregados: string[] = [];
      await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados' || !cat.camiones) return null; // sin lista guardada ya salen los de fábrica
        const faltan = CAMIONES_DE_FABRICA.filter((c) => !cat.camiones!.some((x) => x.id === c.id));
        if (!faltan.length) return null;
        agregados.push(...faltan.map((c) => c.nombre));
        return { ...cat, camiones: [...cat.camiones, ...faltan].slice(0, 6) };
      }, NOMBRE);
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log(agregados.length ? `Pedido grande: se agregaron ${agregados.join(' y ')}.` : 'Pedido grande: ya estaban todos los camiones.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron agregar los camiones del pedido grande: ${(e as Error).message}`);
      return false;
    }
  }
}
