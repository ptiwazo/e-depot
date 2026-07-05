import { useEffect, useState } from 'react';
import { api, Analytics } from '../api';
import { Layout, Kpi, OccupancyBar, HeroBand } from '../components';

export default function AdminDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Analytics>('/analytics/overview').then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <Layout title="Tableau de bord national">
      {err && <div className="alert error">{err}</div>}
      {!data ? (
        <div className="muted">Chargement…</div>
      ) : (
        <>
          <HeroBand
            subtitle="MEDLOG Côte d'Ivoire — Exploitation OFF-DOCK"
            title={`${data.total} rendez-vous · ${data.completedToday} conteneurs traités aujourd'hui`}
          />
          <div className="grid cols-4">
            <Kpi accent value={data.total} label="Rendez-vous (total)" />
            <Kpi value={data.completedToday} label="Conteneurs traités aujourd'hui" />
            <Kpi value={`${data.avgTurnaroundMin} min`} label="Temps de traitement moyen" />
            <Kpi value={`${data.noShowRate}%`} label="Taux d'absence (no-show)" />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h2>Occupation des OFF-DOCKs (aujourd'hui)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Charge</th>
                    <th style={{ width: '35%' }}>Occupation</th>
                    <th>Congestion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.offDocks.map((d) => (
                    <tr key={d.code}>
                      <td>
                        <b>{d.code}</b>
                        <div className="muted small">{d.city}</div>
                      </td>
                      <td className="mono">{d.load}/{d.capacity}</td>
                      <td>
                        <OccupancyBar pct={d.occupancy} />
                        <span className="small muted">{d.occupancy}%</span>
                      </td>
                      <td className="mono">{d.congestion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>Répartition par statut</h2>
              <table>
                <tbody>
                  {Object.entries(data.byStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <tr key={status}>
                        <td>
                          <span className={`badge ${status}`}>{status.replace('_', ' ')}</span>
                        </td>
                        <td className="right mono">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
