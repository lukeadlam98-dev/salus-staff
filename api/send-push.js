// Vercel serverless function: /api/send-push
//
// Receives webhooks from Supabase whenever a row is inserted into
// cover_requests or messages. Looks up the right recipients, fetches
// their stored Web Push subscriptions, and sends each a notification.
//
// Required env vars (set in Vercel project settings):
//   VAPID_PRIVATE_KEY       — secret half of our keypair
//   VAPID_PUBLIC_KEY        — public half (same string baked into App.jsx)
//   SUPABASE_URL            — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
//   PUSH_WEBHOOK_SECRET     — shared secret to verify requests are from Supabase

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_SUBJECT = 'mailto:luke@salus.house';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let initialized = false;
let supabase;

function init() {
  if (initialized) return;
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  initialized = true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify the request actually came from Supabase by checking the shared secret
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    init();
    const { type, table, record } = req.body || {};
    if (type !== 'INSERT') return res.status(200).json({ skipped: true });

    if (table === 'cover_requests') {
      const sent = await handleCoverRequest(record);
      return res.status(200).json({ sent });
    }
    if (table === 'messages') {
      const sent = await handleMessage(record);
      return res.status(200).json({ sent });
    }
    return res.status(200).json({ skipped: 'unknown table' });
  } catch (e) {
    console.error('send-push error:', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}

// Send to every coach (except the one who posted the request)
async function handleCoverRequest(record) {
  const { data: cls } = await supabase
    .from('classes')
    .select('day, time, type, studio')
    .eq('id', record.class_id)
    .single();
  if (!cls) return 0;

  const { data: coaches } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'coach')
    .neq('id', record.requested_by);
  if (!coaches?.length) return 0;

  const userIds = coaches.map(c => c.id);
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .in('user_id', userIds);
  if (!subs?.length) return 0;

  const payload = JSON.stringify({
    title: 'Cover needed',
    body: `${DAYS[cls.day]} ${cls.time} · ${cls.type}`,
    tag: `cover-${record.id}`,
    data: { url: '/?tab=cover' },
  });

  return await sendAll(subs, payload);
}

// Send to everyone with a subscription except the sender
async function handleMessage(record) {
  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', record.user_id)
    .single();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .neq('user_id', record.user_id);
  if (!subs?.length) return 0;

  const senderName = sender?.name || 'Team chat';
  const body = (record.text || '').slice(0, 120);

  const payload = JSON.stringify({
    title: senderName,
    body: body,
    tag: 'team-chat',
    data: { url: '/?tab=chat' },
  });

  return await sendAll(subs, payload);
}

// Send the same payload to a list of subscriptions, cleaning up dead ones.
async function sendAll(subs, payload) {
  let sent = 0;
  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (err) {
      // 404/410 mean the subscription is permanently gone — delete it
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
      } else {
        console.warn('push failed (non-fatal):', err.statusCode, err.body);
      }
    }
  }));
  return sent;
}
