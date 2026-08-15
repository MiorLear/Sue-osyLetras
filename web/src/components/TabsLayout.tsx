import { Outlet } from 'react-router-dom';
import { useContentSync } from '@/lib/useContentSync';
import { BottomNav } from './BottomNav';
import { MobileTopBar } from './MobileTopBar';
import { Sidebar } from './Sidebar';

// Post-login layout.
//   Desktop (>760px): persistent left sidebar + scrollable content area, exactly
//   as before.
//   Phone (<=760px): the sidebar is replaced by a slim top bar and a bottom tab
//   bar. Which one shows is decided in CSS, not in JS, so there is no viewport
//   guess to get wrong on first paint.
export function TabsLayout() {
  // Precarga el contenido al entrar y al recuperar la conexión. Vive aquí y no
  // en main.tsx porque este layout ya está detrás de RequireAuth: antes de
  // saber quién es la usuaria, lo cacheado va al ámbito anónimo.
  useContentSync();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-area">
        <MobileTopBar />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
