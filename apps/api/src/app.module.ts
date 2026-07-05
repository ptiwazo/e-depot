import { Controller, Get, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ContainersModule } from './containers/containers.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { AuthModule } from './auth/auth.module';
import { OffdocksModule } from './offdocks/offdocks.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ManifestModule } from './manifest/manifest.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { ReportsModule } from './reports/reports.module';

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
    UsersModule,
    CompaniesModule,
    AuthModule,
    OffdocksModule,
    AppointmentsModule,
    AnalyticsModule,
    ShiftsModule,
    ManifestModule,
    AuditModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
