import { z } from 'zod';
import { problemaCp, problemaEmail, problemaRfc, problemaTelefono } from '@maqserv/config';

/**
 * VALIDACIÓN DE CAMPOS CON TIPO EN LA API (2026-10-15).
 *
 * Antes cada endpoint aceptaba el teléfono como texto libre con un tope de
 * largo: "Grua#Patio58" pasaba como teléfono. Estas piezas de zod usan las
 * MISMAS reglas que el formulario (`problema*` de @maqserv/config), así que lo
 * que el navegador deja enviar, aquí pasa, y lo que aquí se rechaza llega con
 * el mismo texto que la persona ya vio junto al campo.
 *
 * Vacío vale en las opcionales (`''`, `null`, ausente): la regla de "es
 * obligatorio" va aparte, con `.min(1, …)` o en el servicio.
 *
 * Se valida al ESCRIBIR. Los esquemas con que se LEE lo guardado (tema,
 * catálogo del cotizador) no se endurecen: un dato viejo mal capturado no debe
 * tumbar la carga de la página. Para esos, ver `revisarCampos`.
 */
const conRegla = (largo: number, problema: (v: string) => string | null) =>
  z.string().max(largo).superRefine((v, ctx) => {
    const p = problema(v);
    if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: p });
  });

export const zTelefono = () => conRegla(40, problemaTelefono);
export const zCp = () => conRegla(12, problemaCp);
export const zCorreo = () => conRegla(190, problemaEmail);
export const zRfc = () => conRegla(20, problemaRfc);

/** Obligatorio: además de bien formado, no vacío. */
export const zTelefonoRequerido = (vacio = 'Escribe un teléfono de contacto.') =>
  z.string().max(40).superRefine((v, ctx) => {
    const p = v.trim() ? problemaTelefono(v) : vacio;
    if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: p });
  });

/**
 * Para objetos que llegan enteros (tema, catálogo del cotizador): devuelve el
 * primer problema de los campos indicados, o `null`.
 */
export function revisarCampos(campos: Array<[tipo: 'telefono' | 'cp' | 'correo' | 'rfc', valor: unknown]>): string | null {
  const regla = { telefono: problemaTelefono, cp: problemaCp, correo: problemaEmail, rfc: problemaRfc };
  for (const [tipo, valor] of campos) {
    if (typeof valor !== 'string') continue;
    const p = regla[tipo](valor);
    if (p) return p;
  }
  return null;
}
