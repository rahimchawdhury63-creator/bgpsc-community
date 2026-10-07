import { useState } from 'react';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import { supabase } from '../lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { profile, refreshProfile } = useAuthStore();
  const { t, locale, toggleLocale } = useI18nStore();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(profile?.bio || '');
  const [website, setWebsite] = useState(profile?.website_url || '');
  const [location, setLocation] = useState(profile?.location_text || '');

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      await supabase
        .from('profiles')
        .update({
          bio,
          website_url: website,
          location_text: location,
          locale,
        })
        .eq('id', profile.id);
    },
    onSuccess: () => {
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold">{t('settings.profile')}</h2>
        
        <div>
          <label className="label">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input mt-1"
            rows={3}
            maxLength={500}
          />
          <p className="mt-1 text-xs text-gray-500">{bio.length}/500</p>
        </div>

        <div>
          <label className="label">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="label">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input mt-1"
          />
        </div>

        <button
          onClick={() => updateProfile.mutate()}
          className="btn btn-primary"
          disabled={updateProfile.isPending}
        >
          {t('common.save')}
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold">{t('settings.language')}</h2>
        <div className="flex items-center justify-between">
          <span>Language / ভাষা</span>
          <button onClick={toggleLocale} className="btn btn-outline">
            {locale === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold">{t('settings.notifications')}</h2>
        <p className="text-sm text-gray-500">Notification preferences coming soon</p>
      </div>
    </div>
  );
}
