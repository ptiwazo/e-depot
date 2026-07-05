import { Fragment, useEffect, useState } from 'react';
import { api, AuditEntry } from '../api';
import { Layout } from '../components';

const VERB: Record<string, string> = { POST: 'Création', PATCH: 'Modification', PUT: 'Modification', DELETE: 'Suppression' };
const verbClass: Record<string, string> = { POST: 'CONFIRMED', PATCH: 'ARRIVED', PUT: 'ARRIVED', DELETE: 'REJECTED' };
const ENTITY_LABEL: Record<string, string> = {
  users: 'Utilisateurs', companies: 'Sociétés', manifest: 'Base conteneurs', appointments: 'Rendez-vous',
  offdocks: 'OFF-DOCKs', shifts: 'Shifts', settings: 'Paramètres', auth: 'Authentification',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AuditAdmin() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    const qs = new URLSearchParams();
    if (entity) qs.set('entity', entity);
    if (search.trim()) qs.set('search', search.trim());
    const q = qs.toString();
    api<AuditEntry[]>(`/audit${q ? '?' + q : ''}`).then(setRows);
  }
  useEffect(() => {
    api<string[]>('/audit/entities').then(setEntities);
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, search]);

  return (
    <Layout title="Journal d'audit">
      <div className="alert info">
        Traçabilité de toutes les actions (création, modification, suppression) : qui, quoi, quand. 300 dernières entrées.
      </div>
      <div className="card">
        <div className="flex between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>{rows.length} action(s)</h2>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <select value={entity} onChange={(e) => setEntity(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Toutes les entités</option>
              {entities.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e] ?? e}</option>)}
            </select>
            <input style={{ width: 220 }} placeholder="Rechercher (acteur, chemin…)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Acteur</th><th>Action</th><th>Entité</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="small mono">{fmtDate(r.createdAt)}</td>
                  <td className="small">{r.actor || '—'}{r.role ? <span className="muted"> · {r.role}</span> : null}</td>
                  <td><span className={`badge ${verbClass[r.action] ?? 'REQUESTED'}`}>{VERB[r.action] ?? r.action}</span></td>
                  <td>{ENTITY_LABEL[r.entity] ?? r.entity}</td>
                  <td className="mono small">{r.status ?? '—'}</td>
                  <td className="right">
                    <button className="btn sm ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>Détail</button>
                  </td>
                </tr>
                {open === r.id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'var(--grey-100)' }}>
                      <div className="small mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {r.path}{'\n'}{r.body ? JSON.stringify(r.body, null, 2) : '(aucune donnée)'}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">Aucune action enregistrée.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
