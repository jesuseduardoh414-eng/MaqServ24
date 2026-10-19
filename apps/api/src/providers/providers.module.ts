import { Module } from '@nestjs/common';
import { ProviderPortalController } from './provider-portal.controller';
import { OperadorController } from './operador.controller';
import { ServiceService } from '../quotes/service.service';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * EL PORTAL DEL ALIADO (documento institucional, sección 20).
 *
 * Reusa `ServiceService` a propósito: si el aliado tuviera su propio camino
 * para aceptar o rechazar, el historial contaría distinto según quién apretó
 * el botón — y ese historial es el que después ordena el emparejamiento.
 */
@Module({
  imports: [NotificationsModule],
  // El enlace del operador de la unidad (2026-10-15): un servicio, sin lo del aliado.
  controllers: [ProviderPortalController, OperadorController],
  providers: [ServiceService],
})
export class ProvidersModule {}
