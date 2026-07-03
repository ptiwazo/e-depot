/**
 * Code combiné taille + type de conteneur (ISO 6346 size-type), ex. :
 * 20DV (20' Dry Van), 40HC (40' High Cube), 40HR (40' High Cube Reefer), 45HC…
 */

export const COMMON_SIZE_TYPES = [
  '20DV', '20RF', '20OT', '20FR', '20TK',
  '40DV', '40HC', '40HR', '40RF', '40OT', '40FR',
  '45HC',
];

export function normalizeSizeType(v: string): string {
  return (v || '').toUpperCase().replace(/\s+/g, '');
}

/** Format accepté : 2 chiffres (taille) + 2 à 3 caractères (type), ex. 40HC, 22G1. */
export function isValidSizeType(v: string): boolean {
  return /^\d{2}[A-Z0-9]{2,3}$/.test(normalizeSizeType(v));
}

/** Conteneur réfrigéré déduit du code (RF/RE/RT/HR ou groupe reefer R + chiffre). */
export function isReeferType(v: string): boolean {
  return /RF|RE|RT|HR|R\d/.test(normalizeSizeType(v));
}
