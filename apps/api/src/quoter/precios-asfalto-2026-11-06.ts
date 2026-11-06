import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import {
  CONDICIONES_POR_LINEA,
  LINEA_ASFALTO,
  aplicarRenglonesDeFicha,
  renglonesDeFicha,
  type CatalogoCotizador,
  type RenglonDeFicha,
} from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * PRECIOS DE CARPETA ASFÁLTICA (2026-11-06, los mandó el dueño):
 * "carpeta asfáltica se cobra por tonelada, $2,250; riego de impregnación se
 * cobra por litro, $10.5". Antes del IVA, como el resto de la lista.
 *
 * El precio vive en la ficha del tipo: aquí se hace lo mismo que «Precio en
 * el cotizador» de cada ficha (sus renglones en el tabulador de maquinaria,
 * con su unidad). Con eso la categoría deja de ser «a la medida» y se cotiza
 * sola en el sitio, el panel y el enlace. La ficha del riego pasa a «litro».
 * También cambia el primer punto de sus condiciones, que decía «tonelada
 * aplicada o m²», solo si sigue como venía de fábrica.
 *
 * Corre UNA vez al arrancar, anotado en `platform_settings`
 * (`tabulador_cambios`): lo que se cambie después en la ficha no se pisa.
 */
const NOMBRE = 'precios-asfalto-2026-11-06';

const PRECIOS: Array<{ es: (n: string) => boolean; precio: number; unidad: string; unidadFicha: string }> = [
  { es: (n) => /riego/.test(n), precio: 10.5, unidad: 'litro', unidadFicha: 'litro' },
  { es: (n) => /carpeta/.test(n) && !/riego/.test(n), precio: 2250, unidad: 'tonelada', unidadFicha: 'tonelada' },
];

const PUNTO_VIEJO = 'El precio es por la unidad indicada en la cotización (tonelada aplicada o m²). El volumen se calcula con los m² de la superficie y el espesor en cm.';

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Injectable()
export class PreciosAsfalto20261106 implements OnApplicationBootstrap {
  private readonly log = new Logger('PreciosAsfalto20261106');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de las condiciones por línea (36 s) y de los precios del 3 de noviembre (40 s).
    setTimeout(() => void this.poner(), 44_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_ASFALTO }, select: { id: true } });
      const fichas = linea
        ? await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true, price_unit: true } })
        : [];
      const conPrecio = fichas
        .map((f) => ({ ficha: f, p: PRECIOS.find((x) => x.es(plano(f.name))) }))
        .filter((x): x is { ficha: (typeof fichas)[number]; p: (typeof PRECIOS)[number] } => !!x.p);
      if (!conPrecio.length) {
        // Sin las fichas no hay a quién ponerle precio; se reintenta en el siguiente arranque.
        this.log.warn('Precios de carpeta asfáltica: no están las fichas de carpeta ni de riego; no se cambió nada.');
        return false;
      }

      await this.quoter.migrarTabulador('maquinaria', async (cat) => (cat.tipo === 'maquinaria' ? asfalto(cat, conPrecio) : null), NOMBRE);
      for (const { ficha, p } of conPrecio) {
        if (ficha.price_unit !== p.unidadFicha) {
          await prisma.products.update({ where: { id: ficha.id }, data: { price_unit: p.unidadFicha, updated_at: new Date() } });
        }
      }
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log(`Precios de carpeta asfáltica: ${conPrecio.map(({ ficha, p }) => `${ficha.name} $${p.precio}/${p.unidad}`).join(', ')}.`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los precios de carpeta asfáltica: ${(e as Error).message}`);
      return false;
    }
  }
}

function asfalto(
  cat: Extract<CatalogoCotizador, { tipo: 'maquinaria' }>,
  conPrecio: Array<{ ficha: { id: number; name: string }; p: (typeof PRECIOS)[number] }>,
): CatalogoCotizador {
  let nuevo: CatalogoCotizador = cat;
  for (const { ficha, p } of conPrecio) {
    const { renglones } = renglonesDeFicha(nuevo, 'servicio', ficha.id);
    const lista: RenglonDeFicha[] = renglones.length
      ? renglones.map((r) => ({ ...r, precio: p.precio, unidad: p.unidad }))
      : [{ nombre: ficha.name, precio: p.precio, unidad: p.unidad, cond: 'asfalto' }];
    nuevo = aplicarRenglonesDeFicha(nuevo, 'servicio', ficha.id, lista, { oculto: false, linea: LINEA_ASFALTO });
  }
  if (nuevo.tipo !== 'maquinaria') return nuevo;
  // Sus condiciones: las de fábrica si faltan; si están como venían, el primer punto nuevo.
  const bloque = nuevo.condiciones.asfalto;
  const condiciones = !bloque
    ? { ...nuevo.condiciones, asfalto: CONDICIONES_POR_LINEA.asfalto }
    : { ...nuevo.condiciones, asfalto: { ...bloque, puntos: bloque.puntos.map((t) => (t === PUNTO_VIEJO ? CONDICIONES_POR_LINEA.asfalto.puntos[0] : t)) } };
  return { ...nuevo, condiciones };
}
