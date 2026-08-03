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

  /** true si un token UltraMsg et une URL d'instance sont configurés. */
  async isConfigured(): Promise<boolean> {
    const token = (await this.settings.get('whatsapp_token')).trim();
    const url = (await this.settings.get('whatsapp_api_url')).trim();
    return !!token && !!url;
  }

  /**
   * Envoie un message WhatsApp via UltraMsg (endpoint messages/chat).
   * Ne lève jamais : renvoie { ok, error? }.
   */
  async send(rawTo: string, body: string): Promise<{ ok: boolean; error?: string }> {
    const to = normalizeCIPhone(rawTo);
    if (!to) return { ok: false, error: 'numéro invalide' };
    const base = (await this.settings.get('whatsapp_api_url')).trim();
    const token = (await this.settings.get('whatsapp_token')).trim();
    if (!base || !token) return { ok: false, error: 'WhatsApp non configuré' };
    const url = base.replace(/\/+$/, '') + '/messages/chat';
    try {
      const params = new URLSearchParams({ token, to, body });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json: any = await res.json().catch(() => ({}));
      // UltraMsg : succès = { sent: "true", id: ... } ; échec = { error: ... }
      if (json?.sent === 'true' || json?.sent === true || json?.id) return { ok: true };
      return { ok: false, error: json?.error || json?.message || `HTTP ${res.status}` };
    } catch (e: any) {
      const error = e?.name === 'AbortError' ? 'délai dépassé (20s)' : e?.message ?? 'erreur inconnue';
      this.logger.warn(`WhatsApp échec (${to}) : ${error}`);
      return { ok: false, error };
    }
  }
}
