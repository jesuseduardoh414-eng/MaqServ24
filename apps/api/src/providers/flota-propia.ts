import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { leerZonas, municipiosDe } from '../common/zonas';

/**
 * LA FLOTA PROPIA DE MAQSER24 (2026-11-12).
 *
 * El dueño: "MAQSER24 opera solo; los proveedores son solo una opción para el
 * administrador", y MAQSER24 tiene flota propia (no es PUCSA). Todo lo que ya
 * funciona con un equipo —apartarlo en Disponibilidad, «¿qué unidad va?», el
 * enlace del operador, el rastreo, el cierre— cuelga de un proveedor que
 * aceptó el servicio. En vez de duplicar todo eso sin proveedor, la flota de
 * MAQSER24 es UN PROVEEDOR INTERNO, «MAQSER24 · flota propia»: sus máquinas
 * son las de MAQSER24, sus operadores los de MAQSER24, y nunca sale en la
 * libreta de proveedores, no recibe correos ni portal, y al cerrar no se le
 * paga nada (la cuenta lo trata como trabajo propio).
 *
 * Se identifica por `platform_settings.proveedor_propio` (su id) y se crea solo
 * al arrancar si no existe.
 */

const CLAVE = 'proveedor_propio';
const CLAVE_OPERADORES = 'operadores_propios';
export const NOMBRE_FLOTA_PROPIA = 'MAQSER24 · flota propia';

let cache: { id: number | null; hasta: number } | null = null;

/** El id del proveedor interno de la flota propia, o null si todavía no existe. */
export async function proveedorPropioId(): Promise<number | null> {
  if (cache && cache.hasta > Date.now()) return cache.id;
  const id = await leerAjuste<number | null>(CLAVE, null);
  let valido: number | null = null;
  if (typeof id === 'number' && id > 0) {
    const p = await prisma.providers.findUnique({ where: { id }, select: { id: true } });
    valido = p ? id : null;
  }
  cache = { id: valido, hasta: Date.now() + 60_000 };
  return valido;
}

/** ¿Es la flota propia de MAQSER24? */
export async function esFlotaPropia(providerId: number | bigint | null | undefined): Promise<boolean> {
  if (providerId == null) return false;
  const id = await proveedorPropioId();
  return id != null && Number(providerId) === id;
}

/** Crea el proveedor interno si no existe (idempotente). Devuelve su id. */
export async function asegurarFlotaPropia(): Promise<number> {
  const ya = await proveedorPropioId();
  if (ya) return ya;
  // Llega a donde llega MAQSER24: los municipios de sus zonas (sitio e internas).
  const cobertura = municipiosDe(await leerZonas(), ['sitio', 'interna']);
  const slug = 'maqser24-flota-propia';
  const existente = await prisma.providers.findUnique({ where: { slug }, select: { id: true } });
  const id = existente?.id ?? (await prisma.providers.create({
    data: {
      name: NOMBRE_FLOTA_PROPIA,
      slug,
      level: 'registrado',
      status: 1,
      city: 'Monterrey',
      state: 'Nuevo León',
      coverage: cobertura,
      categories: [],
      notes: 'Proveedor interno: la flota y los operadores de MAQSER24. No sale en la libreta de proveedores.',
    },
    select: { id: true },
  })).id;
  await guardarAjuste(CLAVE, id, 'arranque de la API');
  cache = { id, hasta: Date.now() + 60_000 };
  return id;
}

/** Un operador de MAQSER24: nombre y teléfono (el que recibe el enlace del operador). */
export const operadorPropioSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del operador.').max(120),
  telefono: z.string().trim().max(30).optional().default(''),
});
export type OperadorPropio = z.infer<typeof operadorPropioSchema>;

export async function operadoresPropios(): Promise<OperadorPropio[]> {
  const v = await leerAjuste<unknown>(CLAVE_OPERADORES, []);
  const r = z.array(operadorPropioSchema).safeParse(v);
  return r.success ? r.data : [];
}

export async function guardarOperadoresPropios(lista: OperadorPropio[], por: string): Promise<OperadorPropio[]> {
  // Sin repetidos (mismo nombre), en el orden en que se escribieron.
  const vistos = new Set<string>();
  const limpia = lista.filter((o) => {
    const k = o.nombre.trim().toLowerCase();
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, 200);
  await guardarAjuste(CLAVE_OPERADORES, limpia, por);
  return limpia;
}

/** Al asignar con la flota propia y escribir un operador nuevo, se queda en la lista. */
export async function recordarOperadorPropio(o: OperadorPropio, por: string): Promise<void> {
  const lista = await operadoresPropios();
  const k = o.nombre.trim().toLowerCase();
  const i = lista.findIndex((x) => x.nombre.trim().toLowerCase() === k);
  if (i >= 0) {
    if (o.telefono && lista[i].telefono !== o.telefono) {
      lista[i] = { ...lista[i], telefono: o.telefono };
      await guardarOperadoresPropios(lista, por);
    }
    return;
  }
  await guardarOperadoresPropios([...lista, o], por);
}

/** Al arrancar: que exista la flota propia (15 s después, sin frenar el arranque). */
@Injectable()
export class FlotaPropia implements OnApplicationBootstrap {
  private readonly log = new Logger('FlotaPropia');

  onApplicationBootstrap(): void {
    setTimeout(() => {
      asegurarFlotaPropia()
        .then((id) => this.log.log(`Flota propia de MAQSER24: proveedor interno #${id}.`))
        .catch((e) => this.log.warn(`No se pudo preparar la flota propia: ${(e as Error).message}`));
    }, 15_000).unref();
  }
}
