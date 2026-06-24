import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

// Desktop post-login layout: persistent left sidebar + scrollable content area.
// Each screen renders into <main> via the <Outlet />.
export function TabsLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
