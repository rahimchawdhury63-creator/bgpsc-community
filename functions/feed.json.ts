// Cloudflare Pages Function: JSON Feed Generator
interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY);

  const { data: posts } = await supabase
    .from('posts')
    .select(`*, author:profiles!author_id(*), images:post_images(*)`)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'BGPSC Students Community — Recent Posts',
    home_page_url: 'https://bgpscian.bsdc.info.bd',
    feed_url: 'https://bgpscian.bsdc.info.bd/feed.json',
    description: 'শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট এর শিক্ষার্থীদের কমিউনিটি প্ল্যাটফর্ম',
    icon: 'https://bgpscian.bsdc.info.bd/brand/logo.png',
    favicon: 'https://bgpscian.bsdc.info.bd/brand/logo.png',
    language: 'bn',
    items: posts?.map(post => ({
      id: `https://bgpscian.bsdc.info.bd/post/${post.slug}`,
      url: `https://bgpscian.bsdc.info.bd/post/${post.slug}`,
      title: post.title || 'Untitled',
      content_text: post.body_text || '',
      content_html: post.body_md || '',
      date_published: post.created_at,
      date_modified: post.updated_at,
      author: {
        name: post.author?.full_name || 'Unknown',
        url: `https://bgpscian.bsdc.info.bd/@${post.author?.handle || ''}`,
      },
      image: post.images?.[0]?.url || null,
      tags: post.hashtags || [],
    })) || [],
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
};
