import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
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
  const [scanning, setScanning] = useState(false);
  const [camErr, setCamErr] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Vérifie un contenu de QR (JSON {ref, token}) ou un jeton brut auprès de l'API.
  async function runScan(raw: string) {
    setError('');
    setAppt(null);
    let value = (raw || '').trim();
    if (!value) return;
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

  function submitScan(e: React.FormEvent) {
    e.preventDefault();
    runScan(token);
  }

  // Cycle de vie du scanner caméra.
  useEffect(() => {
    if (!scanning) return;
    let done = false;
    const q = new Html5Qrcode('qr-reader');
    scannerRef.current = q;
    q.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText: string) => {
        if (done) return;
        done = true;
        setScanning(false); // le nettoyage de l'effet arrête la caméra
        setToken(decodedText);
        runScan(decodedText);
      },
      () => { /* échec de lecture d'une image : on ignore */ },
    ).catch((err: any) => {
      if (!done) {
        setCamErr("Caméra indisponible : " + (err?.message || err) + ". Utilisez la saisie manuelle.");
        setScanning(false);
      }
    });
    return () => {
      done = true;
      q.stop().then(() => q.clear()).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

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
        <form className="card pad-lg" onSubmit={submitScan}>
          <h2>Contrôle d'entrée</h2>
          <p className="muted small">Scannez le QR code du chauffeur avec la caméra du téléphone, ou saisissez le jeton.</p>

          {!scanning ? (
            <button type="button" className="btn blue" onClick={() => { setCamErr(''); setError(''); setScanning(true); }}>
              📷 Scanner avec la caméra
            </button>
          ) : (
            <div>
              <div id="qr-reader" style={{ width: '100%', maxWidth: 340, margin: '0 auto', borderRadius: 10, overflow: 'hidden' }} />
              <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setScanning(false)}>
                Arrêter la caméra
              </button>
            </div>
          )}
          {camErr && <div className="alert error small" style={{ marginTop: 12 }}>{camErr}</div>}

          <div className="field" style={{ marginTop: 16 }}>
            <label>Ou saisir le jeton QR</label>
            <input className="mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="collez le contenu du QR ici" />
          </div>
          <button className="btn">Vérifier</button>
          {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}

          <div className="note small" style={{ marginTop: 12 }}>
            La caméra nécessite une connexion sécurisée (HTTPS). Sur un accès non sécurisé, utilisez la saisie manuelle.
          </div>
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
