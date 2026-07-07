import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, AiInsights, AiInsight } from '../api';
import { Layout, Loader } from '../components';

const LEVEL_BADGE: Record<string, string> = {
  crit: 'REJECTED',
  warn: 'IN_PROGRESS',
  info: 'ASSIGNED',
  good: 'COMPLETED',
};
const LEVEL_LABEL: Record<string, string> = { crit: 'Critique', warn: 'Attention', info: 'Info', good: 'OK' };

function InsightRow({ i }: { i: AiInsight }) {
  return (
    <div className="flex" style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line, #eee)', alignItems: 'flex-start' }}>
      <span className={`badge ${LEVEL_BADGE[i.level] ?? 'ASSIGNED'}`} style={{ flex: 'none', minWidth: 72, textAlign: 'center' }}>
        {LEVEL_LABEL[i.level] ?? i.level}
      </span>
      <div>
        <b>{i.title}</b>
        <div className="small muted">{i.detail}</div>
      </div>
    </div>
  );
}

export default function AiDashboard() {
  const [data, setData] = useState<AiInsights | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setErr('');
    api<AiInsights>('/ai/insights')
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <Layout title="Assistant IA d'exploitation">
      {err && <div className="alert error">{err}</div>}

      <div className="flex between" style={{ marginBottom: 14, alignItems: 'center' }}>
        <div className="muted small">
          {data
            ? `Analyse générée le ${new Date(data.generatedAt).toLocaleString('fr-FR')}` +
              (data.configured ? ` · synthèse ${data.model}` : ' · mode déterministe')
            : 'Analyse des données d’exploitation en temps réel.'}
        </div>
        <button className="btn ghost sm" onClick={load} disabled={loading}>
          {loading ? 'Analyse…' : '↻ Réanalyser'}
        </button>
      </div>

      {loading && !data ? (
        <div className="page-center"><Loader /></div>
      ) : data ? (
        <>
          {/* Synthèse en langage naturel (Claude) */}
          <div className="card pad-lg" style={{ marginBottom: 16 }}>
            <div className="flex between" style={{ alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>✨ Synthèse IA</h2>
              {data.configured && data.model && <span className="badge ASSIGNED">{data.model}</span>}
            </div>
            {data.briefing ? (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{data.briefing}</div>
            ) : data.briefingError ? (
              <div className="alert error small">Synthèse indisponible : {data.briefingError}</div>
            ) : (
              <div className="alert info small">
                La synthèse en langage naturel est désactivée. Renseignez une <b>clé API Claude</b> dans{' '}
                <Link to="/admin/settings">Paramètres → Assistant IA</Link> pour l’activer. Les alertes et
                recommandations ci-dessous restent calculées automatiquement.
              </div>
            )}
          </div>

          <div className="grid cols-2">
            {/* Alertes */}
            <div className="card">
              <h2>Alertes détectées</h2>
              {data.alerts.length ? (
                data.alerts.map((a, k) => <InsightRow key={k} i={a} />)
              ) : (
                <div className="alert ok small">Aucune alerte : la situation est nominale.</div>
              )}
            </div>

            {/* Recommandations */}
            <div className="card">
              <h2>Actions recommandées</h2>
              <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                {data.recommendations.map((r, k) => (
                  <li key={k} style={{ marginBottom: 6 }}>{r}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Points saillants */}
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Points saillants</h2>
            <div className="grid cols-3">
              {data.highlights.map((h, k) => (
                <div key={k} style={{ padding: '4px 0' }}>
                  <b>{h.title}</b>
                  <div className="small muted">{h.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </Layout>
  );
}
