import { useEffect, useState } from 'react';
import { api, Analytics } from '../api';
import { Layout, Kpi, OccupancyBar, HeroBand, Loader } from '../components';

export default function AdminDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Analytics>('/analytics/overview').then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <Layout title="Tableau de bord">
      {err && <div className="alert error">{err}</div>}
      {!data ? (
        <div className="page-center"><Loader /></div>
      ) : (
        <>
          <HeroBand
            subtitle="MEDLOG Côte d'Ivoire — Exploitation OFF-DOCK"
            title={`${data.total} rendez-vous · ${data.completedToday} conteneurs traités aujourd'hui`}
          />

          {/* Ligne 1 — volumétrie & état opérationnel courant */}
          <div className="grid cols-4">
            <Kpi accent value={data.total} label="Rendez-vous (total)" />
            <Kpi
              value={data.pendingAssignment}
              label="En attente d'affectation"
              hint="à traiter par un agent"
              tone={data.pendingAssignment > 0 ? 'warn' : 'good'}
            />
            <Kpi value={data.onSite} label="Sur site maintenant" hint="camions au portail / parc" />
            <Kpi value={data.completedToday} label="Traités aujourd'hui" tone="good" />
          </div>

          {/* Ligne 2 — indicateurs de performance (taux & délais) */}
          <div className="grid cols-4" style={{ marginTop: 16 }}>
            <Kpi value={`${data.completionRate}%`} label="Taux de complétion" hint="RDV menés à COMPLETED" />
            <Kpi
              value={`${data.noShowRate}%`}
              label="Taux d'absence (no-show)"
              tone={data.noShowRate >= 15 ? 'crit' : data.noShowRate >= 5 ? 'warn' : 'good'}
            />
            <Kpi value={`${data.avgTurnaroundMin} min`} label="Traitement moyen" hint="arrivée → dépose" />
            <Kpi value={`${data.avgAssignMin} min`} label="Délai d'affectation moyen" hint="création → affectation" />
          </div>

          {/* Ligne 3 — planification & pression sur les sites */}
          <div className="grid cols-4" style={{ marginTop: 16 }}>
            <Kpi value={data.todayScheduled} label="RDV planifiés aujourd'hui" />
            <Kpi value={data.upcoming7d} label="À venir (7 jours)" hint="affectés / confirmés" />
            <Kpi
              value={`${data.avgOccupancy}%`}
              label="Occupation moyenne des sites"
              tone={data.avgOccupancy >= 90 ? 'crit' : data.avgOccupancy >= 70 ? 'warn' : 'good'}
            />
            <Kpi
              value={data.congestedDocks}
              label="Sites congestionnés"
              hint="congestion ≥ 70 %"
              tone={data.congestedDocks > 0 ? 'warn' : 'good'}
            />
          </div>

          {/* Tendance 7 jours */}
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Tendance — demandes créées (7 derniers jours)</h2>
            <TrendChart trend={data.weeklyTrend} />
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
                  {!data.offDocks.length && (
                    <tr><td colSpan={4} className="muted">Aucun OFF-DOCK configuré.</td></tr>
                  )}
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

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h2>RDV du jour par shift</h2>
              <table>
                <tbody>
                  {Object.entries(data.byShiftToday).map(([code, count]) => (
                    <tr key={code}>
                      <td><span className="badge ASSIGNED">{code}</span></td>
                      <td className="right mono">{count}</td>
                    </tr>
                  ))}
                  {!Object.keys(data.byShiftToday).length && (
                    <tr><td className="muted">Aucun RDV planifié aujourd'hui.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>Top transporteurs</h2>
              <table>
                <tbody>
                  {data.topTransporters.map((t, i) => (
                    <tr key={t.name + i}>
                      <td>{i + 1}. {t.name}</td>
                      <td className="right mono">{t.count}</td>
                    </tr>
                  ))}
                  {!data.topTransporters.length && (
                    <tr><td className="muted">Aucune donnée transporteur.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

/** Mini histogramme (CSS) des demandes créées sur 7 jours. */
function TrendChart({ trend }: { trend: { date: string; count: number }[] }) {
  const max = Math.max(1, ...trend.map((t) => t.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, padding: '12px 4px 0' }}>
      {trend.map((t) => {
        const h = Math.round((t.count / max) * 100);
        const d = new Date(t.date + 'T00:00:00');
        const day = d.toLocaleDateString('fr-FR', { weekday: 'short' });
        const num = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return (
          <div key={t.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div className="small mono" style={{ opacity: 0.75 }}>{t.count}</div>
            <div
              title={`${t.count} demande(s) le ${num}`}
              style={{
                width: '100%',
                height: `${Math.max(h, t.count ? 8 : 2)}%`,
                background: t.count ? 'var(--yellow-strong, #e0a400)' : 'var(--grey-200, #e2e2e2)',
                borderRadius: '6px 6px 0 0',
                transition: 'height .45s ease',
              }}
            />
            <div className="small muted" style={{ textAlign: 'center', lineHeight: 1.2 }}>
              {day}<br />{num}
            </div>
          </div>
        );
      })}
    </div>
  );
}
