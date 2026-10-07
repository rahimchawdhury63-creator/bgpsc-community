// Cloudflare Worker for BGPSC Community
// Handles: push notification dispatch, academic year promotion, health checks

import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
}

// Import web-push dynamically
async function getWebPush() {
  const webpush = await import('web-push');
  return webpush.default || webpush;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Flush push outbox (immediate)
    if (url.pathname === '/flush') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      const count = await drainPushOutbox(env);
      return new Response(JSON.stringify({ flushed: count }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;

    // Every minute: drain push outbox
    if (cron === '* * * * *') {
      ctx.waitUntil(drainPushOutbox(env));
    }

    // Jan 1 00:00 Dhaka (18:00 UTC Dec 31): academic year promotion
    if (cron === '0 18 31 12 *') {
      ctx.waitUntil(promoteAcademicYear(env));
    }
  },
};

async function drainPushOutbox(env: Env): Promise<number> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  const webpush = await getWebPush();
  webpush.setVapidDetails(
    env.VAPID_SUBJECT || 'mailto:rrc@bsdc.info.bd',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  // Get pending push items
  const { data: outboxItems } = await supabase
    .from('push_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  if (!outboxItems || outboxItems.length === 0) return 0;

  let sentCount = 0;

  for (const item of outboxItems) {
    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', item.user_id);

    if (!subscriptions || subscriptions.length === 0) {
      await supabase
        .from('push_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', item.id);
      continue;
    }

    const payload = JSON.stringify({
      title: item.title,
      body: item.body,
      icon: '/brand/logo.png',
      badge: '/brand/logo.png',
      tag: item.tag || 'default',
      data: { link: item.link },
      vibrate: [200, 100, 200],
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired, remove it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }

    // Mark as sent
    await supabase
      .from('push_outbox')
      .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: item.attempts + 1 })
      .eq('id', item.id);
  }

  // Update heartbeat
  await supabase.from('heartbeats').upsert({
    key: 'push_drain',
    at: new Date().toISOString(),
    meta: { sent: sentCount, processed: outboxItems.length },
  });

  return sentCount;
}

async function promoteAcademicYear(env: Env): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const year = new Date().getFullYear();

  try {
    await supabase.rpc('promote_academic_year', { p_year: year });
    
    await supabase.from('heartbeats').upsert({
      key: 'academic_promotion',
      at: new Date().toISOString(),
      meta: { year },
    });
  } catch (err) {
    console.error('Academic year promotion failed:', err);
  }
}
