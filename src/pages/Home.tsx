import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import PostCard from '../components/PostCard';
import type { PostWithAuthor } from '../types/database';

export default function Home() {
  const { session, profile } = useAuthStore();
  const { t } = useI18nStore();
  const [tab, setTab] = useState<'forYou' | 'latest' | 'myClass' | 'following' | 'trending'>('forYou');

  const { data: posts, isLoading } = useQuery({
    queryKey: ['feed', tab, profile?.id],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(*),
          images:post_images(*),
          links:post_links(*)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      if (tab === 'following' && profile) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profile.id);

        const followingIds = follows?.map(f => f.following_id) || [];
        query = query.in('author_id', followingIds);
      } else if (tab === 'myClass' && profile) {
        const { data: academics } = await supabase
          .from('academics')
          .select('current_class, section')
          .eq('user_id', profile.id)
          .single();

        if (academics) {
          query = query.eq('class_tag', academics.current_class);
          if (academics.section) {
            query = query.eq('section_tag', academics.section);
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PostWithAuthor[];
    },
    enabled: true,
  });

  const tabs = [
    { id: 'forYou', label: t('feed.forYou') },
    { id: 'latest', label: t('feed.latest') },
    { id: 'myClass', label: t('feed.myClass') },
    { id: 'following', label: t('feed.following') },
    { id: 'trending', label: t('feed.trending') },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="card">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-24" />
                </div>
              </div>
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          ))
        ) : posts && posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">{t('feed.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
