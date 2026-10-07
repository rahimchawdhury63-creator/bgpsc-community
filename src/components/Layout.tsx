import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-paper dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main id="main" className="flex-1 pb-20 lg:pb-0">
          <div className="mx-auto max-w-4xl px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
