import { Module } from '@nestjs/common';
import { OffdocksService } from './offdocks.service';
import { OffdocksController } from './offdocks.controller';

@Module({
  providers: [OffdocksService],
  controllers: [OffdocksController],
  exports: [OffdocksService],
})
export class OffdocksModule {}
