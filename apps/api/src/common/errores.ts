import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

/**
 * LO QUE VE QUIEN LLAMA CUANDO ALGO FALLA (auditoría 2026-10-23).
 *
 * Una respuesta de error no debe contar cómo está hecho el sistema: ni rutas
 * ("Cannot GET /x" delata el framework), ni mensajes técnicos en inglés de las
 * librerías ("Validation failed (numeric string is expected)", "Unexpected
 * token in JSON at position 3", "Expected string, received number"), ni el
 * texto de un error de la base de datos. Todo eso se escribe en el log y a
 * quien llama se le contesta en español, sin detalle.
 *
 * Lo que ya escribimos nosotros (en español, con o sin `code`) pasa tal cual:
 * la web y el panel dependen de esos textos y códigos.
 *
 * Sustituye a ZodErrorFilter (datos inválidos = 400, no 500, QA 2026-09-25).
 */
const log = new Logger('Errores');

/** Mensajes de librerías (Nest, body-parser, multer, zod): técnicos y en inglés. */
const TECNICO = /^(Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) |Validation failed|Unexpected (token|end|field|character)|.*\bJSON\b|Expected |Invalid |Required$|String must|Number must|Array must|Too (many|few)|File too large|Bad Request$|Not Found$|request entity too large|Multipart|Boundary)/i;

const GENERICO: Record<number, string> = {
  400: 'Datos inválidos.',
  401: 'Necesitas iniciar sesión.',
  403: 'No tienes permiso para esto.',
  404: 'No encontrado.',
  405: 'No permitido.',
  413: 'El archivo o los datos son demasiado grandes.',
  415: 'Formato no admitido.',
  429: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
};

interface Respuesta {
  status: (n: number) => { json: (b: unknown) => void };
}

@Catch()
export class ErroresSinDetalle implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Respuesta>();
    const req = host.switchToHttp().getRequest<{ method?: string; url?: string }>();

    if (err instanceof ZodError) {
      const m = err.issues[0]?.message;
      res.status(400).json({ statusCode: 400, message: m && !TECNICO.test(m) ? m : GENERICO[400], error: 'Bad Request' });
      return;
    }

    if (err instanceof HttpException) {
      const status = err.getStatus();
      const cuerpo = err.getResponse();
      const mensaje = typeof cuerpo === 'string' ? cuerpo : (cuerpo as { message?: unknown })?.message;
      const texto = Array.isArray(mensaje) ? String(mensaje[0] ?? '') : typeof mensaje === 'string' ? mensaje : '';
      if (status >= 500) {
        log.error(`${req.method} ${req.url} → ${status}: ${texto}`);
        res.status(status).json({ statusCode: status, message: 'Ocurrió un error. Inténtalo de nuevo en un momento.' });
        return;
      }
      if (!texto || TECNICO.test(texto)) {
        res.status(status).json({ statusCode: status, message: GENERICO[status] ?? 'No se pudo completar.', ...(typeof cuerpo === 'object' && cuerpo && 'code' in cuerpo ? { code: (cuerpo as { code: unknown }).code } : {}) });
        return;
      }
      res.status(status).json(typeof cuerpo === 'string' ? { statusCode: status, message: cuerpo } : cuerpo);
      return;
    }

    // Cualquier otra cosa (la base de datos, un error de programación): al log
    // con todo su detalle, a quien llama nada.
    log.error(`${req.method} ${req.url}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    res.status(500).json({ statusCode: 500, message: 'Ocurrió un error. Inténtalo de nuevo en un momento.' });
  }
}
