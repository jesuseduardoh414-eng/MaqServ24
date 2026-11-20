import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { BULLDOZERS_POR_CAPACIDAD, FLETE_BULLDOZER, LINEA_MAQUINARIA, type EquipoCotizador } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { QuoterService } from './quoter.service';

/**
 * BULLDOZER D5 A D8 (2026-11-20, el dueño: «vamos a agregar una maquinaria de
 * renta: Bulldozer, diferentes capacidades»; luego: «capacidad: D5 D6 D7 D8;
 * costo D8 $3,500»).
 *
 * Igual que las excavadoras por capacidad (2026-11-18): cada clase es un
 * equipo del tabulador de maquinaria («Bulldozer D6») con su precio por hora
 * (`BULLDOZERS_POR_CAPACIDAD`: el D8 del dueño, los demás estimados), y en el
 * cotizador salen como UNA tarjeta «Bulldozer · De D5 a D8» con la capacidad
 * en el renglón (`gruposDeEquipos`). Además:
 *  - su ficha en Inventario («Bulldozer (tractor de orugas)», línea de
 *    maquinaria, sin aliado): la que ya exista con ese nombre, o una nueva;
 *  - su flete «Bulldozer» (ida y vuelta, estimado como el de la excavadora:
 *    también va en cama baja), si no lo tiene ya.
 * Va el primero (el dueño, mismo día: «Bulldozer, excavadoras, moto, retros,
 * vibro, Bob Cat»; el resto lo acomoda OrdenMaquinaria20261120). Un bulldozer
 * que ya exista con ese nombre no se toca. Corre UNA vez al arrancar
 * (`tabulador_cambios`).
 */
const NOMBRE = 'bulldozer-2026-11-20';
const FLETE = 'Bulldozer';
const ES_BULLDOZER = /bull ?dozer|tractor de orugas/i;

const FICHA = {
  name: 'Bulldozer (tractor de orugas)',
  Corto: 'Bulldozer D5, D6, D7 y D8 para despalme, cortes, empuje de material y apertura de caminos.',
  description:
    '<p>Bulldozer (tractor de orugas con cuchilla frontal) para mover y empujar grandes volúmenes de tierra. Se renta en las clases D5, D6, D7 y D8: del D5 para trabajos medianos al D8 para cortes pesados y roca suelta.</p>' +
    '<ul><li>Despalme y desmonte de terrenos</li><li>Cortes, rellenos y empuje de material</li><li>Apertura de caminos y brechas</li><li>Conformación de plataformas y terraplenes</li><li>Desgarre de suelo duro con ripper, según el equipo</li></ul>' +
    '<p><b>Renta con operador y diésel incluidos</b>, por hora, con un mínimo de 8 horas. El operador cuenta con DC3. El flete de ida y vuelta va en la cotización.</p>',
  specs: [
    { label: 'Capacidades', value: 'D5, D6, D7 y D8' },
    { label: 'Peso operativo', value: '13 a 38 t aprox., según la clase' },
    { label: 'Potencia', value: '150 a 330 HP, según la clase' },
    { label: 'Cuchilla', value: 'Recta, semi-U o U, según el equipo' },
    { label: 'Desgarrador (ripper)', value: 'Trasero, según el equipo' },
    { label: 'Equipos de referencia', value: 'Caterpillar D5, D6, D7 y D8, Komatsu D65 y D85 o similar' },
  ],
  attributes: { capacidad: '38', potencia: '330', energia: 'Diésel', implementos: 'Cuchilla frontal; desgarrador (ripper) según el equipo', operador: 'Incluido', combustible: 'Incluido' },
};

@Injectable()
export class Bulldozer20261120 implements OnApplicationBootstrap {
  private readonly log = new Logger('Bulldozer20261120');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de las capacidades de la excavadora (95 s): mismo tabulador.
    setTimeout(() => void this.poner(), 105_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;

      let agregadas = 0;
      let fichaId: number | null = null;
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        const equipos = [...cat.equipos];
        const nuevos: EquipoCotizador[] = [];
        for (const [clase, precio] of Object.entries(BULLDOZERS_POR_CAPACIDAD)) {
          const nombre = `Bulldozer ${clase}`;
          if (equipos.some((e) => e.nombre.trim().toLowerCase() === nombre.toLowerCase())) continue;
          fichaId ??= await this.ficha();
          const base = `dozer_${clase.toLowerCase()}`;
          let id = base;
          while (equipos.some((e) => e.id === id) || nuevos.some((e) => e.id === id)) id = `${base}_${Math.floor(Math.random() * 90 + 10)}`;
          nuevos.push({ id, nombre, icono: 'bulldozer', flete_tipo: FLETE, proveedor_id: null, productos: fichaId ? [fichaId] : [], precio_hora: precio });
        }
        const sinFlete = !(FLETE in cat.fletes);
        if (!nuevos.length && !sinFlete) return null;
        // El primero del cotizador (el dueño, 2026-11-20; ver OrdenMaquinaria20261120).
        equipos.unshift(...nuevos);
        agregadas = nuevos.length;
        return { ...cat, equipos, fletes: sinFlete ? { ...cat.fletes, [FLETE]: FLETE_BULLDOZER } : cat.fletes };
      }, NOMBRE);

      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      if (agregadas) await revalidarSitio();
      this.log.log(`Bulldozer: ${agregadas} capacidad(es) nuevas (D5 a D8)${fichaId ? `, ficha ${fichaId}` : ''}.`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudo poner el Bulldozer: ${(e as Error).message}`);
      return false;
    }
  }

  /** La ficha del Bulldozer: la que ya exista en maquinaria (de MAQSER24), o una nueva. Null si no hay línea de maquinaria. */
  private async ficha(): Promise<number | null> {
    const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_MAQUINARIA }, select: { id: true } });
    if (!linea) return null;
    const fichas = await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true } });
    const ya = fichas.find((f) => ES_BULLDOZER.test(f.name));
    if (ya) return ya.id;
    const ahora = new Date();
    const nueva = await prisma.products.create({
      data: {
        user_id: 0,
        provider_id: null,
        category_id: linea.id,
        name: FICHA.name,
        Corto: FICHA.Corto,
        description: FICHA.description,
        specs: JSON.stringify(FICHA.specs),
        attributes: FICHA.attributes,
        location: 'Monterrey, N.L.',
        horario: { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00' },
        cprice: 0,
        is_rental: true,
        price_unit: 'dia',
        minimo: 1,
        status: 1,
        created_at: ahora,
        updated_at: ahora,
      },
      select: { id: true },
    });
    return nueva.id;
  }
}
