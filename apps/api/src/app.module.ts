import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientThrottlerGuard } from './common/throttler.guard';
import { HealthController } from './health.controller';
import { ThemeModule } from './theme/theme.module';
import { CatalogModule } from './catalog/catalog.module';
import { SettingsModule } from './settings/settings.module';
import { ContentModule } from './content/content.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { QuotesModule } from './quotes/quotes.module';
import { ProvidersModule } from './providers/providers.module';
import { FreightModule } from './freight/freight.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AccountModule } from './account/account.module';
import { VendorsModule } from './vendors/vendors.module';
import { AdminModule } from './admin/admin.module';
import { IntegrationsModule } from './integrations/integrations.module';

/**
 * Techo GLOBAL, generoso a propósito: es una red de seguridad contra inundaciones, no
 * el límite de cada formulario. Navegar el catálogo dispara varias peticiones por
 * página, así que un número corto aquí rompería el sitio. Lo que de verdad protege son
 * los `@Throttle` de cada endpoint sensible (login, /track, contacto, cotizar…).
 * Se cuenta por VISITANTE, no por servidor: ver ClientThrottlerGuard.
 */
@Module({
  imports: [
    // Sin `name`: queda como el throttler "default", que es justo al que apuntan los
    // `@Throttle({ default: ... })` de cada endpoint. Ponerle nombre propio hacía que
    // esos decoradores no coincidieran con nada y NINGÚN límite por ruta se aplicara.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule, ThemeModule, CatalogModule, SettingsModule, ContentModule, OrdersModule, QuotesModule, ProvidersModule, FreightModule, NotificationsModule, AccountModule, VendorsModule, AdminModule, IntegrationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ClientThrottlerGuard }],
})
export class AppModule {}
