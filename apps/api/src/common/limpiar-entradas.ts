import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * LO QUE ESCRIBE EL PÚBLICO SE GUARDA COMO TEXTO, NO COMO CÓDIGO (auditoría 2026-10-23).
 *
 * Todo lo que llega de fuera del panel (sitio, portal del aliado, página del
 * operador) se limpia ANTES de llegar a la ruta: fuera las etiquetas HTML
 * (`<script>`, `<img onerror=…>`, `<a href=…>`) y los caracteres de control
 * invisibles. Nada de lo que se escribe en esos formularios necesita HTML, y
 * así no queda guardado nada que pueda ejecutarse si un día se pinta en otro
 * lugar. Es una capa más: la base de datos ya se consulta con parámetros
 * (Prisma), cada ruta valida con zod, React y los correos escapan al pintar,
 * y el sitio lleva CSP.
 *
 * - El panel (/admin) no pasa por aquí: el blog y las secciones se escriben
 *   en HTML a propósito, y se limpian al servirlos (common/sanitize.ts).
 * - Contraseñas, tokens y códigos no se tocan: cambiarlos rompería el login.
 * - Las subidas (multipart) llegan después; sus textos los valida zod.
 */
const NO_TOCAR = new Set([
  'password', 'password2', 'currentPassword', 'newPassword', 'contrasena', 'token', 'refresh_token',
  't', 'code', 'state', 'navegador', 'redirectUri', 'next',
]);

const ETIQUETA = /<\/?[a-zA-Z!?][^<>]*>/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;
const PROFUNDIDAD = 32;

export function limpiarTexto(v: string): string {
  return v.replace(ETIQUETA, '').replace(CONTROL, '');
}

function limpiar(valor: unknown, clave: string | null, nivel: number): unknown {
  if (nivel > PROFUNDIDAD) return valor;
  if (typeof valor === 'string') return clave && NO_TOCAR.has(clave) ? valor : limpiarTexto(valor);
  if (Array.isArray(valor)) return valor.map((v) => limpiar(v, clave, nivel + 1));
  if (valor && typeof valor === 'object' && (Object.getPrototypeOf(valor) === Object.prototype || Object.getPrototypeOf(valor) === null)) {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) salida[k] = limpiar(v, k, nivel + 1);
    return salida;
  }
  return valor;
}

@Injectable()
export class LimpiarEntradas implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ url?: string; body?: unknown }>();
    const ruta = (req.url ?? '').split('?')[0];
    if (!ruta.startsWith('/admin/') && !ruta.startsWith('/tareas/') && req.body && typeof req.body === 'object') {
      req.body = limpiar(req.body, null, 0);
    }
    return next.handle();
  }
}

/** Un entero de la URL dentro de un rango; lo que no lo sea, `undefined` (antes: NaN y un 500). */
export function enteroDeUrl(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'string' || !/^\d{1,9}$/.test(v.trim())) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

/** Un texto de la URL; repetido (`?q=a&q=b`) o demasiado largo no vale (antes: arreglo y un 500). */
export function textoDeUrl(v: unknown, max = 200): string | undefined {
  return typeof v === 'string' && v.trim() && v.length <= max ? limpiarTexto(v.trim()) : undefined;
}
