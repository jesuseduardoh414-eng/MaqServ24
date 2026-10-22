import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { TasksController } from './tasks.controller';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { RemindersService } from './reminders.service';
import { AvisoSalidaService } from './aviso-salida.service';
import { CotizacionesPorVencerService } from './cotizaciones-por-vencer.service';
import { ServiceService } from '../quotes/service.service';
import { SeguimientoOfertasService } from '../quotes/seguimiento-ofertas.service';
import { MoneyService } from '../money/money.service';

@Module({
  controllers: [NotificationsController, TasksController],
  // ServiceService se instancia aquí también (como en ProvidersModule y
  // QuoterModule): el seguimiento de ofertas ofrece a los siguientes con el
  // MISMO camino que la oferta automática.
  // MoneyService (cobros y pagos, 2026-10-22) vive aquí porque la corrida diaria
  // lo llama; se exporta para el panel y el portal del aliado.
  providers: [NotificationsService, MailerService, RemindersService, AvisoSalidaService, CotizacionesPorVencerService, ServiceService, SeguimientoOfertasService, MoneyService],
  exports: [NotificationsService, MailerService, RemindersService, MoneyService],
})
export class NotificationsModule {}
