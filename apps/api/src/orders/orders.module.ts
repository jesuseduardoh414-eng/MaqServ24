import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersTasksController } from './orders-tasks.controller';
import { OrdersService } from './orders.service';
import { FulfillmentService } from './fulfillment.service';
import { StockService } from './stock.service';
import { TrackController } from './track.controller';
import { PaymentsController } from '../payments/payments.controller';
import { PaymentsService } from '../payments/payments.service';
import { FreightModule } from '../freight/freight.module';
import { NotificationsModule } from '../notifications/notifications.module';

/** Orders + Payments juntos: el checkout crea la orden y arranca el pago. */
@Module({
  imports: [FreightModule, NotificationsModule],
  controllers: [OrdersController, OrdersTasksController, TrackController, PaymentsController],
  providers: [OrdersService, PaymentsService, FulfillmentService, StockService],
  // El panel mueve el envío con el mismo servicio que el webhook de pago:
  // un solo camino para cambiar de estado (ver AdminModule).
  exports: [FulfillmentService],
})
export class OrdersModule {}
