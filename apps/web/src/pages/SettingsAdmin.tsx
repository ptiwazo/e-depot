import { useEffect, useState } from 'react';
import { api } from '../api';
import { Layout, Loader } from '../components';

type Settings = {
  lead_hours_propre_moyen: string;
  lead_hours_default: string;
  propre_moyen_label: string;
};

export default function SettingsAdmin() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

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

  if (!s) return <Layout title="Paramètres"><div className="page-center"><Loader /></div></Layout>;

  return (
    <Layout title="Paramètres — délais de préavis">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}
      <div className="alert info">
        Délai minimum entre la <b>prise du rendez-vous</b> et le <b>créneau demandé</b>. Le délai renforcé
        s'applique aux conteneurs dont le champ <b>« transporteur »</b> vaut <b>« propre moyen »</b> dans la base.
      </div>
      <form className="card pad-lg" onSubmit={save} style={{ maxWidth: 560 }}>
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
        <button className="btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </Layout>
  );
}
