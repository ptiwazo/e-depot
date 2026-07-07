import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional } from 'class-validator';
import { SettingsService, SETTING_KEYS, SettingKey } from './settings.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles';

class SmtpTestDto {
  @IsOptional() @IsEmail() to?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService, private mail: MailService) {}

  @Get()
  getAll() {
    return this.publicSettings();
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
      } else if (key === 'smtp_port') {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
          throw new BadRequestException('Port SMTP invalide (1–65535).');
        }
        await this.settings.set(key, String(n));
      } else if (key === 'smtp_password' || key === 'ai_api_key') {
        // Secret masqué : on ne met à jour que si une nouvelle valeur est fournie.
        if (raw) await this.settings.set(key, raw);
      } else if (key.startsWith('smtp_') || key.startsWith('ai_')) {
        // Champs SMTP / IA facultatifs : vide autorisé (= fonctionnalité désactivée).
        await this.settings.set(key, raw);
      } else {
        if (!raw) throw new BadRequestException(`Valeur vide interdite pour « ${key} ».`);
        await this.settings.set(key as SettingKey, raw);
      }
    }
    return this.publicSettings();
  }

  // Envoi d'un e-mail de test avec la configuration SMTP courante.
  @Post('smtp-test')
  async smtpTest(@Body() dto: SmtpTestDto) {
    const to = dto.to || (await this.settings.get('smtp_from')) || (await this.settings.get('smtp_user'));
    if (!to) throw new BadRequestException('Aucune adresse de destination (renseignez « to » ou l\'adresse d\'expédition).');
    const res = await this.mail.send(
      to,
      'e-depot — test de configuration SMTP',
      'Ceci est un e-mail de test envoyé depuis e-depot. Si vous le recevez, la configuration SMTP est fonctionnelle.',
    );
    if (!res.ok) throw new BadRequestException(`Échec de l'envoi : ${res.error}`);
    return { sent: true, to };
  }

  /** Réponse publique : les secrets (mot de passe SMTP, clé API IA) ne sont jamais renvoyés. */
  private async publicSettings() {
    const all = await this.settings.getAll();
    return {
      ...all,
      smtp_password: '',
      smtp_password_set: !!all.smtp_password,
      ai_api_key: '',
      ai_api_key_set: !!all.ai_api_key,
    };
  }
}
