// /api/spawn-recurring-tasks.js
// Runs daily via Vercel cron — creates today's instances from any
// recurring task templates that fire today.
//
// Required env vars (same as daily-digest):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, CRON_SECRET

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayDow = (today.getDay() + 6) % 7; // 0=Mon..6=Sun
    const todayDom = today.getDate();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Fetch all templates
    const { data: templates, error: tplErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_template', true);
    if (tplErr) throw tplErr;

    const created = [];
    const skipped = [];

    for (const t of templates || []) {
      // Does today match the pattern?
      let fires = false;
      if (t.recurrence === 'daily') fires = true;
      else if (t.recurrence === 'weekly' && (t.recurrence_days || []).includes(todayDow)) fires = true;
      else if (t.recurrence === 'monthly' && (t.recurrence_days || []).includes(todayDom)) fires = true;
      if (!fires) {
        skipped.push({ id: t.id, reason: 'pattern' });
        continue;
      }

      // Did we already spawn an instance for today?
      const { data: existing, error: existErr } = await supabase
        .from('tasks')
        .select('id')
        .eq('recurrence_parent_id', t.id)
        .eq('due_date', todayIso)
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        skipped.push({ id: t.id, reason: 'already exists' });
        continue;
      }

      // Spawn the instance
      const { error: insErr } = await supabase.from('tasks').insert({
        title: t.title,
        description: t.description,
        assignee_id: t.assignee_id,
        audience: t.audience,
        created_by: t.created_by,
        status: 'todo',
        priority: t.priority,
        due_date: todayIso,
        recurrence_parent_id: t.id,
      });
      if (insErr) {
        skipped.push({ id: t.id, reason: 'insert failed', error: insErr.message });
        continue;
      }
      created.push({ id: t.id, title: t.title });
    }

    return res.status(200).json({
      date: todayIso,
      created: created.length,
      skipped: skipped.length,
      details: { created, skipped },
    });
  } catch (err) {
    console.error('spawn-recurring-tasks failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
