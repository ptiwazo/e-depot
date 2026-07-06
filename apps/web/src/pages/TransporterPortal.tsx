import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, Appointment, Shift } from '../api';
import { Layout, Badge, fmtShift } from '../components';

export function TransporterList() {
  const [items, setItems] = useState<Appointment[]>([]);
  useEffect(() => {
    api<Appointment[]>('/appointments').then(setItems);
  }, []);

  return (
    <Layout title="Mes rendez-vous">
      <div className="flex between" style={{ marginBottom: 14 }}>
        <div className="muted">Suivi de vos demandes de retour de conteneurs vides MSC.</div>
        <Link className="btn" to="/transporter/new">+ Nouvelle demande</Link>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Conteneur</th>
              <th>Type</th>
              <th>OFF-DOCK affecté</th>
              <th>Shift</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.reference}</td>
                <td className="mono">{a.containerNumber}</td>
                <td className="mono">{a.containerType}</td>
                <td>{a.offDock ? <><b>{a.offDock.code}</b><div className="small muted">{a.offDock.city}</div></> : '—'}</td>
                <td>{fmtShift(a.slotStart, a.slotEnd, a.shiftCode)}</td>
                <td><Badge status={a.status} /></td>
                <td className="right"><Link className="btn sm ghost" to={`/appointment/${a.id}`}>QR / détail</Link></td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={7} className="muted">Aucune demande pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

interface VerifyResult {
  found: boolean;
  blMatch: boolean;
  containerType?: string;
  consignee?: string;
  message: string;
  propreMoyen?: boolean;
  minLeadHours?: number;
}

// Date la plus proche réservable (aujourd'hui + délai de préavis, au format AAAA-MM-JJ).
function minDateFor(hours?: number): string {
  return new Date(Date.now() + (hours ?? 0) * 3600_000).toISOString().slice(0, 10);
}

export function NewAppointment() {
  const nav = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [form, setForm] = useState({
    containerNumber: '',
    blNumber: '',
    truckPlate: '',
    trailerPlate: '',
    driverName: '',
    driverPhone: '',
    requestedDate: '', // vide : le transporteur choisit consciemment (évite la confusion avec le RDV affecté)
    shiftCode: '', // vide : idem
  });
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Shift[]>('/shifts').then(setShifts);
  }, []);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Vérifie le couple conteneur + BL dans la base MEDLOG (dès que les deux sont saisis).
  async function checkBase() {
    setVerify(null);
    if (!form.containerNumber.trim() || !form.blNumber.trim()) return;
    try {
      const res = await api<VerifyResult>(
        `/manifest/verify?container=${encodeURIComponent(form.containerNumber)}&bl=${encodeURIComponent(form.blNumber)}`,
      );
      setVerify(res);
      // Repousse la date si (et seulement si) une date est déjà choisie et trop proche du préavis.
      if (res.found && res.blMatch && form.requestedDate) {
        const md = minDateFor(res.minLeadHours);
        if (form.requestedDate < md) set('requestedDate', md);
      }
    } catch {
      /* ignore */
    }
  }

  const baseOk = verify?.found && verify?.blMatch;
  const minDate = minDateFor(baseOk ? verify?.minLeadHours : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.containerNumber.trim() || !form.blNumber.trim()) return setError('Conteneur et BL obligatoires.');
    if (!baseOk) return setError('Conteneur + BL non vérifiés dans la base MEDLOG.');
    if (!form.truckPlate.trim() || !form.trailerPlate.trim() || !form.driverName.trim())
      return setError('Camion, remorque et chauffeur sont obligatoires.');
    if (!form.requestedDate) return setError('La date souhaitée est obligatoire.');
    if (!form.shiftCode) return setError('Le shift souhaité est obligatoire.');
    // Préavis (identique au backend) : le début du créneau (date + heure du shift, en UTC)
    // doit être au moins à minLeadHours de maintenant.
    if (verify?.minLeadHours) {
      const sh = shifts.find((s) => s.code === form.shiftCode);
      if (sh) {
        const [h, m] = sh.startTime.split(':').map(Number);
        const slot = new Date(form.requestedDate + 'T00:00:00.000Z');
        slot.setUTCHours(h || 0, m || 0, 0, 0);
        if (slot.getTime() < Date.now() + verify.minLeadHours * 3600_000) {
          return setError(
            `Préavis insuffisant : ce conteneur exige une réservation au moins ${verify.minLeadHours}h à l'avance` +
              `${verify.propreMoyen ? ' (propre moyen)' : ''}. Choisissez une date/un créneau plus lointain.`,
          );
        }
      }
    }
    setBusy(true);
    try {
      const appt = await api<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          containerNumber: form.containerNumber,
          blNumber: form.blNumber,
          truckPlate: form.truckPlate,
          trailerPlate: form.trailerPlate,
          driverName: form.driverName,
          driverPhone: form.driverPhone || undefined,
          requestedDate: new Date(form.requestedDate + 'T00:00:00.000Z').toISOString(),
          shiftCode: form.shiftCode,
        }),
      });
      nav(`/appointment/${appt.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="Nouvelle demande de rendez-vous">
      <div className="grid cols-2">
        <form className="card pad-lg" onSubmit={submit}>
          {error && <div className="alert error">{error}</div>}

          <h3>Conteneur (vérifié dans la base MEDLOG)</h3>
          <div className="row">
            <div className="field">
              <label>Numéro de conteneur *</label>
              <input
                className="mono"
                placeholder="MSCU1234565"
                value={form.containerNumber}
                onChange={(e) => set('containerNumber', e.target.value.toUpperCase())}
                onBlur={checkBase}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>N° BL *</label>
              <input
                className="mono"
                placeholder="MSCUBL200001"
                value={form.blNumber}
                onChange={(e) => set('blNumber', e.target.value.toUpperCase())}
                onBlur={checkBase}
                required
              />
            </div>
          </div>
          {verify && (
            <div className={`alert ${baseOk ? 'ok' : 'error'} small`}>
              {baseOk
                ? `✓ ${verify.message}${verify.consignee ? ` — client ${verify.consignee}` : ''} (type ${verify.containerType})`
                  + ` · préavis minimum ${verify.minLeadHours}h${verify.propreMoyen ? ' — propre moyen' : ''}`
                : `✗ ${verify.message}`}
            </div>
          )}

          <h3 style={{ marginTop: 18 }}>Attelage (saisie manuelle)</h3>
          <div className="row">
            <div className="field">
              <label>Camion (immatriculation) *</label>
              <input className="mono" placeholder="CI-1234-AB" value={form.truckPlate} onChange={(e) => set('truckPlate', e.target.value.toUpperCase())} required />
            </div>
            <div className="field">
              <label>Remorque (immatriculation) *</label>
              <input className="mono" placeholder="RM-4001-CI" value={form.trailerPlate} onChange={(e) => set('trailerPlate', e.target.value.toUpperCase())} required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Chauffeur (nom) *</label>
              <input placeholder="Kouassi Yao" value={form.driverName} onChange={(e) => set('driverName', e.target.value)} required />
            </div>
            <div className="field">
              <label>Téléphone chauffeur</label>
              <input placeholder="+2250708112233" value={form.driverPhone} onChange={(e) => set('driverPhone', e.target.value)} />
            </div>
          </div>

          <h3 style={{ marginTop: 18 }}>Créneau souhaité</h3>
          <div className="alert info small" style={{ marginBottom: 10 }}>
            Indiquez la date et le shift <b>souhaités</b>. L'<b>OFF-DOCK et le créneau définitifs</b> seront
            affectés par un agent MEDLOG (ce ne sont pas encore vos date/heure de rendez-vous).
          </div>
          <div className="row">
            <div className="field">
              <label>Date souhaitée *</label>
              <input type="date" min={minDate} value={form.requestedDate} onChange={(e) => set('requestedDate', e.target.value)} required />
            </div>
            <div className="field">
              <label>Shift souhaité *</label>
              <select value={form.shiftCode} onChange={(e) => set('shiftCode', e.target.value)} required>
                <option value="">— choisir —</option>
                {shifts.map((s) => (
                  <option key={s.code} value={s.code}>{s.label} ({s.startTime}-{s.endTime})</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn" disabled={busy || !baseOk} style={{ marginTop: 8 }}>
            {busy ? 'Traitement…' : 'Soumettre la demande'}
          </button>
        </form>

        <div className="card pad-lg">
          <h2>Comment ça marche</h2>
          <ul className="small" style={{ lineHeight: 1.9, paddingLeft: 18 }}>
            <li>Le conteneur et le BL sont <b>vérifiés dans la base MEDLOG</b> (chargée par l'administrateur) : sans correspondance, la demande ne peut pas être soumise.</li>
            <li>Vous saisissez <b>manuellement</b> le camion, la remorque et le chauffeur.</li>
            <li>Vous choisissez la <b>date</b> et le <b>shift</b> souhaités (Jour ou Nuit).</li>
            <li>La demande validée part en file d'attente : l'<b>OFF-DOCK est affecté par un agent MEDLOG</b>, puis QR code et créneau vous sont communiqués.</li>
          </ul>
          <div className="alert info small">
            Le type de conteneur est repris automatiquement de la base MEDLOG.
          </div>
        </div>
      </div>
    </Layout>
  );
}
