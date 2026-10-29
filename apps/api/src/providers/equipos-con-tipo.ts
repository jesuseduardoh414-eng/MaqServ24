import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { ESTADO_POR_REVISAR } from '../catalog/ofertas';

/**
 * LO QUE YA TENÍA TIPO CUENTA SOLO (revisión de Proveedores, 2026-10-28).
 *
 * Se quitó "Publicar": la máquina de un aliado no sale en el sitio, y si es de
 * un tipo de la lista le llegan las solicitudes de ese tipo sin que nadie la
 * revise. Las que se ofrecieron antes desde el portal con tipo se quedaron
 * esperando ese botón; esto las da de alta. Lo que no tiene tipo sigue
 * "Nuevo" y se decide en Inventario.
 *
 * Como PapelesPrivados: corre unos segundos después de arrancar, nunca lanza y
 * es idempotente (lo que ya se dio de alta no vuelve a aparecer).
 */
@Injectable()
export class EquiposConTipo implements OnApplicationBootstrap {
  private readonly log = new Logger(EquiposConTipo.name);

  onApplicationBootstrap(): void {
    setTimeout(() => void this.darDeAlta(), 10_000).unref();
  }

  async darDeAlta(): Promise<number> {
    try {
      const ahora = new Date();
      const r = await prisma.products.updateMany({
        where: { status: ESTADO_POR_REVISAR, provider_id: { not: null }, tipo_id: { not: null } },
        data: { status: 1, availability_confirmed_at: ahora, updated_at: ahora },
      });
      if (r.count) this.log.log(`Equipos de aliados con tipo que esperaban «Publicar»: ${r.count} dados de alta.`);
      return r.count;
    } catch (e) {
      this.log.warn(`No se pudieron dar de alta los equipos con tipo: ${(e as Error).message}`);
      return 0;
    }
  }
}
