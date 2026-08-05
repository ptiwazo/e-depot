import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/**
 * Normalise un numéro en format international (+225… pour la Côte d'Ivoire).
 * Renvoie null si le numéro est inexploitable.
 */
export function normalizeCIPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let s = String(raw).replace(/[\s().\-]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) return /^\+\d{8,15}$/.test(s) ? s : null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  else if (s.startsWith('225')) s = '+' + s;
  else if (/^0\d{9}$/.test(s)) s = '+225' + s; // numéro local CI (10 chiffres, ex. 0707776408)
  else if (/^\d{8,15}$/.test(s)) s = '+' + s; // dernier recours
  else return null;
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger('WhatsappService');

  constructor(private settings: SettingsService) {}

  private async provider(): Promise<string> {
    return ((await this.settings.get('whatsapp_provider')) || 'ultramsg').trim().toLowerCase();
  }

  /** true si la messagerie WhatsApp est configurée (selon le fournisseur choisi). */
  async isConfigured(): Promise<boolean> {
    const token = (await this.settings.get('whatsapp_token')).trim();
    const url = (await this.settings.get('whatsapp_api_url')).trim();
    if (!token || !url) return false;
    if ((await this.provider()) === 'infobip') {
      return !!(await this.settings.get('whatsapp_sender')).trim();
    }
    return true;
  }

  /**
   * Envoie un message WhatsApp via le fournisseur configuré (UltraMsg ou Infobip).
   * Ne lève jamais : renvoie { ok, error? }.
   */
  async send(rawTo: string, body: string): Promise<{ ok: boolean; error?: string }> {
    const to = normalizeCIPhone(rawTo);
    if (!to) return { ok: false, error: 'numéro invalide' };
    const base = (await this.settings.get('whatsapp_api_url')).trim();
    const token = (await this.settings.get('whatsapp_token')).trim();
    if (!base || !token) return { ok: false, error: 'WhatsApp non configuré' };
    try {
      if ((await this.provider()) === 'infobip') return await this.sendInfobip(base, token, to, body);
      return await this.sendUltramsg(base, token, to, body);
    } catch (e: any) {
      const error = e?.name === 'AbortError' ? 'délai dépassé (12s)' : e?.message ?? 'erreur inconnue';
      this.logger.warn(`WhatsApp échec (${to}) : ${error}`);
      return { ok: false, error };
    }
  }

  // --- UltraMsg : POST {base}/messages/chat (form-urlencoded) --------------
  private async sendUltramsg(base: string, token: string, to: string, body: string) {
    const url = base.replace(/\/+$/, '') + '/messages/chat';
    const params = new URLSearchParams({ token, to, body });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json: any = await res.json().catch(() => ({}));
    if (json?.sent === 'true' || json?.sent === true || json?.id) return { ok: true };
    return { ok: false, error: json?.error || json?.message || `HTTP ${res.status}` };
  }

  // --- Infobip : POST https://{base}/whatsapp/1/message/text (JSON) --------
  private async sendInfobip(base: string, apiKey: string, to: string, body: string) {
    const sender = (await this.settings.get('whatsapp_sender')).trim();
    if (!sender) return { ok: false, error: 'Expéditeur WhatsApp (sender) manquant — renseignez « Numéro expéditeur » dans les paramètres.' };
    const host = base.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const url = `https://${host}/whatsapp/1/message/text`;
    const toDigits = to.replace(/^\+/, ''); // Infobip attend le numéro sans le « + »
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ from: sender, to: toDigits, content: { text: body } }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json: any = await res.json().catch(() => ({}));
    if (res.ok) {
      // Réponse /message/text : statut au niveau racine ; /message (bulk) : messages[].status.
      const st = json?.status || json?.messages?.[0]?.status;
      if (st && ['REJECTED', 'UNDELIVERABLE'].includes(st.groupName)) {
        return { ok: false, error: st.description || st.name || 'message rejeté' };
      }
      return { ok: true };
    }
    const err =
      json?.requestError?.serviceException?.text ||
      json?.requestError?.serviceException?.messageId ||
      `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
}
