import { Link } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';

export default function Header() {
  const { session, profile, signOut } = useAuthStore();
  const { t, locale, toggleLocale } = useI18nStore();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/brand/logo.png" alt="BGPSC Sylhet logo — জ্ঞানই শক্তি, কর্মে মুক্তি" className="h-10 w-10" />
          <span className="hidden text-lg font-bold text-brand-600 sm:block dark:text-brand-400">
            {t('app.name')}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLocale}
            className="btn btn-outline text-sm"
            aria-label="Toggle language"
          >
            {locale === 'bn' ? 'EN' : 'বাং'}
          </button>

          {session && profile ? (
            <div className="flex items-center gap-2">
              <Link to="/notifications" className="btn btn-outline" aria-label={t('nav.notifications')}>
                🔔
              </Link>
              <Link to="/messages" className="btn btn-outline" aria-label={t('nav.messages')}>
                💬
              </Link>
              <Link to={`/@${profile.handle}`} className="flex items-center gap-2">
                <img
                  src={profile.avatar_url || '/brand/logo.png'}
                  alt={profile.full_name}
                  className="h-8 w-8 rounded-full"
                />
              </Link>
              <button onClick={signOut} className="btn btn-secondary text-sm">
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn btn-outline">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="btn btn-primary">
                {t('nav.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
