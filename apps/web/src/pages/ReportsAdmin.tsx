import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { Layout, Loader } from '../components';

type Col = { key: string; label: string };
type Source = { key: string; label: string; filters: string[]; columns: Col[] };

const SOURCES: Source[] = [
  {
    key: 'appointments', label: 'Rendez-vous', filters: ['date', 'status'],
    columns: [
      { key: 'reference', label: 'Référence' }, { key: 'containerNumber', label: 'Conteneur' },
      { key: 'containerType', label: 'Type' }, { key: 'blNumber', label: 'BL' },
      { key: 'company', label: 'Société' }, { key: 'truckPlate', label: 'Camion' },
      { key: 'trailerPlate', label: 'Remorque' }, { key: 'driverName', label: 'Chauffeur' },
      { key: 'driverPhone', label: 'Tél. chauffeur' }, { key: 'offDock', label: 'OFF-DOCK' },
      { key: 'shiftCode', label: 'Shift' }, { key: 'status', label: 'Statut' },
      { key: 'requestedDate', label: 'Date souhaitée' }, { key: 'slotStart', label: 'Créneau' },
      { key: 'createdAt', label: 'Créé le' },
    ],
  },
  {
    key: 'containers', label: 'Base conteneurs', filters: ['type', 'transporteur', 'search'],
    columns: [
      { key: 'containerNumber', label: 'Conteneur' }, { key: 'blNumber', label: 'BL' },
      { key: 'containerType', label: 'Type' }, { key: 'consignee', label: 'Client' },
      { key: 'transporteur', label: 'Transporteur' }, { key: 'shippingLine', label: 'Ligne' },
      { key: 'createdAt', label: 'Créé le' },
    ],
  },
  {
    key: 'users', label: 'Utilisateurs', filters: ['role'],
    columns: [
      { key: 'name', label: 'Nom' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Rôle' },
      { key: 'active', label: 'Actif' }, { key: 'company', label: 'Société' }, { key: 'offDock', label: 'OFF-DOCK' },
      { key: 'phone', label: 'Téléphone' }, { key: 'createdAt', label: 'Créé le' },
    ],
  },
  {
    key: 'companies', label: 'Sociétés', filters: [],
    columns: [
      { key: 'name', label: 'Nom' }, { key: 'rccm', label: 'RCCM' }, { key: 'phone', label: 'Téléphone' },
      { key: 'email', label: 'Email' }, { key: 'comptes', label: 'Comptes' }, { key: 'createdAt', label: 'Créé le' },
    ],
  },
  {
    key: 'audit', label: "Journal d'audit", filters: ['date', 'entity'],
    columns: [
      { key: 'createdAt', label: 'Date' }, { key: 'actor', label: 'Acteur' }, { key: 'role', label: 'Rôle' },
      { key: 'action', label: 'Action' }, { key: 'entity', label: 'Entité' }, { key: 'status', label: 'Statut' },
      { key: 'path', label: 'Chemin' },
    ],
  },
];

const STATUSES = ['REQUESTED', 'VALIDATED', 'ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'NO_SHOW', 'CANCELLED'];
const ROLES = ['ADMIN', 'AGENT', 'OPERATOR', 'TRANSPORTER', 'DRIVER', 'MSC'];

export default function ReportsAdmin() {
  const [sourceKey, setSourceKey] = useState('appointments');
  const source = useMemo(() => SOURCES.find((s) => s.key === sourceKey)!, [sourceKey]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [cols, setCols] = useState<string[]>(SOURCES[0].columns.map((c) => c.key));
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  function changeSource(key: string) {
    setSourceKey(key);
    const s = SOURCES.find((x) => x.key === key)!;
    setCols(s.columns.map((c) => c.key));
    setFilters({});
    setRows(null);
    setErr('');
  }
  function setF(k: string, v: string) { setFilters((f) => ({ ...f, [k]: v })); }
  function toggleCol(k: string) { setCols((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k])); }

  async function generate() {
    setErr(''); setLoading(true); setRows(null);
    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v && v.trim()) qs.set(k, v.trim()); });
      const q = qs.toString();
      const data = await api<Record<string, any>[]>(`/reports/${sourceKey}${q ? '?' + q : ''}`);
      setRows(data);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function exportXlsx() {
    if (!rows?.length) return;
    const chosen = source.columns.filter((c) => cols.includes(c.key));
    const header = chosen.map((c) => c.label);
    const body = rows.map((r) => chosen.map((c) => r[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws['!cols'] = chosen.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, source.label.slice(0, 28));
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `rapport_${sourceKey}_${date}.xlsx`);
  }

  const chosenCols = source.columns.filter((c) => cols.includes(c.key));

  return (
    <Layout title="Rapports & export">
      {err && <div className="alert error">{err}</div>}

      <div className="card pad-lg" style={{ marginBottom: 16 }}>
        <div className="row">
          <div className="field">
            <label>Source de données</label>
            <select value={sourceKey} onChange={(e) => changeSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          {source.filters.includes('date') && (
            <>
              <div className="field"><label>Du</label><input type="date" value={filters.from ?? ''} onChange={(e) => setF('from', e.target.value)} /></div>
              <div className="field"><label>Au</label><input type="date" value={filters.to ?? ''} onChange={(e) => setF('to', e.target.value)} /></div>
            </>
          )}
          {source.filters.includes('status') && (
            <div className="field"><label>Statut</label>
              <select value={filters.status ?? ''} onChange={(e) => setF('status', e.target.value)}>
                <option value="">Tous</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {source.filters.includes('role') && (
            <div className="field"><label>Rôle</label>
              <select value={filters.role ?? ''} onChange={(e) => setF('role', e.target.value)}>
                <option value="">Tous</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          {source.filters.includes('type') && (
            <div className="field"><label>Type</label><input value={filters.type ?? ''} onChange={(e) => setF('type', e.target.value)} placeholder="40HC…" /></div>
          )}
          {source.filters.includes('transporteur') && (
            <div className="field"><label>Transporteur</label><input value={filters.transporteur ?? ''} onChange={(e) => setF('transporteur', e.target.value)} /></div>
          )}
          {source.filters.includes('search') && (
            <div className="field"><label>Conteneur / BL</label><input value={filters.search ?? ''} onChange={(e) => setF('search', e.target.value)} /></div>
          )}
          {source.filters.includes('entity') && (
            <div className="field"><label>Entité</label><input value={filters.entity ?? ''} onChange={(e) => setF('entity', e.target.value)} placeholder="users, manifest…" /></div>
          )}
        </div>

        <div style={{ marginTop: 6 }}>
          <label>Colonnes du rapport</label>
          <div className="flex" style={{ flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
            {source.columns.map((c) => (
              <label key={c.key} className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 'normal', margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn" onClick={generate} disabled={loading}>{loading ? 'Génération…' : 'Générer le rapport'}</button>
          <button className="btn blue" onClick={exportXlsx} disabled={!rows?.length || !chosenCols.length}>⬇ Exporter en Excel (.xlsx)</button>
        </div>
      </div>

      {loading && <div className="page-center"><Loader label="Génération du rapport…" /></div>}

      {rows && !loading && (
        <div className="card">
          <div className="flex between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{rows.length} ligne(s){rows.length > 100 ? ' — aperçu des 100 premières' : ''}</h2>
          </div>
          {!rows.length ? (
            <div className="muted">Aucune donnée pour ces critères.</div>
          ) : (
            <table>
              <thead><tr>{chosenCols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i}>{chosenCols.map((c) => <td key={c.key} className="small">{String(r[c.key] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Layout>
  );
}
