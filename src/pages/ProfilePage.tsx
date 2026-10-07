import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import PostCard from '../components/PostCard';
import type { Profile, PostWithAuthor } from '../types/database';

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { profile: currentUser } = useAuthStore();
  const { t } = useI18nStore();
  const queryClient = useQueryClient();
  const cleanHandle = handle?.replace('@', '');

  const { data: profile } = useQuery({
    queryKey: ['profile', cleanHandle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('handle', cleanHandle)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: isFollowing } = useQuery({
    queryKey: ['following', currentUser?.id, profile?.id],
    queryFn: async () => {
      if (!currentUser || !profile) return false;
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)
        .single();
      return !!data;
    },
    enabled: !!currentUser && !!profile,
  });

  const { data: posts } = useQuery({
    queryKey: ['user-posts', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('posts')
        .select(`*, author:profiles!author_id(*), images:post_images(*)`)
        .eq('author_id', profile.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      return data as PostWithAuthor[];
    },
    enabled: !!profile,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      if (isFollowing) {
        await supabase.rpc('unfollow_user', { p_following_id: profile.id });
      } else {
        await supabase.rpc('follow_user', { p_following_id: profile.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  if (!profile) {
    return <div className="card text-center py-12">Profile not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Banner & Avatar */}
      <div className="card overflow-hidden p-0">
        <div className="h-32 bg-gradient-to-r from-brand-600 to-brand-400 sm:h-48">
          {profile.banner_url && (
            <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="relative px-4 pb-4">
          <img
            src={profile.avatar_url || '/brand/logo.png'}
            alt={profile.full_name}
            className="-mt-12 h-24 w-24 rounded-full border-4 border-white dark:border-gray-800"
          />
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {profile.full_name}
                {profile.verified && <span className="ml-1 text-brand-600">✓</span>}
              </h1>
              <p className="text-gray-500">@{profile.handle}</p>
              {profile.bio && <p className="mt-2">{profile.bio}</p>}
            </div>
            {currentUser && currentUser.id !== profile.id && (
              <button
                onClick={() => followMutation.mutate()}
                className="btn btn-primary"
              >
                {isFollowing ? t('profile.unfollow') : t('profile.follow')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">{t('profile.posts')}</h2>
        {posts && posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="card text-center py-8 text-gray-500">No posts yet</div>
        )}
      </div>
    </div>
  );
}
