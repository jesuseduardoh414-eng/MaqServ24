/**
 * ACCESO DIRECTO A LOS COTIZADORES (2026-10-29).
 *
 * "Son solo para una persona, no deben ser públicos: no se entra con un botón
 * desde el panel ni desde el sitio; solo con los enlaces puedes entrar e
 * instalarlos en el celular, sin usuario ni contraseña." El enlace lleva una
 * llave (`/cotizar/<llave>/maquinaria`): con ella el panel abre sesión con
 * una cuenta interna que SOLO puede usar los cotizadores (la API lo hace
 * cumplir, no la pantalla).
 *
 * Aquí va solo la HUELLA (SHA-256) de la llave: la llave no vive en el código.
 * Para cambiarla (si el enlace se filtra) se pone la huella de una nueva; los
 * enlaces viejos dejan de abrir y las sesiones abiertas se cierran.
 */
export const HUELLA_ACCESO_DIRECTO = '389348bd515b590fc61e312f78d00d1f9290b51e8a59c738b58a897407d90608';

/** La cuenta interna del acceso directo. No recibe correo ni tiene contraseña que alguien conozca. */
export const CUENTA_ACCESO_DIRECTO = 'acceso-directo@cotizador.maqser24.local';
export const NOMBRE_ACCESO_DIRECTO = 'Acceso directo';

/** Lo único que esa cuenta puede usar del panel. */
export const MODULOS_ACCESO_DIRECTO = ['cotizador'] as const;

/** ¿Es la cuenta del acceso directo? */
export const esAccesoDirecto = (email: string | null | undefined): boolean =>
  (email ?? '').trim().toLowerCase() === CUENTA_ACCESO_DIRECTO;
