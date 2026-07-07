export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'AGENT' | 'OPERATOR' | 'TRANSPORTER' | 'DRIVER' | 'MSC';
  companyId?: string | null;
  company?: string | null;
  offDockId?: string | null;
  offDock?: string | null;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  active: boolean;
  pending: boolean; // compte pas encore activé (mot de passe non défini)
  company?: { id: string; name: string } | null;
  offDock?: { id: string; code: string; name: string } | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId?: string | null;
  actor?: string | null;
  role?: string | null;
  status?: number | null;
  path?: string | null;
  body?: any;
}

export interface Company {
  id: string;
  name: string;
  rccm?: string | null;
  phone?: string | null;
  email?: string | null;
  _count?: { users: number };
}

export interface ContainerManifest {
  id: string;
  containerNumber: string;
  blNumber: string;
  containerType: string;
  shippingLine: string;
  consignee?: string | null;
  transporteur?: string | null;
  createdAt: string;
}

export interface Shift {
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  order: number;
}

export interface OffDock {
  id: string;
  code: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  dailyCapacity: number;
  shiftCapacity: number;
  parkingSlots: number;
  congestion: number; // 0..1, calculée automatiquement (lecture seule)
  acceptsReefer: boolean;
  active: boolean;
  load?: number;
  occupancy?: number;
  onSite?: number;
}

export interface AppointmentEvent {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  reference: string;
  containerNumber: string;
  containerType: string;
  blNumber?: string | null;
  status: string;
  requestedDate: string;
  shiftCode?: string | null;
  slotStart?: string | null;
  slotEnd?: string | null;
  qrToken?: string | null;
  company?: { name: string };
  truckPlate?: string | null;
  trailerPlate?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  offDock?: OffDock | null;
  events?: AppointmentEvent[];
  recommendation?: { offDockId: string; offDockCode: string; score: number } | null;
}

export interface Analytics {
  total: number;
  completedToday: number;
  noShow: number;
  noShowRate: number;
  avgTurnaroundMin: number;
  avgAssignMin: number;
  pendingAssignment: number;
  scheduled: number;
  onSite: number;
  completionRate: number;
  todayScheduled: number;
  upcoming7d: number;
  avgOccupancy: number;
  congestedDocks: number;
  byStatus: Record<string, number>;
  byShiftToday: Record<string, number>;
  weeklyTrend: { date: string; count: number }[];
  topTransporters: { name: string; count: number }[];
  offDocks: { code: string; name: string; city: string; load: number; capacity: number; occupancy: number; congestion: number }[];
}

export const TOKEN_KEY = 'edepot_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

// En dev : vide → le proxy Vite route /api vers localhost:3001.
// En prod : VITE_API_URL = URL publique de l'API (ex. https://e-depot-api.onrender.com).
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    // Token présent mais rejeté (401) = session invalide/expirée (ou basculée sur un
    // autre compte dans un autre onglet). On purge et on renvoie vers la connexion
    // pour éviter un état « connecté » incohérent.
    if (res.status === 401 && token) {
      setToken(null);
      const loginUrl = import.meta.env.BASE_URL + 'login';
      if (!window.location.pathname.endsWith('/login')) window.location.assign(loginUrl);
    }
    let message = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
