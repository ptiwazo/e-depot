import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { BrandLogo } from '../components';

export default function Activate() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [info, setInfo] = useState<{ email: string; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) { setErr('Lien invalide (jeton manquant).'); setChecking(false); return; }
    api<{ email: string; name: string }>(`/auth/activation/${token}`)
      .then(setInfo)
      .catch((e) => setErr(e.message))
      .finally(() => setChecking(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (password.length < 6) return setErr('Mot de passe : 6 caractères minimum.');
    if (password !== confirm) return setErr('Les mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      await api('/auth/activate', { method: 'POST', body: JSON.stringify({ token, password }) });
      setMsg('Mot de passe défini ! Vous pouvez maintenant vous connecter.');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-brand" style={{ ['--hero' as any]: "url('/e-depot/hero-yard.jpg')" }}>
        <div style={{ marginBottom: 24 }}><BrandLogo height={44} /></div>
        <div className="tag">TRANSPORT &amp; LOGISTICS</div>
        <div className="big">e-<span>depot</span></div>
        <p style={{ maxWidth: 420, marginTop: 20, color: '#cfcbc4' }}>
          Activation de votre compte MEDLOG e-depot : définissez votre mot de passe.
        </p>
      </div>
      <div className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <div style={{ marginBottom: 16 }}><BrandLogo height={30} chip={false} /></div>
          <h1>Activer mon compte</h1>
          {checking && <div className="muted">Vérification du lien…</div>}
          {err && <div className="alert error">{err}</div>}
          {msg && <div className="alert ok">{msg}<br /><Link to="/login">→ Se connecter</Link></div>}
          {!checking && info && !msg && (
            <>
              <div className="alert info small">Compte : <b>{info.name}</b> — {info.email}</div>
              <div className="field">
                <label>Nouveau mot de passe *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Confirmer *</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Validation…' : 'Définir le mot de passe'}
              </button>
            </>
          )}
          {!checking && !info && !msg && (
            <div className="small" style={{ marginTop: 10 }}><Link to="/login">← Retour à la connexion</Link></div>
          )}
        </form>
      </div>
    </div>
  );
}
