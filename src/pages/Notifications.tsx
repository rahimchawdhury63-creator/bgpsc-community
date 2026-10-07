import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import type { Notification } from '../types/database';

export default function Notifications() {
  const { profile } = useAuthStore();
  const { t } = useI18nStore();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data as Notification[];
    },
    enabled: !!profile,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .is('read_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
        <button
          onClick={() => markAllRead.mutate()}
          className="btn btn-outline text-sm"
        >
          {t('notifications.markAllRead')}
        </button>
      </div>

      <div className="space-y-2">
        {notifications?.map(notif => (
          <Link
            key={notif.id}
            to={notif.link || '#'}
            className={`card block transition-colors ${
              !notif.read_at ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">
                {notif.type === 'like' && '❤️'}
                {notif.type === 'comment' && '💬'}
                {notif.type === 'new_follower' && '👤'}
                {notif.type === 'message' && '💌'}
                {notif.type === 'approval_update' && '✅'}
                {notif.type === 'notice' && '📢'}
              </div>
              <div className="flex-1">
                <p>{notif.body_text}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDistanceToNow(new Date(notif.created_at ?? 0), { addSuffix: true, locale: bn })}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
