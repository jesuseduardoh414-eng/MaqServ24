import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

/**
 * Datos inválidos = 400, no 500 (QA 2026-09-25).
 *
 * Varias rutas validan con `schema.parse(body)`: si el cuerpo no cumple, Zod
 * lanza y Nest lo trataba como error del servidor (500 "Internal server
 * error"). Para quien llama es un dato mal puesto, y así se le dice.
 */
@Catch(ZodError)
export class ZodErrorFilter implements ExceptionFilter {
  catch(err: ZodError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<{ status: (n: number) => { json: (b: unknown) => void } }>();
    res.status(400).json({ statusCode: 400, message: err.issues[0]?.message ?? 'Datos inválidos', error: 'Bad Request' });
  }
}
