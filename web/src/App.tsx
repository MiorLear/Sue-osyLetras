import { Navigate, Route, Routes } from 'react-router-dom';
import type { UserRole } from '@explorarte/shared';
import { useAuth } from './context/AuthContext';
import { TabsLayout } from './components/TabsLayout';

import Onboarding from './routes/Onboarding';
import Login from './routes/Login';
import Register from './routes/Register';
import ForgotPassword from './routes/ForgotPassword';
import PendingApproval from './routes/PendingApproval';
import Main from './routes/Main';
import Emociones from './routes/Emociones';
import EmotionDetail from './routes/EmotionDetail';
import Herramientas from './routes/Herramientas';
import Aprendiendo from './routes/Aprendiendo';
import Comunidad from './routes/Comunidad';
import CalendarScreen from './routes/Calendar';
import Profile from './routes/Profile';
import Sobre from './routes/Sobre';

import AdminDashboard from './routes/admin/AdminDashboard';
import AdminUsuarios from './routes/admin/AdminUsuarios';
import AdminEmociones from './routes/admin/AdminEmociones';
import AdminHerramientas from './routes/admin/AdminHerramientas';
import AdminAprendiendo from './routes/admin/AdminAprendiendo';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  return authed ? <>{children}</> : <Navigate to="/" replace />;
}

function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { authed, user } = useAuth();
  if (!authed) return <Navigate to="/" replace />;
  if (user?.role !== role) return <Navigate to="/main" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* pre-login */}
      <Route path="/" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/pendiente" element={<PendingApproval />} />

      {/* post-login (sidebar layout) */}
      <Route
        element={
          <RequireAuth>
            <TabsLayout />
          </RequireAuth>
        }>
        {/* teacher app */}
        <Route path="/main" element={<Main />} />
        <Route path="/emociones" element={<Emociones />} />
        <Route path="/emociones/:id" element={<EmotionDetail />} />
        <Route path="/herramientas" element={<Herramientas />} />
        <Route path="/aprendiendo" element={<Aprendiendo />} />
        <Route path="/comunidad" element={<Comunidad />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/sobre" element={<Sobre />} />

        {/* admin console */}
        <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="/admin/usuarios" element={<RequireRole role="admin"><AdminUsuarios /></RequireRole>} />
        <Route path="/admin/emociones" element={<RequireRole role="admin"><AdminEmociones /></RequireRole>} />
        <Route path="/admin/herramientas" element={<RequireRole role="admin"><AdminHerramientas /></RequireRole>} />
        <Route path="/admin/aprendiendo" element={<RequireRole role="admin"><AdminAprendiendo /></RequireRole>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
