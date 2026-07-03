import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

class UpdateShiftDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @Matches(HHMM, { message: "Heure invalide (format attendu HH:MM)" }) startTime?: string;
  @IsOptional() @Matches(HHMM, { message: "Heure invalide (format attendu HH:MM)" }) endTime?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.shift.findMany({ orderBy: { order: 'asc' } });
  }

  @Roles('ADMIN')
  @Patch(':code')
  async update(@Param('code') code: string, @Body() dto: UpdateShiftDto) {
    const shift = await this.prisma.shift.findUnique({ where: { code } });
    if (!shift) throw new BadRequestException('Shift introuvable');
    return this.prisma.shift.update({ where: { code }, data: dto });
  }
}
