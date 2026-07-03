/**
 * Validation des numéros de conteneur selon la norme ISO 6346
 * et application de la règle de propriété MSC (e-depot n'accepte QUE
 * les conteneurs vides appartenant au groupe MSC/MEDLOG).
 */

// Préfixes propriétaires (owner code) appartenant au groupe MSC.
// Le 4e caractère est toujours la catégorie d'équipement 'U' (unité de transport).
export const MSC_OWNER_PREFIXES = [
  'MSCU', // MSC — préfixe principal
  'MEDU', // Mediterranean Shipping / MEDLOG
  'MSDU',
  'MSMU',
  'MSZU',
  'MSWU',
  'MSNU',
  'MSFU',
];

// Valeurs des lettres pour le calcul du chiffre d'auto-contrôle ISO 6346.
// A=10 ... Z=38, en sautant les multiples de 11 (11, 22, 33).
function letterValue(ch: string): number {
  const table: Record<string, number> = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  };
  return table[ch];
}

export interface ContainerCheck {
  valid: boolean;       // format ISO 6346 + chiffre de contrôle corrects
  isMsc: boolean;       // appartient au groupe MSC
  reason?: string;
  normalized?: string;  // sans espaces, en majuscules
}

/**
 * Calcule le chiffre d'auto-contrôle ISO 6346 (0-9) à partir des 10 premiers
 * caractères (4 lettres + 6 chiffres).
 */
export function iso6346CheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    const value = i < 4 ? letterValue(ch) : Number(ch);
    sum += value * Math.pow(2, i);
  }
  const mod = sum % 11;
  return mod === 10 ? 0 : mod;
}

/**
 * Valide un numéro de conteneur et détermine s'il relève de MSC.
 */
export function validateContainer(raw: string): ContainerCheck {
  if (!raw) return { valid: false, isMsc: false, reason: 'Numéro requis' };

  const normalized = raw.replace(/\s+/g, '').toUpperCase();

  // Format ISO 6346 : 4 lettres + 7 chiffres (le dernier = chiffre de contrôle).
  if (!/^[A-Z]{4}\d{7}$/.test(normalized)) {
    return {
      valid: false,
      isMsc: false,
      normalized,
      reason: 'Format invalide (attendu : 4 lettres + 7 chiffres, ex. MSCU1234565)',
    };
  }

  // 4e lettre = catégorie d'équipement, doit être U/J/Z.
  if (!['U', 'J', 'Z'].includes(normalized[3])) {
    return {
      valid: false,
      isMsc: false,
      normalized,
      reason: 'Code catégorie d\'équipement invalide (4e caractère)',
    };
  }

  const expected = iso6346CheckDigit(normalized.slice(0, 10));
  const actual = Number(normalized[10]);
  if (expected !== actual) {
    return {
      valid: false,
      isMsc: false,
      normalized,
      reason: `Chiffre de contrôle ISO 6346 invalide (attendu ${expected})`,
    };
  }

  const isMsc = MSC_OWNER_PREFIXES.includes(normalized.slice(0, 4));
  if (!isMsc) {
    return {
      valid: true,
      isMsc: false,
      normalized,
      reason: 'Conteneur non-MSC : retour OFF-DOCK MEDLOG refusé',
    };
  }

  return { valid: true, isMsc: true, normalized };
}
