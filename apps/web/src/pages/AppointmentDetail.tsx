import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { api, Appointment } from '../api';
import { useAuth } from '../auth';
import { Layout, Badge, fmtShift, fmtSlot } from '../components';

export default function AppointmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [qr, setQr] = useState<string>('');
  const [error, setError] = useState('');

  function load() {
    api<Appointment>(`/appointments/${id}`).then(setAppt).catch((e) => setError(e.message));
    api<{ dataUrl: string }>(`/appointments/${id}/qr`).then((r) => setQr(r.dataUrl)).catch(() => {});
  }
  useEffect(load, [id]);

  async function cancel() {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    try {
      await api(`/appointments/${id}/transition`, { method: 'POST', body: JSON.stringify({ to: 'CANCELLED', note: 'Annulé par le transporteur' }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const canCancel =
    user?.role === 'TRANSPORTER' && appt && ['ASSIGNED', 'CONFIRMED'].includes(appt.status);

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
      ['Shift', fmtShift(appt.slotStart, appt.slotEnd, appt.shiftCode)],
      ['Camion / remorque', `${appt.truckPlate ?? '—'} · ${appt.trailerPlate ?? '—'}`],
      ['Chauffeur', appt.driverName ?? '—'],
    ];
    let y = 38;
    for (const [k, v] of lines) {
      doc.setTextColor(139, 129, 120);
      doc.text(`${k} :`, 60, y);
      doc.setTextColor(34, 34, 33);
      doc.text(String(v), 90, y);
      y += 6.5;
    }
    doc.setFontSize(7);
    doc.setTextColor(139, 129, 120);
    doc.text('À présenter au portail de l\'OFF-DOCK affecté pour autorisation d\'entrée.', 8, 78);

    doc.save(`laissez-passer-${appt.reference}.pdf`);
  }

  return (
    <Layout title="Détail du rendez-vous">
      {error && <div className="alert error">{error}</div>}
      {!appt ? (
        <div className="muted">Chargement…</div>
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
