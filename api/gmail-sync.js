// /api/gmail-sync.js
// Fetches recent emails from Gmail, classifies any new ones via Claude Haiku 4.5,
// stores everything in email_classifications, and returns the full sorted list.
//
// Usage:
//   GET /api/gmail-sync?token=<supabase_jwt>           — last 30 messages
//   GET /api/gmail-sync?token=...&after=YYYY-MM-DD&before=YYYY-MM-DD  — date range backfill

import { createClient } from '@supabase/supabase-js';

const CATEGORIES = ['cancellation', 'refund', 'inquiry', 'tour', 'complaint', 'newsletter', 'internal', 'other'];
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

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: integration, error: intErr } = await supabase
    .from('email_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')
    .maybeSingle();

  if (intErr) return res.status(500).json({ error: intErr.message });
  if (!integration) return res.status(404).json({ error: 'No Gmail integration found' });

  // Refresh access token if expired
  let accessToken = integration.access_token;
  const expiryMs = integration.token_expiry ? new Date(integration.token_expiry).getTime() : 0;
  if (Date.now() >= expiryMs - 60_000) {
    if (!integration.refresh_token) {
      return res.status(401).json({ error: 'Token expired. Reconnect Gmail.' });
    }
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
  }

  // List recent message IDs (optionally by date range)
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

  // Find which IDs are already classified
  const { data: existing } = await supabase
    .from('email_classifications')
    .select('gmail_id')
    .eq('user_id', user.id)
    .in('gmail_id', gmailIds);
  const existingIds = new Set((existing || []).map(c => c.gmail_id));
  const newIds = gmailIds.filter(id => !existingIds.has(id));

  // Fetch FULL message (with body) + classify
  const toInsert = [];
  for (const id of newIds) {
    try {
      // format=full gives us the full body, not just snippet
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
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
      const emailBody = extractBodyText(msg.payload).slice(0, 2000); // first 2000 chars

      let classification;
      try {
        classification = await classifyEmail({
          from: emailFrom,
          subject: emailSubject,
          body: emailBody || emailSnippet, // fallback if body extraction fails
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

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase
      .from('email_classifications')
      .insert(toInsert);
    if (insErr) console.error('Insert error:', insErr);
  }

  await supabase
    .from('email_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', integration.id);

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

// ─── Extract plain-text body from a Gmail message payload ───
function extractBodyText(payload) {
  if (!payload) return '';
  if (payload.body?.data) return decodeB64Url(payload.body.data);
  const plain = findPartByMime(payload, 'text/plain');
  if (plain) return decodeB64Url(plain);
  const html = findPartByMime(payload, 'text/html');
  if (html) return stripHtml(decodeB64Url(html));
  return '';
}

function findPartByMime(part, mimeType) {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part.body.data;
  if (part.parts) {
    for (const p of part.parts) {
      const found = findPartByMime(p, mimeType);
      if (found) return found;
    }
  }
  return null;
}

function decodeB64Url(data) {
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf-8');
  } catch { return ''; }
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Claude Haiku 4.5 classifier — improved prompt with synonyms ───
async function classifyEmail({ from, subject, body }) {
  const prompt = `You're classifying emails for staff at Salus House — a small Pilates and reformer studio in Sidcup, UK. Owner is Luke Adlam.

Categorise the email below into EXACTLY ONE category. Pay close attention to the SYNONYMS — members rarely use the textbook word for what they want.

CATEGORIES:

• cancellation — member wants to STOP, PAUSE, FREEZE, HOLD, or LEAVE their membership
  Phrases: "cancel", "leave", "quit", "no longer", "stop", "freeze", "pause", "hold", "discontinue", "end my membership", "won't be renewing", "moving away", "won't be coming anymore"

• refund — money question: refund, payment dispute, double-charge, accidental billing, overcharge
  Phrases: "refund", "money back", "charged twice", "shouldn't have been billed", "dispute", "wrongly charged", "didn't authorise"

• tour — PROSPECTIVE member wanting to VISIT the studio before joining
  Phrases: "tour", "visit", "see the studio", "come and have a look", "look around", "show me around", "view the gym", "pop in", "drop by", "stop by", "have a look at the space", "see what you're like", "swing by", "come for a viewing"

• inquiry — questions from current or prospective members (NOT cancel/refund/visit)
  Examples: "what classes do you offer", "how much is membership", "do you do reformer for beginners", "are there parking spaces", "what time is the Saturday class"

• complaint — unhappy customer expressing dissatisfaction
  Examples: "disappointed", "the class was overcrowded", "instructor was rude", "wasn't happy with"

• newsletter — marketing, promotional, or automated bulk emails (often from retailers, software vendors)

• internal — staff, admin, system notifications, no-reply addresses, automated alerts

• other — none of the above

URGENCY:
• high — money-related, member threatening to leave, complaints, frustrated/escalating tone
• low — newsletters, general info, routine inquiries
• normal — everything else

REPLY FORMAT — ONLY valid JSON, no other text, no markdown fences:
{
  "category": "<one of: ${CATEGORIES.join(', ')}>",
  "summary": "one short plain-English sentence about what they want",
  "urgency": "high" | "normal" | "low",
  "suggested_action": "concise next step for staff, under 12 words"
}

────── EMAIL ──────
FROM: ${from}
SUBJECT: ${subject}
BODY:
${body}
─────────────────`;

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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in classification response');
  const parsed = JSON.parse(match[0]);

  const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
  const urgency = URGENCIES.includes(parsed.urgency) ? parsed.urgency : 'normal';
  return {
    category,
    urgency,
    summary: String(parsed.summary || '').slice(0, 300),
    suggested_action: String(parsed.suggested_action || '').slice(0, 200),
  };
}
