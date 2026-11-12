import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceService } from '../quotes/service.service';
import { CobroPorHora } from './cobro-por-hora';
import { ServiciosPorZona } from './servicios-por-zona';
import { Triturados20261029 } from './triturados-2026-10-29';
import { PreciosEnElSitio } from './precios-en-el-sitio';
import { CondicionesTriturados20261030 } from './condiciones-triturados-2026-10-30';
import { DatosDePago20261030 } from './datos-de-pago-2026-10-30';
import { Mixtos20261030 } from './mixtos-2026-10-30';
import { CondicionesPorLinea20261102 } from './condiciones-por-linea-2026-11-02';
import { Precios20261103 } from './precios-2026-11-03';
import { PreciosAsfalto20261106 } from './precios-asfalto-2026-11-06';
import { BlockPresentaciones20261106 } from './block-presentaciones-2026-11-06';
import { Camiones20261106 } from './camiones-2026-11-06';
import { CalDePatio20261106 } from './cal-de-patio-2026-11-06';
import { CarpetaModificada20261110 } from './carpeta-modificada-2026-11-10';
import { Camiones20261112 } from './camiones-2026-11-12';
import { SinPreciosEnElSitio20261112 } from './sin-precios-en-el-sitio-2026-11-12';
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
  // CobroPorHora, ServiciosPorZona, Triturados20261029, PreciosEnElSitio, CondicionesTriturados20261030, DatosDePago20261030,
  // Mixtos20261030, CondicionesPorLinea20261102, Precios20261103, PreciosAsfalto20261106, BlockPresentaciones20261106, Camiones20261106, CalDePatio20261106,
  // CarpetaModificada20261110, Camiones20261112 y SinPreciosEnElSitio20261112: ponen al día los tabuladores una sola vez, al arrancar.
  providers: [QuoterService, ServiceService, QuoterServicio, Recotizar, CobroPorHora, ServiciosPorZona, Triturados20261029, PreciosEnElSitio, CondicionesTriturados20261030, DatosDePago20261030, Mixtos20261030, CondicionesPorLinea20261102, Precios20261103, PreciosAsfalto20261106, BlockPresentaciones20261106, Camiones20261106, CalDePatio20261106, CarpetaModificada20261110, Camiones20261112, SinPreciosEnElSitio20261112],
  // QuoterServicio también: al marcar "Aceptada" en el panel se abre el servicio.
  // Recotizar: el desglose y el lápiz de Solicitudes, y "Volver a cotizar" (2026-10-23).
  exports: [QuoterService, QuoterServicio, Recotizar],
})
export class QuoterModule {}
