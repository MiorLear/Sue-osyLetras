import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import { AuthProvider } from './context/AuthContext';
import { App } from './App';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InstallPrompt } from './components/InstallPrompt';
import { Toaster } from './components/Toaster';
import { UpdateToast } from './components/UpdateToast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Capa de shell: vive fuera de <App /> para no tocar el árbol de rutas.
            Toaster y ConfirmDialog son singletons — cualquier módulo los invoca
            con toast.* y confirmDialog(), sin pasar props ni contexto. */}
        <Toaster />
        <ConfirmDialog />
        <UpdateToast />
        <InstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
