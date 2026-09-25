import { Module } from '@nestjs/common';
import { AdminAuthController, AdminGuard } from './admin-auth';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminProvidersController } from './admin-providers.controller';
import { AdminAvailabilityController } from './admin-availability.controller';
import { AdminMatchingController } from './admin-matching.controller';
import { AdminServicesController } from './admin-services.controller';
import { AdminClientsController } from './admin-clients.controller';
import { AdminMailController } from './admin-mail.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminIncidentsController } from './admin-incidents.controller';
import { AdminAgendaController } from './admin-agenda.controller';
import { AdminAvisosController } from './admin-avisos.controller';
import { ServiceService } from '../quotes/service.service';
import { MatchingService } from '../quotes/matching.service';
import { AdminOpsController } from './admin-ops.controller';
import { AdminThemesController } from './admin-themes.controller';
import { AdminCmsController } from './admin-cms.controller';
import { AdminCommunityController } from './admin-community.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminFreightController } from './admin-freight.controller';
import { AdminFulfillmentController } from './admin-fulfillment.controller';
import { AdminVendorsController } from './admin-vendors.controller';
import { AdminWithdrawsController } from './admin-withdraws.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminSubscribersController } from './admin-subscribers.controller';
import { AdminContactController } from './admin-contact.controller';
import { AdminAdminsController } from './admin-admins.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AdminQuoterController } from './admin-quoter.controller';
import { FreightModule } from '../freight/freight.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { QuoterModule } from '../quoter/quoter.module';

@Module({
  // OrdersModule: el panel mueve el envío con el MISMO FulfillmentService que el
  // webhook de pago. Solo se importa el provider; los controllers de órdenes los
  // sigue registrando OrdersModule.
  // IntegrationsModule: los suscriptores y los mensajes de contacto se empujan a
  // Perfex CRM con el mismo PerfexService que usa el alta pública del footer.
  // QuoterModule: el cotizador interno del panel corre con el MISMO servicio
  // (tabulador + motor) que sirve al sitio publico.
  imports: [FreightModule, NotificationsModule, OrdersModule, IntegrationsModule, QuoterModule],
  controllers: [AdminAuthController, AdminCatalogController, AdminOpsController, AdminThemesController, AdminCmsController, AdminCommunityController, AdminPaymentsController, AdminFreightController, AdminFulfillmentController, AdminVendorsController, AdminWithdrawsController, AdminCustomersController, AdminSubscribersController, AdminContactController, AdminAdminsController, AdminRolesController, AdminQuoterController, AdminProvidersController, AdminAvailabilityController, AdminMatchingController, AdminServicesController, AdminClientsController, AdminMailController, AdminAnalyticsController, AdminIncidentsController, AdminAgendaController, AdminAvisosController],
  providers: [AdminGuard, ServiceService, MatchingService],
})
export class AdminModule {}
