import { Controller, Headers, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { comprobarTasksSecret } from '../common/tasks-secret';

/**
 * Tarea programada de órdenes: cancela las impagas vencidas y devuelve su
 * stock. Mismo contrato que /tareas/recordatorios (ver tasks.controller.ts):
 * la dispara un cron externo con el `TASKS_SECRET`; sin secreto configurado la
 * ruta no existe. Vive en OrdersModule (no en Notifications) porque necesita
 * OrdersService y el módulo de avisos no puede importar al de órdenes sin
 * crear un ciclo.
 */
@Controller('tareas')
export class OrdersTasksController {
  constructor(private readonly orders: OrdersService) {}

  @Post('ordenes-vencidas')
  async ordenesVencidas(
    @Query('secret') secret?: string,
    @Headers('x-tasks-secret') headerSecret?: string,
  ) {
    comprobarTasksSecret(secret, headerSecret);
    return this.orders.expireUnpaid();
  }
}
