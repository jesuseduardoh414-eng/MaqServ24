import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { LINEA_MATERIALES } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * SIN CONCRETO PREMEZCLADO EN LOS TEXTOS DEL SITIO (2026-11-20, el dueño:
 * «en esta descripción eliminar: concreto premezclado»; y luego, de los otros
 * dos lugares: «sí, quítalos»).
 *
 * Tres textos guardados en la base:
 *  1. «A qué nos dedicamos» (`inf_sitio`, Quiénes somos; puesto el 16-nov):
 *     «…servicios de volteo, concreto premezclado, carpeta asfáltica…» →
 *     «…servicios de volteo, carpeta asfáltica…».
 *  2. El texto de arriba de Servicios (copy `catalog.services.intro` del tema,
 *     publicado y borrador; puesto el 18-nov, también sale en el inicio):
 *     «…suministro de triturados, block y concreto premezclado, entrega…» →
 *     «…suministro de triturados y block, entrega…».
 *  3. La descripción de la categoría Materiales para construcción (tarjeta del
 *     inicio): «Concreto premezclado, acero de refuerzo, block y cemento» →
 *     «Acero de refuerzo, block y cemento».
 * Solo se quita la frase; lo demás que tenga cada texto se respeta. Corre UNA
 * vez al arrancar (marca en `contenido_cambios`).
 */
const NOMBRE = 'sin-concreto-2026-11-20';
const AJUSTE = 'contenido_cambios';
const CLAVE_INTRO = 'catalog.services.intro';
const MENCIONA = /concreto premezclado/i;

/** Quita «concreto premezclado» y su coma o su «y», esté al principio, en medio o al final de la lista. */
export function sinConcreto(texto: string): string {
  return texto
    .replace(/triturados, block y concreto premezclado/gi, 'triturados y block')
    .replace(/,\s*concreto premezclado(?=\s*[,<]|\s+y\s|\s*$)/gi, '')
    .replace(/^((?:\s*<[^>]+>)*\s*)concreto premezclado\s*,\s*(\S)/i, (_m, antes: string, letra: string) => antes + letra.toUpperCase())
    .replace(/concreto premezclado\s*,\s*/gi, '')
    .replace(/\s+y\s+concreto premezclado/gi, '');
}

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Los copys con el intro de Servicios ya sin concreto, o null si no hay nada que cambiar. */
function copysSinConcreto(copys: unknown): Obj | null {
  if (!esObj(copys) || !esObj(copys.es)) return null;
  const intro = copys.es[CLAVE_INTRO];
  if (typeof intro !== 'string' || !MENCIONA.test(intro)) return null;
  const nuevo = sinConcreto(intro);
  return nuevo === intro ? null : { ...copys, es: { ...copys.es, [CLAVE_INTRO]: nuevo } };
}

@Injectable()
export class SinConcreto20261120 implements OnApplicationBootstrap {
  private readonly log = new Logger('SinConcreto20261120');

  onApplicationBootstrap(): void {
    // Después de los otros textos (30 a 70 s): no se pisan la marca.
    setTimeout(() => void this.quitar(), 78_000).unref();
  }

  async quitar(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;
      const cambios: string[] = [];

      // 1) A qué nos dedicamos
      const r = await prisma.inf_sitio.findFirst({ orderBy: { id: 'desc' } });
      if (r?.descripcion && MENCIONA.test(r.descripcion)) {
        const nuevo = sinConcreto(r.descripcion);
        if (nuevo !== r.descripcion) {
          await prisma.inf_sitio.update({ where: { id: r.id }, data: { descripcion: nuevo, updated_at: new Date() } });
          cambios.push('A qué nos dedicamos');
        }
      }

      // 2) Texto de Servicios (tema publicado y borrador)
      for (const th of await prisma.theme.findMany({ select: { id: true, copys: true, draftCopys: true } })) {
        const copys = copysSinConcreto(th.copys);
        const draftCopys = copysSinConcreto(th.draftCopys);
        if (!copys && !draftCopys) continue;
        await prisma.theme.update({
          where: { id: th.id },
          data: {
            ...(copys ? { copys: copys as Prisma.InputJsonValue } : {}),
            ...(draftCopys ? { draftCopys: draftCopys as Prisma.InputJsonValue } : {}),
          },
        });
        cambios.push('texto de Servicios');
      }

      // 3) Categoría Materiales para construcción
      const cat = await prisma.categories.findFirst({ where: { cat_slug: LINEA_MATERIALES }, select: { id: true, description: true } });
      if (cat?.description && MENCIONA.test(cat.description)) {
        const nuevo = sinConcreto(cat.description);
        if (nuevo !== cat.description) {
          await prisma.categories.update({ where: { id: cat.id }, data: { description: nuevo } });
          cambios.push('categoría Materiales para construcción');
        }
      }

      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (cambios.length) await revalidarSitio();
      this.log.log(cambios.length ? `Sin concreto premezclado: ${cambios.join(', ')}.` : 'Ningún texto mencionaba el concreto premezclado: no se tocó nada.');
      return true;
    } catch (e) {
      this.log.warn(`No se pudo quitar el concreto premezclado de los textos: ${(e as Error).message}`);
      return false;
    }
  }
}
