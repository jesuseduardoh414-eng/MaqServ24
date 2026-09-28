import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { FreightModule } from '../freight/freight.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuoterModule } from '../quoter/quoter.module';
import { RecomendadorService } from './recomendador.service';
import { MaquinaServicio } from './maquina-servicio';
import { ServiceService } from './service.service';

@Module({
  // QuoterModule: el documento imprimible de una solicitud por máquina lo
  // emite el mismo servicio del cotizador (folio, empresa, condiciones).
  imports: [FreightModule, NotificationsModule, QuoterModule],
  // MaquinasController (/maquinas/*) DESMONTADO el 2026-09-28: precio único y
  // asigna MAQSER24. Seguía alcanzable por la API y ofrecía la solicitud directo
  // al aliado con precio por máquina (QA 2026-09-28). El archivo queda como historia.
  controllers: [QuotesController],
  // ServiceService se instancia aquí también (como en ProvidersModule y
  // QuoterModule): la solicitud de una máquina termina en la MISMA oferta al
  // aliado que las demás.
  providers: [QuotesService, RecomendadorService, MaquinaServicio, ServiceService],
})
export class QuotesModule {}
