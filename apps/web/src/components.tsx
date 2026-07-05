import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrateur',
  AGENT: 'Agent MEDLOG',
  OPERATOR: 'Opérateur OFF-DOCK',
  TRANSPORTER: 'Transporteur',
  DRIVER: 'Chauffeur',
  MSC: 'MSC (lecture seule)',
};

const NAV: Record<string, { to: string; label: string }[]> = {
  ADMIN: [
    { to: '/admin', label: 'Tableau de bord' },
    { to: '/admin/offdocks', label: 'OFF-DOCKs' },
    { to: '/admin/shifts', label: 'Shifts' },
    { to: '/admin/manifest', label: 'Base conteneurs' },
    { to: '/admin/users', label: 'Utilisateurs' },
    { to: '/admin/companies', label: 'Sociétés' },
    { to: '/admin/settings', label: 'Paramètres' },
    { to: '/agent', label: "File d'affectation" },
    { to: '/appointments', label: 'Rendez-vous' },
  ],
  AGENT: [
    { to: '/agent', label: "File d'affectation" },
    { to: '/appointments', label: 'Rendez-vous' },
  ],
  OPERATOR: [
    { to: '/operator', label: 'Console portail' },
    { to: '/appointments', label: 'Rendez-vous du site' },
  ],
  TRANSPORTER: [
    { to: '/transporter', label: 'Mes rendez-vous' },
    { to: '/transporter/new', label: 'Nouvelle demande' },
  ],
  DRIVER: [{ to: '/appointments', label: 'Mes affectations' }],
  MSC: [{ to: '/msc', label: 'Supervision' }],
};

// Icônes de navigation (par route).
const NAV_ICON: Record<string, string> = {
  '/admin': '📊', '/admin/offdocks': '🏭', '/admin/shifts': '🕐', '/admin/manifest': '📦',
  '/admin/users': '👤', '/admin/companies': '🏢', '/admin/settings': '⚙️',
  '/agent': '🎯', '/appointments': '📅', '/operator': '🖥️',
  '/transporter': '📅', '/transporter/new': '➕', '/msc': '📈',
};

// Logo texte (repli si l'image n'est pas disponible).
export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="logo" style={light ? { color: '#fff' } : undefined}>
      <span className="mark">MEDLOG</span>
      <span className="stack">
        e-depot
        <span className="sub">OFF-DOCK CI</span>
      </span>
    </div>
  );
}

// Logo officiel MEDLOG (image dans public/medlog-logo.png), avec repli sur le logo texte.
export function BrandLogo({ height = 34, light }: { height?: number; light?: boolean }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <Logo light={light} />;
  return (
    <span className="logo-chip">
      <img
        src={`${import.meta.env.BASE_URL}medlog-logo.png`}
        alt="MEDLOG"
        style={{ height, width: 'auto', maxWidth: '100%', display: 'block' }}
        onError={() => setOk(false)}
      />
    </span>
  );
}

export function Layout({ children, title }: { children: ReactNode; title: string }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const links = NAV[user.role] ?? [];

  return (
    <div className="app">
      <aside className="sidebar">
        <BrandLogo light />
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-ico">{NAV_ICON[l.to] ?? '•'}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="userbox">
          <b>{user.name}</b>
          {user.company || user.offDock || ROLE_LABEL[user.role]}
          <button
            className="btn ghost sm logout"
            style={{ width: '100%' }}
            onClick={() => {
              logout();
              nav('/login');
            }}
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <h1 style={{ margin: 0 }}>{title}</h1>
          <span className="role-chip">{ROLE_LABEL[user.role]}</span>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status.replace('_', ' ')}</span>;
}

export function Kpi({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
  return (
    <div className={`card kpi ${accent ? 'accent' : ''}`}>
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}

export function OccupancyBar({ pct }: { pct: number }) {
  const cls = pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : '';
  return (
    <div className={`bar ${cls}`}>
      <span style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function fmtSlot(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const hm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

/** Affiche la date + le shift d'un rendez-vous (avec les heures réelles du poste). */
export function fmtShift(startIso?: string | null, endIso?: string | null, code?: string | null) {
  if (!startIso) return '—';
  const date = new Date(startIso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  if (!code) return fmtSlot(startIso);
  const range = endIso ? ` (${hm(startIso)}-${hm(endIso)})` : '';
  return `${date} · ${code}${range}`;
}
