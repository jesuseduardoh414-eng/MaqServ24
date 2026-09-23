import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuoterController } from './quoter.controller';
import { QuoterService } from './quoter.service';

/**
 * Cotizadores internos (maquinaria y triturados).
 *
 * Exporta el servicio porque el panel lo usa desde `AdminQuoterController`,
 * que vive en AdminModule: los dos lados tienen que cotizar con el MISMO
 * tabulador y el mismo motor, o el precio del sitio y el del panel se separan.
 */
@Module({
  // Por el correo: una solicitud del sitio avisa al proveedor dueño de lo que
  // se pidió, al equipo y al visitante (ver `avisarSolicitud`).
  imports: [NotificationsModule],
  controllers: [QuoterController],
  providers: [QuoterService],
  exports: [QuoterService],
})
export class QuoterModule {}
