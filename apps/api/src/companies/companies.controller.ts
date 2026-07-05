import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

class CompanyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() rccm?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}
class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() rccm?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('companies')
export class CompaniesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.transportCompany.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  @Post()
  async create(@Body() dto: CompanyDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Nom de société obligatoire.');
    return this.prisma.transportCompany.create({
      data: {
        name: dto.name.trim(),
        rccm: dto.rccm?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
      },
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const c = await this.prisma.transportCompany.findUnique({ where: { id } });
    if (!c) throw new BadRequestException('Société introuvable.');
    return this.prisma.transportCompany.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        rccm: dto.rccm !== undefined ? dto.rccm?.trim() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
      },
    });
  }
}
