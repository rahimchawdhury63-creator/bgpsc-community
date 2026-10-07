// Cloudflare Pages Function: Image upload proxy to ImgBB
// Handles authentication, validation, and forwards to ImgBB API

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  IMGBB_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Verify JWT auth
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify user is approved
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Account not approved' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse form data
    const formData = await context.request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 5MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate MIME type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedMimes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Magic byte verification
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const magicBytes = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
      'image/gif': [0x47, 0x49, 0x46, 0x38],
    };

    const expectedMagic = magicBytes[file.type as keyof typeof magicBytes];
    if (expectedMagic) {
      for (let i = 0; i < expectedMagic.length; i++) {
        if (bytes[i] !== expectedMagic[i]) {
          return new Response(JSON.stringify({ error: 'Invalid file content' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Convert to base64
    const base64 = btoa(String.fromCharCode(...bytes));

    // Upload to ImgBB - key in URL, base64 in body
    const imgbbUrl = `https://api.imgbb.com/1/upload?key=${context.env.IMGBB_API_KEY}`;
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', base64);

    const imgbbResponse = await fetch(imgbbUrl, {
      method: 'POST',
      body: imgbbFormData,
    });

    if (!imgbbResponse.ok) {
      const errorText = await imgbbResponse.text();
      return new Response(JSON.stringify({ error: 'Upload failed', details: errorText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imgbbData = await imgbbResponse.json();

    if (!imgbbData.success) {
      return new Response(JSON.stringify({ error: 'Upload failed', details: imgbbData.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return the ImgBB URL data
    return new Response(JSON.stringify({
      url: imgbbData.data.url,
      display_url: imgbbData.data.display_url,
      width: imgbbData.data.width,
      height: imgbbData.data.height,
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
