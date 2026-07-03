import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min,
} from 'class-validator';
import { OffdocksService } from './offdocks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

class UpsertOffDockDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() city!: string;
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsInt() @Min(1) dailyCapacity?: number;
  @IsOptional() @IsInt() @Min(1) shiftCapacity?: number;
  @IsOptional() @IsInt() @Min(1) parkingSlots?: number;
  @IsOptional() @IsBoolean() acceptsReefer?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offdocks')
export class OffdocksController {
  constructor(private service: OffdocksService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('load-today')
  loadToday() {
    return this.service.loadToday();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: UpsertOffDockDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertOffDockDto>) {
    return this.service.update(id, dto);
  }
}
