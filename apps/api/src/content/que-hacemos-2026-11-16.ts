import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * TEXTO NUEVO DE «A QUÉ NOS DEDICAMOS» (2026-11-16, el dueño mandó la imagen:
 * «actualizar la información de a qué nos dedicamos»). Vive en `inf_sitio`
 * (Quiénes somos), que admite HTML: tres párrafos con negritas, como la imagen.
 *
 * Se pone al arrancar, UNA vez (marca en `contenido_cambios`), y solo si sigue
 * el texto de antes: si el dueño ya lo cambió en el panel (Diseño › Quiénes
 * somos › Página completa), se respeta.
 */
const NOMBRE = 'que-hacemos-2026-11-16';
const AJUSTE = 'contenido_cambios';

const ANTES_INICIO = 'Nos especializamos en la renta de maquinaria pesada';
export const DESCRIPCION_NUEVA =
  '<p>En <strong>MAQSER24</strong> somos una plataforma digital que <strong>conecta maquinaria, materiales y servicios</strong> para la construcción, urbanización, movimiento de tierras e infraestructura.</p>' +
  '<p>Facilitamos la <strong>renta y venta de maquinaria pesada</strong>, el <strong>suministro de materiales triturados, agua en pipas, servicios de volteo, concreto premezclado, carpeta asfáltica</strong> y <strong>venta de block</strong>, con equipos confiables, proveedores verificados y atención especializada.</p>' +
  '<p>Nuestro compromiso es ofrecer <strong>soluciones integrales, ágiles y seguras</strong> que mantengan tus proyectos en movimiento, desde un solo lugar.</p>';

/** Texto plano (sin etiquetas ni espacios de más) para reconocer el de antes. */
const plano = (s: string | null | undefined) => (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

@Injectable()
export class QueHacemos20261116 implements OnApplicationBootstrap {
  private readonly log = new Logger('QueHacemos20261116');

  onApplicationBootstrap(): void {
    // Después de los otros cambios del 16 (30, 38, 46 y 54 s): no se pisan la marca.
    setTimeout(() => void this.poner(), 62_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;

      const r = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
      let cambiado = false;
      if (r && plano(r.descripcion).startsWith(ANTES_INICIO)) {
        await prisma.inf_sitio.update({ where: { id: r.id }, data: { descripcion: DESCRIPCION_NUEVA, updated_at: new Date() } });
        cambiado = true;
      }

      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (cambiado) await revalidarSitio();
      this.log.log(cambiado ? '«A qué nos dedicamos»: texto nuevo puesto.' : '«A qué nos dedicamos» ya tenía otro texto: no se tocó.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudo poner el texto de «A qué nos dedicamos»: ${(e as Error).message}`);
      return false;
    }
  }
}
