import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { LINEA_TRANSPORTE } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { revalidarSitio } from '../common/revalidar-sitio';
import { QuoterService } from './quoter.service';

/**
 * «RETIRO» AHORA SE LLAMA «ACARREO» Y HAY ACARREO DE 30 m³ (2026-11-18, el
 * dueño: «dice retiro, poner: acarreo; vamos a agregar otro más: acarreo de
 * 30 m³»).
 *
 *  - Tabulador: «Retiro de material 14 m³» → «Acarreo de material 14 m³» (y el
 *    de 28 m³, apagado, igual). Mismo id, precio y zonas: los documentos ya
 *    emitidos no cambian.
 *  - Nuevo servicio «Acarreo de material 30 m³», por viaje y por zona, con las
 *    mismas condiciones: Zona 1 $7,500 y Zona 2 $9,500 (el dueño, mismo día).
 *  - Descripción para Google de Pipas y volteos: «retiros» → «acarreos».
 *  - Fichas del catálogo: «Retiro de material · volteo …» → «Acarreo de material
 *    · volteo …», y una ficha nueva para el de 30 m³.
 *  - Condiciones del acarreo: «retiro» → «acarreo» y «14 m³ o 28 m³» → «14 m³ o
 *    30 m³», solo donde sigue el texto de antes.
 * Corre UNA vez al arrancar (`tabulador_cambios`).
 */
const NOMBRE = 'acarreos-2026-11-18';
const NUEVO_30 = { id: 'acarreo_30', nombre: 'Acarreo de material 30 m³', zonas: { z1: 7500, z2: 9500 } };
const SEO_CLAVE = 'seo.landing.transport.description';
const SEO_ANTES = 'Agua en pipas de 10 y 20 m³ y retiros de material en volteo de 14 m³ en Monterrey y todo Nuevo León. Cotiza en línea por viaje.';
const SEO_NUEVO = 'Agua en pipas de 10 y 20 m³ y acarreos de material de 14 y 30 m³ en Monterrey y todo Nuevo León. Cotiza en línea por viaje.';

/** «Retiro de material…» → «Acarreo de material…» (solo al inicio). */
const aAcarreo = (s: string) => s.replace(/^Retiro de material/i, 'Acarreo de material');

@Injectable()
export class Acarreos20261118 implements OnApplicationBootstrap {
  private readonly log = new Logger('Acarreos20261118');

  constructor(private readonly quoter: QuoterService) {}

  onApplicationBootstrap(): void {
    // Después de la cal (75 s), que también reescribe el tabulador de maquinaria.
    setTimeout(() => void this.poner(), 85_000).unref();
  }

  async poner(): Promise<boolean> {
    try {
      const hechos = await leerAjuste<string[]>('tabulador_cambios', []);
      if (hechos.includes(NOMBRE)) return false;

      // 1) Fichas: renombrar las de retiro y crear la del de 30 m³.
      const linea = await prisma.categories.findFirst({ where: { cat_slug: LINEA_TRANSPORTE }, select: { id: true } });
      const ahora = new Date();
      let renombradas = 0;
      let ficha30: number | null = null;
      if (linea) {
        const fichas = await prisma.products.findMany({ where: { category_id: linea.id, provider_id: null }, select: { id: true, name: true } });
        for (const f of fichas) {
          if (/^Retiro de material/i.test(f.name)) {
            await prisma.products.update({ where: { id: f.id }, data: { name: aAcarreo(f.name), updated_at: ahora } });
            renombradas++;
          }
        }
        const ya30 = fichas.find((f) => /acarreo/i.test(f.name) && /\b30\s*m/i.test(f.name));
        ficha30 = ya30?.id ?? (await prisma.products.create({
          data: {
            user_id: 0,
            provider_id: null,
            category_id: linea.id,
            name: 'Acarreo de material · 30 m³',
            description: 'Acarreo de material de escombro en camión de 30 m³, por viaje a tiro libre.',
            cprice: 0,
            is_rental: false,
            price_unit: 'viaje',
            status: 1,
            created_at: ahora,
            updated_at: ahora,
          },
          select: { id: true },
        })).id;
      }

      // 2) Tabulador: renombrar, agregar el de 30 m³ y ajustar las condiciones.
      await this.quoter.migrarTabulador('maquinaria', async (cat) => {
        if (cat.tipo !== 'maquinaria') return null;
        // El de 30 m³ sin precio todavía (si ya estaba de antes) toma los de su zona.
        const servicios = cat.servicios
          .map((s) => (/^Retiro de material/i.test(s.nombre) ? { ...s, nombre: aAcarreo(s.nombre) } : s))
          .map((s) => (s.id === NUEVO_30.id && !s.precio && !s.precios_zona ? { ...s, precio: NUEVO_30.zonas.z1, presets: [NUEVO_30.zonas.z1], precios_zona: { ...NUEVO_30.zonas } } : s));
        const base = servicios.find((s) => s.id === 'retiro');
        if (!servicios.some((s) => s.id === NUEVO_30.id || (/acarreo/i.test(s.nombre) && /\b30\s*m/i.test(s.nombre)))) {
          servicios.push({
            id: NUEVO_30.id,
            nombre: NUEVO_30.nombre,
            icono: base?.icono ?? 'retiro',
            unidad: 'viaje',
            precio: NUEVO_30.zonas.z1,
            presets: [NUEVO_30.zonas.z1],
            precios_zona: { ...NUEVO_30.zonas },
            cond: 'retiro',
            linea: LINEA_TRANSPORTE,
            proveedor_id: null,
            productos: ficha30 ? [ficha30] : [],
          });
        }
        const cond = cat.condiciones.retiro;
        const condiciones = cond
          ? {
              ...cat.condiciones,
              retiro: {
                ...cond,
                titulo: cond.titulo.replace('Retiro de material de escombro', 'Acarreo de material de escombro'),
                puntos: cond.puntos.map((p) => p
                  .replace('pueden ser para camiones de 14 m³ o 28 m³', 'pueden ser para camiones de 14 m³ o 30 m³')
                  .replace('aplica para retiro de material de escombro', 'aplica para acarreo de material de escombro')),
              },
            }
          : cat.condiciones;
        return { ...cat, servicios, condiciones };
      }, NOMBRE);

      // 3) La descripción para Google de Pipas y volteos, si sigue la de antes.
      for (const th of await prisma.theme.findMany({ select: { id: true, copys: true, draftCopys: true } })) {
        const cambiar = (c: unknown) => {
          const es = (c as { es?: Record<string, string> } | null)?.es;
          return es && es[SEO_CLAVE] === SEO_ANTES ? { ...(c as object), es: { ...es, [SEO_CLAVE]: SEO_NUEVO } } : null;
        };
        const copys = cambiar(th.copys);
        const draftCopys = th.draftCopys === null ? null : cambiar(th.draftCopys);
        if (copys || draftCopys) {
          await prisma.theme.update({ where: { id: th.id }, data: { ...(copys ? { copys } : {}), ...(draftCopys ? { draftCopys } : {}) } });
        }
      }

      await guardarAjuste('tabulador_cambios', [...(await leerAjuste<string[]>('tabulador_cambios', [])), NOMBRE], 'arranque de la API');
      await revalidarSitio();
      this.log.log(`Acarreos: «Retiro» → «Acarreo» (${renombradas} ficha(s)) y nuevo «${NUEVO_30.nombre}» (Zona 1 ${NUEVO_30.zonas.z1}, Zona 2 ${NUEVO_30.zonas.z2}).`);
      return true;
    } catch (e) {
      this.log.warn(`No se pudieron poner los acarreos: ${(e as Error).message}`);
      return false;
    }
  }
}
