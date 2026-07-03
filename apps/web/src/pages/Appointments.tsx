import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Appointment } from '../api';
import { Layout, Badge, fmtShift } from '../components';

export default function Appointments() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const q = filter ? `?status=${filter}` : '';
    api<Appointment[]>(`/appointments${q}`).then(setItems);
  }, [filter]);

  return (
    <Layout title="Rendez-vous">
      <div className="card">
        <div className="flex between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{items.length} rendez-vous</h2>
          <select style={{ width: 220 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {['ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'REJECTED', 'CANCELLED'].map(
              (s) => (
                <option key={s} value={s}>{s}</option>
              ),
            )}
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Conteneur</th>
              <th>Type</th>
              <th>OFF-DOCK</th>
              <th>Shift</th>
              <th>Transporteur</th>
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
                <td>{a.offDock?.code ?? '—'}</td>
                <td>{fmtShift(a.slotStart, a.slotEnd, a.shiftCode)}</td>
                <td className="small">{a.company?.name ?? '—'}</td>
                <td><Badge status={a.status} /></td>
                <td className="right"><Link className="btn sm ghost" to={`/appointment/${a.id}`}>Détail</Link></td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={8} className="muted">Aucun rendez-vous.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
