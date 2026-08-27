import { Controller, ForbiddenException, Post, Query } from '@nestjs/common';
import { RemindersService } from './reminders.service';

/**
 * TAREAS PROGRAMADAS.
 *
 * El documento pide "recordatorios automáticos" (sección 18), y automático
 * quiere decir que corre sin que nadie se acuerde. El servidor de la API está
 * en un plan que no trae programador de tareas, así que el disparo viene de
 * fuera: un cron gratuito (cron-job.org, GitHub Actions, Vercel Cron) que
 * llama esta ruta una vez al día.
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Protegida por un secreto propio y NO por la sesión de administrador. Un
 *    cron no puede iniciar sesión, y darle credenciales de admin a un servicio
 *    externo sería entregarle el panel entero para que apriete un botón.
 *
 * 2. Sin `TASKS_SECRET` configurado, la ruta NO existe. No hay valor por
 *    defecto: una ruta que dispara correos a toda la red no puede quedar
 *    abierta porque alguien olvidó una variable.
 */
@Controller('tareas')
export class TasksController {
  constructor(private readonly reminders: RemindersService) {}

  private comprobar(secreto: string | undefined) {
    const esperado = process.env.TASKS_SECRET;
    if (!esperado || esperado.length < 16) {
      throw new ForbiddenException('Las tareas programadas no están habilitadas.');
    }
    if (secreto !== esperado) throw new ForbiddenException('Secreto inválido.');
  }

  @Post('recordatorios')
  async recordatorios(@Query('secret') secret?: string) {
    this.comprobar(secret);
    return this.reminders.enviar();
  }
}
