import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query('entity') entity?: string, @Query('search') search?: string) {
    const where: any = {};
    if (entity) where.entity = entity;
    if (search) where.meta = { contains: search, mode: 'insensitive' };
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return rows.map((r) => {
      let meta: any = {};
      try { meta = r.meta ? JSON.parse(r.meta) : {}; } catch { /* ignore */ }
      return {
        id: r.id,
        createdAt: r.createdAt,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        actor: meta.actor ?? null,
        role: meta.role ?? null,
        status: meta.status ?? null,
        path: meta.path ?? null,
        body: meta.body ?? null,
      };
    });
  }

  // Entités distinctes présentes (pour le filtre).
  @Get('entities')
  async entities() {
    const rows = await this.prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } });
    return rows.map((r) => r.entity);
  }
}
