import { Prisma, prisma } from '@maqserv/db';

/**
 * AJUSTES DE PLATAFORMA (tabla `platform_settings`, ver sql/catalogo-guiado.sql).
 *
 * Valores que no son diseño (no van en el tema, que es público) ni secretos
 * (no van en variables de entorno, que exigen tocar cPanel). El primero es el
 * margen de MAQSER24 sobre el costo del aliado.
 *
 * Con caché corta: se leen en cada recomendación del cotizador y no cambian
 * más que cuando alguien los edita en el panel.
 */

export const AJUSTE_MARGEN = 'margen_aliado_pct';
export const MARGEN_DEFAULT = 20;

const cache = new Map<string, { until: number; value: unknown }>();
const TTL_MS = 30_000;

export async function leerAjuste<T>(key: string, porDefecto: T): Promise<T> {
  const c = cache.get(key);
  if (c && c.until > Date.now()) return c.value as T;
  try {
    const row = await prisma.platform_settings.findUnique({ where: { key } });
    const value = (row ? (row.value as T) : porDefecto) ?? porDefecto;
    cache.set(key, { until: Date.now() + TTL_MS, value });
    return value;
  } catch {
    // Sin la tabla (SQL aún no corrido en producción) la plataforma sigue con el default.
    return porDefecto;
  }
}

export async function guardarAjuste(key: string, value: unknown, por: string): Promise<void> {
  await prisma.platform_settings.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, updated_by: por.slice(0, 190) },
    update: { value: value as Prisma.InputJsonValue, updated_by: por.slice(0, 190), updated_at: new Date() },
  });
  cache.delete(key);
}

/** El margen vigente, en %. */
export async function margenAliadoPct(): Promise<number> {
  const v = await leerAjuste<unknown>(AJUSTE_MARGEN, MARGEN_DEFAULT);
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : MARGEN_DEFAULT;
}
