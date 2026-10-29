import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { ZONAS_PRECIO, type CatalogoCotizador } from '@maqserv/config';
import { QuoterService } from './quoter.service';

/**
 * EL AGUA Y EL RETIRO DE MATERIAL SE COBRAN POR ZONA (2026-10-29).
 *
 * "Los servicios de agua ahora se manejan por zonas" y, el mismo día, "retiro
 * de material, son las mismas zonas": dos zonas con sus municipios (Guadalupe
 * en la 2 y Santiago completo también, por la Carretera Nacional) y un precio
 * por viaje en cada una. En los demás municipios no se ofrecen. El retiro de
 * 28 m³ "no va a estar disponible hasta nuevo aviso": se apaga su ficha, así
 * no se elige ni en el cotizador ni en el catálogo, y conserva su precio para
 * cuando vuelva (se reactiva en Inventario).
 *
 * Como CobroPorHora: el tabulador vive en la base de cada servidor y esto lo
 * pone al día solo al arrancar la API, una sola vez (la marca es que el
 * tabulador no tenga zonas). Después, las zonas se editan en Tarifas y los
 * precios en la ficha de cada servicio.
 */
const PRECIOS: Record<string, { z1: number; z2: number }> = {
  pipa: { z1: 3000, z2: 4500 }, // Pipa de agua 10 m³
  agua: { z1: 5000, z2: 6500 }, // Pipa de agua 20 m³
  retiro: { z1: 4500, z2: 5500 }, // Retiro de material 14 m³
};

/** Sin servicio hasta nuevo aviso: se apaga la ficha de su tipo. */
const APAGADOS = ['retiro_28'];

@Injectable()
export class ServiciosPorZona implements OnApplicationBootstrap {
  private readonly log = new Logger(ServiciosPorZona.name);

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de CobroPorHora (8 s): las dos escriben el mismo tabulador, bajo el mismo candado.
    setTimeout(() => void this.poner(), 12_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      let fichasApagadas = 0;
      const hecho = await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria' || cat.zonas_precio !== undefined) return null;
        const servicios = cat.servicios.map((s) => {
          const p = PRECIOS[s.id];
          return p ? { ...s, precio: p.z1, presets: [p.z1], precios_zona: { z1: p.z1, z2: p.z2 } } : s;
        });
        const fichas = cat.servicios.filter((s) => APAGADOS.includes(s.id)).flatMap((s) => s.productos ?? []);
        if (fichas.length) {
          const r = await prisma.products.updateMany({
            where: { id: { in: fichas }, provider_id: null, status: 1 },
            data: { status: 0, updated_at: new Date() },
          });
          fichasApagadas = r.count;
        }
        return { ...cat, zonas_precio: ZONAS_PRECIO, servicios } as CatalogoCotizador;
      }, 'servicios por zona 2026-10-29');
      if (hecho) {
        this.log.log(`Maquinaria: el agua y el retiro de 14 m³ se cobran por zona (Zona 1 y Zona 2); retiro de 28 m³ apagado (${fichasApagadas} ficha${fichasApagadas === 1 ? '' : 's'}).`);
      }
      return hecho;
    } catch (e) {
      this.log.warn(`No se pudieron poner los servicios por zona: ${(e as Error).message}`);
      return false;
    }
  }
}
