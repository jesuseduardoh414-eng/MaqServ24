import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EXCAVADORAS_POR_CAPACIDAD, type EquipoCotizador } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { QuoterService } from './quoter.service';

/**
 * EXCAVADORAS DE 20 A 45 t (2026-11-18, el dueño: «excavadora de diferentes
 * capacidades; opciones para que seleccione la capacidad: 20, 25, 30, 35, 40,
 * 45; los costos varían; aún no me los pasan, puedes ponerle un estimado»).
 *
 * Junto a «Excavadora 20 t c/ cucharón» y «Excavadora 20 t c/ martillo» se
 * agregan las de 25, 30, 35, 40 y 45 t, con el mismo flete, icono, proveedor y
 * ficha, y el precio por hora ESTIMADO de `EXCAVADORAS_POR_CAPACIDAD`. En el
 * cotizador salen como una sola tarjeta por excavadora y la capacidad se elige
 * en el renglón (`gruposDeEquipos`). Una capacidad que ya exista con ese nombre
 * no se toca. Corre UNA vez al arrancar (`tabulador_cambios`).
 */
const NOMBRE = 'capacidades-excavadora-2026-11-18';
const CAPACIDADES = [25, 30, 35, 40, 45] as const;

@Injectable()
export class CapacidadesExcavadora20261118 implements OnApplicationBootstrap {
  private readonly log = new Logger('CapacidadesExcavadora20261118');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de los acarreos (85 s), que también reescriben el tabulador de maquinaria.
    setTimeout(() => void this.poner(), 95_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;

      let agregadas = 0;
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        const equipos = [...cat.equipos];
        for (const clase of ['cucharon', 'martillo'] as const) {
          const re = clase === 'cucharon' ? /cuchar/i : /martillo/i;
          const base = equipos.find((e) => /^excavadora\s+20\s*t\b/i.test(e.nombre) && re.test(e.nombre));
          if (!base) continue;
          let pos = equipos.indexOf(base);
          for (const t of CAPACIDADES) {
            const nombre = base.nombre.replace(/\b20\s*t\b/i, `${t} t`);
            const ya = equipos.find((e) => e.nombre.trim().toLowerCase() === nombre.toLowerCase());
            if (ya) { pos = equipos.indexOf(ya); continue; }
            let id = `${base.id}_${t}`.slice(0, 40);
            while (equipos.some((e) => e.id === id)) id = `${id.slice(0, 37)}_${Math.floor(Math.random() * 90 + 10)}`;
            const nuevo: EquipoCotizador = { ...base, id, nombre, precio_hora: EXCAVADORAS_POR_CAPACIDAD[clase][t] };
            delete nuevo.tarifas;
            equipos.splice(++pos, 0, nuevo);
            agregadas++;
          }
        }
        return agregadas ? { ...cat, equipos } : null;
      }, NOMBRE);

      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      if (agregadas) await revalidarSitio();
      this.log.log(`Excavadoras por capacidad: ${agregadas} capacidad(es) nuevas (25 a 45 t, precio estimado).`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner las capacidades de las excavadoras: ${(e as Error).message}`);
      return false;
    }
  }
}
