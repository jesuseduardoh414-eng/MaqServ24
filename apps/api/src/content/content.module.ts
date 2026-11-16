import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { DatosDeEjemplo } from './datos-de-ejemplo';
import { SectoresTextos20261116 } from './sectores-2026-11-16';
import { PorQueMaqser20261116 } from './por-que-maqser-2026-11-16';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [IntegrationsModule, NotificationsModule],
  controllers: [ContentController],
  // DatosDeEjemplo: al arrancar quita del tema guardado las sucursales de ejemplo y los textos de precios (2026-10-28).
  // SectoresTextos20261116 y PorQueMaqser20261116: textos nuevos que mandó el dueño, una sola vez al arrancar (2026-11-16).
  providers: [ContentService, DatosDeEjemplo, SectoresTextos20261116, PorQueMaqser20261116],
})
export class ContentModule {}
