import { validateContainer, iso6346CheckDigit } from './container';

describe('ISO 6346 container validation', () => {
  it('computes the correct check digit', () => {
    // CSQU3054383 est l'exemple canonique de la norme ISO 6346 (contrôle = 3).
    expect(iso6346CheckDigit('CSQU305438')).toBe(3);
  });

  it('accepts a valid MSC container', () => {
    // MSCU6639870 : chiffre de contrôle ISO 6346 valide.
    const r = validateContainer('mscu 6639870');
    expect(r.valid).toBe(true);
    expect(r.isMsc).toBe(true);
    expect(r.normalized).toBe('MSCU6639870');
  });

  it('rejects a bad check digit', () => {
    const r = validateContainer('MSCU6639871');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/contrôle/i);
  });

  it('rejects a malformed number', () => {
    expect(validateContainer('ABC123').valid).toBe(false);
    expect(validateContainer('MSCU66398711').valid).toBe(false);
  });

  it('flags a valid but non-MSC container', () => {
    // TCLU1234568 (Triton) — numéro ISO valide mais hors périmètre MSC.
    const r = validateContainer('TCLU1234568');
    expect(r.valid).toBe(true);
    expect(r.isMsc).toBe(false);
    expect(r.reason).toMatch(/non-MSC/i);
  });
});
