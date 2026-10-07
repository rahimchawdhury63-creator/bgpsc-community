// Cloudflare Pages Function: Prerender middleware for crawlers
// Detects crawler UAs and serves pre-rendered HTML snapshots

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  KV_CACHE: KVNamespace;
}

const CRAWLER_UAS = [
  'Googlebot',
  'Google-InspectionTool',
  'Bingbot',
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',
  'Sogou',
  'Facebookbot',
  'FacebookExternalHit',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Slurp',
  'Applebot',
];

const DISALLOWED_UAS = ['GPTBot', 'CCBot'];

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const userAgent = context.request.headers.get('User-Agent') || '';

  // Check if disallowed crawler
  if (DISALLOWED_UAS.some(ua => userAgent.includes(ua))) {
    return new Response('Forbidden', { status: 403 });
  }

  // Check if crawler
  const isCrawler = CRAWLER_UAS.some(ua => userAgent.includes(ua));

  if (!isCrawler) {
    // Not a crawler, serve normal SPA
    return context.next();
  }

  // Try to get cached snapshot
  const cacheKey = `prerender:${url.pathname}`;
  const cached = await context.env.KV_CACHE.get(cacheKey);

  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Prerender': 'cache',
      },
    });
  }

  // Generate snapshot
  try {
    const html = await generateSnapshot(url.pathname, context.env);
    
    // Cache for 6 hours
    await context.env.KV_CACHE.put(cacheKey, html, { expirationTtl: 6 * 60 * 60 });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Prerender': 'generated',
      },
    });
  } catch (err) {
    console.error('Prerender failed:', err);
    // Fallback to SPA
    return context.next();
  }
};

async function generateSnapshot(pathname: string, env: Env): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  // Determine content type from path
  if (pathname === '/' || pathname === '') {
    return await generateHomeSnapshot(supabase);
  }

  if (pathname.startsWith('/post/')) {
    const slug = pathname.replace('/post/', '');
    return await generatePostSnapshot(supabase, slug);
  }

  if (pathname.startsWith('/@')) {
    const handle = pathname.replace('/@', '');
    return await generateProfileSnapshot(supabase, handle);
  }

  // Default: return basic shell
  return generateBasicShell(pathname);
}

async function generateHomeSnapshot(supabase: any): Promise<string> {
  // Fetch recent posts
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!author_id(*)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(20);

  const postsHtml = posts?.map((post: any) => `
    <article class="post-card">
      <h2><a href="/post/${post.slug}">${escapeHtml(post.title || 'Untitled')}</a></h2>
      <p class="author">By ${escapeHtml(post.author?.full_name || 'Unknown')} (@${escapeHtml(post.author?.handle || 'unknown')})</p>
      <p class="excerpt">${escapeHtml(post.body_text?.slice(0, 200) || '')}</p>
      <time datetime="${post.created_at}">${new Date(post.created_at).toLocaleDateString()}</time>
    </article>
  `).join('') || '';

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BGPSC Students Community — শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট</title>
  <meta name="description" content="BGPSC Students Community - শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট এর শিক্ষার্থীদের কমিউনিটি প্ল্যাটফর্ম">
  <meta property="og:title" content="BGPSC Students Community">
  <meta property="og:description" content="শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট এর শিক্ষার্থীদের কমিউনিটি প্ল্যাটফর্ম">
  <meta property="og:url" content="https://bgpscian.bsdc.info.bd">
  <meta property="og:image" content="https://bgpscian.bsdc.info.bd/brand/logo.png">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="bn_BD">
  <link rel="canonical" href="https://bgpscian.bsdc.info.bd">
  <link rel="alternate" hreflang="bn" href="https://bgpscian.bsdc.info.bd">
  <link rel="alternate" hreflang="en" href="https://bgpscian.bsdc.info.bd?lang=en">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Shahid Olazar BGB Public School and College",
    "alternateName": "শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ",
    "url": "https://bgpscian.bsdc.info.bd",
    "logo": "https://bgpscian.bsdc.info.bd/brand/logo.png",
    "foundingDate": "1993",
    "motto": "জ্ঞানই শক্তি, কর্মে মুক্তি"
  }
  </script>
</head>
<body>
  <header>
    <h1>BGPSC Students Community</h1>
    <p>শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট</p>
  </header>
  <main>
    <h2>Recent Posts</h2>
    ${postsHtml}
  </main>
  <footer>
    <p>© 2026 BGPSC Students Community. Developed by Rizwan Rahim Chowdhury.</p>
  </footer>
</body>
</html>
  `.trim();
}

async function generatePostSnapshot(supabase: any, slug: string): Promise<string> {
  const { data: post } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!author_id(*),
      images:post_images(*),
      comments:comments(*, author:profiles!author_id(*))
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!post) {
    return generate404();
  }

  const imagesHtml = post.images?.map((img: any) => `
    <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || '')}" width="${img.width}" height="${img.height}">
  `).join('') || '';

  const commentsHtml = post.comments?.map((comment: any) => `
    <div class="comment">
      <p class="author">${escapeHtml(comment.author?.full_name || 'Unknown')}</p>
      <p>${escapeHtml(comment.body_text || '')}</p>
      <time datetime="${comment.created_at}">${new Date(comment.created_at).toLocaleDateString()}</time>
    </div>
  `).join('') || '';

  return `
<!DOCTYPE html>
<html lang="${post.language || 'bn'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title || 'Post')} — BGPSC Students Community</title>
  <meta name="description" content="${escapeHtml(post.body_text?.slice(0, 160) || '')}">
  <meta property="og:title" content="${escapeHtml(post.title || 'Post')}">
  <meta property="og:description" content="${escapeHtml(post.body_text?.slice(0, 160) || '')}">
  <meta property="og:url" content="https://bgpscian.bsdc.info.bd/post/${escapeHtml(slug)}">
  <meta property="og:image" content="${post.images?.[0]?.url || 'https://bgpscian.bsdc.info.bd/brand/logo.png'}">
  <meta property="og:type" content="article">
  <meta property="article:published_time" content="${post.created_at}">
  <meta property="article:author" content="${escapeHtml(post.author?.full_name || '')}">
  <link rel="canonical" href="https://bgpscian.bsdc.info.bd/post/${escapeHtml(slug)}">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(post.title || 'Post')},
    "author": {
      "@type": "Person",
      "name": ${JSON.stringify(post.author?.full_name || 'Unknown')},
      "url": "https://bgpscian.bsdc.info.bd/@${escapeHtml(post.author?.handle || '')}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "BGPSC Students Community",
      "logo": {
        "@type": "ImageObject",
        "url": "https://bgpscian.bsdc.info.bd/brand/logo.png"
      }
    },
    "datePublished": "${post.created_at}",
    "dateModified": "${post.updated_at}",
    "image": "${post.images?.[0]?.url || 'https://bgpscian.bsdc.info.bd/brand/logo.png'}"
  }
  </script>
</head>
<body>
  <article>
    <header>
      <h1>${escapeHtml(post.title || 'Untitled')}</h1>
      <p class="author">By ${escapeHtml(post.author?.full_name || 'Unknown')} (@${escapeHtml(post.author?.handle || 'unknown')})</p>
      <time datetime="${post.created_at}">${new Date(post.created_at).toLocaleDateString()}</time>
    </header>
    <div class="content">
      ${escapeHtml(post.body_md || '')}
    </div>
    ${imagesHtml}
    <footer>
      <p>Likes: ${post.likes_count} | Comments: ${post.comments_count} | Shares: ${post.shares_count}</p>
    </footer>
  </article>
  <section class="comments">
    <h2>Comments (${post.comments?.length || 0})</h2>
    ${commentsHtml}
  </section>
</body>
</html>
  `.trim();
}

async function generateProfileSnapshot(supabase: any, handle: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      posts:posts(*, images:post_images(*))
    `)
    .eq('handle', handle)
    .eq('status', 'approved')
    .single();

  if (!profile) {
    return generate404();
  }

  const postsHtml = profile.posts?.slice(0, 10).map((post: any) => `
    <article>
      <h3><a href="/post/${post.slug}">${escapeHtml(post.title || 'Untitled')}</a></h3>
      <time datetime="${post.created_at}">${new Date(post.created_at).toLocaleDateString()}</time>
    </article>
  `).join('') || '';

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(profile.full_name)} (@${escapeHtml(handle)}) — BGPSC Students Community</title>
  <meta name="description" content="${escapeHtml(profile.bio || `Profile of ${profile.full_name}`)}">
  <meta property="og:title" content="${escapeHtml(profile.full_name)} (@${escapeHtml(handle)})">
  <meta property="og:description" content="${escapeHtml(profile.bio || '')}">
  <meta property="og:url" content="https://bgpscian.bsdc.info.bd/@${escapeHtml(handle)}">
  <meta property="og:image" content="${profile.avatar_url || 'https://bgpscian.bsdc.info.bd/brand/logo.png'}">
  <meta property="og:type" content="profile">
  <link rel="canonical" href="https://bgpscian.bsdc.info.bd/@${escapeHtml(handle)}">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": ${JSON.stringify(profile.full_name)},
    "url": "https://bgpscian.bsdc.info.bd/@${escapeHtml(handle)}",
    "image": "${profile.avatar_url || 'https://bgpscian.bsdc.info.bd/brand/logo.png'}",
    "description": ${JSON.stringify(profile.bio || '')}
  }
  </script>
</head>
<body>
  <header>
    <img src="${profile.avatar_url || '/brand/logo.png'}" alt="${escapeHtml(profile.full_name)}" width="120" height="120">
    <h1>${escapeHtml(profile.full_name)}</h1>
    <p>@${escapeHtml(handle)}</p>
    ${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ''}
    <p>Role: ${profile.role} | Verified: ${profile.verified ? 'Yes' : 'No'}</p>
  </header>
  <main>
    <h2>Recent Posts</h2>
    ${postsHtml}
  </main>
</body>
</html>
  `.trim();
}

function generateBasicShell(pathname: string): string {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BGPSC Students Community</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="https://bgpscian.bsdc.info.bd${pathname}">
</head>
<body>
  <h1>BGPSC Students Community</h1>
  <p>Loading...</p>
</body>
</html>
  `.trim();
}

function generate404(): string {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 Not Found — BGPSC Students Community</title>
  <meta name="robots" content="noindex">
</head>
<body>
  <h1>404 - Page Not Found</h1>
  <p>The page you're looking for doesn't exist.</p>
  <a href="/">Go Home</a>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
