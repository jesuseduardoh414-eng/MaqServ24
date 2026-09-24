import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { FreightModule } from '../freight/freight.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MaquinasController } from './maquinas.controller';
import { RecomendadorService } from './recomendador.service';
import { MaquinaServicio } from './maquina-servicio';
import { ServiceService } from './service.service';

@Module({
  imports: [FreightModule, NotificationsModule],
  controllers: [QuotesController, MaquinasController],
  // ServiceService se instancia aquí también (como en ProvidersModule y
  // QuoterModule): la solicitud de una máquina termina en la MISMA oferta al
  // aliado que las demás.
  providers: [QuotesService, RecomendadorService, MaquinaServicio, ServiceService],
})
export class QuotesModule {}
