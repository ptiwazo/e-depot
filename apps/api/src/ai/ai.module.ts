import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule], // réutilise AnalyticsService (SettingsService est global)
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
