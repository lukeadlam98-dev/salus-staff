// /api/daily-digest.js
// Vercel serverless function — sends Luke a daily summary of timetable changes.
// Runs via Vercel Cron (configured in vercel.json) once per day at 19:00 UTC.
//
// Required Vercel env vars:
//   RESEND_API_KEY            - from resend.com → API keys
//   SUPABASE_URL              - your Supabase project URL
//   SUPABASE_SERVICE_KEY      - service role key (NOT anon key — has full read)
//   DAILY_DIGEST_TO_EMAIL     - luke@salus.house
//   CRON_SECRET               - random string; we check it matches to prevent abuse

import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DAILY_DIGEST_TO_EMAIL = process.env.DAILY_DIGEST_TO_EMAIL || 'luke@salus.house';
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  // Verify cron secret (Vercel cron sends Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Pull all changes from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: changes, error: changesErr } = await supabase
      .from('timetable_changes')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (changesErr) throw changesErr;

    // Pull all coach profiles for name lookups
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, name');
    if (profilesErr) throw profilesErr;
    const profileById = Object.fromEntries(profiles.map(p => [p.id, p.name]));
    const nm = (id) => id ? (profileById[id] || 'Unknown coach') : 'Unknown';

    // Group changes by kind
    const groups = {
      cover_requested: [],
      cover_claimed: [],
      cover_resolved: [],
      cover_posted: [],
      class_hired: [],
      class_transferred: [],
    };
    for (const c of (changes || [])) {
      if (groups[c.kind]) groups[c.kind].push(c);
    }

    const totalChanges = (changes || []).length;
    const dateStr = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    // If nothing happened, send a "quiet day" note (or skip entirely)
    if (totalChanges === 0) {
      return res.status(200).json({ sent: false, reason: 'no changes in last 24h' });
    }

    // Build HTML email
    const html = buildEmailHtml({ groups, dateStr, totalChanges, nm });
    const subject = `Salus Staff · ${totalChanges} change${totalChanges === 1 ? '' : 's'} on ${dateStr.split(',')[0]}`;

    // Send via Resend
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Salus Staff <onboarding@resend.dev>',
        to: [DAILY_DIGEST_TO_EMAIL],
        subject,
        html,
      }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(`Resend ${resp.status}: ${JSON.stringify(result)}`);

    return res.status(200).json({ sent: true, changes: totalChanges, resend_id: result.id });
  } catch (err) {
    console.error('Daily digest failed:', err);
    return res.status(500).json({ error: err.message });
  }
}

function buildEmailHtml({ groups, dateStr, totalChanges, nm }) {
  const fmt = (c) => {
    const date = c.class_date
      ? new Date(c.class_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      : '';
    const time = c.class_time ? c.class_time.slice(0, 5) : '';
    return `${date} ${time} — ${c.class_type || 'class'}`;
  };

  const section = (title, items, render, color) => {
    if (!items.length) return '';
    const rows = items.map(c => `<li style="margin: 6px 0; color: #2a3028;">${render(c)}</li>`).join('');
    return `
      <h3 style="font-family: Georgia, serif; font-size: 16px; color: ${color}; margin: 28px 0 8px;">${title} <span style="color: #999; font-weight: 400; font-size: 13px;">(${items.length})</span></h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">${rows}</ul>
    `;
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Daily digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f1e8; padding: 30px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #fffdf7; border-radius: 12px; padding: 32px; border: 1px solid #ebe3cf;">
    <div style="border-bottom: 2px solid #5c4a38; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="font-size: 11px; color: #7a8270; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700;">SALUS STAFF · DAILY DIGEST</div>
      <h1 style="font-family: Georgia, serif; color: #5c4a38; margin: 4px 0 0; font-size: 26px;">${dateStr}</h1>
      <div style="color: #7a8270; font-size: 13px; margin-top: 6px;">${totalChanges} change${totalChanges === 1 ? '' : 's'} in the last 24 hours</div>
    </div>

    ${section('Cover requested', groups.cover_requested, (c) => `<b>${nm(c.actor_id)}</b> needs cover for ${fmt(c)}${c.details?.reason ? ` <i style="color:#7a8270">(${c.details.reason})</i>` : ''}`, '#c8442a')}
    ${section('Cover claimed', groups.cover_claimed, (c) => `<b>${nm(c.actor_id)}</b> picked up ${nm(c.affected_id)}'s ${fmt(c)}`, '#5c8a5a')}
    ${section('Cover resolved by manager', groups.cover_resolved, (c) => `${fmt(c)} — resolved`, '#5c4a38')}
    ${section('Cover posted to board', groups.cover_posted, (c) => `${nm(c.actor_id)} posted ${fmt(c)} to the board`, '#7a8270')}
    ${section('Studio hires booked', groups.class_hired, (c) => `<b>${nm(c.actor_id)}</b> booked ${fmt(c)} (${c.details?.hire_type === '1on1' ? '1:1' : 'event'})`, '#5c4a38')}
    ${section('Classes transferred', groups.class_transferred, (c) => `<b>${nm(c.actor_id)}</b> handed ${fmt(c)} to <b>${nm(c.affected_id)}</b>`, '#5c4a38')}

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ebe3cf; font-size: 11px; color: #a8a895; text-align: center;">
      Sent automatically by Salus Staff · <a href="https://salus-staff.vercel.app" style="color: #7a8270;">open app</a>
    </div>
  </div>
</body>
</html>`;
}
