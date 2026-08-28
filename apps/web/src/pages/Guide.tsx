import { useState } from 'react';
import { useAuth } from '../auth';
import { Layout } from '../components';

type Item = { t: string; d: string };
type Section = { h: string; items: Item[] };
type RoleGuide = { title: string; tagline: string; sections: Section[] };

const GUIDES: Record<string, RoleGuide> = {
  TRANSPORTER: {
    title: 'Transporteur',
    tagline: 'Réserver et suivre vos retours de conteneurs vides MSC.',
    sections: [
      {
        h: 'Créer une demande de rendez-vous',
        items: [
          { t: 'Ouvrez « Nouvelle demande »', d: 'Dans le menu de gauche.' },
          { t: 'Saisissez le conteneur et le BL', d: 'Ils doivent figurer dans la base MEDLOG : la vérification est automatique et affiche le préavis applicable.' },
          { t: 'Renseignez l’attelage', d: 'Camion, remorque, chauffeur — et le téléphone du chauffeur pour qu’il reçoive le SMS.' },
          { t: 'Choisissez la date et le shift souhaités', d: 'Jour ou Nuit. L’OFF-DOCK, lui, est affecté par MEDLOG (jamais par vous).' },
          { t: 'Respectez le préavis', d: '24 h en standard, 48 h pour les conteneurs « propre moyen ».' },
        ],
      },
      {
        h: 'Après la soumission',
        items: [
          { t: 'Un agent MEDLOG affecte l’OFF-DOCK et le créneau', d: 'Vous recevez un SMS de confirmation avec le site, la date et l’heure.' },
          { t: 'Récupérez votre QR code', d: 'Dans le détail du rendez-vous : c’est votre laissez-passer, imprimable en PDF.' },
        ],
      },
      {
        h: 'Gérer vos rendez-vous',
        items: [
          { t: 'Suivez vos demandes', d: 'Menu « Mes rendez-vous » : le statut évolue en temps réel.' },
          { t: 'Modifiez l’attelage jusqu’à l’arrivée', d: 'Camion / remorque / chauffeur restent modifiables tant que le conteneur n’est pas arrivé au portail (bouton « Modifier l’attelage »).' },
          { t: 'Annulez si nécessaire', d: 'Avec un motif. Un report éventuel est décidé par MEDLOG (vous en êtes averti par SMS).' },
        ],
      },
      {
        h: 'Au portail OFF-DOCK',
        items: [
          { t: 'Présentez le QR code', d: 'L’opérateur le scanne. L’entrée n’est autorisée que le bon jour, pendant votre shift, sur le site affecté.' },
        ],
      },
    ],
  },
  AGENT: {
    title: 'Agent MEDLOG',
    tagline: 'Affecter les OFF-DOCK et arbitrer la file des demandes.',
    sections: [
      {
        h: 'File d’affectation',
        items: [
          { t: 'Consultez les demandes en attente', d: 'Menu « File d’affectation ». Chaque demande affiche la recommandation du moteur (charge, congestion, distance) sur le shift souhaité.' },
          { t: 'Affectez un OFF-DOCK', d: 'Confirmez la recommandation ou choisissez un autre site, puis cliquez « Affecter ». Un SMS part au transporteur et au chauffeur.' },
        ],
      },
      {
        h: 'Arbitrer selon la capacité',
        items: [
          { t: 'Reporter un rendez-vous', d: 'Bouton « Reporter » : nouvelle date/shift + motif. Le préavis minimum de report (paramétrable) est vérifié.' },
          { t: 'Annuler un rendez-vous', d: 'Bouton « Annuler » : le motif est obligatoire et communiqué au transporteur.' },
          { t: 'La capacité ne bloque jamais le transporteur', d: 'Un site saturé n’empêche pas la réservation : c’est vous qui arbitrez ici.' },
        ],
      },
      {
        h: 'Notifications',
        items: [
          { t: 'Vous êtes alerté par SMS à chaque nouvelle demande', d: 'Assurez-vous que votre numéro est renseigné par l’administrateur (Utilisateurs & accès).' },
        ],
      },
    ],
  },
  OPERATOR: {
    title: 'Opérateur OFF-DOCK',
    tagline: 'Contrôler les entrées et confirmer les déposes au portail.',
    sections: [
      {
        h: 'Contrôle d’entrée',
        items: [
          { t: 'Ouvrez la « Console portail »', d: 'Dans le menu de gauche.' },
          { t: 'Scannez le QR code du chauffeur', d: 'Bouton « Scanner avec la caméra » (nécessite une connexion sécurisée HTTPS) ou saisissez la référence manuellement.' },
          { t: 'Validez l’arrivée', d: 'La validation n’est possible que le jour du rendez-vous, pendant le shift, sur votre OFF-DOCK.' },
        ],
      },
      {
        h: 'Déroulé de la dépose',
        items: [
          { t: 'Arrivé → En cours → Terminé', d: 'Confirmez la réception du conteneur : le rendez-vous passe au statut « Terminé ».' },
          { t: 'Rendez-vous du site', d: 'Menu « Rendez-vous du site » pour la liste des RDV attendus sur votre OFF-DOCK.' },
        ],
      },
    ],
  },
  ADMIN: {
    title: 'Administrateur',
    tagline: 'Configurer, piloter et superviser l’ensemble du système.',
    sections: [
      {
        h: 'Pilotage',
        items: [
          { t: 'Tableau de bord', d: 'KPIs, occupation des sites, tendances (créées & à venir).' },
          { t: 'Assistant IA', d: 'Alertes, recommandations et synthèse d’exploitation (clé Claude optionnelle).' },
          { t: 'Rapports', d: 'Requêteur multi-sources, exportable en Excel.' },
          { t: 'Audit', d: 'Trace horodatée de toutes les actions.' },
        ],
      },
      {
        h: 'Configuration',
        items: [
          { t: 'OFF-DOCKs', d: 'Créer les sites et régler leurs capacités (jour, shift, parc). Aides intégrées sous chaque champ.' },
          { t: 'Shifts', d: 'Horaires des postes Jour / Nuit.' },
          { t: 'Base conteneurs', d: 'Importer le fichier des conteneurs (Excel), filtrer, purger. Toute la base est intégrée (MSC et non-MSC).' },
          { t: 'Paramètres', d: 'Délais de préavis, préavis de report, tolérance de créneau, notifications SMS (Brevo), Assistant IA.' },
        ],
      },
      {
        h: 'Accès',
        items: [
          { t: 'Utilisateurs & accès', d: 'Créer les comptes, générer les liens d’activation, et renseigner les téléphones (indispensable pour les SMS aux agents/admins).' },
          { t: 'Sociétés', d: 'Gérer les sociétés de transport.' },
        ],
      },
    ],
  },
  MSC: {
    title: 'MSC (lecture seule)',
    tagline: 'Suivre les retours de conteneurs et la performance des sites.',
    sections: [
      {
        h: 'Tableau de bord',
        items: [
          { t: 'Suivez les indicateurs', d: 'Volumes, taux de complétion, taux d’absence (no-show), occupation et congestion des OFF-DOCK.' },
          { t: 'Consultation uniquement', d: 'Votre accès est en lecture seule : aucune action de gestion.' },
        ],
      },
    ],
  },
  DRIVER: {
    title: 'Chauffeur',
    tagline: 'Votre rendez-vous et votre laissez-passer d’entrée.',
    sections: [
      {
        h: 'Votre rendez-vous',
        items: [
          { t: 'Consultez vos rendez-vous', d: 'Site OFF-DOCK affecté, date et créneau.' },
          { t: 'Présentez le QR code au portail', d: 'Il sert de laissez-passer pour l’autorisation d’entrée.' },
          { t: 'Vous recevez les infos par SMS', d: 'Confirmation, report ou annulation vous sont envoyés directement.' },
        ],
      },
    ],
  },
};

const ROLE_ORDER = ['TRANSPORTER', 'AGENT', 'OPERATOR', 'ADMIN', 'MSC', 'DRIVER'];

export default function Guide() {
  const { user } = useAuth();
  const myRole: string = user?.role && GUIDES[user.role] ? user.role : 'TRANSPORTER';
  const [view, setView] = useState<string>(myRole);
  const isAdmin = user?.role === 'ADMIN';
  const g = GUIDES[view];

  return (
    <Layout title="Mode d'emploi">
      <div className="card pad-lg" style={{ marginBottom: 16 }}>
        <div className="flex between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Guide — {g.title}</h2>
            <div className="muted">{g.tagline}</div>
          </div>
          {isAdmin && (
            <div className="field" style={{ margin: 0, minWidth: 220 }}>
              <label>Afficher le guide d’un profil</label>
              <select value={view} onChange={(e) => setView(e.target.value)}>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>{GUIDES[r].title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        {g.sections.map((sec, si) => (
          <div className="card pad-lg" key={si}>
            <h3 style={{ marginTop: 0 }}>{sec.h}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sec.items.map((it, ii) => (
                <div className="flex" key={ii} style={{ gap: 12, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flex: 'none', width: 26, height: 26, borderRadius: 8,
                      background: 'var(--yellow-strong, #e0a400)', color: '#1a1205',
                      display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13,
                    }}
                  >
                    {ii + 1}
                  </span>
                  <div>
                    <b>{it.t}</b>
                    <div className="small muted">{it.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="alert info" style={{ marginTop: 16 }}>
        Besoin d’aide supplémentaire ? Contactez l’administrateur MEDLOG. Ce guide s’adapte automatiquement à votre profil.
      </div>
    </Layout>
  );
}
