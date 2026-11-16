import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * «¿POR QUÉ MAQSER24?» (2026-11-16, el dueño mandó el diseño con sus textos:
 * «cambia el diseño de esa parte, por el de la imagen»). La sección
 * «Posicionamiento · No somos una rentadora digital» del inicio pasa a:
 *
 *   ¿Por qué MAQSER24? / Tu obra necesita soluciones, no más llamadas. /
 *   cuatro razones nuevas / Red y MTY con su texto nuevo / una frase al pie.
 *
 * Los textos viven en el tema (copys) y las razones en `why_choose_us`, así que
 * cambiar el código no basta: se ponen al arrancar, UNA vez (marca en
 * `contenido_cambios`). Solo se reemplaza lo que sigue igual a lo de antes: lo
 * que el dueño ya haya cambiado en el panel se respeta. Las cuatro razones de
 * antes también salen en «Quiénes somos»: ahí se quedan (pasan a «solo Quiénes
 * somos») y las nuevas van solo al inicio.
 */
const NOMBRE = 'por-que-maqser-2026-11-16';
const AJUSTE = 'contenido_cambios';

/** clave → [lo de antes (o null si no existía), lo nuevo] */
export const TEXTOS_POR_QUE: Record<string, [string | null, string]> = {
  'home.whyChooseUs.eyebrow': ['Posicionamiento', '¿Por qué MAQSER24?'],
  'home.whyChooseUs.title': ['No somos una rentadora digital.', 'Tu obra necesita soluciones, no más llamadas.'],
  'home.whyChooseUs.subtitle': [
    'Somos la infraestructura digital que conecta maquinaria y servicios de construcción con proyectos que necesitan respuesta rápida, trazabilidad y confianza.',
    'Conectamos maquinaria, materiales y servicios de construcción en un solo lugar, para ayudarte a resolver tu proyecto con rapidez, claridad y seguimiento.',
  ],
  'home.whyChooseUs.stat1.label': ['Capacidad propia y de aliados', 'Capacidad propia y proveedores aliados'],
  'home.whyChooseUs.stat2.label': ['Monterrey y zona metro', 'Monterrey y zona metropolitana'],
  'home.whyChooseUs.tagline': [null, 'Conectamos la capacidad que mueve la construcción.'],
};

const RAZONES_VIEJAS = ['Información clara', 'Opciones comparables', 'Operación trazable', 'Un solo proceso'];
export const RAZONES_NUEVAS: Array<{ title: string; description: string }> = [
  { title: 'Todo en un solo lugar', description: 'Solicita maquinaria, pipas, volteos, triturados y otros servicios desde un mismo punto de contacto.' },
  { title: 'Cotizaciones claras y ágiles', description: 'Recibe información más clara sobre el servicio, condiciones y costos aplicables para tomar mejores decisiones.' },
  { title: 'Más alternativas para tu proyecto', description: 'Buscamos opciones dentro de nuestra red de capacidad propia y proveedores aliados, sujetas a disponibilidad.' },
  { title: 'Atención y seguimiento', description: 'Te acompañamos desde la solicitud hasta la coordinación del servicio con comunicación más ordenada.' },
];

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Copys con los textos nuevos donde seguían los de antes; null si no cambió nada. */
function conTextosNuevos(copys: unknown): Obj | null {
  if (!esObj(copys)) return null;
  const es: Obj = esObj(copys.es) ? { ...copys.es } : {};
  let cambio = false;
  for (const [clave, [antes, nuevo]] of Object.entries(TEXTOS_POR_QUE)) {
    const actual = es[clave];
    const sigueIgual = actual === undefined || (typeof actual === 'string' && (antes === null ? actual.trim() === '' : actual.trim() === antes));
    if (sigueIgual && actual !== nuevo) { es[clave] = nuevo; cambio = true; }
  }
  return cambio ? { ...copys, es } : null;
}

@Injectable()
export class PorQueMaqser20261116 implements OnApplicationBootstrap {
  private readonly log = new Logger('PorQueMaqser20261116');

  onApplicationBootstrap(): void {
    // Después de los textos de los sectores (30 s): no se pisan la marca.
    setTimeout(() => void this.poner(), 38_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>(AJUSTE, []);
      if (Array.isArray(hechos) && hechos.includes(NOMBRE)) return false;

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

      // Las de antes se quedan en «Quiénes somos»; las nuevas, solo en el inicio.
      const movidas = await prisma.why_choose_us.updateMany({
        where: { title: { in: RAZONES_VIEJAS }, OR: [{ placement: 'both' }, { placement: null }, { placement: 'home' }] },
        data: { placement: 'about', updated_at: new Date() },
      });
      let nuevas = 0;
      for (const [i, r] of RAZONES_NUEVAS.entries()) {
        const ya = await prisma.why_choose_us.findFirst({ where: { title: r.title }, select: { id: true } });
        if (ya) continue;
        await prisma.why_choose_us.create({
          data: { title: r.title, description: r.description, order: i + 1, status: true, placement: 'home', created_at: new Date(), updated_at: new Date() },
        });
        nuevas++;
      }

      const ahora = await leerAjuste<string[]>(AJUSTE, []);
      await guardarAjuste(AJUSTE, [...(Array.isArray(ahora) ? ahora : []), NOMBRE], 'arranque de la API');
      if (temas || movidas.count || nuevas) await revalidarSitio();
      this.log.log(`¿Por qué MAQSER24?: textos en ${temas} tema(s), ${movidas.count} razón(es) a Quiénes somos, ${nuevas} razón(es) nueva(s) en el inicio.`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudo poner «¿Por qué MAQSER24?»: ${(e as Error).message}`);
      return false;
    }
  }
}
