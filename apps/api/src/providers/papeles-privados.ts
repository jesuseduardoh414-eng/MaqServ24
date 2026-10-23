import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { moverPapelAPrivado } from '../common/archivos-privados';

/**
 * LOS PAPELES QUE QUEDARON EN LA CARPETA PÚBLICA SE MUDAN SOLOS (auditoría 2026-10-23).
 *
 * Hasta hoy los papeles que subía el aliado (constancia fiscal, póliza, actas)
 * iban a `uploads/`, que media.maqser24.com sirve a cualquiera. Los nuevos ya
 * van a la carpeta privada; esto trae los de antes, para que nadie tenga que
 * hacerlo a mano en el servidor.
 *
 * Corre unos segundos DESPUÉS de arrancar (no retrasa que la API conteste), de
 * uno en uno, y nunca lanza. Es idempotente: lo que ya se movió no vuelve a
 * aparecer en la búsqueda, y si un archivo no está en disco se deja como está
 * (el panel dirá "El archivo ya no está").
 */
@Injectable()
export class PapelesPrivados implements OnApplicationBootstrap {
  private readonly log = new Logger(PapelesPrivados.name);

  onApplicationBootstrap(): void {
    setTimeout(() => void this.mover(), 15_000).unref();
  }

  async mover(): Promise<{ movidos: number; sinArchivo: number }> {
    let movidos = 0;
    let sinArchivo = 0;
    try {
      const docs = await prisma.provider_documents.findMany({
        where: { file: { startsWith: 'uploads/' } },
        select: { id: true, file: true },
      });
      for (const d of docs) {
        const nueva = d.file ? await moverPapelAPrivado(d.file) : null;
        if (!nueva) { sinArchivo++; continue; }
        await prisma.provider_documents.update({ where: { id: d.id }, data: { file: nueva } });
        movidos++;
      }
      if (movidos || sinArchivo) {
        this.log.log(`Papeles de aliados a la carpeta privada: ${movidos} movidos${sinArchivo ? `, ${sinArchivo} sin archivo en disco (se dejaron igual)` : ''}.`);
      }
    } catch (e) {
      this.log.warn(`No se pudieron mover los papeles a la carpeta privada: ${(e as Error).message}`);
    }
    return { movidos, sinArchivo };
  }
}
