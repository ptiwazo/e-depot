import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Loader } from './components';
import Login from './pages/Login';
import Intro from './pages/Intro';

// Pages chargées à la demande (code-splitting) → bundle initial plus léger,
// et les libs lourdes (xlsx, jspdf, html5-qrcode) ne sont téléchargées que si besoin.
const Register = lazy(() => import('./pages/Register'));
const Activate = lazy(() => import('./pages/Activate'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const OffDocks = lazy(() => import('./pages/OffDocks'));
const ShiftsAdmin = lazy(() => import('./pages/ShiftsAdmin'));
const SettingsAdmin = lazy(() => import('./pages/SettingsAdmin'));
const UsersAdmin = lazy(() => import('./pages/UsersAdmin'));
const CompaniesAdmin = lazy(() => import('./pages/CompaniesAdmin'));
const AuditAdmin = lazy(() => import('./pages/AuditAdmin'));
const ReportsAdmin = lazy(() => import('./pages/ReportsAdmin'));
const AiDashboard = lazy(() => import('./pages/AiDashboard'));
const AgentQueue = lazy(() => import('./pages/AgentQueue'));
const ManifestAdmin = lazy(() => import('./pages/ManifestAdmin'));
const Appointments = lazy(() => import('./pages/Appointments'));
const OperatorConsole = lazy(() => import('./pages/OperatorConsole'));
const MscDashboard = lazy(() => import('./pages/MscDashboard'));
const AppointmentDetail = lazy(() => import('./pages/AppointmentDetail'));
const TransporterList = lazy(() => import('./pages/TransporterPortal').then((m) => ({ default: m.TransporterList })));
const NewAppointment = lazy(() => import('./pages/TransporterPortal').then((m) => ({ default: m.NewAppointment })));

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
  if (loading) return <div className="page-center"><Loader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role] ?? '/login'} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Suspense fallback={<div className="page-center"><Loader /></div>}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/activate" element={<Activate />} />

        <Route
          path="/"
          element={
            loading ? <div className="page-center"><Loader /></div>
            : user ? <Navigate to={HOME[user.role] ?? '/login'} replace />
            : <Intro />
          }
        />

        <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>} />
        <Route path="/admin/offdocks" element={<Protected roles={['ADMIN']}><OffDocks /></Protected>} />
        <Route path="/admin/shifts" element={<Protected roles={['ADMIN']}><ShiftsAdmin /></Protected>} />
        <Route path="/admin/manifest" element={<Protected roles={['ADMIN']}><ManifestAdmin /></Protected>} />
        <Route path="/admin/settings" element={<Protected roles={['ADMIN']}><SettingsAdmin /></Protected>} />
        <Route path="/admin/users" element={<Protected roles={['ADMIN']}><UsersAdmin /></Protected>} />
        <Route path="/admin/companies" element={<Protected roles={['ADMIN']}><CompaniesAdmin /></Protected>} />
        <Route path="/admin/audit" element={<Protected roles={['ADMIN']}><AuditAdmin /></Protected>} />
        <Route path="/admin/reports" element={<Protected roles={['ADMIN']}><ReportsAdmin /></Protected>} />
        <Route path="/admin/ai" element={<Protected roles={['ADMIN']}><AiDashboard /></Protected>} />

        <Route path="/transporter" element={<Protected roles={['TRANSPORTER']}><TransporterList /></Protected>} />
        <Route path="/transporter/new" element={<Protected roles={['TRANSPORTER']}><NewAppointment /></Protected>} />

        <Route path="/operator" element={<Protected roles={['OPERATOR']}><OperatorConsole /></Protected>} />
        <Route path="/msc" element={<Protected roles={['MSC']}><MscDashboard /></Protected>} />
        <Route path="/agent" element={<Protected roles={['AGENT', 'ADMIN']}><AgentQueue /></Protected>} />

        <Route path="/appointments" element={<Protected roles={['ADMIN', 'AGENT', 'OPERATOR', 'DRIVER']}><Appointments /></Protected>} />
        <Route path="/appointment/:id" element={<Protected><AppointmentDetail /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
