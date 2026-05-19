// /api/sync-tours.js
// Fetches the iCal feed from Google Calendar (TOURS_ICAL_URL env var),
// parses VEVENT entries, and upserts them into the tours table.
//
// Runs every 15 minutes via Vercel cron (see vercel.json).
//
// Required env vars:
//   TOURS_ICAL_URL       — secret iCal address from Google Calendar
//   SUPABASE_URL         — your Supabase project URL
//   SUPABASE_SERVICE_KEY — service_role key (bypasses RLS to insert tours)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TOURS_ICAL_URL = process.env.TOURS_ICAL_URL;

export default async function handler(req, res) {
  // Allow Vercel cron + manual GET for testing
  if (!TOURS_ICAL_URL) {
    return res.status(500).json({ error: 'TOURS_ICAL_URL not configured' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase env not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // 1. Fetch the iCal feed
    const icalRes = await fetch(TOURS_ICAL_URL, {
      headers: { 'User-Agent': 'Salus-Staff-Sync/1.0' },
    });
    if (!icalRes.ok) {
      return res.status(500).json({ error: `iCal fetch failed: ${icalRes.status}` });
    }
    const text = await icalRes.text();

    // 2. Parse events
    const events = parseICal(text);

    // Debug mode: return diagnostic info instead of upserting
    if (req.query?.debug === '1') {
      const samples = events.slice(0, 5).map(ev => ({
        UID: ev.UID,
        SUMMARY: unescape(ev.SUMMARY || ''),
        DTSTART: ev.DTSTART,
        DTSTART_PARAMS: ev._DTSTART_PARAMS,
        DTEND: ev.DTEND,
      }));
      return res.status(200).json({
        feed_length_chars: text.length,
        total_events_in_feed: events.length,
        first_5_events: samples,
        filter_keyword: process.env.TOURS_TITLE_FILTER || 'tour',
        date_range_now: new Date().toISOString(),
      });
    }

    // 3. Filter: only future events (within next 90 days) + past 7 days (so FOH can update notes after)
    const now = Date.now();
    const past = now - 7 * 86400 * 1000;
    const future = now + 90 * 86400 * 1000;

    const toUpsert = [];
    for (const ev of events) {
      const start = parseICalDate(ev.DTSTART, ev._DTSTART_PARAMS);
      if (!start) continue;
      const startMs = start.getTime();
      if (startMs < past || startMs > future) continue;

      const summary = unescape(ev.SUMMARY || '');
      const description = unescape(ev.DESCRIPTION || '');

      // Only treat events that look like tours. Override via env var if needed.
      // Default: include events whose title contains "tour" (case-insensitive).
      const filter = (process.env.TOURS_TITLE_FILTER || 'tour').toLowerCase();
      if (filter && !summary.toLowerCase().includes(filter)) continue;

      const end = parseICalDate(ev.DTEND, ev._DTEND_PARAMS);

      toUpsert.push({
        ical_uid: ev.UID,
        title: summary || null,
        description: description || null,
        guest_name: extractGuestName(summary, description),
        guest_email: extractEmail(description),
        guest_phone: extractPhone(description),
        start_time: start.toISOString(),
        end_time: end ? end.toISOString() : null,
        last_synced_at: new Date().toISOString(),
      });
    }

    if (toUpsert.length === 0) {
      return res.status(200).json({ synced: 0, message: 'No tours in range' });
    }

    // 4. Upsert by ical_uid
    const { error } = await supabase
      .from('tours')
      .upsert(toUpsert, { onConflict: 'ical_uid' });

    if (error) {
      console.error('Upsert error:', error);
      return res.status(500).json({ error: error.message });
    }

    // 5. Mark tours that are no longer in the feed (within range) as cancelled
    const liveUids = toUpsert.map(t => t.ical_uid);
    if (liveUids.length > 0) {
      await supabase
        .from('tours')
        .update({ status: 'cancelled' })
        .gte('start_time', new Date(past).toISOString())
        .lte('start_time', new Date(future).toISOString())
        .not('ical_uid', 'in', `(${liveUids.map(u => `"${u}"`).join(',')})`)
        .neq('status', 'cancelled');
    }

    return res.status(200).json({ synced: toUpsert.length });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

// ─── iCal parsing ───────────────────────────────────────────────────

function parseICal(text) {
  // Unfold lines: lines starting with space/tab are continuations of previous
  const raw = text.split(/\r?\n/);
  const lines = [];
  for (const ln of raw) {
    if (lines.length && (ln.startsWith(' ') || ln.startsWith('\t'))) {
      lines[lines.length - 1] += ln.slice(1);
    } else {
      lines.push(ln);
    }
  }

  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT') {
      if (current && current.UID) events.push(current);
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const keyPart = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const semi = keyPart.indexOf(';');
      const key = semi >= 0 ? keyPart.slice(0, semi) : keyPart;
      const params = semi >= 0 ? keyPart.slice(semi + 1) : '';
      current[key] = value;
      if (key === 'DTSTART' || key === 'DTEND') {
        current[`_${key}_PARAMS`] = params;
      }
    }
  }
  return events;
}

function parseICalDate(s, params) {
  if (!s) return null;
  s = s.trim();

  // All-day (DATE format: YYYYMMDD)
  if (/^\d{8}$/.test(s)) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00`);
  }

  // YYYYMMDDTHHMMSSZ — UTC
  if (/^\d{8}T\d{6}Z$/.test(s)) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`);
  }

  // YYYYMMDDTHHMMSS — floating local time (treat as UK time)
  if (/^\d{8}T\d{6}$/.test(s)) {
    // If a TZID param was specified, we'd ideally honour it. For simplicity
    // we trust the wall-clock value and treat it as Europe/London.
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}`);
  }

  return null;
}

function unescape(s) {
  if (!s) return s;
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// Best-effort extraction. Tours from forms usually put the guest name in title,
// and email/phone in description. We'll do simple regex parsing.

function extractGuestName(summary, description) {
  if (!summary) return null;
  // Common patterns: "Tour - John Smith", "Tour: John Smith", "John Smith - Tour"
  const cleaned = summary
    .replace(/^tour[\s:–-]+/i, '')
    .replace(/[\s:–-]+tour$/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  return cleaned || summary.trim();
}

function extractEmail(description) {
  if (!description) return null;
  const m = description.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

function extractPhone(description) {
  if (!description) return null;
  // UK / international phone — matches 10+ digit sequences with optional spaces, +, parens
  const m = description.match(/(\+?\d[\d\s().-]{8,})/);
  return m ? m[0].trim() : null;
}
