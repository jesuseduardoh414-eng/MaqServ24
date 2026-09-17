import { Module } from '@nestjs/common';
import { QuoterController } from './quoter.controller';
import { QuoterService } from './quoter.service';

/**
 * Cotizadores internos (maquinaria y triturados).
 *
 * Exporta el servicio porque el panel lo usa desde `AdminQuoterController`,
 * que vive en AdminModule: los dos lados tienen que cotizar con el MISMO
 * tabulador y el mismo motor, o el precio del sitio y el del panel se separan.
 */
@Module({
  controllers: [QuoterController],
  providers: [QuoterService],
  exports: [QuoterService],
})
export class QuoterModule {}
