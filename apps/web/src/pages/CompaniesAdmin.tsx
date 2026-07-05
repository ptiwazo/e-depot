import { useEffect, useState } from 'react';
import { api, Company } from '../api';
import { Layout } from '../components';

const EMPTY = { name: '', rccm: '', phone: '', email: '' };

export default function CompaniesAdmin() {
  const [items, setItems] = useState<Company[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function load() { api<Company[]>('/companies').then(setItems); }
  useEffect(load, []);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await api('/companies', { method: 'POST', body: JSON.stringify(form) });
      setMsg(`Société « ${form.name} » créée.`);
      setForm({ ...EMPTY });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <Layout title="Sociétés de transport">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}
      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <form className="card pad-lg" onSubmit={create}>
          <h2>Ajouter une société</h2>
          <div className="field">
            <label>Nom / raison sociale *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ivoire Trans SARL" />
          </div>
          <div className="row">
            <div className="field">
              <label>RCCM</label>
              <input value={form.rccm} onChange={(e) => set('rccm', e.target.value)} placeholder="CI-ABJ-2020-B-12345" />
            </div>
            <div className="field">
              <label>Téléphone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <button className="btn">Créer la société</button>
        </form>
        <div className="card pad-lg">
          <h2>À propos</h2>
          <p className="small muted" style={{ lineHeight: 1.8 }}>
            Les sociétés de transport regroupent les comptes <b>transporteurs</b> et <b>chauffeurs</b>.
            Lors de la création d'un accès transporteur, vous choisissez sa société ici.
            Une société créée par auto-inscription apparaît aussi dans cette liste.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>{items.length} société(s)</h2>
        <table>
          <thead>
            <tr><th>Nom</th><th>RCCM</th><th>Téléphone</th><th>Email</th><th>Comptes</th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b></td>
                <td className="small mono">{c.rccm || '—'}</td>
                <td className="small">{c.phone || '—'}</td>
                <td className="small">{c.email || '—'}</td>
                <td>{c._count?.users ?? 0}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted">Aucune société.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
