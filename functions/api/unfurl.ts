// Cloudflare Pages Function: URL unfurl (link preview)
export const onRequestPost: PagesFunction = async (context) => {
  try {
    const { url } = await context.request.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BGPSC-Bot/1.0 (+https://bgpscian.bsdc.info.bd)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch URL' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

    // Extract metadata
    const title = extractMeta(html, 'og:title') || extractTag(html, 'title');
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    const image = extractMeta(html, 'og:image');
    const siteName = extractMeta(html, 'og:site_name');

    const host = new URL(url).hostname;
    const kind = detectPlatform(host);

    return new Response(JSON.stringify({
      url,
      host,
      kind,
      title,
      description,
      image_url: image,
      site_name: siteName,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  
  const regex2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function detectPlatform(host: string): string {
  const platforms: Record<string, string> = {
    'github.com': 'github',
    'gitlab.com': 'gitlab',
    'facebook.com': 'facebook',
    'instagram.com': 'instagram',
    'threads.net': 'threads',
    'youtube.com': 'youtube',
    'youtu.be': 'youtube',
    'twitter.com': 'x',
    'x.com': 'x',
    'linkedin.com': 'linkedin',
    'reddit.com': 'reddit',
    'medium.com': 'medium',
    'stackoverflow.com': 'stackoverflow',
    'wikipedia.org': 'wikipedia',
    'docs.google.com': 'gdocs',
    'figma.com': 'figma',
    'notion.so': 'notion',
    't.me': 'telegram',
    'telegram.org': 'telegram',
    'wa.me': 'whatsapp',
    'discord.com': 'discord',
    'tiktok.com': 'tiktok',
    'bitbucket.org': 'bitbucket',
    'dev.to': 'devto',
    'codeforces.com': 'codeforces',
    'leetcode.com': 'leetcode',
    'khanacademy.org': 'khanacademy',
  };

  for (const [domain, platform] of Object.entries(platforms)) {
    if (host.includes(domain)) return platform;
  }

  return 'website';
}
