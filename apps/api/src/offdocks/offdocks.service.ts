import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeCongestion } from './congestion';

@Injectable()
export class OffdocksService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.offDock.findMany({ orderBy: { code: 'asc' } });
  }

  async findOne(id: string) {
    const dock = await this.prisma.offDock.findUnique({ where: { id } });
    if (!dock) throw new NotFoundException('OFF-DOCK introuvable');
    return dock;
  }

  create(data: any) {
    return this.prisma.offDock.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.offDock.update({ where: { id }, data });
  }

  /** Charge du jour par OFF-DOCK : nombre de RDV actifs affectés aujourd'hui. */
  async loadToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const docks = await this.prisma.offDock.findMany({ orderBy: { code: 'asc' } });
    const counts = await this.prisma.appointment.groupBy({
      by: ['offDockId'],
      where: {
        slotStart: { gte: start, lt: end },
        status: { in: ['ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      _count: { _all: true },
    });
    const map = new Map(counts.map((c) => [c.offDockId, c._count._all]));
    const congestion = await computeCongestion(this.prisma);

    return docks.map((d) => {
      const load = map.get(d.id) ?? 0;
      const c = congestion[d.id];
      return {
        ...d,
        load,
        occupancy: Math.round((load / Math.max(1, d.dailyCapacity)) * 100),
        onSite: c?.onSite ?? 0,
        congestion: c?.congestion ?? 0, // calculée automatiquement
      };
    });
  }
}
