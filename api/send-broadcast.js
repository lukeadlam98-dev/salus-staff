// /api/send-broadcast.js — push a manager broadcast to every signed-in device.
// ============================================================================
// Called by the app right after a broadcast is inserted. Looks up all
// push_subscriptions and fires a web push to each. Reuses VAPID setup from
// /api/send-push.js.
//
// POST body: { broadcastId: string, title: string, body: string, urgency: 'normal'|'urgent' }
// Auth: requires session bearer token (manager-only check via Supabase service role).

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  'mailto:luke@salus.house',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No auth token' });

  const userResp = await supabase.auth.getUser(token);
  if (userResp.error || !userResp.data?.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const userId = userResp.data.user.id;

  // Manager check
  const { data: profile } = await supabase
    .from('profiles').select('is_manager').eq('id', userId).maybeSingle();
  if (!profile?.is_manager) {
    return res.status(403).json({ error: 'Managers only' });
  }

  const { broadcastId, title, body, urgency } = req.body || {};
  if (!broadcastId || !title || !body) {
    return res.status(400).json({ error: 'broadcastId, title, body required' });
  }

  // Pull every push subscription
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id');

  if (subsErr) {
    console.error('subs error', subsErr);
    return res.status(500).json({ error: subsErr.message });
  }

  const payload = JSON.stringify({
    type: 'broadcast',
    title,
    body,
    urgency: urgency || 'normal',
    broadcastId,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `broadcast-${broadcastId}`,
    requireInteraction: urgency === 'urgent',
  });

  let sent = 0;
  let failed = 0;
  const deadEndpoints = [];

  await Promise.all((subs || []).map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e) {
      failed++;
      // Subscription is gone — clean it up
      if (e.statusCode === 404 || e.statusCode === 410) {
        deadEndpoints.push(sub.id);
      } else {
        console.error('push err', sub.id, e.statusCode, e.body);
      }
    }
  }));

  if (deadEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('id', deadEndpoints);
  }

  return res.status(200).json({ sent, failed, cleanedUp: deadEndpoints.length });
}
