import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { api, Appointment } from '../api';
import { useAuth } from '../auth';
import { Layout, Badge, fmtShift, fmtSlot, Loader } from '../components';

export default function AppointmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [qr, setQr] = useState<string>('');
  const [error, setError] = useState('');
  const [editAtt, setEditAtt] = useState(false);
  const [att, setAtt] = useState({ truckPlate: '', trailerPlate: '', driverName: '', driverPhone: '' });
  const [savingAtt, setSavingAtt] = useState(false);

  function load() {
    api<Appointment>(`/appointments/${id}`).then(setAppt).catch((e) => setError(e.message));
    api<{ dataUrl: string }>(`/appointments/${id}/qr`).then((r) => setQr(r.dataUrl)).catch(() => {});
  }
  useEffect(load, [id]);

  async function cancel() {
    const motif = window.prompt('Motif de l’annulation de ce rendez-vous :', '');
    if (motif === null) return; // annulation abandonnée
    if (!motif.trim()) {
      setError('Le motif est obligatoire pour annuler.');
      return;
    }
    try {
      await api(`/appointments/${id}/transition`, { method: 'POST', body: JSON.stringify({ to: 'CANCELLED', note: motif.trim() }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const canCancel =
    user?.role === 'TRANSPORTER' && appt && ['ASSIGNED', 'CONFIRMED'].includes(appt.status);

  // Attelage modifiable tant que le conteneur n'est pas arrivé au portail.
  const canEditAttelage =
    (user?.role === 'TRANSPORTER' || user?.role === 'ADMIN') &&
    !!appt && ['REQUESTED', 'VALIDATED', 'ASSIGNED', 'CONFIRMED'].includes(appt.status);

  function openEditAtt() {
    if (!appt) return;
    setAtt({
      truckPlate: appt.truckPlate ?? '',
      trailerPlate: appt.trailerPlate ?? '',
      driverName: appt.driverName ?? '',
      driverPhone: appt.driverPhone ?? '',
    });
    setError('');
    setEditAtt(true);
  }

  async function saveAtt() {
    setSavingAtt(true);
    setError('');
    try {
      await api(`/appointments/${id}/attelage`, { method: 'PATCH', body: JSON.stringify(att) });
      setEditAtt(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingAtt(false);
    }
  }

  // Lien d'itinéraire Google Maps vers l'OFF-DOCK affecté (navigation pour le chauffeur).
  const mapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  // Génère un laissez-passer PDF (A6 paysage) avec le QR code, imprimable au portail.
  function printPdf() {
    if (!appt || !qr) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a6' }); // 148 x 105
    // Bandeau MEDLOG
    doc.setFillColor(34, 34, 33);
    doc.rect(0, 0, 148, 16, 'F');
    doc.setFillColor(238, 212, 132);
    doc.rect(0, 16, 148, 1.5, 'F');
    doc.setTextColor(238, 212, 132);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MEDLOG  e-depot', 8, 10);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('LAISSEZ-PASSER OFF-DOCK', 96, 10);

    // QR
    doc.addImage(qr, 'PNG', 8, 24, 46, 46);

    // Infos
    doc.setTextColor(34, 34, 33);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(appt.reference, 60, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines: [string, string][] = [
      ['Conteneur', `${appt.containerNumber} (${appt.containerType})`],
      ['BL', appt.blNumber || '—'],
      ['OFF-DOCK', appt.offDock ? `${appt.offDock.code} — ${appt.offDock.city}` : '—'],
      ...(appt.offDock
        ? ([['GPS', `${appt.offDock.lat.toFixed(6)}, ${appt.offDock.lng.toFixed(6)}`]] as [string, string][])
        : []),
      ['Shift', fmtShift(appt.slotStart, appt.slotEnd, appt.shiftCode)],
      ['Camion / remorque', `${appt.truckPlate ?? '—'} · ${appt.trailerPlate ?? '—'}`],
      ['Chauffeur', appt.driverName ?? '—'],
    ];
    let y = 36;
    for (const [k, v] of lines) {
      doc.setTextColor(139, 129, 120);
      doc.text(`${k} :`, 60, y);
      doc.setTextColor(34, 34, 33);
      doc.text(String(v), 88, y);
      y += 6;
    }
    // Lien cliquable d'itinéraire (utile quand le laissez-passer est ouvert sur téléphone).
    if (appt.offDock) {
      doc.setTextColor(0, 83, 137);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink("Ouvrir l'itineraire (Google Maps)", 60, y + 1, {
        url: mapsUrl(appt.offDock.lat, appt.offDock.lng),
      });
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(7);
    doc.setTextColor(139, 129, 120);
    doc.text('À présenter au portail de l\'OFF-DOCK affecté pour autorisation d\'entrée.', 8, 100);

    doc.save(`laissez-passer-${appt.reference}.pdf`);
  }

  return (
    <Layout title="Détail du rendez-vous">
      {error && <div className="alert error">{error}</div>}
      {user?.role === 'TRANSPORTER' && (
        <div className="flex between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn ghost sm" to="/transporter">← Mes rendez-vous</Link>
          <Link className="btn sm" to="/transporter/new">+ Nouvelle demande</Link>
        </div>
      )}
      {!appt ? (
        <div className="page-center"><Loader /></div>
      ) : (
        <div className="grid cols-2">
          <div className="card pad-lg">
            <div className="flex between">
              <h2 style={{ margin: 0 }}>{appt.reference}</h2>
              <Badge status={appt.status} />
            </div>
            <table style={{ marginTop: 12 }}>
              <tbody>
                <tr><td className="muted">Conteneur</td><td className="mono">{appt.containerNumber}</td></tr>
                <tr><td className="muted">Type</td><td>{appt.containerType}</td></tr>
                <tr><td className="muted">BL</td><td>{appt.blNumber || '—'}</td></tr>
                <tr><td className="muted">OFF-DOCK affecté</td><td>{appt.offDock ? `${appt.offDock.code} — ${appt.offDock.name}, ${appt.offDock.city}` : '—'}</td></tr>
                <tr><td className="muted">Shift affecté</td><td>{fmtShift(appt.slotStart, appt.slotEnd, appt.shiftCode)}</td></tr>
                <tr><td className="muted">Transporteur</td><td>{appt.company?.name}</td></tr>
                <tr><td className="muted">Camion</td><td className="mono">{appt.truckPlate ?? '—'}</td></tr>
                <tr><td className="muted">Remorque</td><td className="mono">{appt.trailerPlate ?? '—'}</td></tr>
                <tr><td className="muted">Chauffeur</td><td>{appt.driverName ?? '—'}{appt.driverPhone ? ` · ${appt.driverPhone}` : ''}</td></tr>
              </tbody>
            </table>
            {canEditAttelage && !editAtt && (
              <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={openEditAtt}>✏️ Modifier l'attelage</button>
            )}
            {editAtt && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--grey-100, #f4f4f4)', borderRadius: 10 }}>
                <div className="small muted" style={{ marginBottom: 8 }}>
                  Attelage — modifiable jusqu'à l'arrivée du conteneur au portail.
                </div>
                <div className="row">
                  <div className="field">
                    <label>Camion (immatriculation) *</label>
                    <input className="mono" value={att.truckPlate} onChange={(e) => setAtt({ ...att, truckPlate: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="field">
                    <label>Remorque (immatriculation) *</label>
                    <input className="mono" value={att.trailerPlate} onChange={(e) => setAtt({ ...att, trailerPlate: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                <div className="row">
                  <div className="field">
                    <label>Chauffeur (nom) *</label>
                    <input value={att.driverName} onChange={(e) => setAtt({ ...att, driverName: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Téléphone chauffeur</label>
                    <input value={att.driverPhone} onChange={(e) => setAtt({ ...att, driverPhone: e.target.value })} placeholder="+2250708112233" />
                  </div>
                </div>
                <div className="flex" style={{ gap: 8, marginTop: 8 }}>
                  <button className="btn sm" disabled={savingAtt} onClick={saveAtt}>{savingAtt ? 'Enregistrement…' : 'Enregistrer l\'attelage'}</button>
                  <button className="btn ghost sm" disabled={savingAtt} onClick={() => setEditAtt(false)}>Annuler</button>
                </div>
              </div>
            )}
            {canCancel && (
              <button className="btn danger sm" style={{ marginTop: 14 }} onClick={cancel}>Annuler le rendez-vous</button>
            )}

            <h3 style={{ marginTop: 22 }}>Historique</h3>
            <ul className="timeline">
              {appt.events?.map((e) => (
                <li key={e.id}>
                  <b>{e.toStatus.replace('_', ' ')}</b>
                  <span className="muted small"> · {fmtSlot(e.createdAt)}</span>
                  {e.note && <div className="small muted">{e.note}</div>}
                </li>
              ))}
            </ul>
          </div>

          <div className="card pad-lg qr-box">
            <h2>Laissez-passer portail</h2>
            {['REQUESTED', 'VALIDATED'].includes(appt.status) ? (
              <div className="alert info" style={{ marginTop: 8 }}>
                ⏳ Demande validée — <b>en attente d'affectation de l'OFF-DOCK par un agent MEDLOG</b>.
                Le QR code et le créneau seront disponibles dès l'affectation.
              </div>
            ) : (
              <>
                <p className="muted small">À présenter au portail de l'OFF-DOCK affecté pour l'autorisation d'entrée.</p>
                {qr ? <img src={qr} alt="QR code rendez-vous" /> : <div className="muted">QR indisponible</div>}
                <div className="mono" style={{ marginTop: 12, fontSize: 16 }}>{appt.reference}</div>
                {appt.offDock && <div className="muted">{appt.offDock.code} · {fmtShift(appt.slotStart, appt.slotEnd, appt.shiftCode)}</div>}
                {appt.offDock && (
                  <div style={{ marginTop: 10 }}>
                    <div className="small muted mono">📍 {appt.offDock.lat.toFixed(6)}, {appt.offDock.lng.toFixed(6)}</div>
                    <a
                      className="btn sm"
                      style={{ marginTop: 6 }}
                      href={mapsUrl(appt.offDock.lat, appt.offDock.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🧭 Itinéraire vers l'OFF-DOCK
                    </a>
                  </div>
                )}
                {qr && (
                  <button className="btn dark" style={{ marginTop: 16 }} onClick={printPdf}>🖨 Imprimer le laissez-passer (PDF)</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
