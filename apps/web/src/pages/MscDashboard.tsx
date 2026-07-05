import { useEffect, useState } from 'react';
import { api, Analytics } from '../api';
import { Layout, Kpi, OccupancyBar, Loader } from '../components';

export default function MscDashboard() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api<Analytics>('/analytics/overview').then(setData);
  }, []);

  return (
    <Layout title="Supervision MSC — retours conteneurs vides">
      {!data ? (
        <div className="page-center"><Loader /></div>
      ) : (
        <>
          <div className="alert info">Vue lecture seule — suivi des retours de conteneurs vides MSC sur le réseau OFF-DOCK MEDLOG CI.</div>
          <div className="grid cols-4">
            <Kpi accent value={data.total} label="Retours enregistrés" />
            <Kpi value={data.completedToday} label="Traités aujourd'hui" />
            <Kpi value={`${data.avgTurnaroundMin} min`} label="Temps moyen en site" />
            <Kpi value={`${data.noShowRate}%`} label="Taux d'absence" />
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Performance par OFF-DOCK</h2>
            <table>
              <thead>
                <tr><th>Site</th><th>Ville</th><th>Charge</th><th style={{ width: '30%' }}>Occupation</th></tr>
              </thead>
              <tbody>
                {data.offDocks.map((d) => (
                  <tr key={d.code}>
                    <td><b>{d.code}</b></td>
                    <td>{d.city}</td>
                    <td className="mono">{d.load}/{d.capacity}</td>
                    <td><OccupancyBar pct={d.occupancy} /><span className="small muted">{d.occupancy}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
