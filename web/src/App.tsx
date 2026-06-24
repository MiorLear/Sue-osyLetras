import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { TabsLayout } from './components/TabsLayout';

import Onboarding from './routes/Onboarding';
import Login from './routes/Login';
import Register from './routes/Register';
import ForgotPassword from './routes/ForgotPassword';
import Main from './routes/Main';
import Emociones from './routes/Emociones';
import EmotionDetail from './routes/EmotionDetail';
import Herramientas from './routes/Herramientas';
import Aprendiendo from './routes/Aprendiendo';
import Comunidad from './routes/Comunidad';
import CalendarScreen from './routes/Calendar';
import Profile from './routes/Profile';
import Sobre from './routes/Sobre';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  return authed ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Routes>
      {/* pre-login */}
      <Route path="/" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* post-login (bottom nav) */}
      <Route
        element={
          <RequireAuth>
            <TabsLayout />
          </RequireAuth>
        }>
        <Route path="/main" element={<Main />} />
        <Route path="/emociones" element={<Emociones />} />
        <Route path="/emociones/:id" element={<EmotionDetail />} />
        <Route path="/herramientas" element={<Herramientas />} />
        <Route path="/aprendiendo" element={<Aprendiendo />} />
        <Route path="/comunidad" element={<Comunidad />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/sobre" element={<Sobre />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
