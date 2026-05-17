// Vercel serverless function: /api/send-push
//
// Receives webhooks from Supabase whenever a row is inserted into
// cover_requests, messages, or cover_messages.

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
    if (table === 'cover_messages') {
      const sent = await handleCoverMessage(record);
      return res.status(200).json({ sent });
    }
    return res.status(200).json({ skipped: 'unknown table' });
  } catch (e) {
    console.error('send-push error:', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}

async function handleCoverRequest(record) {
  const { data: cls } = await supabase
    .from('classes').select('day, time, type, studio')
    .eq('id', record.class_id).single();
  if (!cls) return 0;

  const { data: coaches } = await supabase
    .from('profiles').select('id')
    .eq('role', 'coach').neq('id', record.requested_by);
  if (!coaches?.length) return 0;

  const { data: subs } = await supabase
    .from('push_subscriptions').select('id, subscription')
    .in('user_id', coaches.map(c => c.id));
  if (!subs?.length) return 0;

  const payload = JSON.stringify({
    title: 'Cover needed',
    body: `${DAYS[cls.day]} ${cls.time} · ${cls.type}`,
    tag: `cover-${record.id}`,
    data: { url: '/?tab=home' },
  });
  return await sendAll(subs, payload);
}

async function handleMessage(record) {
  const { data: sender } = await supabase
    .from('profiles').select('name').eq('id', record.user_id).single();

  const { data: subs } = await supabase
    .from('push_subscriptions').select('id, subscription')
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

// Notify everyone involved in a cover thread
async function handleCoverMessage(record) {
  const { data: sender } = await supabase
    .from('profiles').select('name').eq('id', record.user_id).single();

  const { data: req } = await supabase
    .from('cover_requests')
    .select('requested_by, interested_covers, class_id')
    .eq('id', record.cover_request_id).single();
  if (!req) return 0;

  const { data: prevCommenters } = await supabase
    .from('cover_messages').select('user_id')
    .eq('cover_request_id', record.cover_request_id);

  const recipients = new Set();
  if (req.requested_by) recipients.add(req.requested_by);
  (req.interested_covers || []).forEach(id => recipients.add(id));
  (prevCommenters || []).forEach(c => recipients.add(c.user_id));
  recipients.delete(record.user_id);

  // Include manager
  const { data: manager } = await supabase
    .from('profiles').select('id').eq('role', 'manager').limit(1).single();
  if (manager && manager.id !== record.user_id) recipients.add(manager.id);

  if (recipients.size === 0) return 0;

  const { data: subs } = await supabase
    .from('push_subscriptions').select('id, subscription')
    .in('user_id', Array.from(recipients));
  if (!subs?.length) return 0;

  const { data: cls } = await supabase
    .from('classes').select('day, time, type').eq('id', req.class_id).single();

  const senderName = sender?.name?.split(' ')[0] || 'Someone';
  const ctxLabel = cls ? `${DAYS[cls.day]} ${cls.time} ${cls.type}` : 'cover thread';
  const body = (record.text || '').slice(0, 100);

  const payload = JSON.stringify({
    title: `${senderName} replied in ${ctxLabel}`,
    body: body,
    tag: `cover-thread-${record.cover_request_id}`,
    data: { url: '/?tab=home' },
  });
  return await sendAll(subs, payload);
}

async function sendAll(subs, payload) {
  let sent = 0;
  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
      } else {
        console.warn('push failed (non-fatal):', err.statusCode, err.body);
      }
    }
  }));
  return sent;
}
