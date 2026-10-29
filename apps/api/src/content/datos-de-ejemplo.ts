import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * FUERA LOS DATOS DE EJEMPLO Y LOS PRECIOS DEL SITIO (auditoría 2026-10-28).
 *
 * El tema que se guardó en la base al estrenar el sitio trae lo que venía en
 * la plantilla: tres sucursales que no existen (Tampico, Monterrey y
 * Guadalajara, con teléfonos inventados), "3 sucursales" y "+15 años" en
 * Contacto, y "MXN $ · ES" en la barra superior. Además la razón "Precio
 * comparable" y el apartado "Precios y pagos" de los términos, que hablan de
 * precios en un sitio que nunca los enseña.
 *
 * Arreglar el código no los quita: viven en la base. Esto los corrige al
 * arrancar, en local y en producción, sin SQL. Solo toca los valores EXACTOS
 * de la plantilla: lo que Dirección ya haya cambiado en el panel no se toca.
 * Como EquiposConTipo: corre unos segundos después de arrancar, nunca lanza y
 * es idempotente.
 */

const TELEFONOS_DE_EJEMPLO = new Set(['833 224 56 78', '81 1122 3344', '33 4455 6677']);
const CIFRAS_DE_EJEMPLO = new Set(['3|Sucursales', '+15 años|De experiencia']);
const LOCALE_DE_EJEMPLO = 'MXN $ · ES';
const SEO_SERVICIOS_VIEJO = 'Renta de maquinaria con operador, pipas y volteos, triturados, materiales y soluciones asfálticas. Elige la máquina, ve el precio y solicita en línea.';
export const SEO_SERVICIOS_NUEVO = 'Renta de maquinaria con operador, pipas y volteos, triturados, materiales y soluciones asfálticas. Elige lo que necesitas y te mandamos la cotización.';
const PRECIOS_VIEJO_INICIO = 'Los precios se muestran en pesos mexicanos (MXN).';
export const PRECIOS_Y_PAGOS =
  'Los precios no se publican en el Sitio: cada servicio se cotiza por escrito, en pesos mexicanos (MXN) y con la vigencia que indica la cotización. Salvo que se indique lo contrario, no incluyen IVA, el cual se agrega conforme a la legislación aplicable.\n\nLa forma y los plazos de pago se acuerdan en cada cotización. Nos reservamos el derecho de modificar precios en cualquier momento; los cambios no afectan cotizaciones ya aceptadas.';
const RAZON_VIEJA = 'Precio comparable';
export const RAZON_NUEVA = 'Opciones comparables';

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tokens del tema sin lo de ejemplo. Devuelve null si no había nada que quitar. */
function limpiarTokens(tokens: unknown): Obj | null {
  if (!esObj(tokens)) return null;
  let cambio = false;
  const t: Obj = { ...tokens };
  if (esObj(t.contact)) {
    const c: Obj = { ...t.contact };
    if (Array.isArray(c.branches)) {
      const quedan = c.branches.filter((b) => !(esObj(b) && TELEFONOS_DE_EJEMPLO.has(String(b.phone ?? '').trim())));
      if (quedan.length !== c.branches.length) { c.branches = quedan; cambio = true; }
    }
    if (Array.isArray(c.stats)) {
      const quedan = c.stats.filter((s) => !(esObj(s) && CIFRAS_DE_EJEMPLO.has(`${String(s.value ?? '').trim()}|${String(s.label ?? '').trim()}`)));
      if (quedan.length !== c.stats.length) { c.stats = quedan; cambio = true; }
    }
    t.contact = c;
  }
  if (esObj(t.legal) && esObj(t.legal.terms) && Array.isArray(t.legal.terms.sections)) {
    const sections = t.legal.terms.sections.map((s) => {
      if (esObj(s) && typeof s.body === 'string' && s.body.startsWith(PRECIOS_VIEJO_INICIO)) { cambio = true; return { ...s, body: PRECIOS_Y_PAGOS }; }
      return s;
    });
    t.legal = { ...t.legal, terms: { ...t.legal.terms, sections } };
  }
  return cambio ? t : null;
}

/** Textos del tema sin lo de ejemplo. Devuelve null si no había nada que quitar. */
function limpiarCopys(copys: unknown): Obj | null {
  if (!esObj(copys) || !esObj(copys.es)) return null;
  const es: Obj = { ...copys.es };
  let cambio = false;
  if (es['topbar.locale'] === LOCALE_DE_EJEMPLO) { es['topbar.locale'] = ''; cambio = true; }
  if (es['seo.services.description'] === SEO_SERVICIOS_VIEJO) { es['seo.services.description'] = SEO_SERVICIOS_NUEVO; cambio = true; }
  return cambio ? { ...copys, es } : null;
}

@Injectable()
export class DatosDeEjemplo implements OnApplicationBootstrap {
  private readonly log = new Logger(DatosDeEjemplo.name);

  onApplicationBootstrap(): void {
    setTimeout(() => void this.limpiar(), 12_000).unref();
  }

  async limpiar(): Promise<number> {
    let cambios = 0;
    try {
      const temas = await prisma.theme.findMany({ select: { id: true, tokens: true, copys: true, draftTokens: true, draftCopys: true } });
      for (const tema of temas) {
        const data: Prisma.ThemeUpdateInput = {};
        const tokens = limpiarTokens(tema.tokens);
        const copys = limpiarCopys(tema.copys);
        const draftTokens = tema.draftTokens !== null ? limpiarTokens(tema.draftTokens) : null;
        const draftCopys = tema.draftCopys !== null ? limpiarCopys(tema.draftCopys) : null;
        if (tokens) data.tokens = tokens as Prisma.InputJsonValue;
        if (copys) data.copys = copys as Prisma.InputJsonValue;
        if (draftTokens) data.draftTokens = draftTokens as Prisma.InputJsonValue;
        if (draftCopys) data.draftCopys = draftCopys as Prisma.InputJsonValue;
        if (Object.keys(data).length) {
          await prisma.theme.update({ where: { id: tema.id }, data });
          cambios++;
        }
      }
      const razones = await prisma.why_choose_us.updateMany({ where: { title: RAZON_VIEJA }, data: { title: RAZON_NUEVA, updated_at: new Date() } });
      cambios += razones.count;
      if (cambios) {
        this.log.log(`Datos de ejemplo y textos de precios corregidos: ${cambios}.`);
        await revalidarSitio().catch(() => undefined);
      }
    } catch (e) {
      this.log.warn(`No se pudieron corregir los datos de ejemplo: ${(e as Error).message}`);
    }
    return cambios;
  }
}
