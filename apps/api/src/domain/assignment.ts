/**
 * Moteur d'affectation automatique OFF-DOCK.
 *
 * RÈGLE MÉTIER MAJEURE : le transporteur ne choisit JAMAIS l'OFF-DOCK.
 * Il choisit la date et le SHIFT souhaités ; le système sélectionne le meilleur
 * OFF-DOCK ayant de la capacité sur ce shift, en équilibrant la charge entre les
 * sites (capacité, congestion, distance). Fonctions pures = testables sans base.
 */

import { isReeferType } from './sizetype';

// Configuration par défaut des shifts (postes portuaires). Modifiable par l'admin
// et persistée en base ; ces valeurs servent uniquement au seed initial.
export const DEFAULT_SHIFTS = [
  { code: 'JOUR', label: 'Shift Jour', startTime: '07:30', endTime: '19:30', order: 1 },
  { code: 'NUIT', label: 'Shift Nuit', startTime: '19:30', endTime: '07:30', order: 2 },
] as const;

export interface ShiftConfig {
  code: string;
  label: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface Shift {
  code: string;
  label: string;
  start: Date;
  end: Date;
}

export interface OffDockState {
  id: string;
  code: string;
  dailyCapacity: number;
  shiftCapacity: number; // conteneurs acceptés par shift
  congestion: number; // 0..1 : saturation opérationnelle courante
  acceptsReefer: boolean;
  active: boolean;
  distanceKm: number; // distance depuis l'origine du transporteur
  dailyLoad: number; // RDV déjà affectés ce jour-là
  shiftLoads: Record<string, number>; // clé = ISO du début de shift -> nb RDV
}

export interface AssignmentResult {
  offDockId: string;
  offDockCode: string;
  shiftCode: string;
  shiftLabel: string;
  slotStart: Date;
  slotEnd: Date;
  score: number;
}

// Pondération du score (somme = 1). Priorité à l'équilibrage de charge.
const WEIGHTS = { load: 0.5, congestion: 0.3, distance: 0.2 };
const MAX_DISTANCE_KM = 60; // borne de normalisation de la distance

/**
 * Construit les bornes horaires d'un shift pour une date donnée.
 * Si l'heure de fin est <= l'heure de début, le shift franchit minuit (nuit).
 */
export function buildShift(day: Date, cfg: ShiftConfig): Shift {
  const [sh, sm] = cfg.startTime.split(':').map(Number);
  const [eh, em] = cfg.endTime.split(':').map(Number);
  const start = new Date(day);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(day);
  end.setHours(eh, em, 0, 0);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return { code: cfg.code, label: cfg.label, start, end };
}

/** Score d'un OFF-DOCK (0..1, plus haut = meilleur choix). */
export function scoreOffDock(offDock: OffDockState): number {
  const loadRatio = Math.min(1, offDock.dailyLoad / Math.max(1, offDock.dailyCapacity));
  const distanceRatio = Math.min(1, offDock.distanceKm / MAX_DISTANCE_KM);
  return (
    WEIGHTS.load * (1 - loadRatio) +
    WEIGHTS.congestion * (1 - offDock.congestion) +
    WEIGHTS.distance * (1 - distanceRatio)
  );
}

/**
 * Sélectionne le meilleur OFF-DOCK pour un conteneur sur le SHIFT choisi.
 * Renvoie null si aucun site éligible (aucune capacité disponible sur ce shift).
 */
export function selectOffDockForShift(
  offDocks: OffDockState[],
  shift: Shift,
  containerType: string,
): AssignmentResult | null {
  const isReefer = isReeferType(containerType);
  const key = shift.start.toISOString();

  const eligible = offDocks
    .filter((o) => o.active)
    .filter((o) => o.dailyLoad < o.dailyCapacity)
    .filter((o) => (isReefer ? o.acceptsReefer : true))
    .filter((o) => (o.shiftLoads[key] ?? 0) < o.shiftCapacity)
    .map((o) => ({ offDock: o, score: scoreOffDock(o) }))
    .sort((a, b) => b.score - a.score);

  if (!eligible.length) return null;

  const best = eligible[0];
  return {
    offDockId: best.offDock.id,
    offDockCode: best.offDock.code,
    shiftCode: shift.code,
    shiftLabel: shift.label,
    slotStart: shift.start,
    slotEnd: shift.end,
    score: Number(best.score.toFixed(4)),
  };
}
