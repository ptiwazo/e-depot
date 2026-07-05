import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { ManifestService, ManifestRow } from './manifest.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

class AddRowDto {
  @IsString() containerNumber!: string;
  @IsString() blNumber!: string;
  @IsOptional() @IsString() containerType?: string;
  @IsOptional() @IsString() consignee?: string;
  @IsOptional() @IsString() transporteur?: string;
}

class ImportDto {
  @IsArray() rows!: ManifestRow[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('manifest')
export class ManifestController {
  constructor(private service: ManifestService) {}

  // Vérification accessible aux transporteurs (avant soumission) et agents.
  @Roles('TRANSPORTER', 'ADMIN', 'AGENT')
  @Get('verify')
  verify(@Query('container') container: string, @Query('bl') bl: string) {
    return this.service.verify(container, bl);
  }

  @Roles('ADMIN')
  @Get()
  list(
    @Query('search') search?: string,
    @Query('container') container?: string,
    @Query('bl') bl?: string,
    @Query('type') type?: string,
    @Query('client') client?: string,
    @Query('transporteur') transporteur?: string,
  ) {
    return this.service.list({ search, container, bl, type, client, transporteur });
  }

  @Roles('ADMIN')
  @Get('count')
  async count() {
    return { count: await this.service.count() };
  }

  @Roles('ADMIN')
  @Post()
  addOne(@Body() dto: AddRowDto) {
    return this.service.addOne(dto);
  }

  @Roles('ADMIN')
  @Post('import')
  import(@Body() dto: ImportDto) {
    return this.service.import(dto.rows);
  }

  // Vider entièrement la base des conteneurs.
  @Roles('ADMIN')
  @Delete()
  clear() {
    return this.service.clear();
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
