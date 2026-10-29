import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { COTIZADOR_TIPOS } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * EL COTIZADOR DEL SITIO ENSEÑA LOS PRECIOS DE LISTA (2026-10-29).
 *
 * "El cotizador para los clientes debe mostrar los costos, ya que son los
 * fijos; el que tenga los accesos, desde el panel, ahí sí puede modificarlos
 * al momento de hacer la cotización." Enciende `publico.mostrarPrecios` en los
 * dos tabuladores una sola vez; después se prende o se apaga en Tarifas.
 *
 * Como Triturados20261029: queda anotado en `platform_settings`
 * (`tabulador_cambios`), así no vuelve a encenderlo si alguien lo apaga.
 */
const NOMBRE = 'precios-en-el-sitio-2026-10-29';

@Injectable()
export class PreciosEnElSitio implements OnApplicationBootstrap {
  private readonly log = new Logger(PreciosEnElSitio.name);

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.encender(), 20_000).unref();
  }

  async encender(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      for (const tipo of COTIZADOR_TIPOS) {
        await this.quoter.migrarTabulador(tipo, async (cat) =>
          cat.publico.mostrarPrecios ? null : { ...cat, publico: { ...cat.publico, mostrarPrecios: true } }, 'precios en el sitio 2026-10-29');
      }
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log('Cotizadores del sitio: enseñan los precios de lista (2026-10-29).');
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron encender los precios en el sitio: ${(e as Error).message}`);
      return false;
    }
  }
}
