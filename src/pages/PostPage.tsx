import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PostWithAuthor, CommentWithAuthor } from '../types/database';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useState } from 'react';
import { useAuthStore } from '../lib/stores/auth';

export default function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuthStore();
  const [commentText, setCommentText] = useState('');

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(*),
          images:post_images(*),
          links:post_links(*)
        `)
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as PostWithAuthor;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ['comments', post?.id],
    queryFn: async () => {
      if (!post) return [];
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!author_id(*)
        `)
        .eq('post_id', post.id)
        .eq('status', 'published')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CommentWithAuthor[];
    },
    enabled: !!post,
  });

  const handleComment = async () => {
    if (!commentText.trim() || !post) return;
    await supabase.rpc('add_comment', {
      p_post_id: post.id,
      // p_parent_id has no SQL default, so it must be sent explicitly; null
      // means a top-level comment.
      p_parent_id: null,
      p_body: commentText,
    });
    setCommentText('');
  };

  if (isLoading) {
    return <div className="card"><div className="skeleton h-64 w-full" /></div>;
  }

  if (!post) {
    return <div className="card text-center py-12">Post not found</div>;
  }

  return (
    <article className="space-y-6">
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar_url || '/brand/logo.png'}
            alt={post.author.full_name}
            className="h-12 w-12 rounded-full"
          />
          <div>
            <div className="font-semibold">{post.author.full_name}</div>
            <div className="text-sm text-gray-500">
              @{post.author.handle} · {formatDistanceToNow(new Date(post.created_at ?? 0), { addSuffix: true, locale: bn })}
            </div>
          </div>
        </div>

        {post.title && <h1 className="text-2xl font-bold">{post.title}</h1>}
        
        <div className="prose dark:prose-invert max-w-none">
          {post.body_md}
        </div>

        {post.images && post.images.length > 0 && (
          <div className="grid gap-2">
            {post.images.map(img => (
              <img key={img.id} src={img.url} alt={img.alt || ''} className="w-full rounded-lg" />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 border-t pt-4">
          <span>❤️ {post.likes_count} likes</span>
          <span>💬 {post.comments_count} comments</span>
          <span>🔗 {post.shares_count} shares</span>
        </div>
      </div>

      {/* Comments */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">মন্তব্য ({comments?.length || 0})</h2>
        
        {profile && profile.status === 'approved' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="মন্তব্য লিখুন..."
              className="input flex-1"
            />
            <button onClick={handleComment} className="btn btn-primary">
              পাঠান
            </button>
          </div>
        )}

        <div className="space-y-3">
          {comments?.map(comment => (
            <div key={comment.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800" style={{ marginLeft: `${comment.depth * 20}px` }}>
              <div className="flex items-center gap-2">
                <img
                  src={comment.author.avatar_url || '/brand/logo.png'}
                  alt={comment.author.full_name}
                  className="h-8 w-8 rounded-full"
                />
                <div>
                  <div className="text-sm font-semibold">{comment.author.full_name}</div>
                  <div className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.created_at ?? 0), { addSuffix: true, locale: bn })}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm">{comment.body_md}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
