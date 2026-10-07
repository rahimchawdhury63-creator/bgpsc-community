import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { format, subDays } from 'date-fns';

interface AuthorAnalyticsProps {
  postId: string;
}

export default function AuthorAnalytics({ postId }: AuthorAnalyticsProps) {
  const { profile } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['post-analytics', postId],
    queryFn: async () => {
      // Get post daily stats for last 30 days
      const { data: dailyStats } = await supabase
        .from('post_daily_stats')
        .select('*')
        .eq('post_id', postId)
        .gte('day', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
        .order('day', { ascending: true });

      // Get post details
      const { data: post } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      // Calculate aggregates
      const totalViews = dailyStats?.reduce((sum, s) => sum + s.views, 0) || 0;
      const totalImpressions = dailyStats?.reduce((sum, s) => sum + s.impressions, 0) || 0;
      const totalDwell = dailyStats?.reduce((sum, s) => sum + s.dwell_ms, 0) || 0;
      const avgDwell = totalImpressions > 0 ? totalDwell / totalImpressions : 0;

      return {
        post,
        dailyStats: dailyStats || [],
        totalViews,
        totalImpressions,
        totalDwell,
        avgDwell,
        engagementRate: post ? (post.likes_count + post.comments_count + post.shares_count) / Math.max(1, totalImpressions) : 0,
      };
    },
    enabled: !!profile && !!postId,
  });

  if (!profile || !stats) return null;

  // Only show to post author or admin
  if (stats.post?.author_id !== profile.id && profile.role !== 'admin') {
    return null;
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-bold">Analytics</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-brand-600">{stats.totalViews}</div>
          <div className="text-xs text-gray-500">Views</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-brand-600">{stats.totalImpressions}</div>
          <div className="text-xs text-gray-500">Impressions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-brand-600">{Math.round(stats.avgDwell / 1000)}s</div>
          <div className="text-xs text-gray-500">Avg Dwell</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-brand-600">{(stats.engagementRate * 100).toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Engagement</div>
        </div>
      </div>

      {/* Engagement Breakdown */}
      <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="text-sm font-semibold mb-2">Engagement</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Likes</span>
            <span className="font-semibold">{stats.post?.likes_count || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Comments</span>
            <span className="font-semibold">{stats.post?.comments_count || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Shares</span>
            <span className="font-semibold">{stats.post?.shares_count || 0}</span>
          </div>
        </div>
      </div>

      {/* Daily Chart (simplified) */}
      {stats.dailyStats.length > 0 && (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-2">Last 30 Days</h4>
          <div className="h-32 flex items-end gap-1">
            {stats.dailyStats.slice(-14).map((day, idx) => {
              const maxViews = Math.max(...stats.dailyStats.map(s => s.views));
              const height = maxViews > 0 ? (day.views / maxViews) * 100 : 0;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-brand-400 rounded-t hover:bg-brand-500 transition-colors"
                  style={{ height: `${height}%` }}
                  title={`${format(new Date(day.day), 'MMM d')}: ${day.views} views`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{format(new Date(stats.dailyStats[0]?.day || new Date()), 'MMM d')}</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <p className="text-xs text-gray-500 italic">
        Analytics are privacy-aggregated. Only you can see this data.
      </p>
    </div>
  );
}
