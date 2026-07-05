import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TAKE = 20000; // plafond de lignes par rapport

export interface ReportFilters {
  from?: string; to?: string; status?: string; type?: string;
  transporteur?: string; search?: string; role?: string; entity?: string;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private d(x?: Date | null): string {
    return x ? new Date(x).toISOString().slice(0, 16).replace('T', ' ') : '';
  }

  async run(source: string, f: ReportFilters): Promise<Record<string, any>[]> {
    const from = f.from ? new Date(f.from) : undefined;
    const to = f.to ? new Date(f.to + 'T23:59:59') : undefined;
    const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    switch (source) {
      case 'appointments': return this.appointments(range, f);
      case 'containers': return this.containers(f);
      case 'users': return this.users(f);
      case 'companies': return this.companies();
      case 'audit': return this.audit(range, f);
      default: throw new BadRequestException('Source de rapport inconnue.');
    }
  }

  private async appointments(range: any, f: ReportFilters) {
    const where: any = {};
    if (range) where.createdAt = range;
    if (f.status) where.status = f.status;
    const rows = await this.prisma.appointment.findMany({
      where, include: { company: true, offDock: true }, orderBy: { createdAt: 'desc' }, take: TAKE,
    });
    return rows.map((a) => ({
      reference: a.reference,
      containerNumber: a.containerNumber,
      containerType: a.containerType,
      blNumber: a.blNumber,
      company: a.company?.name ?? '',
      truckPlate: a.truckPlate ?? '',
      trailerPlate: a.trailerPlate ?? '',
      driverName: a.driverName ?? '',
      driverPhone: a.driverPhone ?? '',
      offDock: a.offDock?.code ?? '',
      shiftCode: a.shiftCode ?? '',
      status: a.status,
      requestedDate: this.d(a.requestedDate),
      slotStart: this.d(a.slotStart),
      createdAt: this.d(a.createdAt),
    }));
  }

  private async containers(f: ReportFilters) {
    const where: any = {};
    if (f.type) where.containerType = { contains: f.type.toUpperCase() };
    if (f.transporteur) where.transporteur = { contains: f.transporteur, mode: 'insensitive' };
    if (f.search) {
      const s = f.search.toUpperCase();
      where.OR = [{ containerNumber: { contains: s } }, { blNumber: { contains: s } }];
    }
    const rows = await this.prisma.containerManifest.findMany({ where, orderBy: { createdAt: 'desc' }, take: TAKE });
    return rows.map((c) => ({
      containerNumber: c.containerNumber,
      blNumber: c.blNumber,
      containerType: c.containerType,
      consignee: c.consignee ?? '',
      transporteur: c.transporteur ?? '',
      shippingLine: c.shippingLine,
      createdAt: this.d(c.createdAt),
    }));
  }

  private async users(f: ReportFilters) {
    const where: any = {};
    if (f.role) where.role = f.role;
    const rows = await this.prisma.user.findMany({
      where, include: { transportCompany: true, offDock: true }, orderBy: { createdAt: 'desc' }, take: TAKE,
    });
    return rows.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active ? 'Oui' : 'Non',
      company: u.transportCompany?.name ?? '',
      offDock: u.offDock?.code ?? '',
      phone: u.phone ?? '',
      createdAt: this.d(u.createdAt),
    }));
  }

  private async companies() {
    const rows = await this.prisma.transportCompany.findMany({
      include: { _count: { select: { users: true } } }, orderBy: { name: 'asc' }, take: TAKE,
    });
    return rows.map((c) => ({
      name: c.name,
      rccm: c.rccm ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      comptes: c._count.users,
      createdAt: this.d(c.createdAt),
    }));
  }

  private async audit(range: any, f: ReportFilters) {
    const where: any = {};
    if (range) where.createdAt = range;
    if (f.entity) where.entity = f.entity;
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: TAKE });
    return rows.map((r) => {
      let m: any = {};
      try { m = r.meta ? JSON.parse(r.meta) : {}; } catch { /* ignore */ }
      return {
        createdAt: this.d(r.createdAt),
        actor: m.actor ?? '',
        role: m.role ?? '',
        action: r.action,
        entity: r.entity,
        status: m.status ?? '',
        path: m.path ?? '',
      };
    });
  }
}
