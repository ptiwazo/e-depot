import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Paramètres connus + valeurs par défaut (servent tant qu'aucune valeur n'est enregistrée en base).
export const SETTING_DEFAULTS = {
  lead_hours_propre_moyen: '48', // préavis mini (h) si le conteneur est en « propre moyen »
  lead_hours_default: '24', // préavis mini (h) dans les autres cas
  propre_moyen_label: 'propre moyen', // valeur du champ « transporteur » qui déclenche le préavis renforcé
  gate_grace_minutes: '30', // tolérance (min) avant/après le créneau pour la validation opérateur
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

// Normalisation pour comparer les libellés : minuscules, sans accents, espaces compactés.
const norm = (s?: string | null) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: SettingKey): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key];
  }

  async getInt(key: SettingKey): Promise<number> {
    const n = parseInt(await this.get(key), 10);
    return Number.isFinite(n) && n >= 0 ? n : parseInt(SETTING_DEFAULTS[key], 10);
  }

  /** Valeurs effectives (stockées ou par défaut) des paramètres connus. */
  async getAll(): Promise<Record<SettingKey, string>> {
    const result = { ...SETTING_DEFAULTS } as Record<SettingKey, string>;
    const rows = await this.prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    for (const r of rows) result[r.key as SettingKey] = r.value;
    return result;
  }

  set(key: SettingKey, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /**
   * Délai de préavis minimum applicable à un conteneur selon la valeur de son
   * champ « transporteur » (« propre moyen » → délai renforcé).
   */
  async leadHoursFor(transporteur?: string | null): Promise<{ propreMoyen: boolean; minHours: number }> {
    const propreMoyen = norm(transporteur) === norm(await this.get('propre_moyen_label'));
    const minHours = propreMoyen
      ? await this.getInt('lead_hours_propre_moyen')
      : await this.getInt('lead_hours_default');
    return { propreMoyen, minHours };
  }
}
