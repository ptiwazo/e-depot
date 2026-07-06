import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService, SETTING_KEYS, SettingKey } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @Patch()
  async update(@Body() body: Record<string, unknown>) {
    for (const key of SETTING_KEYS) {
      if (!(key in body)) continue;
      const raw = String(body[key] ?? '').trim();
      if (key.includes('hours') || key.includes('minutes')) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          throw new BadRequestException(`Valeur invalide pour « ${key} » (entier positif).`);
        }
        await this.settings.set(key, String(n));
      } else {
        if (!raw) throw new BadRequestException(`Valeur vide interdite pour « ${key} ».`);
        await this.settings.set(key as SettingKey, raw);
      }
    }
    return this.settings.getAll();
  }
}
