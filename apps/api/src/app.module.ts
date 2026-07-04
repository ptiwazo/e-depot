import { Controller, Get, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ContainersModule } from './containers/containers.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { OffdocksModule } from './offdocks/offdocks.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ManifestModule } from './manifest/manifest.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'e-depot', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    PrismaModule,
    ContainersModule,
    SettingsModule,
    AuthModule,
    OffdocksModule,
    AppointmentsModule,
    AnalyticsModule,
    ShiftsModule,
    ManifestModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
