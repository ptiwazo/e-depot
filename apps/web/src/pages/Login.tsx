import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const DEMO = [
  { email: 'admin@medlog.ci', label: 'Administrateur MEDLOG' },
  { email: 'agent@medlog.ci', label: 'Agent MEDLOG (affectations)' },
  { email: 'operateur.vridi@medlog.ci', label: 'Opérateur OFF-DOCK Vridi' },
  { email: 'transporteur@ivoiretrans.ci', label: 'Transporteur (Ivoire Trans)' },
  { email: 'msc@msc.com', label: 'MSC — supervision' },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('EDepot2026!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      nav('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="tag">TRANSPORT &amp; LOGISTICS</div>
        <div className="big">
          e-<span>depot</span>
        </div>
        <p style={{ maxWidth: 420, marginTop: 20, color: '#cfcbc4' }}>
          Prise de rendez-vous pour le retour des conteneurs vides <b style={{ color: '#fff' }}>MSC</b> vers
          les OFF-DOCK <b style={{ color: 'var(--yellow)' }}>MEDLOG Côte d'Ivoire</b>. Affectation automatique
          du site, optimisation de la capacité et du flux camions.
        </p>
      </div>
      <div className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <h1>Connexion</h1>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@medlog.ci" autoFocus />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>

          <div className="demo-accounts">
            <div className="muted small" style={{ marginBottom: 6 }}>Comptes de démonstration :</div>
            {DEMO.map((d) => (
              <button type="button" key={d.email} onClick={() => setEmail(d.email)}>
                <b>{d.label}</b>
                <br />
                <span className="muted">{d.email}</span>
              </button>
            ))}
            <div className="muted small">Mot de passe commun : EDepot2026!</div>
          </div>
        </form>
      </div>
    </div>
  );
}
