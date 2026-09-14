/**
 * Listas guardadas como JSON.
 *
 * En Postgres, `providers.coverage`, `providers.categories`,
 * `client_sites.requirements` y `service_incidents.evidence` eran `text[]`.
 * MySQL no tiene arreglos, así que son columnas JSON y Prisma las tipa como
 * `JsonValue` (cualquier cosa). Esto las devuelve como lo que siempre fueron:
 * un arreglo de cadenas, y vacío si la columna trae null o basura.
 */
export function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}
