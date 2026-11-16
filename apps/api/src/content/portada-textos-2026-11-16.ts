import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * TEXTOS NUEVOS DE LA PORTADA (2026-11-16, el dueño mandó la imagen: «ese
 * texto se va cambiar, por la imagen, lo demás se queda igual»).
 *
 *   Encuentra lo que tu / obra necesita.  (la segunda parte en azul)
 *   En **MAQSER24** conectamos tu obra con: … / A través de nuestra capacidad…
 *   ▌ Una sola plataforma. Más soluciones para tu construcción.
 *
 * El título y el texto viven en `hero_sections`; la parte azul, los textos de
 * respaldo y la frase con barra, en el tema. Se ponen al arrancar, UNA vez
 * (marca en `contenido_cambios`), y solo donde sigue el texto de antes: lo que
 * el dueño ya haya cambiado en Diseño › Hero se respeta. `**…**` va en
 * negritas (ver `conNegritas` en el sitio).
 */
const NOMBRE = 'portada-textos-2026-11-16';
const AJUSTE = 'contenido_cambios';

const TITULO_ANTES = 'Encuentra maquinaria disponible para tu obra';
export const TITULO_NUEVO = 'Encuentra lo que tu obra necesita.';
const TEXTO_ANTES_INICIO = 'En MAQSER24 conectamos tu obra con renta de maquinaria pesada';
export const TEXTO_NUEVO =
  'En **MAQSER24** conectamos tu obra con: renta y venta de maquinaria pesada, suministro de agua en pipas, acarreos en camiones de volteo, materiales triturados (arena, grava, base hidráulica y CNC), venta de block y servicios de pavimentación asfáltica.\n\n' +
  'A través de nuestra capacidad propia y una red de proveedores aliados, te ayudamos a encontrar soluciones para tu proyecto en Monterrey y su área metropolitana.';
export const LEMA_NUEVO = 'Una sola plataforma. Más soluciones para tu construcción.';

const normal = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** clave → [cómo se reconoce lo de antes, lo nuevo] */
const COPYS: Array<[string, (v: string) => boolean, string]> = [
  ['home.hero.title', (v) => v === 'Encuentra maquinaria', 'Encuentra lo que tu'],
  ['home.hero.titleAccent', (v) => v === 'disponible para tu obra', 'obra necesita.'],
  ['home.hero.subtitle', (v) => v.startsWith(TEXTO_ANTES_INICIO), TEXTO_NUEVO],
  ['home.hero.tagline', (v) => v === '', LEMA_NUEVO],
];

function conTextosNuevos(copys: unknown): Obj | null {
  if (!esObj(copys)) return null;
  const es: Obj = esObj(copys.es) ? { ...copys.es } : {};
  let cambio = false;
  for (const [clave, esLoDeAntes, nuevo] of COPYS) {
    const actual = es[clave];
    const v = typeof actual === 'string' ? normal(actual) : '';
    if ((actual === undefined || (typeof actual === 'string' && esLoDeAntes(v))) && actual !== nuevo) { es[clave] = nuevo; cambio = true; }
  }
  return cambio ? { ...copys, es } : null;
}

@Injectable()
export class PortadaTextos20261116 implements OnApplicationBootstrap {
  private readonly log = new Logger('PortadaTextos20261116');

  onApplicationBootstrap(): void {
    // Después de los otros cambios del 16 (30, 38 y 46 s): no se pisan la marca.
    setTimeout(() => void this.poner(), 54_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;

      let hero = 0;
      const h = await prisma.hero_sections.findFirst({ orderBy: { id: 'desc' } });
      if (h) {
        const data: { title?: string; subtitle?: string; updated_at?: Date } = {};
        if (normal(h.title) === TITULO_ANTES) data.title = TITULO_NUEVO;
        if (normal(h.subtitle).startsWith(TEXTO_ANTES_INICIO)) data.subtitle = TEXTO_NUEVO;
        if (data.title || data.subtitle) {
          await prisma.hero_sections.update({ where: { id: h.id }, data: { ...data, updated_at: new Date() } });
          hero = 1;
        }
      }

      let temas = 0;
      for (const th of await prisma.theme.findMany({ select: { id: true, copys: true, draftCopys: true } })) {
        const copys = conTextosNuevos(th.copys);
        const draft = th.draftCopys === null ? null : conTextosNuevos(th.draftCopys);
        if (!copys && !draft) continue;
        await prisma.theme.update({
          where: { id: th.id },
          data: {
            ...(copys ? { copys: copys as Prisma.InputJsonValue } : {}),
            ...(draft ? { draftCopys: draft as Prisma.InputJsonValue } : {}),
          },
        });
        temas++;
      }

      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (hero || temas) await revalidarSitio();
      this.log.log(`Portada: textos nuevos ${hero ? 'en el hero' : '(el hero ya tenía otro texto)'} y en ${temas} tema(s).`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los textos de la portada: ${(e as Error).message}`);
      return false;
    }
  }
}
