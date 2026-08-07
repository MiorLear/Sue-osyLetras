import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import { AuthProvider } from './context/AuthContext';
import { App } from './App';
import { InstallPrompt } from './components/InstallPrompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Capa PWA: vive fuera de <App /> para no chocar con el árbol de rutas. */}
        <InstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
