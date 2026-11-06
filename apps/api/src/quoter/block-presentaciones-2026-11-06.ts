import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import {
  LINEA_MATERIALES,
  aplicarRenglonesDeFicha,
  renglonesDeFicha,
  type CatalogoCotizador,
  type RenglonDeFicha,
} from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { QuoterService } from './quoter.service';

/**
 * EL BLOCK Y SUS PRESENTACIONES (2026-11-06, lo mandó el dueño): "Block se
 * vende por pieza, tarima, viaje Torton, viaje tráiler. Pendiente precio,
 * dejar campo para poner precio."
 *
 * A la ficha del block se le ponen sus cuatro renglones en el tabulador de
 * maquinaria, uno por presentación, en $0 y OCULTOS: así en Inventario › la
 * ficha › Precio en el cotizador ya están los cuatro campos listos para poner
 * el precio y encenderlos. Mientras tanto la categoría sigue a la medida, y el
 * sitio, el panel y el enlace ofrecen cada presentación como su propia tarjeta
 * (`productosALaMedida`). La ficha pasa a cobrarse por pieza (decía m³).
 *
 * Corre UNA vez al arrancar (`tabulador_cambios`). Si la ficha ya tiene
 * renglones (alguien ya les puso precio), no se toca.
 */
const NOMBRE = 'block-presentaciones-2026-11-06';

const PRESENTACIONES = ['pieza', 'tarima', 'viaje Torton', 'viaje tráiler'];

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Los datos extra con «Se vende por: Pieza, tarima, viaje Torton o viaje tráiler»; null si no hay nada que cambiar. */
function conPresentaciones(specs: string | null): string | null {
  try {
    const lista = JSON.parse(specs ?? '[]') as Array<{ label?: string; value?: string }>;
    if (!Array.isArray(lista)) return null;
    const i = lista.findIndex((s) => plano(s.label ?? '').trim() === 'se vende por' && plano(s.value ?? '').trim() === 'pieza');
    if (i < 0) return null;
    lista[i] = { ...lista[i], value: 'Pieza, tarima, viaje Torton o viaje tráiler' };
    return JSON.stringify(lista);
  } catch {
    return null;
  }
}

@Injectable()
export class BlockPresentaciones20261106 implements OnApplicationBootstrap {
  private readonly log = new Logger('BlockPresentaciones20261106');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de las condiciones por línea (36 s), que traen el bloque «materiales».
    setTimeout(() => void this.poner(), 46_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;
      const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_MATERIALES }, select: { id: true } });
      const fichas = linea
        ? (await prisma.products.findMany({ where: { provider_id: null, category_id: linea.id }, select: { id: true, name: true, price_unit: true, specs: true } }))
            .filter((f) => /\bbloc?k|\bbloque/.test(plano(f.name)))
        : [];
      if (!fichas.length) {
        // Sin la ficha no hay a quién ponerle presentaciones; se reintenta en el siguiente arranque.
        this.log.warn('Block: no está su ficha en Materiales para construcción; no se cambió nada.');
        return false;
      }

      const puestas: string[] = [];
      const datos: string[] = [];
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        let nuevo: CatalogoCotizador = cat;
        for (const f of fichas) {
          if (renglonesDeFicha(nuevo, 'servicio', f.id).renglones.length) continue;
          const renglones: RenglonDeFicha[] = PRESENTACIONES.map((unidad) => ({ nombre: `${f.name.trim()} · por ${unidad}`, precio: 0, unidad, cond: 'materiales' }));
          nuevo = aplicarRenglonesDeFicha(nuevo, 'servicio', f.id, renglones, { oculto: true, linea: LINEA_MATERIALES });
          puestas.push(f.name);
        }
        return puestas.length ? nuevo : null;
      }, NOMBRE);
      for (const f of fichas) {
        if (puestas.includes(f.name) && f.price_unit !== 'pieza') {
          await prisma.products.update({ where: { id: f.id }, data: { price_unit: 'pieza', updated_at: new Date() } });
        }
        // El dato «Se vende por» que ve el cliente en la ficha: solo si sigue como venía («Pieza»).
        const specs = conPresentaciones(f.specs);
        if (specs) {
          await prisma.products.update({ where: { id: f.id }, data: { specs, updated_at: new Date() } });
          datos.push(f.name);
        }
      }
      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      this.log.log([
        puestas.length
          ? `Block: presentaciones por ${PRESENTACIONES.join(', ')} en ${puestas.join(', ')}, sin precio y ocultas hasta ponerlo.`
          : 'Block: su ficha ya tenía renglones; no se tocaron.',
        datos.length ? `«Se vende por» al día en ${datos.join(', ')}.` : '',
      ].filter(Boolean).join(' '));
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner las presentaciones del block: ${(e as Error).message}`);
      return false;
    }
  }
}
