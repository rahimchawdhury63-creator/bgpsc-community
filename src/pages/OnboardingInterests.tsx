import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';

export default function OnboardingInterests() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuthStore();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const predefinedInterests = [
    { id: 'academics', label: '📚 Academics', tags: ['study', 'homework', 'exams'] },
    { id: 'sports', label: '⚽ Sports', tags: ['cricket', 'football', 'athletics'] },
    { id: 'science', label: '🔬 Science', tags: ['physics', 'chemistry', 'biology'] },
    { id: 'math', label: '🧮 Mathematics', tags: ['algebra', 'geometry', 'calculus'] },
    { id: 'literature', label: '📖 Literature', tags: ['bangla', 'english', 'poetry'] },
    { id: 'arts', label: '🎨 Arts', tags: ['drawing', 'painting', 'craft'] },
    { id: 'music', label: '🎵 Music', tags: ['singing', 'instruments', 'bands'] },
    { id: 'technology', label: '💻 Technology', tags: ['coding', 'programming', 'ai'] },
    { id: 'gaming', label: '🎮 Gaming', tags: ['esports', 'mobile-games', 'pc-games'] },
    { id: 'culture', label: '🎭 Culture', tags: ['festivals', 'traditions', 'history'] },
    { id: 'news', label: '📰 News', tags: ['school-news', 'local-news', 'world-news'] },
    { id: 'events', label: '🎉 Events', tags: ['competitions', 'celebrations', 'meetups'] },
  ];

  const saveInterests = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not authenticated');

      const allTags = selectedInterests.flatMap(id => {
        const interest = predefinedInterests.find(i => i.id === id);
        return interest?.tags || [];
      });

      await supabase
        .from('profiles')
        .update({
          interests: allTags,
          onboarded: true,
        })
        .eq('id', profile.id);
    },
    onSuccess: () => {
      refreshProfile();
      navigate('/');
    },
  });

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="card">
        <div className="text-center mb-6">
          <img src="/brand/logo.png" alt="BGPSC" className="mx-auto h-16 w-16 mb-4" />
          <h1 className="text-2xl font-bold">What are you interested in?</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Select at least 3 topics to personalize your feed
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {predefinedInterests.map(interest => (
            <button
              key={interest.id}
              onClick={() => toggleInterest(interest.id)}
              className={`rounded-lg border-2 p-4 text-center transition-all ${
                selectedInterests.includes(interest.id)
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 hover:border-brand-400 dark:border-gray-700'
              }`}
            >
              <div className="text-2xl mb-2">{interest.label.split(' ')[0]}</div>
              <div className="text-sm font-medium">{interest.label.split(' ').slice(1).join(' ')}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedInterests.length} selected (min 3)
          </span>
          <button
            onClick={() => saveInterests.mutate()}
            className="btn btn-primary"
            disabled={selectedInterests.length < 3 || saveInterests.isPending}
          >
            {saveInterests.isPending ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
