import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { UserRole } from '@explorarte/shared';
import { useAuth } from './context/AuthContext';
import { TabsLayout } from './components/TabsLayout';
import { OfflineBanner } from './components/OfflineBanner';
import { ContentState } from './components/ContentState';

import Onboarding from './routes/Onboarding';
// Login y Register son los unicos que tiran de firebase/auth, el paquete mas
// pesado del arbol. Cargarlos aparte lo saca del arranque: quien abre la app y
// ve la pantalla de bienvenida ya no descarga el SDK entero de Firebase para
// mirar un texto. Llega cuando hace falta, al ir a entrar.
const Login = lazy(() => import('./routes/Login'));
const Register = lazy(() => import('./routes/Register'));
import ForgotPassword from './routes/ForgotPassword';
import PendingApproval from './routes/PendingApproval';
import Main from './routes/Main';
import Emociones from './routes/Emociones';
import EmotionDetail from './routes/EmotionDetail';
import Herramientas from './routes/Herramientas';
import Aprendiendo from './routes/Aprendiendo';
import AprendiendoTema from './routes/AprendiendoTema';
import Comunidad from './routes/Comunidad';
import CalendarScreen from './routes/Calendar';
import Descargas from './routes/Descargas';
import Profile from './routes/Profile';
import Sobre from './routes/Sobre';
import SyncProblemas from './routes/SyncProblemas';

// La consola del CMS: seis pantallas que solo abre el equipo de Sueños y
// Letras, desde escritorio. Iban en el mismo archivo que todo lo demas, asi que
// cada docente las descargaba en el movil para no abrirlas jamas. vite.config
// las agrupa en un unico chunk 'admin' y el service worker no lo precachea.
const AdminDashboard = lazy(() => import('./routes/admin/AdminDashboard'));
const AdminUsuarios = lazy(() => import('./routes/admin/AdminUsuarios'));
const AdminEmociones = lazy(() => import('./routes/admin/AdminEmociones'));
const AdminHerramientas = lazy(() => import('./routes/admin/AdminHerramientas'));
const AdminAprendiendo = lazy(() => import('./routes/admin/AdminAprendiendo'));
const AdminIntroVideos = lazy(() => import('./routes/admin/AdminIntroVideos'));

/**
 * Sin sesion se va a /login, no al carrusel de bienvenida: quien llega aqui ya
 * tenia cuenta (la sesion caduco, o abrio un enlace guardado). `from` guarda a
 * donde iba para devolverla ahi despues de entrar.
 */
function ToLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  return authed ? <>{children}</> : <ToLogin />;
}

/** La bienvenida es para quien no tiene sesion; con sesion se entra directo. */
function HomeOrOnboarding() {
  const { authed, user } = useAuth();
  if (!authed) return <Onboarding />;
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/main'} replace />;
}

/** Una URL mal escrita lleva a Inicio si hay sesion, y a la bienvenida si no. */
function NotFound() {
  const { authed } = useAuth();
  return <Navigate to={authed ? '/main' : '/'} replace />;
}

function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { authed, user, profileResolved } = useAuth();
  if (!authed) return <ToLogin />;
  // Tener sesion pero no perfil todavia no es "no eres admin": es "aun no lo
  // se". Desde que AuthProvider pinta en cuanto la cache responde, esa ventana
  // existe de verdad, y redirigir en ella echaria de /admin a quien si tiene el
  // rol solo porque su perfil venia en camino.
  if (!user && !profileResolved) return <ContentState status="loading" />;
  if (user?.role !== role) return <Navigate to="/main" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      {/* Overlay: renders nothing when online and idle, so it never reflows
          the routes below. */}
      <OfflineBanner />
      {/* Un solo limite para todas las rutas perezosas. Las de docente siguen
          siendo estaticas a proposito (ver vite.config.ts), asi que esto solo
          se ve al entrar en /login, /register o el CMS. */}
      <Suspense fallback={<ContentState status="loading" />}>
      <Routes>
      {/* pre-login */}
      <Route path="/" element={<HomeOrOnboarding />} />
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
        <Route path="/aprendiendo/:topicId" element={<AprendiendoTema />} />
        <Route path="/comunidad" element={<Comunidad />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/descargas" element={<Descargas />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/sobre" element={<Sobre />} />
        <Route path="/sync-problemas" element={<SyncProblemas />} />

        {/* admin console */}
        <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="/admin/usuarios" element={<RequireRole role="admin"><AdminUsuarios /></RequireRole>} />
        <Route path="/admin/emociones" element={<RequireRole role="admin"><AdminEmociones /></RequireRole>} />
        <Route path="/admin/herramientas" element={<RequireRole role="admin"><AdminHerramientas /></RequireRole>} />
        <Route path="/admin/aprendiendo" element={<RequireRole role="admin"><AdminAprendiendo /></RequireRole>} />
        <Route path="/admin/videos-intro" element={<RequireRole role="admin"><AdminIntroVideos /></RequireRole>} />
      </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}
