// Cloudflare Pages Function: Atom Feed Generator
interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY);

  const { data: posts } = await supabase
    .from('posts')
    .select(`*, author:profiles!author_id(*)`)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>BGPSC Students Community — Recent Posts</title>
  <link href="https://bgpscian.bsdc.info.bd"/>
  <link rel="self" href="https://bgpscian.bsdc.info.bd/feed.xml"/>
  <id>https://bgpscian.bsdc.info.bd/</id>
  <updated>${new Date().toISOString()}</updated>
  <author>
    <name>BGPSC Students Community</name>
  </author>
  <subtitle>শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট</subtitle>
  <icon>https://bgpscian.bsdc.info.bd/brand/logo.png</icon>
  <logo>https://bgpscian.bsdc.info.bd/brand/logo.png</logo>`;

  posts?.forEach(post => {
    xml += `
  <entry>
    <title>${escapeXml(post.title || 'Untitled')}</title>
    <link href="https://bgpscian.bsdc.info.bd/post/${escapeXml(post.slug)}"/>
    <id>https://bgpscian.bsdc.info.bd/post/${escapeXml(post.slug)}</id>
    <published>${new Date(post.created_at).toISOString()}</published>
    <updated>${new Date(post.updated_at).toISOString()}</updated>
    <author>
      <name>${escapeXml(post.author?.full_name || 'Unknown')}</name>
      <uri>https://bgpscian.bsdc.info.bd/@${escapeXml(post.author?.handle || '')}</uri>
    </author>
    <summary>${escapeXml(post.body_text?.slice(0, 300) || '')}</summary>
    <content type="html"><![CDATA[${post.body_md || ''}]]></content>
  </entry>`;
  });

  xml += `
</feed>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m] || m));
}
