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

// Filtres de liste (chaque champ = « contient », insensible à la casse).
export interface ContainerFilter {
  search?: string; // global conteneur/BL
  container?: string;
  bl?: string;
  type?: string;
  client?: string;
  transporteur?: string;
}

export interface ContainerRepository {
  /** true = source en lecture seule (les écritures sont refusées). */
  readonly readOnly: boolean;

  /** Recherche exacte par numéro de conteneur (déjà normalisé MAJ sans espaces). */
  findByNumber(containerNumber: string): Promise<ContainerRecord | null>;

  /** Liste (admin) avec filtres facultatifs par colonne. */
  list(filters?: ContainerFilter): Promise<ContainerRecord[]>;

  /** Nombre total d'entrées. */
  count(): Promise<number>;

  /** Ajout/mise à jour — lève une erreur si readOnly. */
  upsert(rec: ContainerRecord): Promise<ContainerRecord>;

  /** Suppression — lève une erreur si readOnly. */
  remove(id: string): Promise<void>;

  /** Vide toute la base — lève une erreur si readOnly. Renvoie le nombre supprimé. */
  clear(): Promise<number>;
}
