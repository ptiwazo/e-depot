import { isReeferType, isValidSizeType, normalizeSizeType } from './sizetype';

describe('container size-type codes', () => {
  it('normalizes input', () => {
    expect(normalizeSizeType(' 40 hc ')).toBe('40HC');
  });

  it('validates common codes', () => {
    for (const c of ['20DV', '40HC', '40HR', '45HC', '20RF', '22G1']) {
      expect(isValidSizeType(c)).toBe(true);
    }
    expect(isValidSizeType('DRY')).toBe(false);
    expect(isValidSizeType('4')).toBe(false);
  });

  it('detects reefer from the combined code', () => {
    expect(isReeferType('40HR')).toBe(true);
    expect(isReeferType('20RF')).toBe(true);
    expect(isReeferType('40RF')).toBe(true);
    expect(isReeferType('45R1')).toBe(true);
    // Non-reefer :
    expect(isReeferType('40HC')).toBe(false);
    expect(isReeferType('20DV')).toBe(false);
    expect(isReeferType('40FR')).toBe(false); // flat rack, pas reefer
    expect(isReeferType('20OT')).toBe(false);
  });
});
