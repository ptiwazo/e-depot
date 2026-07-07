import { ManifestService } from './manifest.service';
import { ContainerRecord } from '../containers/container.repository';

// Repo en mémoire minimal pour tester la logique d'import (normalizeRow).
function makeRepo() {
  const store: ContainerRecord[] = [];
  return {
    readOnly: false,
    upsert: jest.fn(async (rec: ContainerRecord) => {
      store.push(rec);
      return rec;
    }),
    findByNumber: jest.fn(),
    list: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    _store: store,
  };
}

describe('ManifestService — import de toute la base', () => {
  it('intègre les conteneurs non-MSC', async () => {
    const repo = makeRepo();
    const svc = new ManifestService(repo as any, {} as any);
    const res = await svc.import([
      { containerNumber: 'MSCU6639870', blNumber: 'BL1', containerType: '40HC' }, // MSC
      { containerNumber: 'TCLU1234568', blNumber: 'BL2', containerType: '20DV' }, // non-MSC
    ]);
    expect(res.imported).toBe(2);
    expect(res.ignored).toBe(0);
    expect(repo._store.map((r) => r.containerNumber)).toContain('TCLU1234568');
  });

  it('accepte un numéro hors format ISO strict (toute la base)', async () => {
    const repo = makeRepo();
    const svc = new ManifestService(repo as any, {} as any);
    const res = await svc.import([{ containerNumber: 'abc 123', blNumber: 'bl9' }]);
    expect(res.imported).toBe(1);
    expect(repo._store[0].containerNumber).toBe('ABC123'); // normalisé (MAJ, sans espace)
    expect(repo._store[0].blNumber).toBe('BL9');
  });

  it('ignore uniquement les lignes sans conteneur ou sans BL', async () => {
    const repo = makeRepo();
    const svc = new ManifestService(repo as any, {} as any);
    const res = await svc.import([
      { containerNumber: 'MSCU6639870', blNumber: '' }, // BL manquant → ignoré
      { containerNumber: '', blNumber: 'BL3' }, // conteneur manquant → ignoré
      { containerNumber: 'MEDU1234562', blNumber: 'BL4' }, // ok
    ]);
    expect(res.imported).toBe(1);
    expect(res.ignored).toBe(2);
    expect(res.errors).toHaveLength(2);
  });

  it('conserve un code taille-type hors référentiel plutôt que de rejeter la ligne', async () => {
    const repo = makeRepo();
    const svc = new ManifestService(repo as any, {} as any);
    const res = await svc.import([{ containerNumber: 'MSCU6639870', blNumber: 'BL5', containerType: 'CONTENEUR' }]);
    expect(res.imported).toBe(1);
    expect(repo._store[0].containerType).toBe('CONTENEUR');
  });
});
