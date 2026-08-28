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

/** Démonstration animée (CSS/SVG) du parcours d'un rendez-vous — en boucle. */
function DemoAnimation() {
  return (
    <div className="edx-demo">
      <style>{`
        .edx-demo{position:relative;background:linear-gradient(135deg,#12161e 0%,#1b2430 100%);border-radius:16px;
          padding:16px 18px 14px;color:#eef2f7;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.16)}
        .edx-demo *{box-sizing:border-box}
        .edx-h{font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#f0b419;font-weight:800;
          margin:0 0 14px;display:flex;align-items:center;gap:9px}
        .edx-h::before{content:"";width:26px;height:3px;background:#f0b419;border-radius:2px}
        .edx-stages{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
        .edx-stage{font-size:12px;font-weight:700;text-align:center;padding:8px 4px;border-radius:10px;
          background:rgba(32,41,53,.6);color:#9fb0c2;border:1px solid #2c3a4a}
        .edx-stage b{display:block;font-size:11px;opacity:.7;font-weight:800}
        .edx-road{position:relative;height:70px;border-radius:12px;background:#0d1219;border:1px solid #2c3a4a;overflow:hidden}
        .edx-road::after{content:"";position:absolute;left:0;right:0;top:50%;height:2px;
          background:repeating-linear-gradient(90deg,#3a4a5c 0 14px,transparent 14px 28px)}
        .edx-truck{position:absolute;bottom:9px;left:6px;width:112px}
        .edx-truck svg{display:block;width:112px;height:auto}
        .edx-badge{position:absolute;top:8px;display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;
          padding:5px 9px;border-radius:999px;opacity:1}
        .edx-sms{left:30%;background:#1f6fb2;color:#fff}
        .edx-qr{left:56%;background:#243040;color:#eef2f7;border:1px solid #3a4a5c;padding:5px 7px}
        .edx-done{right:4%;background:#2f8a5b;color:#fff}
        .edx-qr svg{display:block}
        @media (prefers-reduced-motion: no-preference){
          .edx-truck{animation:edxDrive 8s linear infinite}
          .edx-s1{animation:edxA1 8s infinite}.edx-s2{animation:edxA2 8s infinite}
          .edx-s3{animation:edxA3 8s infinite}.edx-s4{animation:edxA4 8s infinite}
          .edx-sms{animation:edxSms 8s infinite}.edx-qr{animation:edxQr 8s infinite}.edx-done{animation:edxDone 8s infinite}
        }
        @keyframes edxDrive{0%{left:6px}100%{left:calc(100% - 118px)}}
        @keyframes edxA1{0%,2%{background:#f0b419;color:#1a1205}22%{background:#f0b419;color:#1a1205}
          26%,100%{background:rgba(32,41,53,.6);color:#9fb0c2}}
        @keyframes edxA2{0%,26%{background:rgba(32,41,53,.6);color:#9fb0c2}28%,47%{background:#f0b419;color:#1a1205}
          51%,100%{background:rgba(32,41,53,.6);color:#9fb0c2}}
        @keyframes edxA3{0%,51%{background:rgba(32,41,53,.6);color:#9fb0c2}53%,72%{background:#f0b419;color:#1a1205}
          76%,100%{background:rgba(32,41,53,.6);color:#9fb0c2}}
        @keyframes edxA4{0%,76%{background:rgba(32,41,53,.6);color:#9fb0c2}78%,100%{background:#2f8a5b;color:#fff;border-color:#2f8a5b}}
        @keyframes edxSms{0%,20%{opacity:0;transform:translateY(6px) scale(.9)}27%,44%{opacity:1;transform:none}
          52%,100%{opacity:0;transform:translateY(-4px)}}
        @keyframes edxQr{0%,50%{opacity:0;transform:scale(.8)}57%,73%{opacity:1;transform:scale(1)}80%,100%{opacity:0}}
        @keyframes edxDone{0%,76%{opacity:0;transform:scale(.4)}84%,100%{opacity:1;transform:scale(1)}}
      `}</style>
      <p className="edx-h">Démonstration — le parcours d'un rendez-vous</p>
      <div className="edx-stages">
        <div className="edx-stage edx-s1"><b>1</b>Demande</div>
        <div className="edx-stage edx-s2"><b>2</b>Affectation OFF-DOCK</div>
        <div className="edx-stage edx-s3"><b>3</b>Contrôle portail (QR)</div>
        <div className="edx-stage edx-s4"><b>4</b>Terminé</div>
      </div>
      <div className="edx-road">
        <span className="edx-badge edx-sms">📩 SMS confirmé</span>
        <span className="edx-badge edx-qr" aria-label="QR code">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="0" width="6" height="6" /><rect x="10" y="0" width="6" height="6" />
            <rect x="0" y="10" width="6" height="6" /><rect x="10" y="10" width="3" height="3" />
            <rect x="13" y="13" width="3" height="3" />
          </svg>
          Scan
        </span>
        <span className="edx-badge edx-done">✓ Terminé</span>
        <div className="edx-truck" aria-hidden="true">
          <svg viewBox="0 0 118 46">
            <rect x="2" y="8" width="70" height="27" rx="2" fill="#e9edf2" stroke="#c3cede" />
            <text x="37" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="#12314f" fontFamily="Arial">MSC</text>
            <path d="M74 35 V16 h13 l9 11 v8 z" fill="#f0b419" />
            <rect x="78" y="18" width="9" height="7" fill="#12161e" opacity=".55" />
            <circle cx="22" cy="37" r="5" fill="#1a1205" /><circle cx="36" cy="37" r="5" fill="#1a1205" />
            <circle cx="86" cy="37" r="5" fill="#1a1205" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function Guide() {
  const { user } = useAuth();
  const myRole: string = user?.role && GUIDES[user.role] ? user.role : 'TRANSPORTER';
  const [view, setView] = useState<string>(myRole);
  const isAdmin = user?.role === 'ADMIN';
  const g = GUIDES[view];

  return (
    <Layout title="Mode d'emploi">
      <div style={{ marginBottom: 16 }}><DemoAnimation /></div>
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
