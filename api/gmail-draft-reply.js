// /api/gmail-draft-reply.js — Use Claude to draft a reply to an email
// Takes { messageId } and returns { draft } — does NOT actually send.
//
// Reads the cached classification from Supabase, asks Claude Haiku to write
// a polite, on-brand reply, returns the draft text for the user to copy.
//
// Auth: requires a Supabase access token in Authorization: Bearer header.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth: parse Supabase JWT from Authorization header ────────────────────
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid auth' });

  // ── Body: messageId of the email classification row ──────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { messageId } = body || {};
  if (!messageId) return res.status(400).json({ error: 'Missing messageId' });

  // ── Fetch the classification (must belong to this user) ──────────────────
  const { data: msg, error: msgErr } = await supabase
    .from('email_classifications')
    .select('*')
    .eq('id', messageId)
    .eq('user_id', user.id)
    .single();

  if (msgErr || !msg) return res.status(404).json({ error: 'Email not found' });

  // ── Build the prompt ─────────────────────────────────────────────────────
  const prompt = `You are drafting a reply email on behalf of Luke, the owner of Salus House — a premium Pilates and reformer studio in Sidcup, south-east London.

Salus House voice:
- Warm, professional, brief — like a friend who runs a quietly excellent business.
- Modern wellness/lifestyle brand. Not corporate. Not aggressively casual.
- No exclamation marks unless genuine excitement. No emojis. No marketing speak.
- Active voice, present tense where possible.
- Sign off with: "Luke" on its own line. (Not "Best regards", not "Kind regards".)

Email to reply to:
From: ${msg.email_from}
Subject: ${msg.email_subject}
${msg.snippet ? `Excerpt: ${msg.snippet}` : ''}

Context (auto-classified):
Category: ${msg.category}
Summary: ${msg.summary || '(no summary)'}
${msg.suggested_action ? `Suggested next step: ${msg.suggested_action}` : ''}

Write the reply email body only. Do NOT include "Subject:", "From:", or "To:" lines.
- Start with "Hi [first name]," if you can extract a first name; otherwise "Hi there,"
- Keep it concise: usually 3-5 sentences.
- If it's a tour enquiry: offer 2-3 time slots this week (use real-feeling times like Tuesday at 11am or Saturday morning) and ask what their goals are.
- If it's a cancellation/refund: acknowledge first, then explain that you'll come back to them shortly with options. Don't commit to anything you can't deliver.
- If it's an inquiry about classes: brief description + invite them to book a tour.
- End with "Luke" on its own line.

Return ONLY the email body, no surrounding text or markdown.`;

  // ── Call Claude Haiku ────────────────────────────────────────────────────
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Claude API error:', claudeRes.status, errText);
      return res.status(500).json({ error: 'AI draft failed', detail: errText });
    }

    const data = await claudeRes.json();
    const draft = (data.content || []).map(c => c.text || '').join('').trim();

    if (!draft) return res.status(500).json({ error: 'Empty draft returned' });

    return res.status(200).json({ draft, replyTo: msg.email_from, subject: `Re: ${msg.email_subject}` });
  } catch (e) {
    console.error('Reply draft exception:', e);
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
