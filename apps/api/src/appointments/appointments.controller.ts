import {
  Body, Controller, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { APPOINTMENT_STATUSES, AppointmentStatus } from '../domain/status';

class CreateAppointmentDto {
  @IsString() @IsNotEmpty() containerNumber!: string;
  @IsString() @IsNotEmpty({ message: 'Le numéro de BL est obligatoire' }) blNumber!: string;
  @IsString() @IsNotEmpty({ message: 'Le camion est obligatoire' }) truckPlate!: string;
  @IsString() @IsNotEmpty({ message: 'La remorque est obligatoire' }) trailerPlate!: string;
  @IsString() @IsNotEmpty({ message: 'Le chauffeur est obligatoire' }) driverName!: string;
  @IsOptional() @IsString() driverPhone?: string;
  @IsISO8601() requestedDate!: string;
  @IsString() @IsNotEmpty({ message: 'Le shift souhaité est obligatoire' }) shiftCode!: string;
}

class TransitionDto {
  @IsIn(APPOINTMENT_STATUSES as unknown as string[]) to!: AppointmentStatus;
  @IsOptional() @IsString() note?: string;
}

class ScanDto {
  @IsString() token!: string;
}

class AssignDto {
  @IsString() @IsNotEmpty() offDockId!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private service: AppointmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.list(user, status);
  }

  @Roles('AGENT', 'ADMIN')
  @Get('pending')
  pending() {
    return this.service.pending();
  }

  @Roles('TRANSPORTER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.service.create(user, dto);
  }

  @Roles('OPERATOR', 'ADMIN')
  @Post('scan')
  scan(@CurrentUser() user: AuthUser, @Body() dto: ScanDto) {
    return this.service.scan(user, dto.token);
  }

  @Roles('AGENT', 'ADMIN')
  @Post(':id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.service.assign(user, id, dto.offDockId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Get(':id/qr')
  qr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.qr(user, id);
  }

  @Roles('OPERATOR', 'ADMIN', 'TRANSPORTER')
  @Post(':id/transition')
  transition(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(user, id, dto.to, dto.note);
  }
}
