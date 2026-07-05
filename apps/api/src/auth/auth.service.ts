import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { transportCompany: true, offDock: true },
    });
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    if (!user.password) {
      throw new UnauthorizedException(
        "Compte non activé : définissez votre mot de passe via le lien d'activation reçu.",
      );
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!user.active) {
      throw new ForbiddenException('Compte en attente de validation par MEDLOG (ou désactivé).');
    }
    return { token: await this.sign(user.id, user.role), user: this.publicUser(user) };
  }

  /** Auto-inscription d'un transporteur : compte créé en attente de validation admin. */
  async register(dto: { companyName: string; name: string; email: string; phone?: string; password: string }) {
    const email = (dto.email || '').toLowerCase().trim();
    const companyName = (dto.companyName || '').trim();
    if (!email || !dto.name?.trim() || !companyName) {
      throw new BadRequestException('Société, nom et email sont obligatoires.');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Mot de passe : 6 caractères minimum.');
    }
    // Société : réutilise une société existante de même nom, sinon la crée.
    const existing = await this.prisma.transportCompany.findFirst({
      where: { name: { equals: companyName, mode: 'insensitive' } },
    });
    const company = existing ?? (await this.prisma.transportCompany.create({ data: { name: companyName } }));
    try {
      await this.prisma.user.create({
        data: {
          email, name: dto.name.trim(), phone: dto.phone?.trim() || null, role: 'TRANSPORTER',
          companyId: company.id, password: await bcrypt.hash(dto.password, 10), active: false,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Un compte existe déjà avec cet email.');
      throw e;
    }
    return { ok: true, message: 'Compte créé. Il sera actif après validation par MEDLOG.' };
  }

  /** Infos affichées sur la page d'activation (vérifie que le jeton est valide). */
  async activationInfo(token: string) {
    const user = await this.prisma.user.findUnique({ where: { activationToken: token } });
    if (!user) throw new BadRequestException("Lien d'activation invalide ou déjà utilisé.");
    return { email: user.email, name: user.name };
  }

  /** Définition du mot de passe via le jeton d'activation. */
  async activate(token: string, password: string) {
    if (!password || password.length < 6) throw new BadRequestException('Mot de passe : 6 caractères minimum.');
    const user = await this.prisma.user.findUnique({ where: { activationToken: token } });
    if (!user) throw new BadRequestException("Lien d'activation invalide ou déjà utilisé.");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 10), activationToken: null, active: true },
    });
    return { ok: true, email: user.email };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { transportCompany: true, offDock: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }

  private sign(sub: string, role: string) {
    return this.jwt.signAsync({ sub, role });
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      company: user.transportCompany?.name ?? null,
      offDockId: user.offDockId,
      offDock: user.offDock?.name ?? null,
    };
  }
}
