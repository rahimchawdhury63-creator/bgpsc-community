import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import type { NotificationPrefsMap } from '../types/app';

export default function PushPreferences() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['notification-prefs', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      
      const { data } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      return data;
    },
    enabled: !!profile,
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!profile) throw new Error('Not authenticated');

      await supabase
        .from('notification_prefs')
        .upsert({
          user_id: profile.id,
          prefs: { ...(prefs?.prefs as NotificationPrefsMap | null), ...updates },
          quiet_start: quietStart,
          quiet_end: quietEnd,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });

  const [quietStart, setQuietStart] = useState(prefs?.quiet_start || '22:00');
  const [quietEnd, setQuietEnd] = useState(prefs?.quiet_end || '07:00');

  const notificationTypes = [
    { key: 'message', label: 'Messages', icon: '💬' },
    { key: 'message_request', label: 'Message Requests', icon: '📨' },
    { key: 'like', label: 'Likes', icon: '❤️' },
    { key: 'comment', label: 'Comments', icon: '💭' },
    { key: 'reply', label: 'Replies', icon: '↩️' },
    { key: 'new_follower', label: 'New Followers', icon: '👤' },
    { key: 'mention', label: 'Mentions', icon: '@' },
    { key: 'notice', label: 'Notices', icon: '📢' },
    { key: 'approval_update', label: 'Registration Updates', icon: '✅' },
    { key: 'promotion', label: 'Class Promotions', icon: '🎓' },
    { key: 'badge', label: 'Badges', icon: '🏆' },
    { key: 'system', label: 'System', icon: '⚙️' },
  ];

  const handleToggle = (key: string, channel: 'in_app' | 'push') => {
    const currentPrefs = (prefs?.prefs as NotificationPrefsMap | null) || {};
    const current = currentPrefs[key]?.[channel] ?? true;
    
    updatePrefsMutation.mutate({
      [key]: {
        ...currentPrefs[key],
        [channel]: !current,
      },
    });
  };

  const handleQuietHoursSave = () => {
    updatePrefsMutation.mutate({});
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Push Notification Preferences</h1>

      {/* Quiet Hours */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">Quiet Hours</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Pause push notifications during these hours (Asia/Dhaka timezone)
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Time</label>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">End Time</label>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="input mt-1"
            />
          </div>
        </div>

        <button
          onClick={handleQuietHoursSave}
          className="btn btn-primary"
          disabled={updatePrefsMutation.isPending}
        >
          {updatePrefsMutation.isPending ? 'Saving...' : 'Save Quiet Hours'}
        </button>
      </div>

      {/* Notification Types */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">Notification Types</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose which notifications you want to receive
        </p>

        <div className="space-y-3">
          {notificationTypes.map(type => {
            const typePrefs = (prefs?.prefs as NotificationPrefsMap | null)?.[type.key] || {};
            const inApp = typePrefs.in_app ?? true;
            const push = typePrefs.push ?? true;

            return (
              <div
                key={type.key}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{type.icon}</span>
                  <span className="font-medium">{type.label}</span>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={inApp}
                      onChange={() => handleToggle(type.key, 'in_app')}
                      className="rounded"
                    />
                    <span>In-App</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={push}
                      onChange={() => handleToggle(type.key, 'push')}
                      className="rounded"
                    />
                    <span>Push</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Device Management */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">Devices</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage devices that receive push notifications
        </p>

        <button className="btn btn-outline w-full">
          Manage Devices
        </button>
      </div>

      {/* Sound & Vibration */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">Sound & Vibration</h2>

        <label className="flex items-center justify-between">
          <span>Sound</span>
          <input type="checkbox" defaultChecked className="rounded" />
        </label>

        <label className="flex items-center justify-between">
          <span>Vibration</span>
          <input type="checkbox" defaultChecked className="rounded" />
        </label>

        <label className="flex items-center justify-between">
          <span>Badge Count</span>
          <input type="checkbox" defaultChecked className="rounded" />
        </label>
      </div>
    </div>
  );
}
