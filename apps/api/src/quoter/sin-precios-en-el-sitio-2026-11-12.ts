import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { COTIZADOR_TIPOS } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * EL COTIZADOR DEL SITIO, SIN PRECIOS (2026-11-12, el dueño: "quitar precios
 * del cotizador web"). Deshace lo del 2026-10-29 (`PreciosEnElSitio`): apaga
 * `publico.mostrarPrecios` en los dos tabuladores UNA vez; el cliente arma su
 * pedido sin ver precios y MAQSER24 le manda la cotización desde Solicitudes.
 * La API ya manda el tabulador en ceros con el interruptor apagado.
 *
 * Después se prende o se apaga en Tarifas (interruptor «Enseña los precios de
 * lista»): queda anotado en `platform_settings` (`tabulador_cambios`), así no
 * lo vuelve a apagar si alguien lo prende. El panel y el enlace no cambian.
 */
const NOMBRE = 'sin-precios-en-el-sitio-2026-11-12';

@Injectable()
export class SinPreciosEnElSitio20261112 implements OnApplicationBootstrap {
  private readonly log = new Logger('SinPreciosEnElSitio20261112');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.apagar(), 58_000).unref();
  }

  async apagar(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      for (const tipo of COTIZADOR_TIPOS) {
        await this.quoter.migrarTabulador(tipo, async (cat) =>
          cat.publico.mostrarPrecios ? { ...cat, publico: { ...cat.publico, mostrarPrecios: false } } : null, NOMBRE);
      }
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log('Cotizadores del sitio: ya no enseñan precios (2026-11-12).');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron quitar los precios del sitio: ${(e as Error).message}`);
      return false;
    }
  }
}
