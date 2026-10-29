import { Controller, Get, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { tap, type Observable } from 'rxjs';

/**
 * LAS PANTALLAS ABIERTAS SE PONEN AL DÍA SOLAS (2026-10-26).
 *
 * "Acabo de hacer un cobro, pero no se actualiza en automático el sistema; eso
 * debe ser en todos, se deben actualizar en tiempo real." Cada pantalla pedía
 * sus datos al abrirse y solo se volvía a leer con lo que hiciera ahí mismo
 * quien la tenía abierta; la campana la recargaba únicamente si llegaba un
 * aviso, y un cobro no genera aviso.
 *
 * Ahora la API lleva la hora del último cambio: toda petición que guarda algo
 * (POST, PUT, PATCH o DELETE que sale bien) la mueve. El panel la recibe con la
 * campana (`GET /admin/avisos`, cada pocos segundos) y el sitio con
 * `GET /cambios`; cuando avanza, la pantalla vuelve a pedir sus datos
 * (`router.refresh()`) sin perder filtros ni lo que se está escribiendo.
 *
 * Consulta periódica y no conexión abierta, por lo mismo que la campana: en
 * cPanel cada conexión larga ocupa un proceso de entrada y Passenger no
 * garantiza mantenerla.
 *
 * Vive en memoria porque en cPanel la API corre en un solo proceso. Al
 * reiniciar arranca en la hora de arranque: las pantallas se ponen al día una
 * vez de más, nunca una de menos. Las pantallas solo reaccionan cuando el valor
 * AVANZA, así que si algún día hubiera varios procesos un cambio se vería un
 * poco tarde, pero no habría recargas en bucle.
 */
let ultimo = Date.now();

export function marcarCambio(): void {
  ultimo = Math.max(Date.now(), ultimo + 1);
}

export function ultimoCambio(): number {
  return ultimo;
}

/** Lo que se manda pero no cambia nada que otra pantalla enseñe. */
const NO_CUENTAN = [
  // Entrar, renovar la sesión y recuperar la contraseña
  /^\/(admin\/)?auth\/(login|refresh|forgot-password|reset-password|resend-verification|change-password|olvide|restablecer)$/,
  // Cálculos y vistas previas: no guardan nada
  /^\/quoter\/calculate\//,
  /^\/quotes\/vista-previa$/,
  /^\/maquinas\/(recomendar|documento)$/,
  // "Leído" de la campana: es de cada quien
  /^\/(notifications\/read|admin\/avisos\/leido)$/,
  // La ubicación del GPS llega cada pocos segundos; el mapa se lee solo
  /^\/(operador\/ubicacion|aliado\/servicios\/[^/]+\/ubicacion)$/,
  /^\/wishlist\//,
  // Tareas programadas: lo que le importa a alguien sale como aviso de la campana
  /^\/tareas\//,
];

@Injectable()
export class AvisarCambios implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const metodo = (req.method ?? 'GET').toUpperCase();
    const ruta = (req.url ?? '').split('?')[0];
    if (metodo === 'GET' || metodo === 'HEAD' || metodo === 'OPTIONS' || NO_CUENTAN.some((re) => re.test(ruta))) {
      return next.handle();
    }
    // `complete` y no `next`: solo cuando la ruta terminó bien (un error no completa).
    return next.handle().pipe(tap({ complete: marcarCambio }));
  }
}

/** Para el sitio (cuenta, portal del aliado, operador). El panel lo recibe con la campana. */
@Controller('cambios')
export class CambiosController {
  @SkipThrottle()
  @Get()
  ultimo() {
    return { cambio: ultimoCambio() };
  }
}
