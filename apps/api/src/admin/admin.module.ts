import { Module } from '@nestjs/common';
import { AdminAuthController, AdminGuard } from './admin-auth';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminProvidersController } from './admin-providers.controller';
import { AdminAvailabilityController } from './admin-availability.controller';
import { AdminMatchingController } from './admin-matching.controller';
import { AdminServicesController } from './admin-services.controller';
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
import { AdminAdminsController } from './admin-admins.controller';
import { FreightModule } from '../freight/freight.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  // OrdersModule: el panel mueve el envío con el MISMO FulfillmentService que el
  // webhook de pago. Solo se importa el provider; los controllers de órdenes los
  // sigue registrando OrdersModule.
  // IntegrationsModule: los suscriptores se empujan a Perfex CRM con el mismo
  // PerfexService que usa el alta pública del footer.
  imports: [FreightModule, NotificationsModule, OrdersModule, IntegrationsModule],
  controllers: [AdminAuthController, AdminCatalogController, AdminOpsController, AdminThemesController, AdminCmsController, AdminCommunityController, AdminPaymentsController, AdminFreightController, AdminFulfillmentController, AdminVendorsController, AdminWithdrawsController, AdminCustomersController, AdminSubscribersController, AdminAdminsController, AdminProvidersController, AdminAvailabilityController, AdminMatchingController, AdminServicesController],
  providers: [AdminGuard, ServiceService, MatchingService],
})
export class AdminModule {}
