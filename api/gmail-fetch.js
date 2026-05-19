// /api/gmail-fetch.js
// Reads the most recent 20 emails from the user's Gmail inbox.
// Handles token refresh automatically.
//
// Usage: GET /api/gmail-fetch?token=<supabase_jwt>
// Returns: { messages: [{ id, from, subject, date, snippet }, ...] }

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  // Identify the user from their Supabase JWT
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Get the stored Gmail integration
  const { data: integration, error: intErr } = await supabase
    .from('email_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')
    .maybeSingle();

  if (intErr) return res.status(500).json({ error: intErr.message });
  if (!integration) return res.status(404).json({ error: 'No Gmail integration found' });

  // Refresh the access token if it's expired (or about to expire)
  let accessToken = integration.access_token;
  const expiryMs = integration.token_expiry ? new Date(integration.token_expiry).getTime() : 0;

  if (Date.now() >= expiryMs - 60_000) {
    if (!integration.refresh_token) {
      return res.status(401).json({ error: 'Token expired and no refresh_token available. Reconnect Gmail.' });
    }
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: integration.refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }).toString(),
      });
      if (!refreshRes.ok) {
        return res.status(500).json({ error: 'Token refresh failed' });
      }
      const newTokens = await refreshRes.json();
      accessToken = newTokens.access_token;
      await supabase.from('email_integrations').update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
      }).eq('id', integration.id);
    } catch (err) {
      return res.status(500).json({ error: 'Refresh threw: ' + String(err?.message || err) });
    }
  }

  // List the last 20 message IDs
  let listData;
  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      const errText = await listRes.text();
      return res.status(500).json({ error: 'Gmail list failed: ' + errText });
    }
    listData = await listRes.json();
  } catch (err) {
    return res.status(500).json({ error: 'List threw: ' + String(err?.message || err) });
  }

  const ids = (listData.messages || []).map(m => m.id);

  // Fetch each message's metadata (subject/from/date/snippet only — saves bandwidth)
  const messages = await Promise.all(ids.map(async (id) => {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const headers = {};
      (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: headers['From'] || '',
        subject: headers['Subject'] || '(no subject)',
        date: headers['Date'] || '',
        snippet: msg.snippet || '',
      };
    } catch {
      return null;
    }
  }));

  // Update last_synced_at
  await supabase
    .from('email_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', integration.id);

  return res.status(200).json({ messages: messages.filter(Boolean) });
}
