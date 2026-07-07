import { useEffect, useState } from 'react';
import { api, Appointment, OffDock, Shift } from '../api';
import { Layout, Badge } from '../components';

export default function AgentQueue() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [docks, setDocks] = useState<OffDock[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  // Report en cours d'édition : { [id]: { date, shift } }
  const [reschedule, setReschedule] = useState<Record<string, { date: string; shift: string }>>({});

  function load() {
    api<Appointment[]>('/appointments/pending').then((list) => {
      setItems(list);
      const pre: Record<string, string> = {};
      list.forEach((a) => {
        if (a.recommendation) pre[a.id] = a.recommendation.offDockId;
      });
      setChoice((c) => ({ ...pre, ...c }));
    });
    api<OffDock[]>('/offdocks').then((d) => setDocks(d.filter((x) => x.active)));
    api<Shift[]>('/shifts').then(setShifts);
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

  async function cancel(a: Appointment) {
    if (!window.confirm(`Annuler la demande ${a.reference} ? Le transporteur devra en refaire une.`)) return;
    setBusy(a.id);
    setErr('');
    setMsg('');
    try {
      await api(`/appointments/${a.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ to: 'CANCELLED', note: 'Annulé par un agent MEDLOG (capacité OFF-DOCK)' }),
      });
      setMsg(`${a.reference} annulé.`);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  }

  function openReschedule(a: Appointment) {
    setReschedule((r) => ({
      ...r,
      [a.id]: { date: new Date(a.requestedDate).toISOString().slice(0, 10), shift: a.shiftCode ?? '' },
    }));
  }
  function closeReschedule(id: string) {
    setReschedule((r) => {
      const n = { ...r };
      delete n[id];
      return n;
    });
  }

  async function submitReschedule(a: Appointment) {
    const edit = reschedule[a.id];
    if (!edit?.date || !edit?.shift) {
      setErr('Choisissez une nouvelle date et un shift pour le report.');
      return;
    }
    setBusy(a.id);
    setErr('');
    setMsg('');
    try {
      await api(`/appointments/${a.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          requestedDate: new Date(edit.date + 'T00:00:00.000Z').toISOString(),
          shiftCode: edit.shift,
        }),
      });
      setMsg(`${a.reference} reporté au ${new Date(edit.date).toLocaleDateString('fr-FR')}.`);
      closeReschedule(a.id);
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
        (charge, congestion, distance) sur le shift demandé — vous confirmez, choisissez un autre site,
        ou, si la capacité l'exige, <b>reportez</b> ou <b>annulez</b> la demande. Un OFF-DOCK saturé
        n'empêche jamais le transporteur de réserver : c'est vous qui arbitrez ici.
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
              <th style={{ width: 300 }}>Affectation / arbitrage</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const reqDate = new Date(a.requestedDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
              const editing = reschedule[a.id];
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
                      <span className="small" style={{ color: 'var(--red)' }} title="Tous les sites sont pleins sur ce shift — vous pouvez forcer une affectation, reporter ou annuler.">
                        aucun site dispo
                      </span>
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
                    <div className="flex" style={{ gap: 6, marginTop: 6 }}>
                      <button className="btn sm ghost" disabled={busy === a.id} onClick={() => (editing ? closeReschedule(a.id) : openReschedule(a))}>
                        {editing ? 'Fermer' : '↻ Reporter'}
                      </button>
                      <button className="btn sm ghost" disabled={busy === a.id} onClick={() => cancel(a)} style={{ color: 'var(--red)' }}>
                        ✕ Annuler
                      </button>
                    </div>
                    {editing && (
                      <div style={{ marginTop: 8, padding: 8, background: 'var(--grey-100, #f4f4f4)', borderRadius: 8 }}>
                        <div className="small muted" style={{ marginBottom: 6 }}>Reporter à une autre date / shift :</div>
                        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <input
                            type="date"
                            value={editing.date}
                            onChange={(e) => setReschedule((r) => ({ ...r, [a.id]: { ...r[a.id], date: e.target.value } }))}
                          />
                          <select
                            value={editing.shift}
                            onChange={(e) => setReschedule((r) => ({ ...r, [a.id]: { ...r[a.id], shift: e.target.value } }))}
                          >
                            <option value="">— shift —</option>
                            {shifts.map((s) => (
                              <option key={s.code} value={s.code}>{s.label} ({s.startTime}-{s.endTime})</option>
                            ))}
                          </select>
                          <button className="btn sm" disabled={busy === a.id} onClick={() => submitReschedule(a)}>
                            {busy === a.id ? '…' : 'Valider le report'}
                          </button>
                        </div>
                      </div>
                    )}
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
