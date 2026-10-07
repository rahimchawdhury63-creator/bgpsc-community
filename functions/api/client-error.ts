// Cloudflare Pages Function: Client error reporting
export const onRequestPost: PagesFunction = async (context) => {
  try {
    const { message, stack, url } = await context.request.json();
    const userAgent = context.request.headers.get('User-Agent');

    // Log to console for now (in production, send to error monitoring service)
    console.error('Client error:', { message, stack, url, userAgent });

    // Could also write to Supabase error_events table here
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
