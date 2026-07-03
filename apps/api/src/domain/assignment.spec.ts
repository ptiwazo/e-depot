import {
  selectOffDockForShift,
  scoreOffDock,
  buildShift,
  DEFAULT_SHIFTS,
  OffDockState,
} from './assignment';

function offDock(partial: Partial<OffDockState> & { id: string }): OffDockState {
  return {
    code: partial.id.toUpperCase(),
    dailyCapacity: 200,
    shiftCapacity: 100,
    congestion: 0,
    acceptsReefer: true,
    active: true,
    distanceKm: 10,
    dailyLoad: 0,
    shiftLoads: {},
    ...partial,
  };
}

const day = new Date('2026-07-03T00:00:00');
const jour = buildShift(day, DEFAULT_SHIFTS[0]);
const nuit = buildShift(day, DEFAULT_SHIFTS[1]);

describe('shift construction', () => {
  it('builds the day shift 07:30 -> 19:30', () => {
    expect(jour.code).toBe('JOUR');
    expect(jour.start.getHours()).toBe(7);
    expect(jour.start.getMinutes()).toBe(30);
    expect(jour.end.getHours()).toBe(19);
    expect(jour.end.getDate()).toBe(jour.start.getDate());
  });

  it('night shift 19:30 -> 07:30 crosses midnight', () => {
    expect(nuit.start.getHours()).toBe(19);
    expect(nuit.end.getHours()).toBe(7);
    expect(nuit.end.getDate()).toBe(nuit.start.getDate() + 1);
  });

  it('supports admin-configured custom hours', () => {
    const custom = buildShift(day, { code: 'JOUR', label: 'Jour', startTime: '06:00', endTime: '18:00' });
    expect(custom.start.getHours()).toBe(6);
    expect(custom.end.getHours()).toBe(18);
  });
});

describe('off-dock selection for a chosen shift', () => {
  it('prefers the least-loaded off-dock (load balancing)', () => {
    const docks = [offDock({ id: 'a', dailyLoad: 180 }), offDock({ id: 'b', dailyLoad: 10 })];
    expect(selectOffDockForShift(docks, jour, 'DRY')?.offDockId).toBe('b');
  });

  it('penalizes congestion', () => {
    const docks = [offDock({ id: 'a', congestion: 0.9 }), offDock({ id: 'b', congestion: 0.1 })];
    expect(selectOffDockForShift(docks, jour, 'DRY')?.offDockId).toBe('b');
  });

  it('excludes inactive and daily-full off-docks', () => {
    const docks = [
      offDock({ id: 'a', active: false }),
      offDock({ id: 'b', dailyCapacity: 50, dailyLoad: 50 }),
      offDock({ id: 'c', dailyLoad: 40 }),
    ];
    expect(selectOffDockForShift(docks, jour, 'DRY')?.offDockId).toBe('c');
  });

  it('excludes off-docks whose chosen shift is already full', () => {
    const docks = [
      offDock({ id: 'a', shiftCapacity: 2, shiftLoads: { [jour.start.toISOString()]: 2 } }),
      offDock({ id: 'b', dailyLoad: 50 }),
    ];
    expect(selectOffDockForShift(docks, jour, 'DRY')?.offDockId).toBe('b');
  });

  it('routes reefer containers only to reefer-capable sites', () => {
    const docks = [
      offDock({ id: 'a', acceptsReefer: false, dailyLoad: 0 }),
      offDock({ id: 'b', acceptsReefer: true, dailyLoad: 150 }),
    ];
    expect(selectOffDockForShift(docks, jour, 'REEFER')?.offDockId).toBe('b');
  });

  it('returns the chosen shift code/label in the result', () => {
    const res = selectOffDockForShift([offDock({ id: 'a' })], nuit, 'DRY');
    expect(res?.shiftCode).toBe('NUIT');
    expect(res?.shiftLabel).toBe('Shift Nuit');
  });

  it('returns null when no site is available on that shift', () => {
    const docks = [offDock({ id: 'a', shiftCapacity: 1, shiftLoads: { [jour.start.toISOString()]: 1 } })];
    expect(selectOffDockForShift(docks, jour, 'DRY')).toBeNull();
  });

  it('exposes 2 default shifts', () => {
    expect(DEFAULT_SHIFTS).toHaveLength(2);
    expect(DEFAULT_SHIFTS.map((s) => s.code)).toEqual(['JOUR', 'NUIT']);
  });
});
