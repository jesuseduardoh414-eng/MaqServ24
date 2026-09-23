import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceService } from '../quotes/service.service';
import { QuoterController } from './quoter.controller';
import { QuoterService } from './quoter.service';
import { QuoterServicio } from './quoter-servicio';

/**
 * Cotizadores internos (maquinaria y triturados).
 *
 * Exporta el servicio porque el panel lo usa desde `AdminQuoterController`,
 * que vive en AdminModule: los dos lados tienen que cotizar con el MISMO
 * tabulador y el mismo motor, o el precio del sitio y el del panel se separan.
 *
 * `ServiceService` entra aquí por la misma razón que en ProvidersModule: la
 * solicitud del sitio abre un servicio y se lo ofrece al proveedor, y eso
 * tiene que pasar por el ÚNICO camino que mueve servicios, o el historial
 * contaría distinto según de dónde vino.
 */
@Module({
  // Por el correo: una solicitud del sitio avisa al proveedor dueño de lo que
  // se pidió, al equipo y al cliente (ver `avisarSolicitud` y `QuoterServicio`).
  imports: [NotificationsModule],
  controllers: [QuoterController],
  providers: [QuoterService, ServiceService, QuoterServicio],
  exports: [QuoterService],
})
export class QuoterModule {}
