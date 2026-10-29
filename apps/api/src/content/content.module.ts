import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { DatosDeEjemplo } from './datos-de-ejemplo';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [IntegrationsModule, NotificationsModule],
  controllers: [ContentController],
  // DatosDeEjemplo: al arrancar quita del tema guardado las sucursales de ejemplo y los textos de precios (2026-10-28).
  providers: [ContentService, DatosDeEjemplo],
})
export class ContentModule {}
