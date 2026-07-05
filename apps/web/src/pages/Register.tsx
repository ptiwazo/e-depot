import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const [form, setForm] = useState({ companyName: '', name: '', email: '', phone: '', password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (form.password.length < 6) return setErr('Mot de passe : 6 caractères minimum.');
    if (form.password !== form.confirm) return setErr('Les mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      const res = await api<{ message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          companyName: form.companyName, name: form.name, email: form.email,
          phone: form.phone || undefined, password: form.password,
        }),
      });
      setMsg(res.message);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="tag">TRANSPORT &amp; LOGISTICS</div>
        <div className="big">e-<span>depot</span></div>
        <p style={{ maxWidth: 420, marginTop: 20, color: '#cfcbc4' }}>
          Espace <b style={{ color: 'var(--yellow)' }}>transporteur</b> : créez votre compte pour prendre
          rendez-vous et retourner vos conteneurs vides MSC vers les OFF-DOCK MEDLOG CI.
        </p>
      </div>
      <div className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <h1>Inscription transporteur</h1>
          {msg && <div className="alert ok">{msg} <br /><Link to="/login">→ Aller à la connexion</Link></div>}
          {err && <div className="alert error">{err}</div>}
          {!msg && (
            <>
              <div className="field">
                <label>Société de transport *</label>
                <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Ivoire Trans SARL" autoFocus />
              </div>
              <div className="field">
                <label>Votre nom *</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Kouassi Yao" />
              </div>
              <div className="field">
                <label>Email *</label>
                <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="vous@societe.ci" />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+2250708112233" />
              </div>
              <div className="row">
                <div className="field">
                  <label>Mot de passe *</label>
                  <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
                </div>
                <div className="field">
                  <label>Confirmer *</label>
                  <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
                </div>
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Création…' : 'Créer mon compte'}
              </button>
              <p className="small muted" style={{ marginTop: 10 }}>
                Votre compte sera actif après validation par MEDLOG.
              </p>
              <div className="small" style={{ marginTop: 8 }}><Link to="/login">← Déjà un compte ? Se connecter</Link></div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
