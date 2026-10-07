import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';

export default function BottomNav() {
  const { session, profile } = useAuthStore();
  const { t } = useI18nStore();

  const navItems = [
    { to: '/', icon: '🏠', label: t('nav.home') },
    { to: '/search', icon: '🔍', label: t('nav.search') },
    ...(session && profile ? [
      { to: '/notifications', icon: '🔔', label: t('nav.notifications') },
      { to: '/messages', icon: '💬', label: t('nav.messages') },
      { to: `/@${profile.handle}`, icon: '👤', label: t('nav.profile') },
    ] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white lg:hidden dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-around">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-3 text-xs ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
