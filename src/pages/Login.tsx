import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18nStore } from '../lib/stores/i18n';

export default function Login() {
  const { t } = useI18nStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="text-center">
          <img src="/brand/logo.png" alt="BGPSC" className="mx-auto h-20 w-20" />
          <h1 className="mt-4 text-2xl font-bold">{t('auth.login')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('app.name')}</p>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="label">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              required
            />
          </div>

          <div>
            <label className="label">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
