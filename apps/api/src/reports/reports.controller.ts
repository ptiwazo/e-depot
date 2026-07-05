import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService, ReportFilters } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get(':source')
  run(
    @Param('source') source: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('transporteur') transporteur?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('entity') entity?: string,
  ) {
    const f: ReportFilters = { from, to, status, type, transporteur, search, role, entity };
    return this.service.run(source, f);
  }
}
