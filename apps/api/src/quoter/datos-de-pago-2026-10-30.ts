import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { COTIZADOR_TIPOS, PAGO_DE_FABRICA } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * DATOS PARA EL PAGO EN LAS COTIZACIONES (2026-10-30, pedido del dueño).
 *
 * Pone en los dos tabuladores las cuentas de su tarjeta de datos bancarios
 * (PUCSA Maquinaria: Banco del Bajío y Mercado Pago, link de pagos y meses sin
 * intereses). Solo si el tabulador todavía no trae cuentas; una sola vez,
 * anotado en `platform_settings` (`tabulador_cambios`), así lo que se edite
 * después en Tarifas no se vuelve a pisar.
 */
const NOMBRE = 'datos-de-pago-2026-10-30';

@Injectable()
export class DatosDePago20261030 implements OnApplicationBootstrap {
  private readonly log = new Logger(DatosDePago20261030.name);

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.poner(), 28_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      for (const tipo of COTIZADOR_TIPOS) {
        await this.quoter.migrarTabulador(tipo, async (cat) =>
          cat.pago?.cuentas.length ? null : { ...cat, pago: structuredClone(PAGO_DE_FABRICA) }, 'datos de pago 2026-10-30');
      }
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log('Cotizaciones: datos para el pago puestos en los dos tabuladores.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los datos para el pago: ${(e as Error).message}`);
      return false;
    }
  }
}
