import { PrismaService } from '../prisma/prisma.service';

export interface Congestion {
  onSite: number; // camions physiquement présents (ARRIVED + IN_PROGRESS)
  parkingSlots: number;
  congestion: number; // 0..1, plafonné
}

/**
 * Congestion opérationnelle courante de chaque OFF-DOCK, calculée automatiquement :
 * nombre de camions présents (ARRIVED + IN_PROGRESS) / capacité de parc, plafonné à 1.
 * Reflète l'engorgement réel du site, indépendamment du remplissage planifié du jour.
 */
export async function computeCongestion(
  prisma: PrismaService,
): Promise<Record<string, Congestion>> {
  const docks = await prisma.offDock.findMany({ select: { id: true, parkingSlots: true } });
  const onSite = await prisma.appointment.groupBy({
    by: ['offDockId'],
    where: { status: { in: ['ARRIVED', 'IN_PROGRESS'] } },
    _count: { _all: true },
  });
  const map = new Map(onSite.map((o) => [o.offDockId, o._count._all]));

  const result: Record<string, Congestion> = {};
  for (const d of docks) {
    const count = map.get(d.id) ?? 0;
    const slots = Math.max(1, d.parkingSlots);
    result[d.id] = {
      onSite: count,
      parkingSlots: d.parkingSlots,
      congestion: Math.min(1, count / slots),
    };
  }
  return result;
}
