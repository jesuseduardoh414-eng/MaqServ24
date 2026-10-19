/**
 * TIPOS DE CAMPO (2026-10-15).
 *
 * "Aquí se supone que es un número de teléfono y deja escribir texto; eso no
 * debe pasar, no solo en este." Una sola fuente para el sitio, el panel y la
 * API, igual que la política de contraseñas:
 *
 * - QUÉ SE PUEDE ESCRIBIR en cada tipo (`limpiarPara`): lo usa el filtro global
 *   de los formularios (`FiltroDeCampos` en @maqserv/ui) para no dejar entrar
 *   una letra en un teléfono, ni al teclear ni al pegar.
 * - QUÉ ES UN VALOR VÁLIDO (`problema*`): lo usa el formulario antes de enviar
 *   y la API para rechazar. Devuelven el texto del problema o `null`.
 *
 * Un campo vacío NO es un problema aquí: si es obligatorio lo dice el
 * formulario. Así sirven igual para campos opcionales.
 */

export type TipoCampo = 'telefono' | 'cp' | 'entero' | 'decimal' | 'rfc' | 'email' | 'nombre';

/** Qué caracteres admite cada tipo, uno por uno. */
const ADMITE: Record<TipoCampo, RegExp> = {
  // Dígitos y los separadores con que la gente escribe teléfonos: +52 (81) 1234-5678.
  telefono: /[0-9+\s()\-.]/,
  cp: /[0-9]/,
  entero: /[0-9]/,
  decimal: /[0-9.]/,
  rfc: /[A-ZÑ&0-9]/,
  email: /\S/,
  // Letras (con acentos y ñ), espacios y lo que llevan algunos apellidos: D'Alessio, Pérez-Gómez, Ma. José.
  nombre: /[\p{L}\s.'’\-]/u,
};

/** Lo que se ve en el aviso cuando se intenta escribir algo que no va. */
export const PISTA_CAMPO: Record<TipoCampo, string> = {
  telefono: 'Solo números (y + o guiones)',
  cp: 'Solo números',
  entero: 'Solo números enteros',
  decimal: 'Solo números y un punto decimal',
  rfc: 'Solo letras y números',
  email: 'Un correo no lleva espacios',
  nombre: 'Solo letras',
};

/**
 * Deja en `texto` solo lo que el tipo admite. El RFC sube a mayúsculas; el
 * decimal conserva un solo punto (si `yaTienePunto`, ninguno).
 */
export function limpiarPara(tipo: TipoCampo, texto: string, yaTienePunto = false): string {
  const fuente = tipo === 'rfc' ? texto.toUpperCase() : texto;
  let salida = '';
  let punto = yaTienePunto;
  for (const c of fuente) {
    if (!ADMITE[tipo].test(c)) continue;
    if (tipo === 'decimal' && c === '.') {
      if (punto) continue;
      punto = true;
    }
    salida += c;
  }
  return salida;
}

export const soloDigitos = (s: string) => s.replace(/\D/g, '');

/* ── Teléfono (México) ─────────────────────────────────────────────────── */

/**
 * Los 10 dígitos de un teléfono de México, o `null` si no lo es. Acepta la
 * lada internacional (+52, y el viejo +52 1 de celulares) y cualquier
 * separador: "+52 1 (81) 4021-3277" → "8140213277".
 */
export function telefonoMx(s: string): string | null {
  let d = soloDigitos(s);
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  if (!/^[2-9]\d{9}$/.test(d)) return null;
  // 0000000000, 5555555555…: relleno, no un teléfono.
  if (/^(\d)\1{9}$/.test(d)) return null;
  return d;
}

/** Hasta cuántos dígitos se dejan escribir (10 + la lada 521). */
export const TELEFONO_MAX_DIGITOS = 13;

export function problemaTelefono(s: string | null | undefined): string | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  return telefonoMx(v) ? null : 'Escribe un teléfono de 10 dígitos, como 81 1234 5678.';
}

/* ── Código postal ─────────────────────────────────────────────────────── */

export function problemaCp(s: string | null | undefined): string | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  return /^\d{5}$/.test(v) ? null : 'El código postal son 5 dígitos, como 64000.';
}

/* ── Correo ────────────────────────────────────────────────────────────── */

export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function problemaEmail(s: string | null | undefined): string | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  return RE_EMAIL.test(v) ? null : 'Escribe un correo válido, como nombre@empresa.com.';
}

/* ── RFC ───────────────────────────────────────────────────────────────── */

/** Formato del SAT: 3 letras (empresa) o 4 (persona), fecha AAMMDD y homoclave de 3. */
const RE_RFC = /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{2}[A\d]$/;

export function problemaRfc(s: string | null | undefined): string | null {
  const v = (s ?? '').trim().toUpperCase();
  if (!v) return null;
  return RE_RFC.test(v) ? null : 'El RFC no es válido: son 12 caracteres (empresa) o 13 (persona), como ABC680524P76.';
}

/* ── Nombre de persona ─────────────────────────────────────────────────── */

export function problemaNombre(s: string | null | undefined): string | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  if (!/^[\p{L}\s.'’\-]+$/u.test(v)) return 'El nombre solo lleva letras.';
  return /\p{L}{2}/u.test(v) ? null : 'Escribe el nombre completo.';
}

/* ── Números ───────────────────────────────────────────────────────────── */

/** `null` si es un número dentro de [min, max] (vacío también es `null`). */
export function problemaNumero(
  s: string | number | null | undefined,
  { min, max, entero }: { min?: number; max?: number; entero?: boolean } = {},
): string | null {
  const v = typeof s === 'number' ? String(s) : (s ?? '').trim();
  if (!v) return null;
  if (entero ? !/^-?\d+$/.test(v) : !/^-?\d+(\.\d+)?$/.test(v)) return entero ? 'Escribe un número entero.' : 'Escribe un número.';
  const n = Number(v);
  if (min !== undefined && n < min) return `El mínimo es ${min}.`;
  if (max !== undefined && n > max) return `El máximo es ${max}.`;
  return null;
}
