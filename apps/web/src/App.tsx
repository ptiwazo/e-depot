import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import OffDocks from './pages/OffDocks';
import ShiftsAdmin from './pages/ShiftsAdmin';
import SettingsAdmin from './pages/SettingsAdmin';
import AgentQueue from './pages/AgentQueue';
import ManifestAdmin from './pages/ManifestAdmin';
import Appointments from './pages/Appointments';
import { TransporterList, NewAppointment } from './pages/TransporterPortal';
import OperatorConsole from './pages/OperatorConsole';
import MscDashboard from './pages/MscDashboard';
import AppointmentDetail from './pages/AppointmentDetail';

const HOME: Record<string, string> = {
  ADMIN: '/admin',
  AGENT: '/agent',
  OPERATOR: '/operator',
  TRANSPORTER: '/transporter',
  MSC: '/msc',
  DRIVER: '/appointments',
};

function Protected({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }} className="muted">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role] ?? '/login'} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route
        path="/"
        element={
          loading ? <div style={{ padding: 40 }} className="muted">Chargement…</div>
          : user ? <Navigate to={HOME[user.role] ?? '/login'} replace />
          : <Navigate to="/login" replace />
        }
      />

      <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>} />
      <Route path="/admin/offdocks" element={<Protected roles={['ADMIN']}><OffDocks /></Protected>} />
      <Route path="/admin/shifts" element={<Protected roles={['ADMIN']}><ShiftsAdmin /></Protected>} />
      <Route path="/admin/manifest" element={<Protected roles={['ADMIN']}><ManifestAdmin /></Protected>} />
      <Route path="/admin/settings" element={<Protected roles={['ADMIN']}><SettingsAdmin /></Protected>} />

      <Route path="/transporter" element={<Protected roles={['TRANSPORTER']}><TransporterList /></Protected>} />
      <Route path="/transporter/new" element={<Protected roles={['TRANSPORTER']}><NewAppointment /></Protected>} />

      <Route path="/operator" element={<Protected roles={['OPERATOR']}><OperatorConsole /></Protected>} />
      <Route path="/msc" element={<Protected roles={['MSC']}><MscDashboard /></Protected>} />
      <Route path="/agent" element={<Protected roles={['AGENT', 'ADMIN']}><AgentQueue /></Protected>} />

      <Route path="/appointments" element={<Protected roles={['ADMIN', 'AGENT', 'OPERATOR', 'DRIVER']}><Appointments /></Protected>} />
      <Route path="/appointment/:id" element={<Protected><AppointmentDetail /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
