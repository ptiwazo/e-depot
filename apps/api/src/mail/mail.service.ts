import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');

  constructor(private settings: SettingsService) {}

  /** true si un serveur SMTP est configuré (host renseigné). */
  async isConfigured(): Promise<boolean> {
    return !!(await this.settings.get('smtp_host'));
  }

  private async transport(): Promise<nodemailer.Transporter | null> {
    const host = (await this.settings.get('smtp_host')).trim();
    if (!host) return null;
    const port = await this.settings.getInt('smtp_port');
    const user = (await this.settings.get('smtp_user')).trim();
    const pass = await this.settings.get('smtp_password');
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = TLS implicite ; 587/25 = STARTTLS
      auth: user ? { user, pass } : undefined,
    });
  }

  /**
   * Envoie un e-mail. Ne lève jamais : renvoie { ok, error? } pour que l'appelant
   * (notification métier) ne soit pas interrompu si le SMTP est mal configuré.
   */
  async send(to: string, subject: string, text: string, html?: string): Promise<{ ok: boolean; error?: string }> {
    if (!to) return { ok: false, error: 'destinataire manquant' };
    try {
      const t = await this.transport();
      if (!t) return { ok: false, error: 'SMTP non configuré' };
      const from = (await this.settings.get('smtp_from')).trim() || (await this.settings.get('smtp_user')).trim();
      if (!from) return { ok: false, error: "adresse d'expédition manquante" };
      await t.sendMail({ from, to, subject, text, html });
      return { ok: true };
    } catch (e: any) {
      const error = e?.message ?? 'erreur inconnue';
      this.logger.warn(`Envoi e-mail échoué (${to}) : ${error}`);
      return { ok: false, error };
    }
  }
}
