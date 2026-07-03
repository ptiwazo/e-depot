import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import {
  CONTAINER_REPOSITORY,
  ContainerRepository,
} from '../containers/container.repository';
import {
  buildShift,
  selectOffDockForShift,
  OffDockState,
} from '../domain/assignment';
import { canTransition, AppointmentStatus } from '../domain/status';
import { isReeferType } from '../domain/sizetype';
import { haversineKm, PORT_ABIDJAN } from './geo';
import { computeCongestion } from '../offdocks/congestion';
import { AuthUser } from '../common/current-user.decorator';

const ACTIVE_STATUSES = ['ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CONTAINER_REPOSITORY) private readonly containers: ContainerRepository,
  ) {}

  private ref(): string {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    return `EDP-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /**
   * Crée un RDV : vérification du conteneur + BL dans la BASE chargée par l'admin
   * (ContainerManifest) + anti-doublon. Le RDV part en file d'attente (VALIDATED) ;
   * l'affectation de l'OFF-DOCK est réalisée par un AGENT MEDLOG, pas par le système.
   * Le camion, la remorque et le chauffeur sont saisis manuellement.
   */
  async create(
    user: AuthUser,
    dto: {
      containerNumber: string;
      blNumber: string;
      truckPlate: string;
      trailerPlate: string;
      driverName: string;
      driverPhone?: string;
      requestedDate: string;
      shiftCode: string;
    },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('Compte transporteur non rattaché à une société');
    }

    const containerNumber = (dto.containerNumber || '').replace(/\s+/g, '').toUpperCase();
    const blNumber = (dto.blNumber || '').trim().toUpperCase();

    // 1. Vérification dans la base MEDLOG (conteneur + BL) — obligatoire avant soumission.
    const entry = await this.containers.findByNumber(containerNumber);
    if (!entry) {
      throw new BadRequestException(
        'Conteneur introuvable dans la base MEDLOG. Retour non autorisé.',
      );
    }
    if (entry.blNumber !== blNumber) {
      throw new BadRequestException('Le numéro de BL ne correspond pas à ce conteneur dans la base MEDLOG.');
    }
    const containerType = entry.containerType;

    // 2. Anti-doublon : pas de RDV actif pour le même conteneur.
    const dup = await this.prisma.appointment.findFirst({
      where: { containerNumber, status: { in: ['REQUESTED', 'VALIDATED', ...ACTIVE_STATUSES] } },
    });
    if (dup) {
      throw new BadRequestException(
        `Un rendez-vous actif existe déjà pour ce conteneur (${dup.reference})`,
      );
    }

    const requestedDate = new Date(dto.requestedDate);
    if (isNaN(requestedDate.getTime())) {
      throw new BadRequestException('Date souhaitée invalide');
    }

    // 3. Shift choisi par le transporteur (l'OFF-DOCK sera affecté par un agent MEDLOG).
    const shiftCfg = await this.prisma.shift.findUnique({ where: { code: dto.shiftCode } });
    if (!shiftCfg) throw new BadRequestException('Shift invalide');

    const reference = this.ref();

    const appt = await this.prisma.appointment.create({
      data: {
        reference,
        containerNumber,
        containerType,
        isoValid: true,
        blNumber,
        companyId: user.companyId,
        truckPlate: dto.truckPlate.toUpperCase().trim(),
        trailerPlate: dto.trailerPlate.toUpperCase().trim(),
        driverName: dto.driverName.trim(),
        driverPhone: dto.driverPhone?.trim() || null,
        requestedDate,
        shiftCode: dto.shiftCode,
        status: 'VALIDATED', // en attente d'affectation par un agent MEDLOG
        createdById: user.id,
        events: {
          create: [
            { toStatus: 'REQUESTED', note: 'Demande créée', actorId: user.id },
            { fromStatus: 'REQUESTED', toStatus: 'VALIDATED', note: 'Conteneur + BL vérifiés dans la base MEDLOG — en attente d\'affectation' },
          ],
        },
      },
      include: this.include(),
    });

    await this.audit(user.id, 'APPOINTMENT_CREATE', appt.id, { reference, shift: dto.shiftCode });
    return appt;
  }

  /** File d'affectation : demandes validées en attente d'un OFF-DOCK, avec recommandation. */
  async pending() {
    const appts = await this.prisma.appointment.findMany({
      where: { status: { in: ['REQUESTED', 'VALIDATED'] } },
      include: this.include(),
      orderBy: { createdAt: 'asc' },
    });
    const recos = await Promise.all(appts.map((a) => this.recommend(a)));
    return appts.map((a, i) => ({ ...a, recommendation: recos[i] }));
  }

  /** Recommandation du moteur pour une demande (meilleur OFF-DOCK sur le shift demandé). */
  private async recommend(appt: { requestedDate: Date; shiftCode: string | null; containerType: string }) {
    if (!appt.shiftCode) return null;
    const shiftCfg = await this.prisma.shift.findUnique({ where: { code: appt.shiftCode } });
    if (!shiftCfg) return null;
    const shift = buildShift(appt.requestedDate, shiftCfg);
    const reco = await this.computeAssignment(shift, appt.containerType);
    return reco
      ? { offDockId: reco.offDockId, offDockCode: reco.offDockCode, score: reco.score }
      : null;
  }

  /**
   * Affectation de l'OFF-DOCK par un AGENT MEDLOG (accepte la reco ou choisit un autre site).
   * Génère le créneau (bornes du shift), le QR code et passe le RDV en ASSIGNED.
   */
  async assign(user: AuthUser, id: string, offDockId: string) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    if (!['REQUESTED', 'VALIDATED'].includes(appt.status)) {
      throw new BadRequestException(`Ce rendez-vous est déjà affecté (statut ${appt.status})`);
    }
    if (!appt.shiftCode) throw new BadRequestException('Shift manquant sur la demande');

    const offDock = await this.prisma.offDock.findUnique({ where: { id: offDockId } });
    if (!offDock || !offDock.active) throw new BadRequestException('OFF-DOCK invalide ou inactif');
    if (isReeferType(appt.containerType) && !offDock.acceptsReefer) {
      throw new BadRequestException(`${offDock.code} n'accepte pas les conteneurs réfrigérés (${appt.containerType})`);
    }

    const shiftCfg = await this.prisma.shift.findUnique({ where: { code: appt.shiftCode } });
    if (!shiftCfg) throw new BadRequestException('Shift invalide');
    const shift = buildShift(appt.requestedDate, shiftCfg);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        offDockId,
        slotStart: shift.start,
        slotEnd: shift.end,
        status: 'ASSIGNED',
        qrToken: randomBytes(16).toString('hex'),
        events: {
          create: {
            fromStatus: appt.status,
            toStatus: 'ASSIGNED',
            note: `Affecté à ${offDock.code} · ${shift.label} par agent ${user.email}`,
            actorId: user.id,
          },
        },
      },
      include: this.include(),
    });
    await this.audit(user.id, 'APPOINTMENT_ASSIGN', id, { offDock: offDock.code, shift: shift.code });
    return updated;
  }

  /** Construit l'état des OFF-DOCK pour le shift visé et lance le moteur. */
  private async computeAssignment(shift: { start: Date; end: Date; code: string; label: string }, containerType: string) {
    const dayStart = new Date(shift.start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const docks = await this.prisma.offDock.findMany({ where: { active: true } });
    const appts = await this.prisma.appointment.findMany({
      where: {
        slotStart: { gte: dayStart, lt: dayEnd },
        status: { in: ACTIVE_STATUSES },
      },
      select: { offDockId: true, slotStart: true },
    });
    // Congestion calculée automatiquement (état réel du parc).
    const congestion = await computeCongestion(this.prisma);

    const states: OffDockState[] = docks.map((d) => {
      const own = appts.filter((a) => a.offDockId === d.id);
      const shiftLoads: Record<string, number> = {};
      for (const a of own) {
        if (a.slotStart) {
          const key = a.slotStart.toISOString();
          shiftLoads[key] = (shiftLoads[key] ?? 0) + 1;
        }
      }
      return {
        id: d.id,
        code: d.code,
        dailyCapacity: d.dailyCapacity,
        shiftCapacity: d.shiftCapacity,
        congestion: congestion[d.id]?.congestion ?? 0,
        acceptsReefer: d.acceptsReefer,
        active: d.active,
        distanceKm: haversineKm(PORT_ABIDJAN, { lat: d.lat, lng: d.lng }),
        dailyLoad: own.length,
        shiftLoads,
      };
    });

    return selectOffDockForShift(states, shift, containerType);
  }

  private include() {
    return {
      offDock: true,
      company: true,
      events: { orderBy: { createdAt: 'asc' as const } },
    };
  }

  /** Liste filtrée selon le rôle. */
  async list(user: AuthUser, status?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (user.role === 'TRANSPORTER') where.companyId = user.companyId;
    if (user.role === 'OPERATOR') where.offDockId = user.offDockId;
    return this.prisma.appointment.findMany({
      where,
      include: this.include(),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(user: AuthUser, id: string) {
    const appt = await this.prisma.appointment.findUnique({ where: { id }, include: this.include() });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    if (user.role === 'TRANSPORTER' && appt.companyId !== user.companyId) {
      throw new ForbiddenException();
    }
    if (user.role === 'OPERATOR' && appt.offDockId !== user.offDockId) {
      throw new ForbiddenException();
    }
    return appt;
  }

  /** QR code (data URL PNG) encodant le jeton de contrôle au portail. */
  async qr(user: AuthUser, id: string) {
    const appt = await this.findOne(user, id);
    if (!appt.qrToken) {
      return { reference: appt.reference, dataUrl: null as string | null };
    }
    const payload = JSON.stringify({ ref: appt.reference, token: appt.qrToken });
    const dataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
    return { reference: appt.reference, dataUrl };
  }

  /** Scan au portail : retrouve un RDV par jeton QR (opérateur du site). */
  async scan(user: AuthUser, token: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { qrToken: token },
      include: this.include(),
    });
    if (!appt) throw new NotFoundException('QR inconnu');
    if (user.role === 'OPERATOR' && appt.offDockId !== user.offDockId) {
      throw new ForbiddenException("Ce conteneur est affecté à un autre OFF-DOCK");
    }
    return appt;
  }

  /** Transition de statut contrôlée par l'automate. */
  async transition(user: AuthUser, id: string, to: AppointmentStatus, note?: string) {
    const appt = await this.findOne(user, id);
    const from = appt.status as AppointmentStatus;
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Transition ${from} → ${to} non autorisée`);
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: to,
        events: { create: { fromStatus: from, toStatus: to, note, actorId: user.id } },
      },
      include: this.include(),
    });
    await this.audit(user.id, 'APPOINTMENT_TRANSITION', id, { from, to });
    return updated;
  }

  private async audit(actorId: string, action: string, entityId: string, meta: any) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entity: 'Appointment', entityId, meta: JSON.stringify(meta) },
    });
  }
}
