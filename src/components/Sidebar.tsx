import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';

export default function Sidebar() {
  const { session, profile } = useAuthStore();
  const { t } = useI18nStore();

  if (!session || !profile) return null;

  const navItems = [
    { to: '/', icon: '🏠', label: t('nav.home') },
    { to: '/search', icon: '🔍', label: t('nav.search') },
    { to: '/notifications', icon: '🔔', label: t('nav.notifications') },
    { to: '/messages', icon: '💬', label: t('nav.messages') },
    { to: `/@${profile.handle}`, icon: '👤', label: t('nav.profile') },
    { to: '/settings', icon: '⚙️', label: t('nav.settings') },
    ...(profile.role === 'admin' ? [{ to: '/admin', icon: '🛡️', label: t('nav.admin') }] : []),
  ];

  return (
    <aside className="hidden w-64 border-r border-gray-200 bg-white lg:block dark:border-gray-700 dark:bg-gray-900">
      <nav className="sticky top-16 p-4">
        <div className="flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}
