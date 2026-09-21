import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';

/**
 * RECORTA LOS ESPACIOS DE LOS EXTREMOS EN TODO LO QUE ENTRA.
 *
 * Nace de un caso real: una contraseña copiada y pegada traía un espacio al
 * final y el login respondía "correo o contraseña incorrectos". Desde fuera es
 * indistinguible de una contraseña mala, así que se busca el error donde no
 * está. Lo mismo pasa con un correo pegado desde un chat o un SKU desde Excel.
 *
 * Va como pipe GLOBAL y no campo por campo a propósito: el problema no era de
 * un formulario, era de cualquiera. Aquí se arregla una vez y vale para todo lo
 * que llegue por `body` o por `query`.
 *
 * DOS DECISIONES:
 *
 * 1. Sí, también la contraseña. Es el caso que lo motivó. A cambio, una
 *    contraseña que EMPIECE o TERMINE en espacio deja de ser válida — nadie
 *    elige una así a propósito, y quien lo hiciera no podría volver a teclearla
 *    igual. Se recorta igual al crearla y al cambiarla (misma ruta), así que
 *    las dos puntas coinciden.
 *
 * 2. Sólo los extremos. Los espacios de en medio no se tocan: "Torre A 2"
 *    sigue siendo eso, y un texto de blog conserva su formato.
 */
const recortar = (valor: unknown): unknown => {
  if (typeof valor === 'string') return valor.trim();
  if (Array.isArray(valor)) return valor.map(recortar);
  // Sólo objetos "planos": un Buffer de una subida o una Date no se recorren.
  if (valor !== null && typeof valor === 'object') {
    const proto = Object.getPrototypeOf(valor);
    if (proto === Object.prototype || proto === null) {
      const salida: Record<string, unknown> = {};
      for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
        salida[clave] = recortar(v);
      }
      return salida;
    }
  }
  return valor;
};

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(valor: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') return valor;
    return recortar(valor);
  }
}
