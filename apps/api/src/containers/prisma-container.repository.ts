import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContainerRecord, ContainerRepository } from './container.repository';

/** Source par défaut : table ContainerManifest (SQLite/Prisma), en écriture. */
@Injectable()
export class PrismaContainerRepository implements ContainerRepository {
  readonly readOnly = false;

  constructor(private prisma: PrismaService) {}

  async findByNumber(containerNumber: string): Promise<ContainerRecord | null> {
    const e = await this.prisma.containerManifest.findUnique({ where: { containerNumber } });
    return e ? this.map(e) : null;
  }

  async list(search?: string): Promise<ContainerRecord[]> {
    const where = search
      ? {
          OR: [
            { containerNumber: { contains: search.toUpperCase() } },
            { blNumber: { contains: search.toUpperCase() } },
          ],
        }
      : {};
    const rows = await this.prisma.containerManifest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.map(r));
  }

  count(): Promise<number> {
    return this.prisma.containerManifest.count();
  }

  async upsert(rec: ContainerRecord): Promise<ContainerRecord> {
    const data = {
      containerNumber: rec.containerNumber,
      blNumber: rec.blNumber,
      containerType: rec.containerType,
      consignee: rec.consignee,
      transporteur: rec.transporteur ?? null,
    };
    const e = await this.prisma.containerManifest.upsert({
      where: { containerNumber: rec.containerNumber },
      create: data,
      update: data,
    });
    return this.map(e);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.containerManifest.delete({ where: { id } });
  }

  private map(e: {
    id: string;
    containerNumber: string;
    blNumber: string;
    containerType: string;
    consignee: string | null;
    transporteur: string | null;
  }): ContainerRecord {
    return {
      id: e.id,
      containerNumber: e.containerNumber,
      blNumber: e.blNumber,
      containerType: e.containerType,
      consignee: e.consignee ?? null,
      transporteur: e.transporteur ?? null,
    };
  }
}
