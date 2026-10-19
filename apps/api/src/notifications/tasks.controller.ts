import { Controller, Headers, Post, Query } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { AvisoSalidaService } from './aviso-salida.service';
import { comprobarTasksSecret } from '../common/tasks-secret';
import { sincronizarReservasActivas } from '../quotes/reservas';

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
 *
 * (La guardia vive en common/tasks-secret.ts — la comparten las tareas de
 * órdenes vencidas en OrdersModule.)
 */
@Controller('tareas')
export class TasksController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly salidas: AvisoSalidaService,
  ) {}

  /**
   * La corrida diaria. Además de los recordatorios, ajusta la disponibilidad
   * en lo que solo depende del calendario (quotes/reservas.ts): cotizaciones
   * autorizadas que vencieron sin aceptarse sueltan su equipo y los servicios
   * que se alargan siguen apartándolo. Va aquí y no en una ruta nueva para
   * que el cron que ya existe lo haga sin tocar el servidor.
   */
  @Post('recordatorios')
  async recordatorios(
    @Query('secret') secret?: string,
    @Headers('x-tasks-secret') headerSecret?: string,
  ) {
    comprobarTasksSecret(secret, headerSecret);
    const reservas = await sincronizarReservasActivas();
    return { ...(await this.reminders.enviar()), reservas };
  }

  /**
   * Avisos de hora de salida a los aliados (2026-10-15, ver aviso-salida.service.ts).
   * La llama el cron "Avisos de salida" cada 15 min: además despierta la API,
   * que en cPanel se duerme sin visitas y con ella su reloj interno.
   */
  @Post('salidas')
  async salidasDelDia(
    @Query('secret') secret?: string,
    @Headers('x-tasks-secret') headerSecret?: string,
  ) {
    comprobarTasksSecret(secret, headerSecret);
    return this.salidas.revisar();
  }

  /** Solo la parte de disponibilidad, para correrla a mano o más seguido. */
  @Post('reservas')
  async reservas(
    @Query('secret') secret?: string,
    @Headers('x-tasks-secret') headerSecret?: string,
  ) {
    comprobarTasksSecret(secret, headerSecret);
    return sincronizarReservasActivas();
  }
}
