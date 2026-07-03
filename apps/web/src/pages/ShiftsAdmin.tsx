import { useEffect, useState } from 'react';
import { api, Shift } from '../api';
import { Layout } from '../components';

export default function ShiftsAdmin() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function load() {
    api<Shift[]>('/shifts').then(setShifts);
  }
  useEffect(load, []);

  async function patch(code: string, data: Partial<Shift>) {
    setMsg('');
    setErr('');
    try {
      await api(`/shifts/${code}`, { method: 'PATCH', body: JSON.stringify(data) });
      setMsg('Horaires du shift mis à jour.');
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <Layout title="Horaires des shifts">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}
      <div className="alert info">
        Les horaires définis ici s'appliquent à tous les OFF-DOCK et pilotent l'affectation des rendez-vous.
        Un shift dont l'heure de fin est antérieure à l'heure de début franchit minuit (poste de nuit).
      </div>
      <div className="grid cols-2">
        {shifts.map((s) => (
          <div className="card pad-lg" key={s.code}>
            <div className="flex between">
              <h2 style={{ margin: 0 }}>{s.code}</h2>
              <span className="role-chip">{s.startTime} – {s.endTime}</span>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Libellé</label>
              <input defaultValue={s.label} key={`l-${s.label}`} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.label) patch(s.code, { label: v }); }} />
            </div>
            <div className="row">
              <div className="field">
                <label>Heure de début</label>
                <input type="time" defaultValue={s.startTime} key={`s-${s.startTime}`} onBlur={(e) => { if (e.target.value && e.target.value !== s.startTime) patch(s.code, { startTime: e.target.value }); }} />
              </div>
              <div className="field">
                <label>Heure de fin</label>
                <input type="time" defaultValue={s.endTime} key={`e-${s.endTime}`} onBlur={(e) => { if (e.target.value && e.target.value !== s.endTime) patch(s.code, { endTime: e.target.value }); }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
