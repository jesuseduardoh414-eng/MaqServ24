import { Module } from '@nestjs/common';
import { FreightService } from './freight.service';

@Module({
  providers: [FreightService],
  exports: [FreightService],
})
export class FreightModule {}
