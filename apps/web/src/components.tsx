import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

// Compteur animé : anime la partie numérique d'une valeur ("42 min", "5%", 21304…).
function useCountUp(value: ReactNode): ReactNode {
  const [out, setOut] = useState<ReactNode>(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let prefix = '', suffix = '', target = NaN, decimals = 0;
    if (typeof value === 'number') target = value;
    else if (typeof value === 'string') {
      const m = value.match(/^(\D*?)([\d.,]+)(.*)$/);
      if (m) {
        prefix = m[1]; suffix = m[3];
        const raw = m[2].replace(',', '.');
        target = parseFloat(raw);
        decimals = (raw.split('.')[1] || '').length;
      }
    }
    if (!isFinite(target)) { setOut(value); return; }
    const fmt = (n: number) => `${prefix}${n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
    if (reduce) { setOut(fmt(target)); return; }
    const dur = 950, start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setOut(fmt(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else setOut(fmt(target));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return out;
}

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
    { to: '/admin/audit', label: 'Audit' },
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

// Jeu d'icônes vectorielles maison (trait géométrique, style angulaire MEDLOG).
const ICONS: Record<string, ReactNode> = {
  dashboard: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  offdock: (<><path d="M3 21V9l9-5 9 5v12" /><path d="M2 21h20" /><rect x="8" y="13" width="8" height="8" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  container: (<><rect x="3" y="6" width="18" height="12" rx="1" /><path d="M7.5 6v12M12 6v12M16.5 6v12" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3 3 0 0 1 0 5.5M17.6 20a5.6 5.6 0 0 0-3-4.9" /></>),
  building: (<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h0M15 7h0M9 11h0M15 11h0M9 15h0M15 15h0M10 21v-3h4v3" /></>),
  settings: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>),
  target: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="16" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>),
  monitor: (<><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>),
  plus: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  chart: (<><path d="M4 4v16h16" /><path d="M7.5 15l3-4 3 2 4-6" /></>),
  audit: (<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const inner = ICONS[name];
  if (!inner) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {inner}
    </svg>
  );
}

// Icône de navigation (par route).
const NAV_ICON: Record<string, string> = {
  '/admin': 'dashboard', '/admin/offdocks': 'offdock', '/admin/shifts': 'clock',
  '/admin/manifest': 'container', '/admin/users': 'users', '/admin/companies': 'building',
  '/admin/settings': 'settings', '/agent': 'target', '/appointments': 'calendar',
  '/admin/audit': 'audit', '/operator': 'monitor', '/transporter': 'calendar', '/transporter/new': 'plus', '/msc': 'chart',
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
            <span className="nav-ico"><Icon name={NAV_ICON[l.to] ?? 'dashboard'} /></span>
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

// Bande hero photo (en tête de page).
export function HeroBand({ title, subtitle, hero }: { title: string; subtitle?: string; hero?: string }) {
  return (
    <div className="hero-band" style={hero ? ({ ['--hero']: `url('${hero}')` } as any) : undefined}>
      {subtitle && <div className="sub">{subtitle}</div>}
      <h1>{title}</h1>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status.replace('_', ' ')}</span>;
}

export function Kpi({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
  const display = useCountUp(value);
  return (
    <div className={`card kpi ${accent ? 'accent' : ''}`}>
      <span className="value">{display}</span>
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
