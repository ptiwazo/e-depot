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
    // Délai moyen d'affectation (création → ASSIGNED), en minutes.
    const avgAssignMin = await this.assignDelayMinutes();

    const noShowRate = completedTotal + noShow > 0
      ? Math.round((noShow / (completedTotal + noShow)) * 100)
      : 0;

    // Agrégats dérivés du décompte par statut.
    const sum = (...keys: string[]) => keys.reduce((a, k) => a + (statusMap[k] ?? 0), 0);
    const pendingAssignment = sum('REQUESTED', 'VALIDATED'); // en attente d'un agent
    const scheduled = sum('ASSIGNED', 'CONFIRMED'); // affectés, à venir
    const onSite = sum('ARRIVED', 'IN_PROGRESS'); // camions présents au portail / parc
    const completionRate = total > 0 ? Math.round((completedTotal / total) * 100) : 0;

    // RDV planifiés aujourd'hui et sur les 7 prochains jours (créneaux fermes).
    const in7d = new Date(todayStart);
    in7d.setDate(in7d.getDate() + 7);
    const SCHEDULED_STATUSES = ['ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
    const [todayScheduled, upcoming7d] = await Promise.all([
      this.prisma.appointment.count({
        where: { slotStart: { gte: todayStart, lt: todayEnd }, status: { in: SCHEDULED_STATUSES } },
      }),
      this.prisma.appointment.count({
        where: { slotStart: { gte: todayStart, lt: in7d }, status: { in: ['ASSIGNED', 'CONFIRMED'] } },
      }),
    ]);

    // Occupation & congestion moyennes des sites actifs.
    const activeDocks = offDocks.filter((_, i) => docks[i].active);
    const avgOccupancy = activeDocks.length
      ? Math.round(activeDocks.reduce((a, d) => a + d.occupancy, 0) / activeDocks.length)
      : 0;
    const congestedDocks = activeDocks.filter((d) => d.congestion >= 70).length;

    // Répartition des RDV du jour par shift.
    const shiftGroups = await this.prisma.appointment.groupBy({
      by: ['shiftCode'],
      where: { slotStart: { gte: todayStart, lt: todayEnd }, status: { in: SCHEDULED_STATUSES } },
      _count: { _all: true },
    });
    const byShiftToday: Record<string, number> = {};
    for (const g of shiftGroups) byShiftToday[g.shiftCode ?? '—'] = g._count._all;

    // Tendance : RDV créés sur les 7 derniers jours.
    const weeklyTrend = await this.weeklyTrend(todayStart);

    // Top transporteurs (par volume de RDV).
    const topTransporters = await this.topTransporters();

    return {
      total,
      completedToday,
      noShow,
      noShowRate,
      avgTurnaroundMin: turnaround,
      avgAssignMin,
      pendingAssignment,
      scheduled,
      onSite,
      completionRate,
      todayScheduled,
      upcoming7d,
      avgOccupancy,
      congestedDocks,
      byStatus: statusMap,
      byShiftToday,
      weeklyTrend,
      topTransporters,
      offDocks,
    };
  }

  /** Délai moyen entre la création d'un RDV et son affectation (ASSIGNED), en minutes. */
  private async assignDelayMinutes(): Promise<number> {
    const events = await this.prisma.appointmentEvent.findMany({
      where: { toStatus: 'ASSIGNED' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { appointment: { select: { createdAt: true } } },
    });
    let sum = 0;
    let n = 0;
    for (const e of events) {
      if (e.appointment) {
        sum += (e.createdAt.getTime() - e.appointment.createdAt.getTime()) / 60000;
        n++;
      }
    }
    return n ? Math.round(sum / n) : 0;
  }

  /** RDV créés par jour sur les 7 derniers jours (aujourd'hui inclus). */
  private async weeklyTrend(todayStart: Date): Promise<{ date: string; count: number }[]> {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const rows = await this.prisma.appointment.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { createdAt: true },
    });
    const trend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const count = rows.filter((r) => r.createdAt >= d && r.createdAt < next).length;
      trend.push({ date: d.toISOString().slice(0, 10), count });
    }
    return trend;
  }

  /** Top 5 des transporteurs par volume de rendez-vous. */
  private async topTransporters(): Promise<{ name: string; count: number }[]> {
    const groups = await this.prisma.appointment.groupBy({
      by: ['companyId'],
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: 5,
    });
    if (!groups.length) return [];
    const companies = await this.prisma.transportCompany.findMany({
      where: { id: { in: groups.map((g) => g.companyId) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(companies.map((c) => [c.id, c.name]));
    return groups.map((g) => ({ name: nameMap.get(g.companyId) ?? '—', count: g._count._all }));
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
