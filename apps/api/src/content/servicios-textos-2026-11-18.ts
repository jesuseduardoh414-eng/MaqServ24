import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * TEXTOS NUEVOS DE LA PÁGINA SERVICIOS (2026-11-18, el dueño mandó la imagen:
 * «cambiar el contenido de esa parte, por la nueva»).
 *
 *  - Título del banner: «Todo el equipo, en un solo lugar» → «Maquinaria,
 *    materiales y servicios para tu obra» (tema: tokens.catalog.banner.title).
 *  - Texto bajo «Servicios»: copy nuevo `catalog.services.intro`, con dos
 *    párrafos. Antes ahí salía la descripción para Google, que se queda corta.
 *
 * Se pone al arrancar, UNA vez (marca en `contenido_cambios`), y solo donde
 * sigue lo de antes: lo que el dueño ya haya cambiado en el panel se respeta.
 */
const NOMBRE = 'servicios-textos-2026-11-18';
const AJUSTE = 'contenido_cambios';

const TITULO_ANTES = 'Todo el equipo, en un solo lugar';
export const TITULO_NUEVO = 'Maquinaria, materiales y servicios para tu obra';
export const INTRO_NUEVA =
  'Con MAQSER24 puedes cotizar la renta de maquinaria pesada con operador y consultar equipos en venta. También puedes solicitar suministro de triturados y block, entrega de agua en pipas, acarreos en volteos y tolvas, suministro y aplicación de carpeta asfáltica y riego de impregnación.\n\n' +
  'Atendemos obras en Monterrey y su área metropolitana.';

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const normal = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

/** Tokens con el título nuevo del banner, o null si no hay nada que cambiar. */
function conTitulo(tokens: unknown): Obj | null {
  if (!esObj(tokens) || !esObj(tokens.catalog) || !esObj(tokens.catalog.banner)) return null;
  const banner = tokens.catalog.banner;
  if (normal(banner.title) !== TITULO_ANTES) return null;
  return { ...tokens, catalog: { ...tokens.catalog, banner: { ...banner, title: TITULO_NUEVO } } };
}

/** Copys con el texto nuevo, o null si ya tiene uno (el del dueño o este). */
function conIntro(copys: unknown): Obj | null {
  if (!esObj(copys)) return null;
  const es: Obj = esObj(copys.es) ? copys.es : {};
  if (typeof es['catalog.services.intro'] === 'string') return null;
  return { ...copys, es: { ...es, 'catalog.services.intro': INTRO_NUEVA } };
}

@Injectable()
export class ServiciosTextos20261118 implements OnApplicationBootstrap {
  private readonly log = new Logger('ServiciosTextos20261118');

  onApplicationBootstrap(): void {
    // Después de los otros cambios de arranque (hasta 62 s): no se pisan la marca.
    setTimeout(() => void this.poner(), 70_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;

      let temas = 0;
      for (const th of await prisma.theme.findMany({ select: { id: true, tokens: true, draftTokens: true, copys: true, draftCopys: true } })) {
        const tokens = conTitulo(th.tokens);
        const draftTokens = th.draftTokens === null ? null : conTitulo(th.draftTokens);
        const copys = conIntro(th.copys);
        const draftCopys = th.draftCopys === null ? null : conIntro(th.draftCopys);
        if (!tokens && !draftTokens && !copys && !draftCopys) continue;
        await prisma.theme.update({
          where: { id: th.id },
          data: {
            ...(tokens ? { tokens: tokens as Prisma.InputJsonValue } : {}),
            ...(draftTokens ? { draftTokens: draftTokens as Prisma.InputJsonValue } : {}),
            ...(copys ? { copys: copys as Prisma.InputJsonValue } : {}),
            ...(draftCopys ? { draftCopys: draftCopys as Prisma.InputJsonValue } : {}),
          },
        });
        temas++;
      }

      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (temas) await revalidarSitio();
      this.log.log(`Servicios: textos nuevos en ${temas} tema(s).`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los textos de Servicios: ${(e as Error).message}`);
      return false;
    }
  }
}
