import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CAMIONES_DE_FABRICA } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * LOS CAMIONES DEL PEDIDO GRANDE, CON SUS m³ Y TONELADAS (2026-11-12, el
 * dueño: "volteo 7 metros cúbicos / 10 toneladas, volteo 14 metros cúbicos /
 * 14 toneladas, tolva 30 metros cúbicos / 50 t, full 60 metros cúbicos / 100
 * toneladas", en lugar de «Puesto en obra»).
 *
 * En el tabulador guardado, a los cuatro de fábrica se les pone el nombre y el
 * detalle nuevos (los camiones de 7 y 14 m³ pasan a ser volteos), en el orden
 * de fábrica; se conservan su clave y sus precios, y cualquier otro camión va
 * después, sin tocarlo. Corre UNA vez al arrancar (`tabulador_cambios`).
 */
// «-b»: la primera vuelta (solo en la computadora de pruebas) puso 20 ton al volteo de 14 m³; el dueño confirmó 14.
const NOMBRE = 'camiones-2026-11-12-b';

@Injectable()
export class Camiones20261112 implements OnApplicationBootstrap {
  private readonly log = new Logger('Camiones20261112');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de la del 6 de noviembre (48 s), que agregó los camiones de 7 y 14 m³.
    setTimeout(() => void this.poner(), 56_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      let cambio = false;
      await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados' || !cat.camiones) return null; // sin lista guardada ya salen los de fábrica
        const guardados = cat.camiones;
        const deFabrica = CAMIONES_DE_FABRICA.map((f) => {
          const g = guardados.find((x) => x.id === f.id);
          return { ...f, precios_ton: g?.precios_ton ?? f.precios_ton };
        });
        const otros = guardados.filter((x) => !CAMIONES_DE_FABRICA.some((f) => f.id === x.id));
        const camiones = [...deFabrica, ...otros].slice(0, 6);
        if (JSON.stringify(camiones) === JSON.stringify(guardados)) return null;
        cambio = true;
        return { ...cat, camiones };
      }, NOMBRE);
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log(cambio ? 'Pedido grande: volteo 7 y 14 m³, tolva y full con sus m³ y toneladas.' : 'Pedido grande: los camiones ya estaban al día.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner al día los camiones del pedido grande: ${(e as Error).message}`);
      return false;
    }
  }
}
