import { Module } from '@nestjs/common';
import { ManifestService } from './manifest.service';
import { ManifestController } from './manifest.controller';

@Module({
  providers: [ManifestService],
  controllers: [ManifestController],
  exports: [ManifestService],
})
export class ManifestModule {}
