import { useEffect, useState } from 'react';
import { api } from '../api';
import { Layout, Loader } from '../components';

type Settings = {
  lead_hours_propre_moyen: string;
  lead_hours_default: string;
  propre_moyen_label: string;
  gate_grace_minutes: string;
  reschedule_lead_hours: string;
  smtp_from: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_password_set?: boolean;
  ai_api_key: string;
  ai_model: string;
  ai_api_key_set?: boolean;
};

export default function SettingsAdmin() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api<Settings>('/settings').then(setS);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setMsg(''); setErr(''); setSaving(true);
    try {
      const r = await api<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(s) });
      setS(r);
      setMsg('Paramètres enregistrés.');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setMsg(''); setErr(''); setTesting(true);
    try {
      const r = await api<{ sent: boolean; to: string }>('/settings/smtp-test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo || undefined }),
      });
      setMsg(`E-mail de test envoyé à ${r.to}.`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setTesting(false);
    }
  }

  if (!s) return <Layout title="Paramètres"><div className="page-center"><Loader /></div></Layout>;

  return (
    <Layout title="Paramètres">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}

      <form className="card pad-lg" onSubmit={save} style={{ maxWidth: 620 }}>
        <h2 style={{ marginTop: 0 }}>Délais de préavis</h2>
        <div className="alert info">
          Délai minimum entre la <b>prise du rendez-vous</b> et le <b>créneau demandé</b>. Le délai renforcé
          s'applique aux conteneurs dont le champ <b>« transporteur »</b> vaut <b>« propre moyen »</b> dans la base.
        </div>
        <div className="row">
          <div className="field">
            <label>Préavis « propre moyen » (heures)</label>
            <input
              type="number" min={0} max={2000}
              value={s.lead_hours_propre_moyen}
              onChange={(e) => setS({ ...s, lead_hours_propre_moyen: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Préavis standard (heures)</label>
            <input
              type="number" min={0} max={2000}
              value={s.lead_hours_default}
              onChange={(e) => setS({ ...s, lead_hours_default: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Libellé « propre moyen » (dans la base conteneurs)</label>
          <input value={s.propre_moyen_label} onChange={(e) => setS({ ...s, propre_moyen_label: e.target.value })} />
          <div className="small muted" style={{ marginTop: 4 }}>
            Valeur exacte du champ « transporteur » qui déclenche le préavis renforcé (insensible à la casse et aux accents).
          </div>
        </div>

        <div className="field">
          <label>Préavis de report par l'agent (heures)</label>
          <input
            type="number" min={0} max={2000}
            value={s.reschedule_lead_hours}
            onChange={(e) => setS({ ...s, reschedule_lead_hours: e.target.value })}
          />
          <div className="small muted" style={{ marginTop: 4 }}>
            Un agent MEDLOG peut reporter un rendez-vous <b>même après affectation</b>, à condition que la nouvelle
            date/créneau respecte ce préavis minimum. Mettez 0 pour l'autoriser sans délai.
          </div>
        </div>

        <div className="alert info" style={{ marginTop: 4 }}>
          <b>Contrôle d'entrée</b> — l'opérateur ne peut valider l'arrivée / le déchargement / la dépose d'un
          conteneur que pendant le créneau du rendez-vous, avec la tolérance ci-dessous.
        </div>
        <div className="field">
          <label>Tolérance de créneau (minutes)</label>
          <input
            type="number" min={0} max={1440}
            value={s.gate_grace_minutes}
            onChange={(e) => setS({ ...s, gate_grace_minutes: e.target.value })}
          />
          <div className="small muted" style={{ marginTop: 4 }}>
            Marge autorisée avant le début et après la fin du créneau (ex. 30 = arrivée acceptée jusqu'à 30 min avant/après).
          </div>
        </div>

        <hr style={{ margin: '22px 0', border: 0, borderTop: '1px solid var(--line, #e0e0e0)' }} />

        <h2>Serveur d'e-mails (SMTP)</h2>
        <div className="alert info">
          Configuration d'envoi des e-mails aux transporteurs (confirmation d'affectation, report, annulation).
          Laissez le <b>serveur SMTP</b> vide pour désactiver les envois.
        </div>
        <div className="field">
          <label>Adresse e-mail d'expédition</label>
          <input
            type="email"
            placeholder="rdv@medlog.ci"
            value={s.smtp_from}
            onChange={(e) => setS({ ...s, smtp_from: e.target.value })}
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Serveur SMTP d'envoi</label>
            <input
              placeholder="smtp.medlog.ci"
              value={s.smtp_host}
              onChange={(e) => setS({ ...s, smtp_host: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Port SMTP</label>
            <input
              type="number" min={1} max={65535}
              value={s.smtp_port}
              onChange={(e) => setS({ ...s, smtp_port: e.target.value })}
            />
            <div className="small muted" style={{ marginTop: 4 }}>587 (STARTTLS) · 465 (TLS) · 25</div>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Login SMTP</label>
            <input
              autoComplete="off"
              placeholder="rdv@medlog.ci"
              value={s.smtp_user}
              onChange={(e) => setS({ ...s, smtp_user: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Mot de passe SMTP</label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={s.smtp_password_set ? '•••••••• (inchangé)' : 'mot de passe'}
              value={s.smtp_password}
              onChange={(e) => setS({ ...s, smtp_password: e.target.value })}
            />
            <div className="small muted" style={{ marginTop: 4 }}>
              {s.smtp_password_set
                ? 'Un mot de passe est déjà enregistré. Laissez vide pour le conserver.'
                : 'Jamais réaffiché après enregistrement.'}
            </div>
          </div>
        </div>

        <div className="flex" style={{ gap: 10, alignItems: 'flex-end', marginTop: 6 }}>
          <div className="field" style={{ flex: 1, margin: 0 }}>
            <label>Tester l'envoi vers</label>
            <input
              type="email"
              placeholder="destinataire@exemple.ci (défaut : adresse d'expédition)"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <button type="button" className="btn ghost" disabled={testing} onClick={sendTest}>
            {testing ? 'Envoi…' : '✉ Envoyer un test'}
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          Enregistrez d'abord la configuration SMTP avant de tester.
        </div>

        <hr style={{ margin: '22px 0', border: 0, borderTop: '1px solid var(--line, #e0e0e0)' }} />

        <h2>Assistant IA d'exploitation</h2>
        <div className="alert info">
          Active la <b>synthèse en langage naturel</b> du <b>Tableau de bord IA</b> (analyse, risques, actions)
          via l'API Claude d'Anthropic. Sans clé, l'Assistant IA reste disponible en <b>mode déterministe</b>
          (alertes et recommandations calculées automatiquement).
        </div>
        <div className="field">
          <label>Clé API Claude (Anthropic)</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={s.ai_api_key_set ? '•••••••• (inchangée)' : 'sk-ant-...'}
            value={s.ai_api_key}
            onChange={(e) => setS({ ...s, ai_api_key: e.target.value })}
          />
          <div className="small muted" style={{ marginTop: 4 }}>
            {s.ai_api_key_set
              ? 'Une clé est déjà enregistrée. Laissez vide pour la conserver.'
              : 'Jamais réaffichée après enregistrement. Obtenue sur console.anthropic.com.'}
          </div>
        </div>
        <div className="field">
          <label>Modèle Claude</label>
          <select value={s.ai_model} onChange={(e) => setS({ ...s, ai_model: e.target.value })}>
            <option value="claude-sonnet-5">Claude Sonnet 5 (équilibré — recommandé)</option>
            <option value="claude-opus-4-8">Claude Opus 4.8 (le plus puissant)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rapide / économique)</option>
          </select>
        </div>

        <button className="btn" disabled={saving} style={{ marginTop: 18 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </Layout>
  );
}
