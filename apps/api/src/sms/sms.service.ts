import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import { normalizeCIPhone } from '../whatsapp/whatsapp.service';

/**
 * Envoi de SMS via la passerelle SMG4008-8G (email -> SMS).
 * On envoie un e-mail à la boîte surveillée par la passerelle :
 *   - Objet = "00" + numéro international (ex. 002250707776408)
 *   - Corps = "[SMS]" + texte + "[End]"
 *
 * Deux transports pour DÉPOSER l'e-mail :
 *   - "smtp"  : envoi direct via SMTP (fonctionne on-premise ; bloqué sur Render).
 *   - "brevo" : envoi via l'API HTTP Brevo (fonctionne depuis le cloud / Render).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SmsService');

  constructor(private settings: SettingsService) {}

  private async transportMode(): Promise<string> {
    return ((await this.settings.get('sms_transport')) || 'smtp').trim().toLowerCase();
  }

  /** true si la passerelle SMS est configurée (selon le transport choisi). */
  async isConfigured(): Promise<boolean> {
    const from = (await this.settings.get('sms_smtp_user')).trim();
    const gw = (await this.settings.get('sms_gateway_email')).trim();
    if (!from || !gw) return false;
    if ((await this.transportMode()) === 'brevo') {
      return !!(await this.settings.get('sms_brevo_key')).trim();
    }
    const host = (await this.settings.get('sms_smtp_host')).trim();
    const pass = await this.settings.get('sms_smtp_password');
    return !!host && !!pass;
  }

  /** Envoie un SMS via la passerelle. Ne lève jamais : renvoie { ok, error? }. */
  async send(rawTo: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const norm = normalizeCIPhone(rawTo);
    if (!norm) return { ok: false, error: 'numéro invalide' };
    const digits = norm.replace(/^\+/, ''); // international sans le « + »
    const subject = '00' + digits; // format attendu par la passerelle (ex. 002250707776408)
    const body = '[SMS]' + text + '[End]';
    const from = (await this.settings.get('sms_smtp_user')).trim();
    const gw = (await this.settings.get('sms_gateway_email')).trim();
    if (!from || !gw) return { ok: false, error: 'passerelle SMS non configurée' };
    try {
      if ((await this.transportMode()) === 'brevo') return await this.sendBrevo(from, gw, subject, body);
      return await this.sendSmtp(from, gw, subject, body);
    } catch (e: any) {
      const error = e?.name === 'AbortError' ? 'délai dépassé (12s)' : e?.message ?? 'erreur inconnue';
      this.logger.warn(`SMS échec (${digits}) : ${error}`);
      return { ok: false, error };
    }
  }

  // --- Transport BREVO (API HTTP, port 443 — fonctionne depuis Render) -----
  private async sendBrevo(from: string, gw: string, subject: string, body: string) {
    const key = (await this.settings.get('sms_brevo_key')).trim();
    if (!key) return { ok: false, error: 'clé API Brevo manquante' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: 'MEDLOG e-depot' },
        to: [{ email: gw }],
        subject,
        textContent: body,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) return { ok: true };
    const j: any = await res.json().catch(() => ({}));
    return { ok: false, error: j?.message || `HTTP ${res.status}` };
  }

  // --- Transport SMTP direct (on-premise) ----------------------------------
  private async sendSmtp(from: string, gw: string, subject: string, body: string) {
    const host = (await this.settings.get('sms_smtp_host')).trim();
    if (!host) return { ok: false, error: 'SMTP non configuré' };
    const port = await this.settings.getInt('sms_smtp_port');
    const user = (await this.settings.get('sms_smtp_user')).trim();
    const pass = await this.settings.get('sms_smtp_password');
    const t = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
    await t.sendMail({ from, to: gw, subject, text: body });
    return { ok: true };
  }
}
