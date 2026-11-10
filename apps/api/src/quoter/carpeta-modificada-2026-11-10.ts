import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { LINEA_ASFALTO, aplicarRenglonesDeFicha, renglonesDeFicha, type CatalogoCotizador, type RenglonDeFicha } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * CARPETA NORMAL Y CARPETA MODIFICADA, POR SEPARADO (2026-11-10, lo pidió el
 * dueño): la tarjeta «Carpeta asfáltica normal y modificada» queda como
 * «Carpeta normal» (su precio, $2,250/t, no cambia) y se agrega otra,
 * «Carpeta modificada», a $2,650 por tonelada. Antes del IVA, como el resto.
 *
 * Las dos son renglones de la misma ficha de carpeta (como las presentaciones
 * del block): en Inventario › la ficha › Precio en el cotizador salen los dos.
 * El renglón de antes conserva su id, porque las cotizaciones lo guardan.
 *
 * Corre UNA vez al arrancar (`tabulador_cambios`). Si la ficha aún no tiene
 * precio, o ya tiene su renglón de modificada, no se toca.
 */
const NOMBRE = 'carpeta-modificada-2026-11-10';

const NORMAL = 'Carpeta normal';
const MODIFICADA: RenglonDeFicha = { nombre: 'Carpeta modificada', precio: 2650, unidad: 'tonelada', cond: 'asfalto' };

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** «Carpeta modificada» sola; «normal y modificada» no cuenta. */
const esModificada = (n: string) => /modificad/.test(plano(n)) && !/normal/.test(plano(n));

@Injectable()
export class CarpetaModificada20261110 implements OnApplicationBootstrap {
  private readonly log = new Logger('CarpetaModificada20261110');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de los precios de carpeta del 6 de noviembre (44 s), que ponen $2,250 a todos sus renglones.
    setTimeout(() => void this.poner(), 52_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      if (!hechos.includes('precios-asfalto-2026-11-06')) return false; // primero va el precio de la carpeta
      const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_ASFALTO }, select: { id: true } });
      const fichas = linea
        ? (await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true } }))
            .filter((f) => /carpeta/.test(plano(f.name)) && !/riego/.test(plano(f.name)))
        : [];
      if (!fichas.length) {
        this.log.warn('Carpeta modificada: no está la ficha de carpeta en Soluciones asfálticas; no se cambió nada.');
        return false;
      }

      const puestas: string[] = [];
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        let nuevo: CatalogoCotizador = cat;
        for (const f of fichas) {
          const { renglones, oculto } = renglonesDeFicha(nuevo, 'servicio', f.id);
          if (!renglones.length || renglones.some((r) => esModificada(r.nombre))) continue;
          // El de la carpeta normal: el que lo dice, o el primero.
          const i = Math.max(0, renglones.findIndex((r) => /normal/.test(plano(r.nombre))));
          const lista = renglones.map((r, j) => (j === i ? { ...r, nombre: NORMAL } : r));
          lista.splice(i + 1, 0, { ...MODIFICADA, cond: renglones[i].cond ?? MODIFICADA.cond });
          nuevo = aplicarRenglonesDeFicha(nuevo, 'servicio', f.id, lista, { oculto, linea: LINEA_ASFALTO });
          puestas.push(f.name);
        }
        return puestas.length ? nuevo : null;
      }, NOMBRE);
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log(
        puestas.length
          ? `Carpeta: «${NORMAL}» y «${MODIFICADA.nombre}» $${MODIFICADA.precio}/t en ${puestas.join(', ')}.`
          : 'Carpeta: ya tenía su renglón de modificada (o no tenía precio); no se tocó.',
      );
      return true;
    } catch (e) {
      this.log.warn(`No se pudo separar la carpeta modificada: ${(e as Error).message}`);
      return false;
    }
  }
}
