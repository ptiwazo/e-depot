import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import { normalizeCIPhone } from '../whatsapp/whatsapp.service';

/**
 * Envoi de SMS via la passerelle SMG4008-8G (email -> SMS).
 * On envoie un e-mail via SMTP (Gmail) à la boîte surveillée par la passerelle :
 *   - Objet   = "00" + numéro international (ex. 002250707776408)
 *   - Corps   = "[SMS]" + texte + "[End]"
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SmsService');

  constructor(private settings: SettingsService) {}

  /** true si la passerelle SMS est configurée (SMTP + boîte passerelle). */
  async isConfigured(): Promise<boolean> {
    const host = (await this.settings.get('sms_smtp_host')).trim();
    const user = (await this.settings.get('sms_smtp_user')).trim();
    const pass = await this.settings.get('sms_smtp_password');
    const gw = (await this.settings.get('sms_gateway_email')).trim();
    return !!host && !!user && !!pass && !!gw;
  }

  private async transport(): Promise<nodemailer.Transporter | null> {
    const host = (await this.settings.get('sms_smtp_host')).trim();
    if (!host) return null;
    const port = await this.settings.getInt('sms_smtp_port');
    const user = (await this.settings.get('sms_smtp_user')).trim();
    const pass = await this.settings.get('sms_smtp_password');
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = TLS implicite ; 587 = STARTTLS
      auth: user ? { user, pass } : undefined,
      // Timeouts courts : ne jamais bloquer si le SMTP est injoignable.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
  }

  /**
   * Envoie un SMS via la passerelle. Ne lève jamais : renvoie { ok, error? }.
   */
  async send(rawTo: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const norm = normalizeCIPhone(rawTo);
    if (!norm) return { ok: false, error: 'numéro invalide' };
    const digits = norm.replace(/^\+/, ''); // international sans le « + »
    const subject = '00' + digits; // format attendu par la passerelle (ex. 002250707776408)
    const body = '[SMS]' + text + '[End]';
    try {
      const t = await this.transport();
      const from = (await this.settings.get('sms_smtp_user')).trim();
      const gw = (await this.settings.get('sms_gateway_email')).trim();
      if (!t || !from || !gw) return { ok: false, error: 'passerelle SMS non configurée' };
      await t.sendMail({ from, to: gw, subject, text: body });
      return { ok: true };
    } catch (e: any) {
      const error = e?.message ?? 'erreur inconnue';
      this.logger.warn(`SMS échec (${digits}) : ${error}`);
      return { ok: false, error };
    }
  }
}
