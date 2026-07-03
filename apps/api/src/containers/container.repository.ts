// Abstraction d'accès à la BASE DES CONTENEURS vides attendus (manifeste MEDLOG).
// Source : table ContainerManifest (Prisma / PostgreSQL).

export const CONTAINER_REPOSITORY = 'CONTAINER_REPOSITORY';

export interface ContainerRecord {
  id?: string;
  containerNumber: string;
  blNumber: string;
  containerType: string;
  consignee: string | null;
  transporteur?: string | null;
}

export interface ContainerRepository {
  /** true = source en lecture seule (les écritures sont refusées). */
  readonly readOnly: boolean;

  /** Recherche exacte par numéro de conteneur (déjà normalisé MAJ sans espaces). */
  findByNumber(containerNumber: string): Promise<ContainerRecord | null>;

  /** Liste (admin) avec recherche facultative sur conteneur/BL. */
  list(search?: string): Promise<ContainerRecord[]>;

  /** Nombre total d'entrées. */
  count(): Promise<number>;

  /** Ajout/mise à jour — lève une erreur si readOnly. */
  upsert(rec: ContainerRecord): Promise<ContainerRecord>;

  /** Suppression — lève une erreur si readOnly. */
  remove(id: string): Promise<void>;
}
