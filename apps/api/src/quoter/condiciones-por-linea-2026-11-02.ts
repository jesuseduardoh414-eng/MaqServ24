import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CONDICIONES_POR_LINEA } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * CONDICIONES DE CARPETA ASFÁLTICA, MATERIALES Y VENTA (2026-11-02).
 *
 * Esas líneas entraron al cotizador (un cotizador del sitio por categoría): el
 * renglón que nazca en su ficha imprime su propio bloque de condiciones y no
 * las de renta de maquinaria. Se agregan al tabulador guardado una sola vez,
 * al arrancar, y solo las que falten; lo que se edite después en Tarifas ›
 * Condiciones no se vuelve a pisar (`tabulador_cambios`).
 */
const NOMBRE = 'condiciones-por-linea-2026-11-02';

@Injectable()
export class CondicionesPorLinea20261102 implements OnApplicationBootstrap {
  private readonly log = new Logger(CondicionesPorLinea20261102.name);

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 36_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        const faltan = Object.entries(CONDICIONES_POR_LINEA).filter(([clave]) => !cat.condiciones[clave]);
        if (!faltan.length) return null;
        return { ...cat, condiciones: { ...cat.condiciones, ...Object.fromEntries(faltan) } };
      }, 'condiciones por línea 2026-11-02');
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log('Maquinaria: condiciones de carpeta asfáltica, materiales y venta listas.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron agregar las condiciones por línea: ${(e as Error).message}`);
      return false;
    }
  }
}
