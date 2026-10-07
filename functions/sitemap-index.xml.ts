// Cloudflare Pages Function: Dynamic Sitemap Generator
// Generates sitemap index and shards for SEO

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  KV_CACHE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Sitemap index
  if (path === '/sitemap-index.xml') {
    return await generateSitemapIndex(context.env);
  }

  // Sitemap shards
  const shardMatch = path.match(/^\/sitemap-(\d+)\.xml$/);
  if (shardMatch) {
    const shardIndex = parseInt(shardMatch[1]);
    return await generateSitemapShard(context.env, shardIndex);
  }

  // Image sitemap
  if (path === '/sitemap-images.xml') {
    return await generateImageSitemap(context.env);
  }

  return new Response('Not Found', { status: 404 });
};

async function generateSitemapIndex(env: Env): Promise<Response> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  // Count total posts
  const { count: postCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  const totalPosts = postCount || 0;
  const shardSize = 10000; // Max URLs per shard
  const numShards = Math.ceil(totalPosts / shardSize);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://bgpscian.bsdc.info.bd/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`;

  for (let i = 0; i < numShards; i++) {
    xml += `
  <sitemap>
    <loc>https://bgpscian.bsdc.info.bd/sitemap-${i}.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`;
  }

  xml += `
  <sitemap>
    <loc>https://bgpscian.bsdc.info.bd/sitemap-images.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generateSitemapShard(env: Env, shardIndex: number): Promise<Response> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const shardSize = 10000;
  const offset = shardIndex * shardSize;

  const { data: posts } = await supabase
    .from('posts')
    .select('slug, updated_at, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: true })
    .range(offset, offset + shardSize - 1);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  posts?.forEach(post => {
    const priority = calculatePriority(post);
    const changefreq = calculateChangefreq(post);

    xml += `
  <url>
    <loc>https://bgpscian.bsdc.info.bd/post/${escapeXml(post.slug)}</loc>
    <lastmod>${new Date(post.updated_at).toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generateImageSitemap(env: Env): Promise<Response> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const { data: images } = await supabase
    .from('post_images')
    .select(`
      *,
      posts!inner(slug, status)
    `)
    .eq('posts.status', 'published')
    .limit(1000);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  images?.forEach(img => {
    xml += `
  <url>
    <loc>https://bgpscian.bsdc.info.bd/post/${escapeXml(img.posts.slug)}</loc>
    <image:image>
      <image:loc>${escapeXml(img.url)}</image:loc>
      ${img.alt ? `<image:title>${escapeXml(img.alt)}</image:title>` : ''}
      ${img.caption ? `<image:caption>${escapeXml(img.caption)}</image:caption>` : ''}
    </image:image>
  </url>`;
  });

  xml += `
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function calculatePriority(post: any): number {
  const age = Date.now() - new Date(post.created_at).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);

  // Newer posts get higher priority
  if (daysOld < 7) return 0.9;
  if (daysOld < 30) return 0.8;
  if (daysOld < 90) return 0.7;
  if (daysOld < 365) return 0.6;
  return 0.5;
}

function calculateChangefreq(post: any): string {
  const age = Date.now() - new Date(post.created_at).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);

  if (daysOld < 1) return 'hourly';
  if (daysOld < 7) return 'daily';
  if (daysOld < 30) return 'weekly';
  if (daysOld < 365) return 'monthly';
  return 'yearly';
}

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
