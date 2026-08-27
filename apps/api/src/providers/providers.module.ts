import { Module } from '@nestjs/common';
import { ProviderPortalController } from './provider-portal.controller';
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
  controllers: [ProviderPortalController],
  providers: [ServiceService],
})
export class ProvidersModule {}
