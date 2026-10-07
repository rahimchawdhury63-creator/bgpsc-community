// Cloudflare Pages Function: RSS 2.0 Feed Generator
// Generates RSS feed for posts

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY);

  const url = new URL(context.request.url);
  const authorHandle = url.searchParams.get('author');

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:profiles!author_id(*),
      images:post_images(*)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);

  if (authorHandle) {
    query = query.eq('author.handle', authorHandle);
  }

  const { data: posts } = await query;

  const feedTitle = authorHandle 
    ? `Posts by @${authorHandle} — BGPSC Students Community`
    : 'BGPSC Students Community — Recent Posts';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>https://bgpscian.bsdc.info.bd</link>
    <description>শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট এর শিক্ষার্থীদের কমিউনিটি প্ল্যাটফর্ম</description>
    <language>bn</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://bgpscian.bsdc.info.bd/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://bgpscian.bsdc.info.bd/brand/logo.png</url>
      <title>BGPSC Students Community</title>
      <link>https://bgpscian.bsdc.info.bd</link>
    </image>`;

  posts?.forEach(post => {
    const description = post.body_text?.slice(0, 300) || '';
    const content = post.body_md || '';
    const image = post.images?.[0];

    xml += `
    <item>
      <title>${escapeXml(post.title || 'Untitled')}</title>
      <link>https://bgpscian.bsdc.info.bd/post/${escapeXml(post.slug)}</link>
      <guid isPermaLink="true">https://bgpscian.bsdc.info.bd/post/${escapeXml(post.slug)}</guid>
      <pubDate>${new Date(post.created_at).toUTCString()}</pubDate>
      <author>${escapeXml(post.author?.email || '')} (${escapeXml(post.author?.full_name || 'Unknown')})</author>
      <description>${escapeXml(description)}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>`;

    if (image) {
      xml += `
      <enclosure url="${escapeXml(image.url)}" type="image/webp" length="0"/>`;
    }

    xml += `
    </item>`;
  });

  xml += `
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
};

function escapeXml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
