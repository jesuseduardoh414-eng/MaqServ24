/**
 * POLÍTICA DE CONTRASEÑAS (2026-09-30).
 *
 * Una sola fuente para el sitio, el panel y la API. El formulario la usa para
 * palomear la ayuda mientras se escribe; la API la usa para RECHAZAR. Si se
 * separan, el formulario dejaría pasar algo que la API tumba (o al revés) y el
 * usuario vería un error que no entiende.
 *
 * Todas las reglas son obligatorias. Además de los cuatro tipos de carácter se
 * rechazan los patrones que un ataque de diccionario prueba primero:
 * secuencias (1234, abcd, qwer), repeticiones (aaa, 1111), contraseñas de lista
 * y el propio nombre o correo de la cuenta.
 */

export interface ContextoContrasena {
  /** Nombre de la persona: su contraseña no debe contenerlo. */
  nombre?: string | null;
  /** Correo de la cuenta: tampoco la parte antes de la @. */
  correo?: string | null;
}

export interface ReglaContrasena {
  id: string;
  texto: string;
  ok: (p: string, ctx?: ContextoContrasena) => boolean;
}

export const CONTRASENA_MIN = 10;
export const CONTRASENA_MAX = 100;

/** Minúsculas sin acentos, para comparar patrones sin que "Á" se escape. */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FILAS = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

/** ¿Tiene 4 o más caracteres seguidos de una secuencia (al derecho o al revés)? */
function tieneSecuencia(p: string): boolean {
  const s = plano(p);
  for (let i = 0; i + 4 <= s.length; i++) {
    const trozo = s.slice(i, i + 4);
    const reves = [...trozo].reverse().join('');
    if (FILAS.some((f) => f.includes(trozo) || f.includes(reves))) return true;
  }
  return false;
}

/** ¿Repite el mismo carácter 3 veces seguidas, o es un bloque repetido (abcabc, 1212)? */
function tieneRepeticion(p: string): boolean {
  const s = plano(p);
  if (/(.)\1\1/.test(s)) return true;
  return /^(.{1,4})\1+$/.test(s) || /(.{2,4})\1\1/.test(s);
}

/**
 * Palabras que aparecen en toda lista de contraseñas filtradas, más las de la
 * marca: es lo primero que alguien probaría contra una cuenta de MAQSER24.
 */
const COMUNES = [
  'password', 'passw0rd', 'contrasena', 'contrasenia', 'qwerty', 'admin', 'administrador', 'usuario',
  'welcome', 'bienvenido', 'iloveyou', 'teamo', 'monkey', 'dragon', 'letmein', 'football', 'futbol',
  'secret', 'secreto', 'master', 'shadow', 'superman', 'batman', 'mexico', 'monterrey', 'america',
  'maqser', 'maqserv', 'servmaq', 'maquinaria', 'default', 'changeme', 'cambiame', 'prueba',
];
function esComun(p: string): boolean {
  // "P@ssw0rd" es "password" con disfraz: se deshacen los cambios típicos.
  const s = plano(p).replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[$5]/g, 's').replace(/7/g, 't');
  return COMUNES.some((w) => s.includes(w));
}

function tieneDatosPropios(p: string, ctx?: ContextoContrasena): boolean {
  const s = plano(p);
  const trozos = [
    ...plano(ctx?.nombre ?? '').split(/[^a-z0-9]+/),
    ...plano((ctx?.correo ?? '').split('@')[0] ?? '').split(/[^a-z0-9]+/),
  ].filter((t) => t.length >= 3);
  return trozos.some((t) => s.includes(t));
}

export const REGLAS_CONTRASENA: ReglaContrasena[] = [
  { id: 'largo', texto: `Al menos ${CONTRASENA_MIN} caracteres`, ok: (p) => p.length >= CONTRASENA_MIN },
  { id: 'mayus', texto: 'Una letra mayúscula', ok: (p) => /[A-ZÁÉÍÓÚÜÑ]/.test(p) },
  { id: 'minus', texto: 'Una letra minúscula', ok: (p) => /[a-záéíóúüñ]/.test(p) },
  { id: 'numero', texto: 'Un número', ok: (p) => /[0-9]/.test(p) },
  { id: 'simbolo', texto: 'Un símbolo, como ! # $ * o @', ok: (p) => /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s]/.test(p) },
  { id: 'secuencia', texto: 'Sin secuencias como 1234, abcd o qwer', ok: (p) => p.length > 0 && !tieneSecuencia(p) },
  { id: 'repeticion', texto: 'Sin repeticiones como aaa, 1111 o abab', ok: (p) => p.length > 0 && !tieneRepeticion(p) },
  { id: 'comun', texto: 'Que no sea una contraseña común (password, qwerty, maqser…)', ok: (p) => p.length > 0 && !esComun(p) },
  { id: 'propia', texto: 'Que no incluya tu nombre ni tu correo', ok: (p, ctx) => p.length > 0 && !tieneDatosPropios(p, ctx) },
];

/**
 * Valida la contraseña contra TODAS las reglas. Devuelve el texto de la primera
 * que falla (para un mensaje de error) o `null` si está bien.
 */
export function problemaContrasena(p: string, ctx?: ContextoContrasena): string | null {
  if (p.length > CONTRASENA_MAX) return `La contraseña no puede pasar de ${CONTRASENA_MAX} caracteres.`;
  const falla = REGLAS_CONTRASENA.find((r) => !r.ok(p, ctx));
  return falla ? `La contraseña no es segura: ${falla.texto.charAt(0).toLowerCase()}${falla.texto.slice(1)}.` : null;
}

export const contrasenaSegura = (p: string, ctx?: ContextoContrasena): boolean => problemaContrasena(p, ctx) === null;
