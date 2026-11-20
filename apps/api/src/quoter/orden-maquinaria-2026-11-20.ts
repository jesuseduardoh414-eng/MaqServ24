import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { EquipoCotizador } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { QuoterService } from './quoter.service';

/**
 * ORDEN DE LOS EQUIPOS EN EL COTIZADOR (2026-11-20, el dueño: «cambiar el
 * orden de aparición: Bulldozer diferentes capacidades, excavadoras, moto,
 * retros, vibro, bob cat»).
 *
 * Las tarjetas salen en el orden del tabulador de maquinaria (sitio, panel y
 * enlaces), así que se reacomoda el tabulador guardado. Dentro de cada clase
 * se respeta el orden que ya tenían (cucharón antes que martillo, capacidades
 * de menor a mayor). Un equipo que no es de estas clases queda al final, en
 * su orden. Corre UNA vez al arrancar (`tabulador_cambios`), después del
 * Bulldozer (105 s).
 */
const NOMBRE = 'orden-maquinaria-2026-11-20';

const CLASES: RegExp[] = [
  /bull ?dozer|tractor de orugas/,
  /^excavadora/, // antes que «retro»: «retroexcavadora» también dice «excavadora», pero no al principio
  /motoconform/,
  /retro/,
  /vibro|compactador/,
  /bob ?cat|minicargador/,
];

function claseDe(e: EquipoCotizador): number {
  const n = e.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const i = CLASES.findIndex((re) => re.test(n));
  return i < 0 ? CLASES.length : i;
}

/** Los equipos en el orden del dueño; dentro de cada clase, como venían. */
export function ordenarEquipos(equipos: EquipoCotizador[]): EquipoCotizador[] {
  return equipos
    .map((e, i) => ({ e, i, c: claseDe(e) }))
    .sort((a, b) => a.c - b.c || a.i - b.i)
    .map((x) => x.e);
}

@Injectable()
export class OrdenMaquinaria20261120 implements OnApplicationBootstrap {
  private readonly log = new Logger('OrdenMaquinaria20261120');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    setTimeout(() => void this.ordenar(), 110_000).unref();
  }

  async ordenar(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;

      let cambio = false;
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        const equipos = ordenarEquipos(cat.equipos);
        cambio = equipos.some((e, i) => e !== cat.equipos[i]);
        return cambio ? { ...cat, equipos } : null;
      }, NOMBRE);

      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      if (cambio) await revalidarSitio();
      this.log.log(cambio ? 'Maquinaria: equipos en el orden del dueño (bulldozer, excavadoras, moto, retros, vibro, Bob Cat).' : 'Maquinaria: los equipos ya estaban en orden.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudo ordenar la maquinaria: ${(e as Error).message}`);
      return false;
    }
  }
}
