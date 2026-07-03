import { useEffect, useState } from 'react';
import { api, Appointment, OffDock } from '../api';
import { Layout, Badge } from '../components';

export default function AgentQueue() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [docks, setDocks] = useState<OffDock[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function load() {
    api<Appointment[]>('/appointments/pending').then((list) => {
      setItems(list);
      // Pré-sélectionne la recommandation du moteur pour chaque demande.
      const pre: Record<string, string> = {};
      list.forEach((a) => {
        if (a.recommendation) pre[a.id] = a.recommendation.offDockId;
      });
      setChoice((c) => ({ ...pre, ...c }));
    });
    api<OffDock[]>('/offdocks').then((d) => setDocks(d.filter((x) => x.active)));
  }
  useEffect(load, []);

  async function assign(a: Appointment) {
    const offDockId = choice[a.id] || a.recommendation?.offDockId;
    if (!offDockId) {
      setErr('Sélectionnez un OFF-DOCK.');
      return;
    }
    setBusy(a.id);
    setErr('');
    setMsg('');
    try {
      const res = await api<Appointment>(`/appointments/${a.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ offDockId }),
      });
      setMsg(`${res.reference} affecté à ${res.offDock?.code}.`);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <Layout title="File d'affectation OFF-DOCK">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}
      <div className="alert info">
        Demandes validées en attente d'affectation. Le moteur propose le meilleur OFF-DOCK
        (charge, congestion, distance) sur le shift demandé — vous confirmez ou choisissez un autre site.
      </div>

      <div className="card">
        <div className="flex between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{items.length} demande(s) à affecter</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Conteneur / BL</th>
              <th>Transporteur</th>
              <th>Date + shift demandés</th>
              <th>Recommandation</th>
              <th style={{ width: 260 }}>Affectation OFF-DOCK</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const reqDate = new Date(a.requestedDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
              return (
                <tr key={a.id}>
                  <td className="mono">{a.reference}<div><Badge status={a.status} /></div></td>
                  <td><span className="mono">{a.containerNumber}</span> <span className="badge ASSIGNED">{a.containerType}</span><div className="small muted mono">BL {a.blNumber}</div></td>
                  <td className="small">{a.company?.name}</td>
                  <td>{reqDate} · <b>{a.shiftCode}</b></td>
                  <td>
                    {a.recommendation ? (
                      <><b>{a.recommendation.offDockCode}</b><div className="small muted">score {a.recommendation.score}</div></>
                    ) : (
                      <span className="small" style={{ color: 'var(--red)' }}>aucun site dispo</span>
                    )}
                  </td>
                  <td>
                    <div className="flex" style={{ gap: 6 }}>
                      <select
                        value={choice[a.id] ?? a.recommendation?.offDockId ?? ''}
                        onChange={(e) => setChoice((c) => ({ ...c, [a.id]: e.target.value }))}
                      >
                        <option value="">— choisir —</option>
                        {docks.map((d) => (
                          <option key={d.id} value={d.id}>{d.code} ({d.city})</option>
                        ))}
                      </select>
                      <button className="btn sm" disabled={busy === a.id} onClick={() => assign(a)}>
                        {busy === a.id ? '…' : 'Affecter'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr><td colSpan={6} className="muted">Aucune demande en attente d'affectation.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
