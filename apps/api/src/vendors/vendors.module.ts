import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorPanelController } from './vendor-panel.controller';
import { ProductsService } from '../catalog/products.service';
import { MarketplaceGuard } from './marketplace.guard';

/**
 * Marketplace heredado (vendedores, su tienda y sus retiros). Está APAGADO por
 * `MARKETPLACE_ACTIVO` en @maqserv/config: los dos controladores responden 404.
 */
@Module({
  controllers: [VendorsController, VendorPanelController],
  providers: [ProductsService, MarketplaceGuard],
})
export class VendorsModule {}
