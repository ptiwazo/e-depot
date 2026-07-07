import { Controller, Get, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { MailModule } from './mail/mail.module';
import { AiModule } from './ai/ai.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'e-depot', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    // Rate-limiting : 300 requêtes / minute / IP (généreux ; le login est plus strict).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    PrismaModule,
    MailModule,
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
    AiModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
