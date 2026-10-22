import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';
import { QuoterModule } from '../quoter/quoter.module';

@Module({
  // QuoterModule: "Cotizar" en una ficha abre el cotizador que la tiene (Fase 4).
  imports: [QuoterModule],
  controllers: [CatalogController],
  providers: [ProductsService, CategoriesService],
})
export class CatalogModule {}
