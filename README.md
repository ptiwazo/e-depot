# e-depot — MEDLOG Côte d'Ivoire

Système de **prise de rendez-vous pour le retour des conteneurs vides MSC** vers les
OFF-DOCK MEDLOG CI. Affectation **automatique** du site (le transporteur ne choisit pas),
optimisation de la capacité et du flux camions, QR code au portail, suivi temps réel et analytics.

Monorepo : **NestJS + Prisma (SQLite)** pour l'API · **React + Vite + TypeScript** pour le front.
Thème conforme à la charte *MEDLOG Brand Guidelines 2023*.

## Démarrage rapide

```bash
# à la racine e-depot/
npm install
npm --workspace apps/api run db:setup   # migration Prisma + seed (comptes & données démo)
npm run dev                             # API :3001 + Web :5173
```

Puis ouvrir http://localhost:5173.

> Postgres : dans `apps/api/prisma/schema.prisma`, mettre `provider = "postgresql"` et adapter
> `DATABASE_URL` dans `apps/api/.env`, puis relancer `db:setup`.

## Comptes de démonstration

Mot de passe commun : **`EDepot2026!`**

| Rôle | Email | Portail |
|------|-------|---------|
| Administrateur | `admin@medlog.ci` | Tableau de bord national, OFF-DOCKs, shifts, affectations |
| Agent MEDLOG | `agent@medlog.ci` | File d'affectation OFF-DOCK (recommandation + décision) |
| Opérateur OFF-DOCK | `operateur.vridi@medlog.ci` | Console portail (scan QR + arrivées) |
| Transporteur | `transporteur@ivoiretrans.ci` | Demande de RDV, suivi, QR |
| Chauffeur | `chauffeur@ivoiretrans.ci` | Affectations |
| MSC | `msc@msc.com` | Supervision (lecture seule) |

## Règles métier clés

- **Base conteneurs (chargée par l'admin)** : les retours MSC autorisés (conteneur + BL,
  code taille-type, client) sont chargés par l'administrateur (ajout manuel ou **import Excel
  .xlsx** avec **template téléchargeable**). Une demande n'est **soumise que si le couple
  conteneur + BL figure dans la base** ; le type est repris de la base. Contrôle ISO 6346 à l'import.
- **Code taille-type combiné** (ISO 6346) : `20DV`, `40HC`, `40HR`, `45HC`… Le caractère
  **réfrigéré** est déduit du code (ex. `40HR`) pour le routage vers les OFF-DOCK compatibles.
- **Laissez-passer PDF** : le QR code du rendez-vous est imprimable en PDF (bouton dans le détail).
- **Attelage saisi manuellement** : le transporteur saisit camion, remorque et chauffeur
  (immatriculations + nom/téléphone) directement sur la demande.
- **Shifts (postes portuaires)** : 2 shifts de 12h — Jour (07h30-19h30) et Nuit (19h30-07h30).
  Les horaires sont **configurables par l'admin** (menu Shifts). Le transporteur choisit la
  **date et le shift** souhaités lors de la demande.
- **Affectation OFF-DOCK par un agent MEDLOG** : la demande validée part en file d'attente ; un
  **agent MEDLOG** affecte l'OFF-DOCK. Le moteur de score (charge, congestion, distance depuis le
  Port d'Abidjan, sur le shift choisi) fournit une **recommandation** que l'agent confirme ou
  remplace. Ni le transporteur ni le système n'affectent le site automatiquement.
- **Cycle de vie** : REQUESTED → VALIDATED → ASSIGNED → CONFIRMED → ARRIVED → IN_PROGRESS →
  COMPLETED (+ REJECTED / NO_SHOW / CANCELLED), transitions contrôlées par un automate.
- **QR code** unique par rendez-vous, contrôlé au portail par l'opérateur du site affecté.

## Tests

```bash
npm --workspace apps/api run test   # moteur d'affectation + validation ISO 6346
```

## Structure

```
apps/api   NestJS + Prisma
  src/domain        logique métier pure (container ISO 6346, moteur d'affectation, automate)
  src/appointments  RDV : validation, anti-doublon, affectation, QR, transitions
  src/offdocks      OFF-DOCKs + charge du jour
  src/analytics     KPIs (throughput, no-show, turnaround, occupation)
apps/web   React + Vite (portails Admin / Opérateur / Transporteur / MSC)
```
