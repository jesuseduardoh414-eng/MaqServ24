import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { CONDICIONES_CAL, LINEA_MATERIALES, LINEA_TRITURADOS, type CatalogoCotizador } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { QuoterService } from './quoter.service';

/**
 * LA CAL PASA A MATERIALES PARA CONSTRUCCIÓN (2026-11-18, el dueño: «en
 * materiales de construcción debemos agregar la cal; la cal ya no va a ser de
 * triturados, ahora va a ser de materiales de construcción»).
 *
 * Hasta hoy la cal de patio era un material «puesto en obra» del cotizador de
 * triturados (tarjeta en «Pedido grande»). Ahora es un servicio de la línea de
 * materiales (tabulador de maquinaria, como el block), por tonelada, con:
 *  - el MISMO precio, aliado y ficha que ya tenía (lo que el dueño le haya
 *    puesto se conserva);
 *  - su mínimo (28 ton) como `minimo` del servicio: se cobra al menos eso;
 *  - sus condiciones (bloque `cal`), que se imprimen cuando va en la cotización.
 * Se quita de triturados y su ficha del catálogo pasa a la categoría Materiales
 * para construcción. Corre UNA vez al arrancar (`tabulador_cambios`): primero
 * la agrega en materiales y luego la quita de triturados, así un corte a la
 * mitad deja la cal repetida, nunca perdida.
 */
const NOMBRE = 'cal-a-materiales-2026-11-18';
const ES_CAL = /\bcal\b/i;

@Injectable()
export class CalAMateriales20261118 implements OnApplicationBootstrap {
  private readonly log = new Logger('CalAMateriales20261118');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de la cal de patio (50 s) y de los demás cambios del tabulador.
    setTimeout(() => void this.mover(), 75_000).unref();
  }

  async mover(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;

      // 1) Lo que la cal tiene hoy en triturados.
      let cal: { nombre: string; precio: number; minimo: number; proveedor: number | null; fichas: number[]; oculto: boolean } | null = null;
      let condiciones = CONDICIONES_CAL as CatalogoCotizador['condiciones'][string];
      await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados') return null;
        const p = cat.productos.find((x) => x.id === 'cal_patio' || ES_CAL.test(x.nombre));
        if (p) {
          cal = { nombre: p.nombre, precio: p.precio_ton, minimo: p.minimo_ton ?? 28, proveedor: p.proveedor_id ?? null, fichas: p.productos ?? [], oculto: !!p.oculto };
        }
        if (cat.condiciones.cal) condiciones = cat.condiciones.cal;
        return null; // aquí solo se lee
      }, NOMBRE);

      // 2) La cal en materiales (servicio del tabulador de maquinaria), si no está ya.
      const datos = cal as { nombre: string; precio: number; minimo: number; proveedor: number | null; fichas: number[]; oculto: boolean } | null;
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        const ya = cat.servicios.some((s) => s.id === 'cal_patio' || ES_CAL.test(s.nombre));
        const conCond = cat.condiciones.cal ? cat.condiciones : { ...cat.condiciones, cal: condiciones };
        if (ya && cat.condiciones.cal) return null;
        if (ya || !datos) return { ...cat, condiciones: conCond };
        return {
          ...cat,
          servicios: [
            ...cat.servicios,
            {
              id: 'cal_patio',
              nombre: datos.nombre,
              icono: 'material',
              unidad: 'tonelada',
              precio: datos.precio,
              presets: [datos.precio],
              cond: 'cal',
              linea: LINEA_MATERIALES,
              proveedor_id: datos.proveedor,
              productos: datos.fichas,
              minimo: datos.minimo,
              ...(datos.oculto ? { oculto: true } : {}),
            },
          ],
          condiciones: conCond,
        };
      }, NOMBRE);

      // 3) Fuera de triturados (renglón y condiciones).
      await this.quoter.migrarTabulador('triturados', async (cat) => {
        if (cat.tipo !== 'triturados') return null;
        const sin = cat.productos.filter((x) => !(x.id === 'cal_patio' || ES_CAL.test(x.nombre)));
        if (sin.length === cat.productos.length && !cat.condiciones.cal) return null;
        const { cal: _fuera, ...resto } = cat.condiciones;
        return { ...cat, productos: sin, condiciones: resto };
      }, NOMBRE);

      // 4) Su ficha del catálogo, a Materiales para construcción.
      const [tri, mat] = await Promise.all([
        prisma.categories.findFirst({ where: { cat_slug: LINEA_TRITURADOS }, select: { id: true } }),
        prisma.categories.findFirst({ where: { cat_slug: LINEA_MATERIALES }, select: { id: true } }),
      ]);
      let fichas = 0;
      if (tri && mat) {
        const candidatas = await prisma.products.findMany({ where: { category_id: tri.id, provider_id: null }, select: { id: true, name: true } });
        const ids = new Set([...(datos?.fichas ?? []), ...candidatas.filter((c) => ES_CAL.test(c.name)).map((c) => c.id)]);
        if (ids.size) {
          const r = await prisma.products.updateMany({ where: { id: { in: [...ids] }, category_id: tri.id }, data: { category_id: mat.id, updated_at: new Date() } });
          fichas = r.count;
        }
      }

      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      await revalidarSitio();
      this.log.log(datos
        ? `Cal: a Materiales para construcción ($${datos.precio}/ton, mínimo ${datos.minimo} ton); ${fichas} ficha(s) movida(s).`
        : `Cal: no estaba en triturados; ${fichas} ficha(s) movida(s).`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudo pasar la cal a materiales: ${(e as Error).message}`);
      return false;
    }
  }
}
