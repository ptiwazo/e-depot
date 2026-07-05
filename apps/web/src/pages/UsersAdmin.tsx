import { useEffect, useState } from 'react';
import { api, Company, ManagedUser, OffDock } from '../api';
import { Layout } from '../components';

const ROLES: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'AGENT', label: 'Agent MEDLOG (affectations)' },
  { value: 'OPERATOR', label: 'Opérateur OFF-DOCK' },
  { value: 'TRANSPORTER', label: 'Transporteur' },
  { value: 'DRIVER', label: 'Chauffeur' },
  { value: 'MSC', label: 'MSC (lecture seule)' },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

// Lien d'activation à transmettre à l'utilisateur (basé sur l'URL du site).
function activationLink(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}activate?token=${token}`;
}

const EMPTY = { role: 'TRANSPORTER', name: '', email: '', phone: '', companyId: '', offDockId: '' };

export default function UsersAdmin() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [offdocks, setOffdocks] = useState<OffDock[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function load() {
    api<ManagedUser[]>('/users').then(setUsers);
  }
  useEffect(() => {
    load();
    api<Company[]>('/companies').then(setCompanies);
    api<OffDock[]>('/offdocks').then(setOffdocks);
  }, []);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg(''); setLink('');
    try {
      const res = await api<{ user: ManagedUser; activationToken: string }>('/users', {
        method: 'POST',
        body: JSON.stringify({
          role: form.role, name: form.name, email: form.email, phone: form.phone || undefined,
          companyId: form.companyId || undefined, offDockId: form.offDockId || undefined,
        }),
      });
      setMsg(`Compte créé pour ${res.user.name}. Transmettez-lui le lien d'activation ci-dessous.`);
      setLink(activationLink(res.activationToken));
      setForm({ ...EMPTY });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function toggleActive(u: ManagedUser) {
    setErr(''); setMsg('');
    try { await api(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) }); load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function resetLink(u: ManagedUser) {
    setErr(''); setMsg(''); setLink('');
    try {
      const res = await api<{ activationToken: string }>(`/users/${u.id}/reset`, { method: 'POST' });
      setMsg(`Nouveau lien d'activation pour ${u.name} (l'ancien mot de passe est invalidé).`);
      setLink(activationLink(res.activationToken));
    } catch (e: any) { setErr(e.message); }
  }

  function copy() { navigator.clipboard?.writeText(link).then(() => setMsg('Lien copié dans le presse-papiers.')); }

  const needsCompany = form.role === 'TRANSPORTER' || form.role === 'DRIVER';
  const needsOffDock = form.role === 'OPERATOR';

  return (
    <Layout title="Utilisateurs & accès">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}
      {link && (
        <div className="alert info">
          <div className="small" style={{ marginBottom: 6 }}><b>Lien d'activation</b> — à envoyer à l'utilisateur (WhatsApp, SMS…). Il y définira son mot de passe.</div>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 240 }} className="mono small" />
            <button type="button" className="btn sm" onClick={copy}>Copier</button>
          </div>
        </div>
      )}

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <form className="card pad-lg" onSubmit={create}>
          <h2>Créer un accès</h2>
          <div className="row">
            <div className="field">
              <label>Rôle *</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Nom complet *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Kouassi Yao" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Email *</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="prenom.nom@medlog.ci" />
            </div>
            <div className="field">
              <label>Téléphone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+2250708112233" />
            </div>
          </div>
          {needsCompany && (
            <div className="field">
              <label>Société de transport {form.role === 'TRANSPORTER' ? '*' : ''}</label>
              <select value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
                <option value="">— choisir —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!companies.length && <div className="small muted" style={{ marginTop: 4 }}>Aucune société : créez-en une dans « Sociétés ».</div>}
            </div>
          )}
          {needsOffDock && (
            <div className="field">
              <label>OFF-DOCK rattaché</label>
              <select value={form.offDockId} onChange={(e) => set('offDockId', e.target.value)}>
                <option value="">— choisir —</option>
                {offdocks.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn">Créer le compte</button>
          <p className="small muted" style={{ marginTop: 8 }}>
            Le compte est créé sans mot de passe : un lien d'activation est généré pour que l'utilisateur définisse le sien.
          </p>
        </form>

        <div className="card pad-lg">
          <h2>Comment ça marche</h2>
          <ul className="small" style={{ lineHeight: 1.9, paddingLeft: 18 }}>
            <li>Choisissez le <b>rôle</b> et renseignez l'identité. Un <b>transporteur</b> est rattaché à une société ; un <b>opérateur</b> à un OFF-DOCK.</li>
            <li>À la création, un <b>lien d'activation</b> s'affiche : copiez-le et transmettez-le à la personne.</li>
            <li>Elle ouvre le lien, <b>définit son mot de passe</b>, puis peut se connecter.</li>
            <li>Les <b>transporteurs peuvent aussi s'inscrire seuls</b> ; leur compte apparaît ici en « à valider » — activez-le pour autoriser la connexion.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>{users.length} compte(s)</h2>
        <table>
          <thead>
            <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Rattachement</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="small">{u.email}</td>
                <td>{roleLabel(u.role)}</td>
                <td className="small">{u.company?.name || (u.offDock ? `${u.offDock.code}` : '—')}</td>
                <td>
                  {u.pending
                    ? <span className="badge REQUESTED">à activer</span>
                    : u.active
                      ? <span className="badge COMPLETED">actif</span>
                      : <span className="badge REJECTED">inactif</span>}
                </td>
                <td className="right">
                  <div className="flex" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn sm ghost" onClick={() => resetLink(u)}>Lien</button>
                    <button className={`btn sm ${u.active ? 'danger' : 'blue'}`} onClick={() => toggleActive(u)}>
                      {u.active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={6} className="muted">Aucun compte.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
