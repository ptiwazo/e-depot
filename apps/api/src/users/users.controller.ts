import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

const ROLE_VALUES = ['ADMIN', 'AGENT', 'OPERATOR', 'TRANSPORTER', 'DRIVER', 'MSC'];

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsIn(ROLE_VALUES) role!: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() offDockId?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(ROLE_VALUES) role?: string;
  @IsOptional() @IsString() companyId?: string | null;
  @IsOptional() @IsString() offDockId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/reset')
  reset(@Param('id') id: string) {
    return this.service.resetActivation(id);
  }
}
