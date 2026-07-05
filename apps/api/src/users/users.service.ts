import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES } from '../common/roles';

const VALID_ROLES = Object.keys(ROLES);

const SELECT = {
  id: true, email: true, name: true, phone: true, role: true, active: true,
  companyId: true, offDockId: true, createdAt: true, activationToken: true,
  transportCompany: { select: { id: true, name: true } },
  offDock: { select: { id: true, code: true, name: true } },
} as const;

export interface CreateUserDto {
  email: string; name: string; phone?: string; role: string;
  companyId?: string; offDockId?: string;
}
export interface UpdateUserDto {
  name?: string; phone?: string; role?: string; companyId?: string | null;
  offDockId?: string | null; active?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: SELECT });
    return rows.map((u) => this.shape(u));
  }

  /** Création par l'admin : sans mot de passe, avec jeton d'activation renvoyé. */
  async create(dto: CreateUserDto) {
    const email = (dto.email || '').toLowerCase().trim();
    if (!email || !dto.name?.trim()) throw new BadRequestException('Email et nom obligatoires.');
    if (!VALID_ROLES.includes(dto.role)) throw new BadRequestException('Rôle invalide.');
    await this.checkLinks(dto.role, dto.companyId, dto.offDockId);

    const activationToken = randomBytes(24).toString('hex');
    try {
      const u = await this.prisma.user.create({
        data: {
          email, name: dto.name.trim(), phone: dto.phone?.trim() || null, role: dto.role,
          companyId: dto.companyId || null, offDockId: dto.offDockId || null,
          password: '', active: true, activationToken,
        },
        select: SELECT,
      });
      return { user: this.shape(u), activationToken };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Un compte existe déjà avec cet email.');
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (dto.role && !VALID_ROLES.includes(dto.role)) throw new BadRequestException('Rôle invalide.');
    // Valide avec les valeurs effectives : on ne réclame pas la société si on ne modifie que le statut.
    const effCompany = dto.companyId !== undefined ? dto.companyId : user.companyId;
    const effOffDock = dto.offDockId !== undefined ? dto.offDockId : user.offDockId;
    await this.checkLinks(dto.role ?? user.role, effCompany, effOffDock);
    const u = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone !== undefined ? (dto.phone?.trim() || null) : undefined,
        role: dto.role,
        companyId: dto.companyId !== undefined ? (dto.companyId || null) : undefined,
        offDockId: dto.offDockId !== undefined ? (dto.offDockId || null) : undefined,
        active: dto.active,
      },
      select: SELECT,
    });
    return this.shape(u);
  }

  /** Régénère un lien d'activation (nouveau mot de passe à définir) et renvoie le jeton. */
  async resetActivation(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const activationToken = randomBytes(24).toString('hex');
    await this.prisma.user.update({ where: { id }, data: { password: '', activationToken, active: true } });
    return { activationToken };
  }

  private async checkLinks(role: string, companyId?: string | null, offDockId?: string | null) {
    if (companyId) {
      const c = await this.prisma.transportCompany.findUnique({ where: { id: companyId } });
      if (!c) throw new BadRequestException('Société de transport introuvable.');
    }
    if (offDockId) {
      const o = await this.prisma.offDock.findUnique({ where: { id: offDockId } });
      if (!o) throw new BadRequestException('OFF-DOCK introuvable.');
    }
    if (role === 'TRANSPORTER' && !companyId) {
      throw new BadRequestException('Un transporteur doit être rattaché à une société.');
    }
  }

  private shape(u: any) {
    const { activationToken, transportCompany, offDock, ...rest } = u;
    return {
      ...rest,
      company: transportCompany ? { id: transportCompany.id, name: transportCompany.name } : null,
      offDock: offDock ? { id: offDock.id, code: offDock.code, name: offDock.name } : null,
      pending: !!activationToken, // compte pas encore activé (mot de passe non défini)
    };
  }
}
