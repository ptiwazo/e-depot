import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validateContainer } from '../domain/container';
import { isValidSizeType, normalizeSizeType } from '../domain/sizetype';
import {
  CONTAINER_REPOSITORY,
  ContainerFilter,
  ContainerRecord,
  ContainerRepository,
} from '../containers/container.repository';
import { SettingsService } from '../settings/settings.service';

export interface ManifestRow {
  containerNumber: string;
  blNumber: string;
  containerType?: string; // code combiné taille+type, ex. 20DV, 40HC, 40HR, 45HC
  consignee?: string;
  transporteur?: string;
}

@Injectable()
export class ManifestService {
  constructor(
    @Inject(CONTAINER_REPOSITORY) private readonly repo: ContainerRepository,
    private readonly settings: SettingsService,
  ) {}

  /** true quand la base est externe (HFSQL) : les écritures sont refusées. */
  get readOnly(): boolean {
    return this.repo.readOnly;
  }

  list(filters?: ContainerFilter) {
    return this.repo.list(filters);
  }

  count() {
    return this.repo.count();
  }

  /** Vide entièrement la base des conteneurs. */
  async clear() {
    this.assertWritable();
    const deleted = await this.repo.clear();
    return { deleted };
  }

  addOne(row: ManifestRow) {
    this.assertWritable();
    const parsed = this.normalizeRow(row);
    if (parsed.error) throw new BadRequestException(parsed.error);
    return this.repo.upsert(parsed.data!);
  }

  /** Import en masse (upsert). Renvoie le décompte importés / ignorés + erreurs. */
  async import(rows: ManifestRow[]) {
    this.assertWritable();
    let imported = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const parsed = this.normalizeRow(row);
      if (parsed.error) {
        errors.push(`Ligne ${i + 1} (${row.containerNumber || '?'}) : ${parsed.error}`);
        continue;
      }
      await this.repo.upsert(parsed.data!);
      imported++;
    }
    return { imported, ignored: errors.length, total: rows.length, errors: errors.slice(0, 20) };
  }

  remove(id: string) {
    this.assertWritable();
    return this.repo.remove(id);
  }

  /** Vérifie qu'un couple (conteneur, BL) figure dans la base avant soumission. */
  async verify(container: string, bl: string) {
    const containerNumber = (container || '').replace(/\s+/g, '').toUpperCase();
    const entry = await this.repo.findByNumber(containerNumber);
    if (!entry) {
      return { found: false, blMatch: false, message: 'Conteneur absent de la base MEDLOG' };
    }
    const blMatch = entry.blNumber === (bl || '').trim().toUpperCase();
    const { propreMoyen, minHours } = await this.settings.leadHoursFor(entry.transporteur);
    return {
      found: true,
      blMatch,
      containerType: entry.containerType,
      consignee: entry.consignee,
      transporteur: entry.transporteur ?? null,
      propreMoyen,
      minLeadHours: minHours,
      message: blMatch ? 'Conteneur et BL vérifiés' : 'Le BL ne correspond pas à ce conteneur',
    };
  }

  private assertWritable() {
    if (this.repo.readOnly) {
      throw new BadRequestException('Base conteneurs en lecture seule.');
    }
  }

  private normalizeRow(row: ManifestRow): { data?: ContainerRecord; error?: string } {
    const containerNumber = (row.containerNumber || '').replace(/\s+/g, '').toUpperCase();
    const blNumber = (row.blNumber || '').trim().toUpperCase();
    if (!containerNumber || !blNumber) return { error: 'Conteneur et BL requis' };

    const check = validateContainer(containerNumber);
    if (!check.valid) return { error: check.reason || 'Numéro de conteneur invalide' };
    if (!check.isMsc) return { error: 'Conteneur non-MSC (hors périmètre)' };

    const containerType = normalizeSizeType(row.containerType || '20DV');
    if (!isValidSizeType(containerType)) {
      return { error: `Code taille-type invalide : ${containerType} (ex. attendu 20DV, 40HC, 40HR, 45HC)` };
    }

    return {
      data: {
        containerNumber,
        blNumber,
        containerType,
        consignee: row.consignee || null,
        transporteur: row.transporteur?.trim() || null,
      },
    };
  }
}
