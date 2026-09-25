/**
 * CANDADO POR LLAVE, dentro del proceso (QA 2026-09-25).
 *
 * "Revisar si la máquina está libre" y "apartarla" son dos pasos. Si dos
 * solicitudes llegan a la vez (doble clic, o dos clientes por la misma
 * máquina) las dos ven la máquina libre y las dos la apartan. Esto hace que
 * las operaciones con una llave en común vayan una detrás de otra.
 *
 * Es de un solo proceso a propósito: la API corre como UNA instancia en
 * cPanel. Si algún día corre en varias, esto tiene que pasar a la base
 * (GET_LOCK de MySQL en una conexión dedicada, o una restricción única).
 */

const colas = new Map<string, Promise<unknown>>();

export async function conCandado<T>(llaves: string[], fn: () => Promise<T>): Promise<T> {
  // Orden fijo y sin repetidos: dos llamadas con las mismas llaves en otro
  // orden no se quedan esperándose la una a la otra.
  const unicas = [...new Set(llaves)].sort();
  const anteriores = unicas.map((k) => colas.get(k) ?? Promise.resolve());
  let soltar!: () => void;
  const mia = new Promise<void>((r) => { soltar = r; });
  for (const k of unicas) colas.set(k, mia);
  try {
    await Promise.all(anteriores.map((p) => p.catch(() => undefined)));
    return await fn();
  } finally {
    soltar();
    for (const k of unicas) if (colas.get(k) === mia) colas.delete(k);
  }
}
