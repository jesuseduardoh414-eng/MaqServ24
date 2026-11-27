import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { COTIZADOR_TIPOS } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { QuoterService } from './quoter.service';

/**
 * UN SOLO CORREO: VENTAS (2026-11-27, el dueño: «solo se va a dejar el correo
 * de ventas, el otro se va a quitar»).
 *
 * Las cotizaciones (y su PDF) traían en el encabezado info@maqser24.com, que no
 * es el correo que se atiende. Aquí se cambia por ventas@maqser24.com en el
 * documento de los dos tabuladores (Tarifas › Documento), pero SOLO si trae uno
 * de los correos viejos de MAQSER24: uno que el dueño haya escrito a mano se
 * respeta. Corre una vez al arrancar (`tabulador_cambios`). Las cotizaciones
 * ya emitidas no cambian: su documento está congelado.
 */
const NOMBRE = 'correo-ventas-2026-11-27';
const CORREO = 'ventas@maqser24.com';
const VIEJOS = new Set(['info@maqser24.com', 'avisos@maqser24.com', 'info@maqserv24.com', 'avisos@maqserv24.com', 'ventas@maqserv24.com']);

@Injectable()
export class CorreoVentas20261127 implements OnApplicationBootstrap {
  private readonly log = new Logger('CorreoVentas20261127');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de los demás cambios del tabulador.
    setTimeout(() => void this.cambiar(), 90_000).unref();
  }

  async cambiar(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      let cambiados = 0;
      for (const tipo of COTIZADOR_TIPOS) {
        await this.quoter.migrarTabulador(tipo, async (cat) => {
          const actual = (cat.empresa?.correo ?? '').trim().toLowerCase();
          if (!VIEJOS.has(actual)) return null;
          cambiados++;
          return { ...cat, empresa: { ...cat.empresa, correo: CORREO } };
        }, NOMBRE);
      }
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      if (cambiados) await revalidarSitio();
      this.log.log(`Cotizaciones: correo del encabezado → ${CORREO} en ${cambiados} tabulador(es).`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudo poner el correo de ventas en las cotizaciones: ${(e as Error).message}`);
      return false;
    }
  }
}
