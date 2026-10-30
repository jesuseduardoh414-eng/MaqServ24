import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceService } from '../quotes/service.service';
import { CobroPorHora } from './cobro-por-hora';
import { ServiciosPorZona } from './servicios-por-zona';
import { Triturados20261029 } from './triturados-2026-10-29';
import { PreciosEnElSitio } from './precios-en-el-sitio';
import { CondicionesTriturados20261030 } from './condiciones-triturados-2026-10-30';
import { DatosDePago20261030 } from './datos-de-pago-2026-10-30';
import { QuoterController } from './quoter.controller';
import { QuoterService } from './quoter.service';
import { QuoterServicio } from './quoter-servicio';
import { Recotizar } from './recotizar';

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
  // CobroPorHora, ServiciosPorZona, Triturados20261029, PreciosEnElSitio, CondicionesTriturados20261030 y DatosDePago20261030:
  // ponen al día los tabuladores una sola vez, al arrancar (2026-10-29 y 30).
  providers: [QuoterService, ServiceService, QuoterServicio, Recotizar, CobroPorHora, ServiciosPorZona, Triturados20261029, PreciosEnElSitio, CondicionesTriturados20261030, DatosDePago20261030],
  // QuoterServicio también: al marcar "Aceptada" en el panel se abre el servicio.
  // Recotizar: el desglose y el lápiz de Solicitudes, y "Volver a cotizar" (2026-10-23).
  exports: [QuoterService, QuoterServicio, Recotizar],
})
export class QuoterModule {}
