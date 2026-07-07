import { canTransition, nextStatuses, APPOINTMENT_STATUSES } from './status';

describe('automate de statuts des rendez-vous', () => {
  it('autorise le flux nominal complet', () => {
    expect(canTransition('REQUESTED', 'VALIDATED')).toBe(true);
    expect(canTransition('VALIDATED', 'ASSIGNED')).toBe(true);
    expect(canTransition('ASSIGNED', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'ARRIVED')).toBe(true);
    expect(canTransition('ARRIVED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('interdit les sauts d’étapes', () => {
    expect(canTransition('REQUESTED', 'ARRIVED')).toBe(false);
    expect(canTransition('VALIDATED', 'CONFIRMED')).toBe(false);
    expect(canTransition('ASSIGNED', 'ARRIVED')).toBe(false);
    expect(canTransition('CONFIRMED', 'IN_PROGRESS')).toBe(false);
  });

  it('interdit le retour en arrière', () => {
    expect(canTransition('CONFIRMED', 'ASSIGNED')).toBe(false);
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('ARRIVED', 'CONFIRMED')).toBe(false);
  });

  it('les états terminaux n’ont aucune transition sortante', () => {
    for (const s of ['COMPLETED', 'REJECTED', 'NO_SHOW', 'CANCELLED'] as const) {
      expect(nextStatuses(s)).toHaveLength(0);
      for (const to of APPOINTMENT_STATUSES) expect(canTransition(s, to)).toBe(false);
    }
  });

  it('permet l’annulation depuis les états actifs pré-arrivée', () => {
    expect(canTransition('REQUESTED', 'CANCELLED')).toBe(true);
    expect(canTransition('VALIDATED', 'CANCELLED')).toBe(true);
    expect(canTransition('ASSIGNED', 'CANCELLED')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    // Une fois arrivé au portail, plus d’annulation libre.
    expect(canTransition('ARRIVED', 'CANCELLED')).toBe(false);
  });

  it('no-show seulement depuis CONFIRMED', () => {
    expect(canTransition('CONFIRMED', 'NO_SHOW')).toBe(true);
    expect(canTransition('ASSIGNED', 'NO_SHOW')).toBe(false);
    expect(canTransition('ARRIVED', 'NO_SHOW')).toBe(false);
  });
});
