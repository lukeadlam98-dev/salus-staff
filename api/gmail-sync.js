// /api/gmail-sync.js
// Fetches recent emails from Gmail, classifies any new ones via Claude Haiku 4.5,
// stores everything in email_classifications, and returns the full sorted list.
//
// Usage: GET /api/gmail-sync?token=<supabase_jwt>
// Returns: { messages: [{ id, gmail_id, email_*, category, summary, urgency, suggested_action, handled_at }], newly_classified: N }

import { createClient } from '@supabase/supabase-js';

// ─── Categories the model is allowed to use ───
const CATEGORIES = [
  'cancellation', 'refund', 'inquiry', 'tour', 'complaint',
  'newsletter', 'internal', 'other',
];
const URGENCIES = ['high', 'normal', 'low'];

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  // ─── Validate Supabase JWT ───
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  // ─── Get the user's Gmail integration ───
  const { data: integration, error: intErr } = await supabase
    .from('email_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')
    .maybeSingle();

  if (intErr) return res.status(500).json({ error: intErr.message });
  if (!integration) return res.status(404).json({ error: 'No Gmail integration found' });

  // ─── Refresh access token if expired ───
  let accessToken = integration.access_token;
  const expiryMs = integration.token_expiry ? new Date(integration.token_expiry).getTime() : 0;
  if (Date.now() >= expiryMs - 60_000) {
    if (!integration.refresh_token) {
      return res.status(401).json({ error: 'Token expired. Reconnect Gmail.' });
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
      if (!refreshRes.ok) return res.status(500).json({ error: 'Token refresh failed' });
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

  // ─── List recent message IDs (or by date range if provided) ───
  let gmailIds = [];
  const { after, before } = req.query;
  try {
    let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + (after || before ? '100' : '30');
    if (after || before) {
      const qParts = [];
      if (after) qParts.push(`after:${String(after).replace(/-/g, '/')}`);
      if (before) qParts.push(`before:${String(before).replace(/-/g, '/')}`);
      url += '&q=' + encodeURIComponent(qParts.join(' '));
    }
    const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listRes.ok) {
      const errText = await listRes.text();
      return res.status(500).json({ error: 'Gmail list failed: ' + errText });
    }
    const listData = await listRes.json();
    gmailIds = (listData.messages || []).map(m => m.id);
  } catch (err) {
    return res.status(500).json({ error: 'Gmail list threw: ' + String(err?.message || err) });
  }

  // ─── Find which IDs are already classified ───
  const { data: existing } = await supabase
    .from('email_classifications')
    .select('gmail_id')
    .eq('user_id', user.id)
    .in('gmail_id', gmailIds);

  const existingIds = new Set((existing || []).map(c => c.gmail_id));
  const newIds = gmailIds.filter(id => !existingIds.has(id));

  // ─── For each new email: fetch metadata + classify ───
  const toInsert = [];
  for (const id of newIds) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();

      const headers = {};
      (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });

      const emailFrom = headers['From'] || '';
      const emailSubject = headers['Subject'] || '';
      const emailSnippet = msg.snippet || '';
      const emailDate = headers['Date'] || '';

      // Classify via Claude — fall back to 'other' if it fails
      let classification;
      try {
        classification = await classifyEmail({
          from: emailFrom, subject: emailSubject, snippet: emailSnippet,
        });
      } catch (e) {
        console.error('Classify failed:', e?.message || e);
        classification = {
          category: 'other',
          summary: emailSubject || emailSnippet.slice(0, 80),
          urgency: 'normal',
          suggested_action: 'Review manually',
        };
      }

      toInsert.push({
        user_id: user.id,
        gmail_id: id,
        email_thread_id: msg.threadId,
        email_from: emailFrom,
        email_subject: emailSubject,
        email_snippet: emailSnippet,
        email_date: emailDate,
        category: classification.category,
        summary: classification.summary,
        urgency: classification.urgency,
        suggested_action: classification.suggested_action,
        classified_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Per-message error:', err);
    }
  }

  // ─── Bulk insert new classifications ───
  if (toInsert.length > 0) {
    const { error: insErr } = await supabase
      .from('email_classifications')
      .insert(toInsert);
    if (insErr) console.error('Insert error:', insErr);
  }

  // ─── Update last_synced_at ───
  await supabase
    .from('email_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', integration.id);

  // ─── Return ALL classifications for this user, newest first ───
  const { data: allMessages, error: selErr } = await supabase
    .from('email_classifications')
    .select('*')
    .eq('user_id', user.id)
    .order('classified_at', { ascending: false })
    .limit(100);

  if (selErr) return res.status(500).json({ error: selErr.message });

  return res.status(200).json({
    messages: allMessages || [],
    newly_classified: toInsert.length,
  });
}

// ─── Claude Haiku 4.5 classifier ───
async function classifyEmail({ from, subject, snippet }) {
  const prompt = `You are classifying emails for the staff of Salus House, a small Pilates / reformer studio in Sidcup, UK.

Categorise this email into ONE of these categories:
- cancellation: member wants to cancel their membership or a class booking
- refund: member asking about a refund, payment issue, or billing dispute
- inquiry: member or prospective member asking questions (classes, prices, schedules, info)
- tour: someone wants to book a tour or visit the studio
- complaint: member unhappy about a class, instructor, facility, or service
- newsletter: marketing, promotional, or automated email
- internal: from staff, system notifications, or admin
- other: anything else not above

Reply with ONLY a JSON object (no other text, no markdown fences):
{
  "category": "<one of the categories above>",
  "summary": "one short plain-English sentence about what they want",
  "urgency": "high" | "normal" | "low",
  "suggested_action": "concise next step for staff, ideally under 10 words"
}

Urgency rules:
- "high" if they're frustrated, threatening to leave, time-sensitive, or money-related
- "low" for newsletters, general info requests
- "normal" otherwise

EMAIL TO CLASSIFY:
FROM: ${from}
SUBJECT: ${subject}
SNIPPET: ${snippet}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Anthropic API: ' + response.status + ' — ' + errText);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Pull out the JSON object even if the model wraps it in stray text
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in classification response');
  const parsed = JSON.parse(match[0]);

  // Validate + sanitize
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
  const urgency = URGENCIES.includes(parsed.urgency) ? parsed.urgency : 'normal';

  return {
    category,
    urgency,
    summary: String(parsed.summary || '').slice(0, 300),
    suggested_action: String(parsed.suggested_action || '').slice(0, 200),
  };
}
