import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import { formatDistanceToNow } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';
import type { PostWithAuthor } from '../types/database';
import { useState } from 'react';

interface PostCardProps {
  post: PostWithAuthor;
}

export default function PostCard({ post }: PostCardProps) {
  const { session, profile } = useAuthStore();
  const { t, locale } = useI18nStore();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (liked) {
        await supabase.rpc('unlike_post', { p_post_id: post.id });
      } else {
        await supabase.rpc('like_post', { p_post_id: post.id });
      }
    },
    onSuccess: () => {
      setLiked(!liked);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.slug] });
    },
  });

  const timeAgo = formatDistanceToNow(new Date(post.created_at ?? 0), {
    addSuffix: true,
    locale: locale === 'bn' ? bn : enUS,
  });

  return (
    <article className="card space-y-3">
      {/* Author header */}
      <div className="flex items-center gap-3">
        <Link to={`/@${post.author.handle}`}>
          <img
            src={post.author.avatar_url || '/brand/logo.png'}
            alt={post.author.full_name}
            className="h-12 w-12 rounded-full"
          />
        </Link>
        <div className="flex-1">
          <Link to={`/@${post.author.handle}`} className="font-semibold hover:underline">
            {post.author.full_name}
            {post.author.verified && <span className="ml-1 text-brand-600">✓</span>}
          </Link>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            @{post.author.handle} · {timeAgo}
          </div>
        </div>
        {post.type !== 'post' && (
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {post.type}
          </span>
        )}
      </div>

      {/* Content */}
      <Link to={`/post/${post.slug}`} className="block space-y-2">
        {post.title && <h2 className="text-xl font-bold">{post.title}</h2>}
        {post.sensitive && !showSensitive ? (
          <div className="rounded-lg bg-gray-100 p-4 text-center dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">{t('post.sensitive')}</p>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowSensitive(true);
              }}
              className="btn btn-outline mt-2"
            >
              Show content
            </button>
          </div>
        ) : (
          <p className="text-gray-800 dark:text-gray-200">
            {post.body_text?.slice(0, 280)}
            {post.body_text && post.body_text.length > 280 && '...'}
          </p>
        )}
      </Link>

      {/* Images */}
      {post.images && post.images.length > 0 && !post.sensitive && (
        <div className="grid gap-2">
          {post.images.slice(0, 4).map((img) => (
            <img
              key={img.id}
              src={img.url}
              alt={img.alt || ''}
              className="w-full rounded-lg object-cover"
              style={{ maxHeight: '400px' }}
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* Actions */}
      {session && profile && (
        <div className="flex items-center gap-4 border-t border-gray-200 pt-3 dark:border-gray-700">
          <button
            onClick={() => likeMutation.mutate()}
            className={`flex items-center gap-1 transition-colors ${
              liked ? 'text-red-500' : 'text-gray-600 hover:text-red-500 dark:text-gray-400'
            }`}
            disabled={!profile || profile.status !== 'approved'}
          >
            <span>{liked ? '❤️' : '🤍'}</span>
            <span className="text-sm">{post.likes_count}</span>
          </button>
          <Link to={`/post/${post.slug}`} className="flex items-center gap-1 text-gray-600 hover:text-brand-600 dark:text-gray-400">
            <span>💬</span>
            <span className="text-sm">{post.comments_count}</span>
          </Link>
          <button className="flex items-center gap-1 text-gray-600 hover:text-brand-600 dark:text-gray-400">
            <span>🔗</span>
            <span className="text-sm">{t('post.share')}</span>
          </button>
          <button className="flex items-center gap-1 text-gray-600 hover:text-brand-600 dark:text-gray-400">
            <span>🔖</span>
          </button>
        </div>
      )}
    </article>
  );
}
