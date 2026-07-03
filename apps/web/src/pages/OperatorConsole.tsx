import { useState } from 'react';
import { api, Appointment } from '../api';
import { Layout, Badge, fmtShift } from '../components';

// Prochaines actions proposées à l'opérateur selon le statut courant.
const ACTIONS: Record<string, { to: string; label: string; cls: string }[]> = {
  ASSIGNED: [{ to: 'CONFIRMED', label: 'Confirmer le rendez-vous', cls: 'blue' }],
  CONFIRMED: [
    { to: 'ARRIVED', label: 'Enregistrer arrivée au portail', cls: '' },
    { to: 'NO_SHOW', label: 'Marquer absence (no-show)', cls: 'danger' },
  ],
  ARRIVED: [{ to: 'IN_PROGRESS', label: 'Démarrer déchargement', cls: 'blue' }],
  IN_PROGRESS: [{ to: 'COMPLETED', label: 'Confirmer dépose conteneur', cls: 'dark' }],
};

export default function OperatorConsole() {
  const [token, setToken] = useState('');
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function scan(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setAppt(null);
    let value = token.trim();
    // Accepte un scan QR complet (JSON {ref, token}) ou un jeton brut.
    try {
      const parsed = JSON.parse(value);
      if (parsed.token) value = parsed.token;
    } catch { /* jeton brut */ }
    try {
      const res = await api<Appointment>('/appointments/scan', { method: 'POST', body: JSON.stringify({ token: value }) });
      setAppt(res);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function transition(to: string) {
    if (!appt) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<Appointment>(`/appointments/${appt.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ to }),
      });
      setAppt(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="Console portail OFF-DOCK">
      <div className="grid cols-2">
        <form className="card pad-lg" onSubmit={scan}>
          <h2>Contrôle d'entrée</h2>
          <p className="muted small">Scannez le QR code du chauffeur ou saisissez le jeton / la référence.</p>
          <div className="field">
            <label>Jeton QR</label>
            <input className="mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="collez le contenu du QR ici" autoFocus />
          </div>
          <button className="btn">Vérifier</button>
          {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}
        </form>

        <div className="card pad-lg">
          {!appt ? (
            <div className="muted">Aucun conteneur vérifié. En attente d'un scan.</div>
          ) : (
            <>
              <div className="flex between">
                <h2 style={{ margin: 0 }}>{appt.reference}</h2>
                <Badge status={appt.status} />
              </div>
              <table style={{ marginTop: 10 }}>
                <tbody>
                  <tr><td className="muted">Conteneur</td><td className="mono">{appt.containerNumber} ({appt.containerType})</td></tr>
                  <tr><td className="muted">OFF-DOCK</td><td>{appt.offDock?.code} · {appt.offDock?.city}</td></tr>
                  <tr><td className="muted">Shift</td><td>{fmtShift(appt.slotStart, appt.slotEnd, appt.shiftCode)}</td></tr>
                  <tr><td className="muted">Transporteur</td><td>{appt.company?.name}</td></tr>
                  <tr><td className="muted">Camion / remorque</td><td className="mono">{appt.truckPlate ?? '—'} · {appt.trailerPlate ?? '—'}</td></tr>
                  <tr><td className="muted">Chauffeur</td><td>{appt.driverName ?? '—'}{appt.driverPhone ? ` · ${appt.driverPhone}` : ''}</td></tr>
                </tbody>
              </table>

              <div className="stack" style={{ marginTop: 16, gap: 8 }}>
                {(ACTIONS[appt.status] ?? []).map((a) => (
                  <button key={a.to} className={`btn ${a.cls}`} disabled={busy} onClick={() => transition(a.to)}>
                    {a.label}
                  </button>
                ))}
                {!ACTIONS[appt.status] && (
                  <div className="alert info small">Aucune action disponible pour ce statut.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
