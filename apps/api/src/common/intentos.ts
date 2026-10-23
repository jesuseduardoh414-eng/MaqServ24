/**
 * FRENO POR CUENTA en los inicios de sesión (auditoría 2026-10-23).
 *
 * El `@Throttle` del login cuenta por IP: frena a quien prueba desde una sola
 * máquina, pero no a quien reparte las pruebas entre cientos de IPs contra el
 * MISMO correo (contraseñas filtradas de otros sitios). Esto cuenta los fallos
 * por correo: tras MAXIMO fallos en la ventana, ese correo deja de aceptar
 * intentos hasta que la ventana pase.
 *
 * Se cuenta también para correos que NO existen, a propósito: si solo se
 * bloquearan los que existen, el bloqueo diría qué correos tienen cuenta.
 *
 * En memoria y de un solo proceso, como `candado.ts`: la API corre como UNA
 * instancia en cPanel. Reiniciar la API limpia los contadores, que es
 * aceptable (el límite por IP sigue en pie).
 */

const VENTANA_MS = 15 * 60_000;
const MAXIMO = 8;
/** Tope de llaves guardadas: inventar correos no debe llenar la memoria. */
const TOPE_LLAVES = 20_000;

const fallos = new Map<string, { n: number; desde: number }>();

export const MINUTOS_DE_BLOQUEO = VENTANA_MS / 60_000;

function vigente(llave: string): { n: number; desde: number } | null {
  const f = fallos.get(llave);
  if (!f) return null;
  if (Date.now() - f.desde > VENTANA_MS) {
    fallos.delete(llave);
    return null;
  }
  return f;
}

/** ¿Esta cuenta ya agotó sus intentos? */
export function estaBloqueada(llave: string): boolean {
  return (vigente(llave)?.n ?? 0) >= MAXIMO;
}

export function anotarFallo(llave: string): void {
  const f = vigente(llave);
  if (f) {
    f.n += 1;
    return;
  }
  if (fallos.size >= TOPE_LLAVES) {
    const ahora = Date.now();
    for (const [k, v] of fallos) if (ahora - v.desde > VENTANA_MS) fallos.delete(k);
    // Si sigue lleno es una inundación: se suelta lo más viejo antes que crecer sin fin.
    if (fallos.size >= TOPE_LLAVES) fallos.delete(fallos.keys().next().value as string);
  }
  fallos.set(llave, { n: 1, desde: Date.now() });
}

/** Entró bien o restableció su contraseña: se le perdonan los fallos. */
export function limpiarFallos(llave: string): void {
  fallos.delete(llave);
}
