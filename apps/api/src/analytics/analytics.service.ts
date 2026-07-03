import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeCongestion } from '../offdocks/congestion';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [byStatus, total, completedToday, noShow, completedTotal, docks] = await Promise.all([
      this.prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: { status: 'COMPLETED', slotStart: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.appointment.count({ where: { status: 'NO_SHOW' } }),
      this.prisma.appointment.count({ where: { status: 'COMPLETED' } }),
      this.prisma.offDock.findMany({ orderBy: { code: 'asc' } }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s.status] = s._count._all;

    // Occupation du jour par OFF-DOCK.
    const activeToday = await this.prisma.appointment.groupBy({
      by: ['offDockId'],
      where: {
        slotStart: { gte: todayStart, lt: todayEnd },
        status: { in: ['ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      _count: { _all: true },
    });
    const loadMap = new Map(activeToday.map((a) => [a.offDockId, a._count._all]));
    const congestionMap = await computeCongestion(this.prisma);

    const offDocks = docks.map((d) => {
      const load = loadMap.get(d.id) ?? 0;
      return {
        code: d.code,
        name: d.name,
        city: d.city,
        load,
        capacity: d.dailyCapacity,
        occupancy: Math.round((load / Math.max(1, d.dailyCapacity)) * 100),
        congestion: Math.round((congestionMap[d.id]?.congestion ?? 0) * 100),
      };
    });

    // Turnaround moyen (ARRIVED → COMPLETED), en minutes.
    const turnaround = await this.turnaroundMinutes();

    const noShowRate = completedTotal + noShow > 0
      ? Math.round((noShow / (completedTotal + noShow)) * 100)
      : 0;

    return {
      total,
      completedToday,
      noShow,
      noShowRate,
      avgTurnaroundMin: turnaround,
      byStatus: statusMap,
      offDocks,
    };
  }

  private async turnaroundMinutes(): Promise<number> {
    const completed = await this.prisma.appointment.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    });
    if (!completed.length) return 0;

    let sum = 0;
    let n = 0;
    for (const a of completed) {
      const events = await this.prisma.appointmentEvent.findMany({
        where: { appointmentId: a.id, toStatus: { in: ['ARRIVED', 'COMPLETED'] } },
      });
      const arrived = events.find((e) => e.toStatus === 'ARRIVED');
      const done = events.find((e) => e.toStatus === 'COMPLETED');
      if (arrived && done) {
        sum += (done.createdAt.getTime() - arrived.createdAt.getTime()) / 60000;
        n++;
      }
    }
    return n ? Math.round(sum / n) : 0;
  }
}
