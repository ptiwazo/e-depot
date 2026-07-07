import { Controller, Get, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Get('insights')
  insights() {
    return this.ai.insights();
  }
}
