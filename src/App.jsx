import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, MessageSquare, Users, BarChart3, AlertCircle, AlertOctagon, Plus,
  Send, ArrowLeftRight, Check, X, Clock, Bell, RotateCcw, Settings, Mail, LogOut,
  ChevronLeft, ChevronRight, TrendingUp, Award, Activity, Trash2,
  Sparkles, Play, Heart, Flame, Bookmark, MoreHorizontal, Music, Lightbulb,
  Home as HomeIcon, FileText, User as UserIcon, Settings as SettingsIcon
} from 'lucide-react';
import { supabase } from './lib/supabase';
import {
  profileFromDb,
  classFromDb, classToDb,
  coverReqFromDb,
  swapReqFromDb,
  messageFromDb,
  shiftFromDb,
  taskFromDb,
  taskCommentFromDb,
  shiftNoteFromDb,
  tourFromDb,
  maintenanceFromDb,
  feedbackFromDb,
  coachPostFromDb,
  postReactionFromDb,
  postCommentFromDb,
  bookingFromDb,
  dmFromDb,
} from './lib/transformers';

// ──────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_COACH_PREFS = {
  assignedCover: true,     // Manager assigned me cover for a class
  coverPosted: false,      // A class is now open for claim
  classReminder24h: true,  // 24h before each of my classes
  weeklySummary: false,    // Sunday evening recap
};

// Cover coaches care about *opportunities*, not their regular schedule (they have none)
const DEFAULT_COVER_PREFS = {
  assignedCover: true,           // Manager picked me for a class — urgent
  coverPosted: true,             // New cover request hit the board — their bread and butter
  classReminder24h: true,        // Reminder before a cover I've taken
  notSelected: false,            // Courtesy: someone else got picked from interested list
  weeklyOpportunities: false,    // Weekly digest of upcoming open shifts
};

const DEFAULT_MANAGER_PREFS = {
  ...DEFAULT_COACH_PREFS,
  classReminder24h: false,  // managers usually aren't teaching
  newCoverRequest: true,    // Coach requested cover (needs action)
  coverClaimed: false,      // Someone took a posted class
  weeklyActivity: true,     // Weekly summary of activity
};

// Empty data shape. Real data is loaded from Supabase at runtime.
const EMPTY_DATA = {
  users: [],
  classes: [],
  coverRequests: [],
  swapRequests: [],
  messages: [],
  shifts: [],
  tasks: [],
  taskComments: [],
  shiftNotes: [],
  tours: [],
  maintenance: [],
  feedback: [],
  posts: [],
  postReactions: [],
  postComments: [],
  bookings: [],
  dms: [],
};

const CLASS_TYPES = {
  'Salus Reformer':      { color: '#7a8c5c', bg: '#e8ede0' },
  'Reformer Beginner':   { color: '#9aae7e', bg: '#eef2e6' },
  'Reformer Advanced':   { color: '#5b7245', bg: '#dce4d2' },
  'Reformer Stretch':    { color: '#b3c490', bg: '#f0f3e6' },
  'Friday Night Flow':   { color: '#c6926a', bg: '#f4e6d8' },
  'Hyrox':               { color: '#c8442a', bg: '#f5dcd6' },
  'Hyrox for Beginners': { color: '#d8694f', bg: '#fae3dc' },
  'Salus Signature':     { color: '#5c4a38', bg: '#dce4df' },
  'Salus Strength':      { color: '#1f3528', bg: '#d4dcd6' },
  'Barbell Strength':    { color: '#4a6f54', bg: '#e0e8e2' },
  'Salus Sculpt':        { color: '#c89c4a', bg: '#f4ead4' },
  'Glutes & Abs':        { color: '#b88a3a', bg: '#f0e3cc' },
  'Arms & Abs':          { color: '#d8ac5a', bg: '#f8efde' },
  'Power Yoga':          { color: '#8c5b7a', bg: '#ecdce4' },
};

const STUDIOS = {
  reformer: { label: 'Reformer Studio', short: 'Reformer' },
  hybrid:   { label: 'Hybrid',          short: 'Hybrid' },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATES = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24'];
const DAY_LABELS = ['Mon 18', 'Tue 19', 'Wed 20', 'Thu 21', 'Fri 22', 'Sat 23', 'Sun 24'];

// ─── Date helpers ───
// Monday-anchored week: returns the Monday of the week containing `date`.
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function toIsoDate(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// Build a Google Calendar "render" URL that pre-fills a new event.
// Tapping it opens Google Calendar in browser (or the app on mobile) with the event ready to save.
function googleCalendarUrl({ title, dateIso, startTime, endTime, description, location }) {
  const fmt = (d, t) => {
    // YYYYMMDDTHHmmss — local time, no Z (Google interprets as floating; user's local zone applies)
    const dt = new Date(`${d}T${t || '00:00'}:00`);
    const pad = (n) => String(n).padStart(2, '0');
    return dt.getFullYear()
      + pad(dt.getMonth() + 1)
      + pad(dt.getDate())
      + 'T'
      + pad(dt.getHours())
      + pad(dt.getMinutes())
      + '00';
  };
  const dates = `${fmt(dateIso, startTime)}/${fmt(dateIso, endTime || startTime)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || '',
    dates,
  });
  if (description) params.set('details', description);
  if (location)    params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}


// ──────────────────────────────────────────────────────────────────────────────
// HOOKS
// ──────────────────────────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

const fmtTime = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Urgency for cover requests based on how soon the class is
const getUrgency = (dateStr) => {
  if (!dateStr) return { level: 'green', label: '—', color: '#7a8c5c', bg: '#eef1e8', daysLeft: null };
  const classDate = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((classDate - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7)  return { level: 'red',   label: 'Urgent',          color: '#c8442a', bg: '#fdebe5', daysLeft };
  if (daysLeft <= 14) return { level: 'amber', label: 'Soon',            color: '#c89c4a', bg: '#fbf2dd', daysLeft };
  return { level: 'green', label: 'Plenty of time', color: '#7a8c5c', bg: '#eef1e8', daysLeft };
};

const endTime = (start, dur) => {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + dur;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ──────────────────────────────────────────────────────────────────────────────

export default function SalusStaff() {
  const isMobile = useIsMobile();
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [tab, setTab] = useState('home');
  const [tabInitialized, setTabInitialized] = useState(false);
  const [modal, setModal] = useState(null);
  const [scheduleView, setScheduleView] = useState('studio'); // 'studio' | 'foh'
  const [lastViewed, setLastViewed] = useState({ chat: 0, cover: 0 });
  const [urgentCoverDismissed, setUrgentCoverDismissed] = useState(false);
  const [showUrgentCover, setShowUrgentCover] = useState(false);

  // Load lastViewed from localStorage when the logged-in user is known
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    try {
      const raw = localStorage.getItem(`salus-last-viewed-${uid}`);
      setLastViewed(raw ? JSON.parse(raw) : { chat: 0, cover: 0 });
    } catch {
      setLastViewed({ chat: 0, cover: 0 });
    }
  }, [session?.user?.id]);

  // When the user switches to chat or cover, update the timestamp
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    if (tab !== 'chat' && tab !== 'cover') return;
    setLastViewed(prev => {
      const next = { ...prev, [tab]: Date.now() };
      try { localStorage.setItem(`salus-last-viewed-${uid}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [tab, session?.user?.id]);

  // Show urgent cover popup whenever there are open cover requests for this user.
  // It re-shows every time the app becomes visible (fresh load OR returning from background).
  // Reset dismissal whenever the app is hidden, so it reappears next time you open it.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setUrgentCoverDismissed(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (urgentCoverDismissed) return;
    if (loading || !session?.user?.id || !data.users.length) return;
    const me = data.users.find(u => u.id === session.user.id);
    if (!me || me.role === 'manager') return; // Manager doesn't need this prompt
    const openForMe = data.coverRequests.filter(r =>
      r.status === 'open' && r.requestedBy !== me.id
    );
    if (openForMe.length > 0) {
      setShowUrgentCover(true);
    }
  }, [loading, session?.user?.id, data.users.length, data.coverRequests.length, urgentCoverDismissed]);

  // Listen for auth state changes (session restore on mount + reactive updates)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch all data once we have a session
  const reloadData = async (silent = false) => {
    if (!session) return;
    if (!silent) setLoading(true);
    try {
      const [profilesRes, classesRes, coverReqRes, swapReqRes, messagesRes, shiftsRes, tasksRes, taskCmRes, shiftNotesRes, toursRes, maintRes, fbRes, postsRes, postRxRes, postCmRes, bookingsRes, dmsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('cover_requests').select('*'),
        supabase.from('swap_requests').select('*'),
        supabase.from('messages').select('*').order('created_at', { ascending: true }),
        supabase.from('foh_shifts').select('*'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('task_comments').select('*').order('created_at', { ascending: true }),
        supabase.from('shift_notes').select('*').order('created_at', { ascending: true }),
        supabase.from('tours').select('*').order('start_time', { ascending: true }),
        supabase.from('maintenance_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('member_feedback').select('*').order('created_at', { ascending: false }),
        supabase.from('coach_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('coach_post_reactions').select('*'),
        supabase.from('coach_post_comments').select('*').order('created_at', { ascending: true }),
        supabase.from('studio_bookings').select('*').order('date', { ascending: true }),
        supabase.from('direct_messages').select('*').order('created_at', { ascending: true }),
      ]);

      const errors = [profilesRes, classesRes, coverReqRes, swapReqRes, messagesRes, shiftsRes, tasksRes, taskCmRes, shiftNotesRes, toursRes, maintRes, fbRes, postsRes, postRxRes, postCmRes, bookingsRes, dmsRes]
        .filter(r => r.error)
        .map(r => r.error.message);
      if (errors.length) {
        console.error('Data load errors:', errors);
      }

      const myEmail = session.user?.email || '';
      setData({
        users: (profilesRes.data || []).map(r => profileFromDb(r, r.id === session.user?.id ? myEmail : '')),
        classes: (classesRes.data || []).map(classFromDb),
        coverRequests: (coverReqRes.data || []).map(coverReqFromDb),
        swapRequests: (swapReqRes.data || []).map(swapReqFromDb),
        messages: (messagesRes.data || []).map(messageFromDb),
        shifts: (shiftsRes.data || []).map(shiftFromDb),
        tasks: (tasksRes.data || []).map(taskFromDb),
        taskComments: (taskCmRes.data || []).map(taskCommentFromDb),
        shiftNotes: (shiftNotesRes.data || []).map(shiftNoteFromDb),
        tours: (toursRes.data || []).map(tourFromDb),
        maintenance: (maintRes.data || []).map(maintenanceFromDb),
        feedback: (fbRes.data || []).map(feedbackFromDb),
        posts: (postsRes.data || []).map(coachPostFromDb),
        postReactions: (postRxRes.data || []).map(postReactionFromDb),
        postComments: (postCmRes.data || []).map(postCommentFromDb),
        bookings: (bookingsRes.data || []).map(bookingFromDb),
        dms: (dmsRes.data || []).map(dmFromDb),
      });
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      reloadData();
    } else {
      setLoading(false);
      setData(EMPTY_DATA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Real-time updates: listen for any change in our five tables and refetch.
  // This is what makes a new message or cover request show up on everyone's screen instantly.
  useEffect(() => {
    if (!session) return;
    const silentReload = () => reloadData(true);
    const channel = supabase
      .channel('salus-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cover_requests' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'foh_shifts' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_feedback' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_posts' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_post_reactions' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_post_comments' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_bookings' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_notes' }, silentReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tours' }, silentReload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Lock body scrolling when chat is active — chat has its own contained scroll.
  // Prevents the iOS rubber-band effect on the background.
  // MUST be before any early returns (React rules of hooks).
  useEffect(() => {
    if (tab === 'chat') {
      const prevBody = document.body.style.overflow;
      const prevHtml = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBody;
        document.documentElement.style.overflow = prevHtml;
      };
    }
  }, [tab]);

  // Login handler — real Supabase auth
  const handleLogin = async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setAuthError(error.message || 'Could not sign in. Check email and password.');
      return false;
    }
    return true;
  };

  // Signup handler — auth.signUp passes name in metadata; a database trigger creates the profile.
  // This is more reliable than client-side INSERT (no RLS timing issues).
  const handleSignup = async (email, password, fullName) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || '').trim();
    if (!cleanName) {
      setAuthError('Please enter your full name.');
      return false;
    }

    const { error: signupErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: cleanName },
      },
    });
    if (signupErr) {
      setAuthError(signupErr.message || 'Could not create account.');
      return false;
    }
    return true;
  };

  const handleLogout = async () => {
    setTabInitialized(false);
    await supabase.auth.signOut();
  };

  // ─── Loading screens ───────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1e8', fontFamily: 'Geist, sans-serif' }}>
        <div style={{ color: '#5c4a38', fontFamily: '"Fraunces", serif', fontSize: 18, letterSpacing: 0.5 }}>Loading Salus Staff…</div>
      </div>
    );
  }

  // Not logged in → show login screen
  if (!session) {
    return (
      <LoginScreen
        error={authError}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1e8', fontFamily: 'Geist, sans-serif' }}>
        <div style={{ color: '#5c4a38', fontFamily: '"Fraunces", serif', fontSize: 18, letterSpacing: 0.5 }}>Loading your team…</div>
      </div>
    );
  }

  const currentUserId = session.user?.id;

  // No profile row for this auth user — guide them
  if (!data.users.find(u => u.id === currentUserId)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1e8', fontFamily: 'Geist, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 440, background: '#fffdf7', border: '1px solid #e8e0cc', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 22, marginTop: 0, color: '#1a2620' }}>Account isn't fully set up yet</h2>
          <p style={{ fontSize: 14, color: '#5a6258', lineHeight: 1.5 }}>
            Your login works, but there's no team profile attached to it.
            The manager needs to add a profile row for your account in Supabase.
          </p>
          <button
            onClick={handleLogout}
            style={{ marginTop: 16, padding: '10px 18px', borderRadius: 8, border: 'none', background: '#5c4a38', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────
  // Pattern: write to Supabase, then reload all data on success.

  const updateUserSettings = async (userId, settings) => {
    const patch = {};
    if (settings.emailPrefs !== undefined) patch.email_prefs = settings.emailPrefs;
    if (settings.name !== undefined) patch.name = settings.name;
    if (settings.initials !== undefined) patch.initials = settings.initials;
    if (settings.color !== undefined) patch.color = settings.color;
    if (settings.avatarUrl !== undefined) patch.avatar_url = settings.avatarUrl;
    if (settings.bankAccount !== undefined) patch.bank_account = settings.bankAccount;
    if (settings.bankSortCode !== undefined) patch.bank_sort_code = settings.bankSortCode;
    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) { console.error('updateUserSettings', error); return; }
    await reloadData(true);
  };

  const requestCover = async (classId, reason) => {
    // Managers' own requests skip the pending stage and go straight to the board.
    const initialStatus = isManager ? 'open' : 'pending';
    const { error: er1 } = await supabase.from('cover_requests').insert({
      class_id: classId,
      requested_by: currentUserId,
      reason: reason || '',
      status: initialStatus,
    });
    if (er1) { console.error('requestCover', er1); return; }
    const cls = data.classes.find(c => c.id === classId);
    await supabase.from('classes').update({ status: 'needsCover', original_coach_id: cls?.coachId }).eq('id', classId);
    await reloadData(true);
  };

  const cancelCoverRequest = async (requestId) => {
    const req = data.coverRequests.find(r => r.id === requestId);
    if (!req) return;
    const { error } = await supabase.from('cover_requests').delete().eq('id', requestId);
    if (error) { console.error('cancelCoverRequest', error); return; }
    const origId = data.classes.find(c => c.id === req.classId)?.originalCoachId;
    await supabase.from('classes').update({ status: 'assigned', original_coach_id: null, coach_id: origId }).eq('id', req.classId);
    await reloadData(true);
  };

  const claimCover = async (requestId, overrideCoachId) => {
    const req = data.coverRequests.find(r => r.id === requestId);
    if (!req) return;
    const coachId = overrideCoachId || currentUserId;
    const { error: er1 } = await supabase.from('cover_requests').update({ status: 'claimed', claimed_by: coachId }).eq('id', requestId);
    if (er1) { console.error('claimCover-req', er1); return; }
    const { error: er2 } = await supabase.from('classes').update({ coach_id: coachId, status: 'covered' }).eq('id', req.classId);
    if (er2) { console.error('claimCover-class', er2); return; }
    await reloadData(true);
  };

  const approveCoverRequest = async (requestId, action, assignTo) => {
    const req = data.coverRequests.find(r => r.id === requestId);
    if (!req) return;
    if (action === 'decline') {
      await supabase.from('cover_requests').delete().eq('id', requestId);
      await supabase.from('classes').update({ status: 'assigned', original_coach_id: null }).eq('id', req.classId);
    } else if (action === 'assign' && assignTo) {
      await supabase.from('cover_requests').update({ status: 'assigned', claimed_by: assignTo }).eq('id', requestId);
      await supabase.from('classes').update({ coach_id: assignTo, status: 'covered' }).eq('id', req.classId);
    } else if (action === 'post') {
      await supabase.from('cover_requests').update({ status: 'open' }).eq('id', requestId);
    }
    await reloadData(true);
  };

  const expressInterest = async (requestId) => {
    const req = data.coverRequests.find(r => r.id === requestId);
    if (!req) return;
    const interested = req.interestedCovers || [];
    const next = interested.includes(currentUserId)
      ? interested.filter(id => id !== currentUserId)
      : [...interested, currentUserId];
    const { error } = await supabase.from('cover_requests').update({ interested_covers: next }).eq('id', requestId);
    if (error) { console.error('expressInterest', error); return; }
    await reloadData(true);
  };

  const saveClass = async (classData) => {
    if (classData.id) {
      const { error } = await supabase.from('classes').update(classToDb(classData)).eq('id', classData.id);
      if (error) console.error('updateClass', error);
    } else {
      const { error } = await supabase.from('classes').insert(classToDb(classData));
      if (error) console.error('insertClass', error);
    }
    await reloadData(true);
  };

  const deleteClass = async (classId) => {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) console.error('deleteClass', error);
    await reloadData(true);
  };

  const sendMessage = async (text, isUrgent = false) => {
    if (!text || !text.trim()) return;
    const { error } = await supabase.from('messages').insert({
      user_id: currentUserId,
      text: text.trim(),
      is_urgent: isUrgent === true,
    });
    if (error) console.error('sendMessage', error);
    await reloadData(true);
  };

  const deleteMessage = async (messageId) => {
    if (!messageId) return;
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) { console.error('deleteMessage', error); return; }
    await reloadData(true);
  };

  const updateMessage = async (messageId, newText) => {
    if (!messageId || !newText || !newText.trim()) return;
    const { error } = await supabase
      .from('messages')
      .update({ text: newText.trim(), edited_at: new Date().toISOString() })
      .eq('id', messageId);
    if (error) { console.error('updateMessage', error); return; }
    await reloadData(true);
  };

  // Create a studio hire (stored in classes table with is_hire=TRUE).
  const createStudioHire = async ({ date, time, dur, studio, hireType, notes }) => {
    const dateObj = new Date(date + 'T' + time);
    const jsDay = dateObj.getDay(); // 0=Sun..6=Sat
    const day = jsDay === 0 ? 6 : jsDay - 1; // Map to Mon=0..Sun=6

    const typeLabel = hireType === '1on1' ? '1:1 Session' : 'Studio Hire';
    const { error } = await supabase.from('classes').insert({
      date,
      day,
      time,
      dur: Number(dur) || 60,
      type: typeLabel,
      coach_id: currentUserId,
      studio,
      status: 'assigned',
      is_hire: true,
      hire_type: hireType,
      notes: notes || null,
    });
    if (error) { console.error('createStudioHire', error); return false; }
    await reloadData(true);
    return true;
  };

  // Transfer a class directly to another coach (private hand-off).
  const transferClass = async (classId, newCoachId) => {
    if (!classId || !newCoachId) return false;
    const { error } = await supabase
      .from('classes')
      .update({
        coach_id: newCoachId,
        status: 'assigned',
        original_coach_id: null, // clear any cover-related state
      })
      .eq('id', classId);
    if (error) { console.error('transferClass', error); return false; }
    // Close any open cover request for this class
    await supabase.from('cover_requests')
      .delete()
      .eq('class_id', classId)
      .in('status', ['pending', 'open']);
    await reloadData(true);
    return true;
  };

  // Manager-only: assign or clear an FOH shift's staff member.
  const assignShift = async (shiftId, staffId) => {
    if (!shiftId) return false;
    const { error } = await supabase
      .from('foh_shifts')
      .update({
        staff_id: staffId || null,
        status: staffId ? 'assigned' : 'open',
        original_staff_id: null,
      })
      .eq('id', shiftId);
    if (error) { console.error('assignShift', error); return false; }
    await reloadData(true);
    return true;
  };

  // Placeholder — full FOH cover system to come.
  const requestShiftCover = async (shiftId) => {
    if (!shiftId) return false;
    const { error } = await supabase
      .from('foh_shifts')
      .update({ status: 'needs_cover' })
      .eq('id', shiftId);
    if (error) { console.error('requestShiftCover', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Task mutations ───
  const createTask = async ({ title, description, assigneeId, audience, dueDate, priority, recurrence, recurrenceDays, taskKind }) => {
    if (!title?.trim()) return false;
    const isRecurring = recurrence && recurrence !== 'none';
    const kind = taskKind || 'daily';
    const initialStatus = kind === 'project' ? 'not_started' : 'todo';

    const basePayload = {
      title: title.trim(),
      description: (description || '').trim() || null,
      assignee_id: audience === 'specific' ? assigneeId : null,
      audience: audience || 'specific',
      created_by: currentUserId,
      priority: priority || 'normal',
      task_kind: kind,
    };

    if (!isRecurring) {
      const { error } = await supabase.from('tasks').insert({
        ...basePayload,
        status: initialStatus,
        due_date: dueDate || null,
      });
      if (error) { console.error('createTask', error); return false; }
      await reloadData(true);
      return true;
    }

    // Recurring: only makes sense for daily-kind. Create template + today's instance.
    const { data: tplData, error: tplErr } = await supabase
      .from('tasks')
      .insert({
        ...basePayload,
        status: 'todo',
        is_template: true,
        recurrence,
        recurrence_days: recurrenceDays && recurrenceDays.length ? recurrenceDays : null,
      })
      .select('id')
      .single();
    if (tplErr) { console.error('createTask template', tplErr); return false; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayDow = (today.getDay() + 6) % 7;
    const todayDom = today.getDate();
    const fireToday =
      recurrence === 'daily' ||
      (recurrence === 'weekly' && (recurrenceDays || []).includes(todayDow)) ||
      (recurrence === 'monthly' && (recurrenceDays || []).includes(todayDom));

    if (fireToday) {
      await supabase.from('tasks').insert({
        ...basePayload,
        status: 'todo',
        due_date: toIsoDate(today),
        recurrence_parent_id: tplData.id,
      });
    }
    await reloadData(true);
    return true;
  };

  // Set status to any value. Auto-posts a system comment for project tasks.
  const setTaskStatus = async (taskId, newStatus) => {
    if (!taskId || !newStatus) return false;
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return false;
    const oldStatus = task.status;
    if (oldStatus === newStatus) return true;

    const patch = { status: newStatus };
    if (newStatus === 'done') {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = currentUserId;
    } else {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
    if (error) { console.error('setTaskStatus', error); return false; }

    // For project tasks, log the status change as a system comment
    if (task.taskKind === 'project') {
      const meName = data.users.find(u => u.id === currentUserId)?.name?.split(' ')[0] || 'Someone';
      const label = TASK_STATUS_LABELS[newStatus] || newStatus;
      await supabase.from('task_comments').insert({
        task_id: taskId,
        user_id: currentUserId,
        text: `${meName} moved this to ${label}`,
        kind: 'status_change',
      });
    }
    await reloadData(true);
    return true;
  };

  // Keep old markTaskDone for daily tasks
  const markTaskDone = async (taskId, done) => {
    return await setTaskStatus(taskId, done ? 'done' : 'todo');
  };

  const addTaskComment = async (taskId, text) => {
    if (!taskId || !text?.trim()) return false;
    const { error } = await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: currentUserId,
      text: text.trim(),
      kind: 'comment',
    });
    if (error) { console.error('addTaskComment', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteTaskComment = async (commentId) => {
    if (!commentId) return false;
    const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
    if (error) { console.error('deleteTaskComment', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Shift handover notes ───
  const addShiftNote = async (shiftId, text) => {
    if (!shiftId || !text?.trim()) return false;
    const { error } = await supabase.from('shift_notes').insert({
      shift_id: shiftId,
      user_id: currentUserId,
      text: text.trim(),
    });
    if (error) { console.error('addShiftNote', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteShiftNote = async (noteId) => {
    if (!noteId) return false;
    const { error } = await supabase.from('shift_notes').delete().eq('id', noteId);
    if (error) { console.error('deleteShiftNote', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Tours (synced from Google Calendar) ───
  // Only notes + outcome can be updated; the rest is mirrored from Google.
  const updateTourOutcome = async (tourId, { status, notes }) => {
    if (!tourId) return false;
    const patch = {};
    if (status !== undefined) {
      patch.status = status;
      patch.outcome_by = currentUserId;
      patch.outcome_at = new Date().toISOString();
    }
    if (notes !== undefined) patch.notes = (notes || '').trim() || null;
    const { error } = await supabase.from('tours').update(patch).eq('id', tourId);
    if (error) { console.error('updateTourOutcome', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteTask = async (taskId) => {
    if (!taskId) return false;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { console.error('deleteTask', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Maintenance ───
  const createMaintenanceLog = async ({ title, description, location, equipment, urgency }) => {
    if (!title?.trim()) return false;
    const { error } = await supabase.from('maintenance_logs').insert({
      title: title.trim(),
      description: (description || '').trim() || null,
      location: location || null,
      equipment: (equipment || '').trim() || null,
      urgency: urgency || 'normal',
      status: 'reported',
      reported_by: currentUserId,
    });
    if (error) { console.error('createMaintenanceLog', error); return false; }
    await reloadData(true);
    return true;
  };

  const updateMaintenanceStatus = async (id, status, notes) => {
    if (!id) return false;
    const patch = { status };
    if (status === 'fixed') {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = currentUserId;
      if (notes) patch.resolution_notes = notes;
    } else {
      patch.resolved_at = null;
      patch.resolved_by = null;
    }
    const { error } = await supabase.from('maintenance_logs').update(patch).eq('id', id);
    if (error) { console.error('updateMaintenanceStatus', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteMaintenanceLog = async (id) => {
    if (!id) return false;
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
    if (error) { console.error('deleteMaintenanceLog', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Feedback ───
  const createFeedback = async ({ memberName, context, feedback, sentiment }) => {
    if (!feedback?.trim()) return false;
    const { error } = await supabase.from('member_feedback').insert({
      member_name: (memberName || '').trim() || null,
      context: (context || '').trim() || null,
      feedback: feedback.trim(),
      sentiment: sentiment || 'neutral',
      status: 'new',
      logged_by: currentUserId,
    });
    if (error) { console.error('createFeedback', error); return false; }
    await reloadData(true);
    return true;
  };

  const updateFeedbackStatus = async (id, status, notes) => {
    if (!id) return false;
    const patch = { status };
    if (status === 'addressed') {
      patch.addressed_at = new Date().toISOString();
      patch.addressed_by = currentUserId;
      if (notes) patch.addressed_notes = notes;
    }
    const { error } = await supabase.from('member_feedback').update(patch).eq('id', id);
    if (error) { console.error('updateFeedbackStatus', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteFeedback = async (id) => {
    if (!id) return false;
    const { error } = await supabase.from('member_feedback').delete().eq('id', id);
    if (error) { console.error('deleteFeedback', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Coach posts (Flows) ───
  const createPost = async ({ title, description, postType, videoUrl, tags }) => {
    if (!title?.trim()) return false;
    const { error } = await supabase.from('coach_posts').insert({
      title: title.trim(),
      description: (description || '').trim() || null,
      post_type: postType || 'flow',
      video_url: (videoUrl || '').trim() || null,
      tags: (tags || []).filter(t => t && t.trim()),
      posted_by: currentUserId,
    });
    if (error) { console.error('createPost', error); return false; }
    await reloadData(true);
    return true;
  };

  const updatePost = async (postId, patch) => {
    if (!postId) return false;
    const dbPatch = { edited_at: new Date().toISOString() };
    if (patch.title !== undefined)       dbPatch.title = patch.title.trim();
    if (patch.description !== undefined) dbPatch.description = (patch.description || '').trim() || null;
    if (patch.videoUrl !== undefined)    dbPatch.video_url = (patch.videoUrl || '').trim() || null;
    if (patch.tags !== undefined)        dbPatch.tags = patch.tags;
    const { error } = await supabase.from('coach_posts').update(dbPatch).eq('id', postId);
    if (error) { console.error('updatePost', error); return false; }
    await reloadData(true);
    return true;
  };

  const deletePost = async (postId) => {
    if (!postId) return false;
    const { error } = await supabase.from('coach_posts').delete().eq('id', postId);
    if (error) { console.error('deletePost', error); return false; }
    await reloadData(true);
    return true;
  };

  const togglePostReaction = async (postId, reaction) => {
    if (!postId || !reaction) return false;
    // Did I already react with this emoji?
    const mine = data.postReactions.find(r =>
      r.postId === postId && r.userId === currentUserId && r.reaction === reaction
    );
    if (mine) {
      const { error } = await supabase
        .from('coach_post_reactions')
        .delete()
        .eq('post_id', postId).eq('user_id', currentUserId).eq('reaction', reaction);
      if (error) { console.error('removeReaction', error); return false; }
    } else {
      const { error } = await supabase
        .from('coach_post_reactions')
        .insert({ post_id: postId, user_id: currentUserId, reaction });
      if (error) { console.error('addReaction', error); return false; }
    }
    await reloadData(true);
    return true;
  };

  const addPostComment = async (postId, text) => {
    if (!postId || !text?.trim()) return false;
    const { error } = await supabase.from('coach_post_comments').insert({
      post_id: postId,
      user_id: currentUserId,
      text: text.trim(),
    });
    if (error) { console.error('addPostComment', error); return false; }
    await reloadData(true);
    return true;
  };

  const deletePostComment = async (commentId) => {
    if (!commentId) return false;
    const { error } = await supabase.from('coach_post_comments').delete().eq('id', commentId);
    if (error) { console.error('deletePostComment', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Onboarding ───
  const saveOnboardingAck = async (patch) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', currentUserId);
    if (error) { console.error('saveOnboardingAck', error); return false; }
    await reloadData(true);
    return true;
  };

  // Manager-only: flip is_coach or is_foh on another user
  const toggleUserRole = async (userId, field, value) => {
    if (!isManager || !userId) return false;
    const dbField = field === 'isCoach' ? 'is_coach' : field === 'isFoh' ? 'is_foh' : null;
    if (!dbField) return false;
    const { error } = await supabase.from('profiles').update({ [dbField]: value }).eq('id', userId);
    if (error) { console.error('toggleUserRole', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Studio Bookings ───
  const createBooking = async (payload) => {
    if (!payload.title?.trim()) return false;

    // If recurring, build a series of dates and insert one row per occurrence
    const isRecurring = payload.recurrencePattern === 'weekly'
      && Array.isArray(payload.recurrenceDays) && payload.recurrenceDays.length
      && payload.recurrenceEndDate;

    if (isRecurring) {
      const dates = generateRecurringDates(payload.date, payload.recurrenceEndDate, payload.recurrenceDays);
      if (dates.length === 0) return false;
      const seriesId = crypto.randomUUID();
      const rows = dates.map(d => ({
        title: payload.title.trim(),
        description: (payload.description || '').trim() || null,
        booking_type: payload.bookingType,
        hirer_name: (payload.hirerName || '').trim() || null,
        hirer_contact: (payload.hirerContact || '').trim() || null,
        price: payload.price ? Number(payload.price) : null,
        studio: payload.studio || 'whole',
        date: d,
        start_time: payload.startTime,
        end_time: payload.endTime,
        status: payload.status || 'confirmed',
        notes: (payload.notes || '').trim() || null,
        created_by: currentUserId,
        recurrence_pattern: 'weekly',
        recurrence_days: payload.recurrenceDays,
        recurrence_end_date: payload.recurrenceEndDate,
        recurrence_series_id: seriesId,
      }));
      const { error } = await supabase.from('studio_bookings').insert(rows);
      if (error) { console.error('createBooking (series)', error); return false; }
      await reloadData(true);
      return true;
    }

    // One-off booking
    const { error } = await supabase.from('studio_bookings').insert({
      title: payload.title.trim(),
      description: (payload.description || '').trim() || null,
      booking_type: payload.bookingType,
      hirer_name: (payload.hirerName || '').trim() || null,
      hirer_contact: (payload.hirerContact || '').trim() || null,
      price: payload.price ? Number(payload.price) : null,
      studio: payload.studio || 'whole',
      date: payload.date,
      start_time: payload.startTime,
      end_time: payload.endTime,
      status: payload.status || 'confirmed',
      notes: (payload.notes || '').trim() || null,
      created_by: currentUserId,
    });
    if (error) { console.error('createBooking', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteBookingSeries = async (seriesId) => {
    if (!seriesId) return false;
    const { error } = await supabase.from('studio_bookings').delete().eq('recurrence_series_id', seriesId);
    if (error) { console.error('deleteBookingSeries', error); return false; }
    await reloadData(true);
    return true;
  };

  const updateBooking = async (id, payload) => {
    if (!id) return false;
    const dbPatch = { updated_at: new Date().toISOString() };
    if (payload.title !== undefined)        dbPatch.title = payload.title.trim();
    if (payload.description !== undefined)  dbPatch.description = (payload.description || '').trim() || null;
    if (payload.bookingType !== undefined)  dbPatch.booking_type = payload.bookingType;
    if (payload.hirerName !== undefined)    dbPatch.hirer_name = (payload.hirerName || '').trim() || null;
    if (payload.hirerContact !== undefined) dbPatch.hirer_contact = (payload.hirerContact || '').trim() || null;
    if (payload.price !== undefined)        dbPatch.price = payload.price ? Number(payload.price) : null;
    if (payload.studio !== undefined)       dbPatch.studio = payload.studio;
    if (payload.date !== undefined)         dbPatch.date = payload.date;
    if (payload.startTime !== undefined)    dbPatch.start_time = payload.startTime;
    if (payload.endTime !== undefined)      dbPatch.end_time = payload.endTime;
    if (payload.status !== undefined)       dbPatch.status = payload.status;
    if (payload.notes !== undefined)        dbPatch.notes = (payload.notes || '').trim() || null;
    const { error } = await supabase.from('studio_bookings').update(dbPatch).eq('id', id);
    if (error) { console.error('updateBooking', error); return false; }
    await reloadData(true);
    return true;
  };

  const deleteBooking = async (id) => {
    if (!id) return false;
    const { error } = await supabase.from('studio_bookings').delete().eq('id', id);
    if (error) { console.error('deleteBooking', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Direct Messages ───
  const sendDm = async (recipientId, text) => {
    if (!recipientId || !text?.trim()) return false;
    const { error } = await supabase.from('direct_messages').insert({
      sender_id: currentUserId,
      recipient_id: recipientId,
      text: text.trim(),
    });
    if (error) { console.error('sendDm', error); return false; }
    await reloadData(true);
    return true;
  };

  const markDmsRead = async (otherUserId) => {
    if (!otherUserId) return;
    const { error } = await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', currentUserId)
      .is('read_at', null);
    if (error) console.error('markDmsRead', error);
    await reloadData(true);
  };

  const clearAllMessages = async () => {
    // .neq trick: delete all rows (id is never equal to this fake UUID)
    const { error } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { console.error('clearAllMessages', error); return; }
    await reloadData(true);
  };

  // Reset is now a no-op for safety. (In dev, manager can wipe data via Supabase.)
  const resetData = async () => { setModal(null); };

  // Legacy persist alias used by some inner components. Routes to reloadData.
  const persist = async () => { await reloadData(true); };

  const currentUser = data.users.find(u => u.id === currentUserId);
  const isManager = currentUser.role === 'manager';

  // First-time onboarding — if the user hasn't picked any role yet, show the picker.
  // Manager bypasses this entirely.
  if (!isManager && !currentUser.isCoach && !currentUser.isFoh) {
    return (
      <RolePickerScreen
        currentUser={currentUser}
        onPick={async ({ isCoach, isFoh }) => {
          const { error } = await supabase
            .from('profiles')
            .update({ is_coach: isCoach, is_foh: isFoh })
            .eq('id', currentUserId);
          if (error) { console.error('RolePicker save', error); return; }
          await reloadData(true);
        }}
        onSignOut={handleLogout}
      />
    );
  }

  // Then onboarding (after role is set, before they see Home).
  // Manager bypasses. Existing users are bypassed via the SQL migration that
  // backfilled their flags (or by completing it themselves).
  if (!isManager && !currentUser.onboardingCompletedAt) {
    return (
      <OnboardingFlow
        currentUser={currentUser}
        onSaveAck={saveOnboardingAck}
        onUpdateProfile={(patch) => updateUserSettings(currentUserId, patch)}
        onSignOut={handleLogout}
      />
    );
  }

  const pendingCount = data.coverRequests.filter(r => r.status === 'pending').length;
  const openCount = data.coverRequests.filter(r => r.status === 'open').length;

  // Unread = items created after lastViewed timestamp, excluding the user's own actions
  const chatUnread = data.messages.filter(m =>
    m.userId !== currentUserId && m.timestamp > (lastViewed.chat || 0)
  ).length;

  const coverUnread = data.coverRequests.filter(r =>
    r.requestedBy !== currentUserId &&
    (r.status === 'pending' || r.status === 'open') &&
    r.timestamp > (lastViewed.cover || 0)
  ).length;

  const dmUnread = data.dms.filter(m =>
    m.recipientId === currentUserId && m.readAt == null
  ).length;

  // Everyone lands on Home — the cover-first dashboard.
  // Only runs once per sign-in.
  if (!tabInitialized && currentUser) {
    setTab('home');
    if (currentUser.isFoh && !currentUser.isCoach) setScheduleView('foh');
    setTabInitialized(true);
  }

  // Wrappers that match the names the inner components expect
  const assignCoverDirectly = (requestId, coachId) =>
    approveCoverRequest(requestId, 'assign', coachId);

  const postCoverToBoard = (requestId) =>
    approveCoverRequest(requestId, 'post');

  const declineCoverRequest = (requestId) =>
    approveCoverRequest(requestId, 'decline');

  const addClass = (classData) => saveClass({ ...classData, id: null });
  const updateClass = (classId, updates) => {
    const existing = data.classes.find(c => c.id === classId);
    if (!existing) return Promise.resolve();
    return saveClass({ ...existing, ...updates, id: classId });
  };

  const proposeSwap = async (fromClassId, toClassId) => {
    const toClass = data.classes.find(c => c.id === toClassId);
    if (!toClass) return;
    const { error } = await supabase.from('swap_requests').insert({
      class_a_id: fromClassId,
      class_b_id: toClassId,
      from_coach: currentUserId,
      to_coach: toClass.coachId,
      status: 'pending',
    });
    if (error) console.error('proposeSwap', error);
    await reloadData(true);
  };

  const respondToSwap = async (swapId, accept) => {
    const swap = data.swapRequests.find(s => s.id === swapId);
    if (!swap) return;
    if (accept) {
      const classA = data.classes.find(c => c.id === swap.classAId);
      const classB = data.classes.find(c => c.id === swap.classBId);
      await supabase.from('classes').update({ coach_id: classB.coachId }).eq('id', swap.classAId);
      await supabase.from('classes').update({ coach_id: classA.coachId }).eq('id', swap.classBId);
      await supabase.from('swap_requests').update({ status: 'accepted' }).eq('id', swapId);
    } else {
      await supabase.from('swap_requests').update({ status: 'declined' }).eq('id', swapId);
    }
    await reloadData(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Geist:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f1e8; }
        .salus-btn { transition: all 0.15s ease; cursor: pointer; }
        .salus-btn:hover { transform: translateY(-1px); }
        .salus-card { transition: all 0.2s ease; }
        .salus-card:hover { box-shadow: 0 4px 12px rgba(92, 74, 56, 0.08); }
        .salus-tab { transition: all 0.2s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .salus-modal-content { animation: slideUp 0.22s ease; }
        .salus-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .salus-scroll::-webkit-scrollbar-track { background: transparent; }
        .salus-scroll::-webkit-scrollbar-thumb { background: #d4cdb8; border-radius: 3px; }
        .salus-input:focus { outline: none; border-color: #5c4a38 !important; }

        /* Mobile-specific overrides */
        @media (max-width: 768px) {
          .salus-header { padding: 10px 14px !important; }
          .salus-header-right { gap: 4px !important; }
          .salus-nav { padding: 6px 8px 0 !important; gap: 2px !important; }
          .salus-nav-tab { padding: 8px 10px !important; font-size: 12px !important; }
          .salus-main { padding: 14px 14px 100px !important; }
          .salus-section-header { gap: 12px !important; }
          .salus-modal-card { max-width: 100% !important; border-radius: 12px !important; }
          .salus-stats-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .salus-stats-table > div { min-width: 540px; }
          .salus-h2 { font-size: 22px !important; }
        }

        /* Touch-friendly active states */
        @media (hover: none) {
          .salus-btn:active { transform: scale(0.98); }
        }
      `}</style>

      {/* Header */}
      <header className="salus-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoNew}>
            <img src="/icon-192.png" alt="Salus" style={styles.logoNewImg} />
          </div>
          {!isMobile && (
            <div style={styles.logoTextWrap}>
              <div style={styles.logoText}>Salus</div>
            </div>
          )}
        </div>

        <div className="salus-header-right" style={styles.headerRight}>
          <button
            onClick={() => setModal({ type: 'notifications' })}
            className="salus-btn"
            style={styles.bellBtn}
            title="Notifications"
          >
            <Bell size={18} color={(coverUnread + chatUnread + dmUnread) > 0 ? '#5c4a38' : '#a59478'} />
            {(coverUnread + chatUnread + dmUnread) > 0 && (
              <span style={styles.bellBtnBadge}>{coverUnread + chatUnread + dmUnread}</span>
            )}
          </button>

          <button
            onClick={() => setTab('me')}
            className="salus-btn"
            style={styles.headerAvBtn}
            title="Profile & settings"
          >
            <UserAvatar user={currentUser} size={36} fontSize={13} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className={tab === 'chat' ? 'salus-main salus-main-chat' : 'salus-main'} style={tab === 'chat' ? styles.mainChat : styles.main}>
        {tab === 'home' && (
          <Home
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClassClick={(classId) => {
              const cls = data.classes.find(c => c.id === classId);
              const req = data.coverRequests.find(r => r.classId === classId && (r.status === 'open' || r.status === 'pending'));
              if (req) {
                setModal({ type: 'coverThread', coverRequestId: req.id });
              } else {
                setModal({ type: 'classDetail', classId });
              }
            }}
            onRequestCover={() => setModal({ type: 'pickClassToRequestCover' })}
            onHireStudio={() => { setTab('bookings'); setModal({ type: 'createBooking' }); }}
            onClaim={(req) => setModal({ type: 'coverThread', coverRequestId: req.id })}
            onExpressInterest={expressInterest}
            onViewAllCover={() => setTab('cover')}
            onViewChat={() => setTab('chat')}
            onCreateTask={() => setModal({ type: 'createTask' })}
            onOpenTask={(taskId) => setModal({ type: 'taskDetail', taskId })}
            onOpenTour={(tourId) => setModal({ type: 'tourDetail', tourId })}
            onCreateMaintenance={() => setModal({ type: 'createMaintenance' })}
            onOpenMaintenance={(id) => setModal({ type: 'maintenanceDetail', id })}
            onCreateFeedback={() => setModal({ type: 'createFeedback' })}
            onOpenFeedback={(id) => setModal({ type: 'feedbackDetail', id })}
          />
        )}
        {(tab === 'timetable' || tab === 'cover') && (
          <StatusBar
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onJumpTo={setTab}
          />
        )}

        {tab === 'timetable' && (
          <ScheduleView
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            isMobile={isMobile}
            scheduleView={scheduleView}
            setScheduleView={setScheduleView}
            onClassClick={(classId) => {
              const req = data.coverRequests.find(r => r.classId === classId && (r.status === 'open' || r.status === 'pending'));
              if (req) {
                setModal({ type: 'coverThread', coverRequestId: req.id });
              } else {
                setModal({ type: 'classDetail', classId });
              }
            }}
            onShiftClick={(shiftId) => setModal({ type: 'shiftDetail', shiftId })}
            onAddClass={() => setModal({ type: 'editClass', classId: null })}
            onDayClick={(isoDate) => setModal({ type: 'dayDetail', isoDate })}
          />
        )}
        {tab === 'cover' && (
          <CoverBoard
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            isCoverCoach={currentUser.coachType === 'cover'}
            onClaim={claimCover}
            onCancel={cancelCoverRequest}
            onManage={(requestId) => setModal({ type: 'manageCover', requestId })}
            onExpressInterest={expressInterest}
          />
        )}
        {tab === 'chat' && (
          <Chat
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onSend={sendMessage}
            onDeleteMessage={deleteMessage}
            onEditMessage={updateMessage}
            onClearAll={() => setModal({ type: 'clearChat' })}
            onOpenDm={(userId) => setModal({ type: 'dm', otherUserId: userId })}
          />
        )}
        {tab === 'stats' && (
          isManager
            ? <ManagerStats data={data} onShowInvoices={() => setModal({ type: 'invoices' })} />
            : <CoachStats data={data} currentUser={currentUser} />
        )}
        {tab === 'bookings' && (
          <StudioBookingsView
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onCreate={() => setModal({ type: 'createBooking' })}
            onOpenBooking={(id) => setModal({ type: 'bookingDetail', id })}
          />
        )}
        {tab === 'me' && (
          <MePage
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onOpenSettings={() => setModal({ type: 'settings' })}
            onShowInvoices={() => setModal({ type: 'invoices' })}
            onShowTimeOff={() => setModal({ type: 'timeOff' })}
            onShowTeam={() => setModal({ type: 'team' })}
            onSignOut={handleLogout}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={styles.bottomNav}>
        <BottomTab icon={HomeIcon} label="Home" active={tab==='home'} onClick={() => setTab('home')} />
        <BottomTab icon={Calendar} label="Schedule" active={tab==='timetable'} onClick={() => setTab('timetable')} />
        <BottomTab icon={Bookmark} label="Bookings" active={tab==='bookings'} onClick={() => setTab('bookings')} />
        <BottomTab icon={MessageSquare} label="Chat" active={tab==='chat'} onClick={() => setTab('chat')} badge={chatUnread + dmUnread} />
        <BottomTab icon={UserIcon} label="Me" active={tab==='me'} onClick={() => setTab('me')} />
      </nav>

      {/* Modals */}
      {modal?.type === 'classDetail' && (
        <ClassDetailModal
          classObj={data.classes.find(c => c.id === modal.classId)}
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onRequestCover={(reason) => { requestCover(modal.classId, reason); setModal(null); }}
          onProposeSwap={(toClassId) => { proposeSwap(modal.classId, toClassId); setModal(null); }}
          onTransfer={() => setModal({ type: 'transferClass', classId: modal.classId })}
          onEdit={() => setModal({ type: 'editClass', classId: modal.classId })}
          onDelete={() => setModal({ type: 'confirmDelete', classId: modal.classId })}
        />
      )}
      {modal?.type === 'editClass' && (
        <EditClassModal
          classObj={modal.classId ? data.classes.find(c => c.id === modal.classId) : null}
          data={data}
          onClose={() => setModal(null)}
          onSave={(classData) => {
            if (modal.classId) updateClass(modal.classId, classData);
            else addClass(classData);
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'manageCover' && (
        <ManageCoverModal
          request={data.coverRequests.find(r => r.id === modal.requestId)}
          data={data}
          onClose={() => setModal(null)}
          onAssign={(coachId) => { assignCoverDirectly(modal.requestId, coachId); setModal(null); }}
          onPost={() => { postCoverToBoard(modal.requestId); setModal(null); }}
          onDecline={() => { declineCoverRequest(modal.requestId); setModal(null); }}
        />
      )}
      {modal?.type === 'confirmDelete' && (
        <ConfirmModal
          title="Delete this class?"
          message="This will remove the class from the timetable and cancel any related cover or swap requests."
          confirmLabel="Delete"
          onConfirm={() => { deleteClass(modal.classId); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'dayDetail' && (
        <DayDetailModal
          isoDate={modal.isoDate}
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onClassClick={(classId) => {
            const req = data.coverRequests.find(r => r.classId === classId && (r.status === 'open' || r.status === 'pending'));
            if (req) {
              setModal({ type: 'coverThread', coverRequestId: req.id });
            } else {
              setModal({ type: 'classDetail', classId });
            }
          }}
        />
      )}
      {modal?.type === 'coverThread' && (() => {
        const req = data.coverRequests.find(r => r.id === modal.coverRequestId);
        const cls = req && data.classes.find(c => c.id === req.classId);
        if (!req || !cls) return null;
        return (
          <CoverThreadModal
            coverRequest={req}
            classObj={cls}
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onClaim={(r) => { claimCover(r.id); setModal(null); }}
            onCancel={(reqId) => { cancelCoverRequest(reqId); setModal(null); }}
            onExpressInterest={(reqId) => expressInterest(reqId)}
          />
        );
      })()}
      {modal?.type === 'shiftDetail' && (() => {
        const s = data.shifts.find(s => s.id === modal.shiftId);
        if (!s) return null;
        return (
          <ShiftDetailModal
            shift={s}
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onAssign={assignShift}
            onRequestCover={requestShiftCover}
            onAddShiftNote={addShiftNote}
            onDeleteShiftNote={deleteShiftNote}
          />
        );
      })()}
      {modal?.type === 'team' && (
        <TeamDirectoryModal
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onMessageInChat={(userId) => {
            if (userId) {
              setModal({ type: 'dm', otherUserId: userId });
            } else {
              setModal(null);
              setTab('chat');
            }
          }}
          onToggleRole={toggleUserRole}
        />
      )}
      {modal?.type === 'createTask' && (
        <CreateTaskModal
          data={data}
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onCreate={createTask}
        />
      )}
      {modal?.type === 'taskDetail' && (() => {
        const t = data.tasks.find(t => t.id === modal.taskId);
        if (!t) return null;
        return (
          <TaskDetailModal
            task={t}
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onMarkDone={markTaskDone}
            onSetStatus={setTaskStatus}
            onDelete={deleteTask}
            onAddComment={addTaskComment}
            onDeleteComment={deleteTaskComment}
          />
        );
      })()}
      {modal?.type === 'createMaintenance' && (
        <CreateMaintenanceModal onClose={() => setModal(null)} onCreate={createMaintenanceLog} />
      )}
      {modal?.type === 'maintenanceDetail' && (() => {
        const log = data.maintenance.find(m => m.id === modal.id);
        if (!log) return null;
        return (
          <MaintenanceDetailModal
            log={log}
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onUpdateStatus={updateMaintenanceStatus}
            onDelete={deleteMaintenanceLog}
          />
        );
      })()}
      {modal?.type === 'createFeedback' && (
        <CreateFeedbackModal onClose={() => setModal(null)} onCreate={createFeedback} />
      )}
      {modal?.type === 'feedbackDetail' && (() => {
        const item = data.feedback.find(f => f.id === modal.id);
        if (!item) return null;
        return (
          <FeedbackDetailModal
            item={item}
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onUpdateStatus={updateFeedbackStatus}
            onDelete={deleteFeedback}
          />
        );
      })()}
      {modal?.type === 'tourDetail' && (() => {
        const t = data.tours.find(x => x.id === modal.tourId);
        if (!t) return null;
        return (
          <TourDetailModal
            tour={t}
            currentUser={currentUser}
            onClose={() => setModal(null)}
            onUpdate={updateTourOutcome}
          />
        );
      })()}
      {modal?.type === 'createBooking' && (
        <CreateBookingModal
          existing={null}
          currentUser={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onCreate={createBooking}
          onUpdate={updateBooking}
        />
      )}
      {modal?.type === 'editBooking' && (() => {
        const b = data.bookings.find(x => x.id === modal.id);
        if (!b) return null;
        return (
          <CreateBookingModal
            existing={b}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onCreate={createBooking}
            onUpdate={updateBooking}
          />
        );
      })()}
      {modal?.type === 'bookingDetail' && (() => {
        const b = data.bookings.find(x => x.id === modal.id);
        if (!b) return null;
        return (
          <BookingDetailModal
            booking={b}
            currentUser={currentUser}
            isManager={isManager}
            onClose={() => setModal(null)}
            onEdit={(id) => setModal({ type: 'editBooking', id })}
            onDelete={deleteBooking}
            onDeleteSeries={deleteBookingSeries}
          />
        );
      })()}
      {modal?.type === 'dm' && (() => {
        const other = data.users.find(u => u.id === modal.otherUserId);
        if (!other) return null;
        return (
          <DmThreadModal
            otherUser={other}
            data={data}
            currentUser={currentUser}
            onClose={() => setModal(null)}
            onSend={sendDm}
            onMarkRead={markDmsRead}
          />
        );
      })()}
      {modal?.type === 'notifications' && (
        <NotificationsDrawer
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onGoTo={(tab) => setTab(tab)}
          onOpenDm={(userId) => setModal({ type: 'dm', otherUserId: userId })}
        />
      )}
      {modal?.type === 'transferClass' && (() => {
        const cls = data.classes.find(c => c.id === modal.classId);
        if (!cls) return null;
        return (
          <TransferClassModal
            classObj={cls}
            data={data}
            currentUser={currentUser}
            onClose={() => setModal(null)}
            onTransfer={transferClass}
          />
        );
      })()}
      {modal?.type === 'hireStudio' && (
        <HireStudioModal
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onSubmit={createStudioHire}
        />
      )}
      {modal?.type === 'pickClassToRequestCover' && (
        <PickClassModal
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onPick={(classId) => setModal({ type: 'classDetail', classId })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'settings' && (
        <SettingsModal
          user={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onSave={(settings) => { updateUserSettings(currentUser.id, settings); setModal(null); }}
        />
      )}
      {modal?.type === 'reset' && (
        <ConfirmModal
          title="Reset demo data?"
          message="This will restore the original sample classes, cover requests, and chat messages."
          confirmLabel="Reset"
          onConfirm={resetData}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'clearChat' && (
        <ConfirmModal
          title="Clear all chat messages?"
          message="This will permanently delete every message in the team chat. This action cannot be undone."
          confirmLabel="Clear all"
          onConfirm={() => { clearAllMessages(); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'timeOff' && (
        <TimeOffModal onClose={() => setModal(null)} />
      )}
      {modal?.type === 'invoices' && (
        <InvoicesModal data={data} onClose={() => setModal(null)} />
      )}
      {showUrgentCover && (
        <UrgentCoverModal
          requests={data.coverRequests.filter(r => r.status === 'open' && r.requestedBy !== currentUser.id)}
          classes={data.classes}
          users={data.users}
          currentUser={currentUser}
          onClaim={(req) => {
            setShowUrgentCover(false);
            setUrgentCoverDismissed(true);
            setModal({ type: 'class', classId: req.classId });
          }}
          onView={() => {
            setShowUrgentCover(false);
            setUrgentCoverDismissed(true);
            setTab('cover');
          }}
          onClose={() => {
            setShowUrgentCover(false);
            setUrgentCoverDismissed(true);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// NAV TAB
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// USER AVATAR — shows photo if uploaded, falls back to coloured circle with initials
// ──────────────────────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 24, fontSize = 10 }) {
  if (!user) return null;
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0, display: 'block',
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: user.color || '#888', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 700, flexShrink: 0,
    }}>
      {user.initials}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DAILY WELLBEING QUOTE — rotates by day of year
// ──────────────────────────────────────────────────────────────────────────────

const WELLBEING_QUOTES = [
  { text: "Movement is medicine. Show up for your body today.", attr: "Salus" },
  { text: "Strength is not measured in weight, but in how you carry your day.", attr: "Salus" },
  { text: "Recovery is part of the work, not separate from it.", attr: "Salus" },
  { text: "Breathe deeply. Move intentionally. Rest fully.", attr: "Salus" },
  { text: "Take care of your body. It's the only place you have to live.", attr: "Jim Rohn" },
  { text: "The greatest wealth is health.", attr: "Virgil" },
  { text: "An ounce of prevention is worth a pound of cure.", attr: "Benjamin Franklin" },
  { text: "Don't put off tomorrow what you can do today — especially the warm-up.", attr: "Salus" },
  { text: "Small daily practices create extraordinary lives.", attr: "Robin Sharma" },
  { text: "Your body hears everything your mind says. Be kind in both.", attr: "Naomi Judd" },
  { text: "Discipline is choosing between what you want now and what you want most.", attr: "Abraham Lincoln" },
  { text: "Rest when you're weary. Refresh and renew yourself.", attr: "Ralph Marston" },
  { text: "Health is a state of complete harmony of the body, mind, and spirit.", attr: "B.K.S. Iyengar" },
  { text: "Show up for yourself before showing up for anyone else.", attr: "Salus" },
  { text: "The body achieves what the mind believes.", attr: "Napoleon Hill" },
  { text: "Progress, not perfection.", attr: "Salus" },
  { text: "You don't have to be extreme, just consistent.", attr: "Salus" },
  { text: "The first wealth is health.", attr: "Ralph Waldo Emerson" },
  { text: "What you do today can improve all your tomorrows.", attr: "Ralph Marston" },
  { text: "Honour your effort. Be proud of every rep.", attr: "Salus" },
  { text: "A healthy outside starts from the inside.", attr: "Robert Urich" },
  { text: "Slow is smooth. Smooth is fast.", attr: "Salus" },
  { text: "Make every breath count.", attr: "Salus" },
  { text: "Rest is not the opposite of progress. It's part of it.", attr: "Salus" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", attr: "Arnold Schwarzenegger" },
  { text: "Find joy in the journey, not just the finish line.", attr: "Salus" },
  { text: "Strong people lift others up.", attr: "Salus" },
  { text: "Listen to your body. It's smarter than your training plan.", attr: "Salus" },
  { text: "Calm mind, strong body, full heart.", attr: "Salus" },
  { text: "Mobility is freedom. Move every joint daily.", attr: "Salus" },
  { text: "Sleep is the most underrated performance enhancer.", attr: "Salus" },
  { text: "Be patient with your progress. Trust the process.", attr: "Salus" },
];

// ──────────────────────────────────────────────────────────────────────────────
// UK BANK HOLIDAYS — 2026
// ──────────────────────────────────────────────────────────────────────────────

const UK_BANK_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-04', name: 'Early May bank holiday' },
  { date: '2026-05-25', name: 'Spring bank holiday' },
  { date: '2026-08-31', name: 'Summer bank holiday' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-28', name: 'Boxing Day (substitute)' },
];

const UK_BANK_HOLIDAYS_2027 = [
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-03-29', name: 'Easter Monday' },
  { date: '2027-05-03', name: 'Early May bank holiday' },
  { date: '2027-05-31', name: 'Spring bank holiday' },
  { date: '2027-08-30', name: 'Summer bank holiday' },
  { date: '2027-12-27', name: 'Christmas Day (substitute)' },
  { date: '2027-12-28', name: 'Boxing Day (substitute)' },
];

const ALL_BANK_HOLIDAYS = [...UK_BANK_HOLIDAYS_2026, ...UK_BANK_HOLIDAYS_2027];

function getUpcomingBankHolidays(months = 12) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setMonth(limit.getMonth() + months);
  return ALL_BANK_HOLIDAYS.filter(h => {
    const d = new Date(h.date);
    return d >= today && d <= limit;
  });
}

function DailyQuote() {
  // Day of year, deterministic — same quote all day, different tomorrow
  const dayOfYear = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  })();
  const quote = WELLBEING_QUOTES[dayOfYear % WELLBEING_QUOTES.length];
  return (
    <div style={styles.quoteBar}>
      <div style={styles.quoteText}>“{quote.text}”</div>
      <div style={styles.quoteAttr}>— {quote.attr}</div>
    </div>
  );
}

function BottomTab({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{ ...styles.bottomTab, ...(active ? styles.bottomTabActive : {}) }}
      className="salus-btn"
    >
      <Icon size={22} strokeWidth={active ? 2.4 : 2} />
      <span style={{ ...styles.bottomTabLabel, ...(active ? styles.bottomTabLabelActive : {}) }}>
        {label}
      </span>
      {badge > 0 && <span style={styles.bottomTabBadge}>{badge}</span>}
    </button>
  );
}

function NavTab({ icon: Icon, label, active, onClick, badge, isMobile }) {
  // Shorten labels on mobile
  const mobileLabel = isMobile
    ? label.replace('Team ', '').replace(' Board', '').replace('Timetable', 'Week')
    : label;
  return (
    <button
      onClick={onClick}
      className="salus-tab salus-btn salus-nav-tab"
      style={{
        ...styles.navTab,
        ...(active ? styles.navTabActive : {}),
      }}
    >
      <Icon size={isMobile ? 14 : 16} />
      <span>{mobileLabel}</span>
      {badge > 0 && (
        <span style={styles.navBadge}>{badge}</span>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TIMETABLE
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// ROLE PICKER — shown once after first signup so the user tells us what they do
// ──────────────────────────────────────────────────────────────────────────────

function RolePickerScreen({ currentUser, onPick, onSignOut }) {
  const [isCoach, setIsCoach] = useState(false);
  const [isFoh, setIsFoh] = useState(false);
  const [saving, setSaving] = useState(false);
  const canContinue = isCoach || isFoh;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    await onPick({ isCoach, isFoh });
    // onPick triggers reloadData which re-renders past this screen; no need to clear saving
  };

  const Option = ({ active, onClick, title, desc, icon }) => (
    <button
      onClick={onClick}
      className="salus-btn"
      style={{
        ...styles.rolePickerOption,
        ...(active ? styles.rolePickerOptionActive : {}),
      }}
    >
      <div style={styles.rolePickerOptionIcon}>{icon}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.rolePickerOptionTitle}>{title}</div>
        <div style={styles.rolePickerOptionDesc}>{desc}</div>
      </div>
      <div style={{
        ...styles.rolePickerCheckbox,
        ...(active ? styles.rolePickerCheckboxActive : {}),
      }}>
        {active && <Check size={14} color="#fff" strokeWidth={3} />}
      </div>
    </button>
  );

  return (
    <div style={styles.rolePickerWrap}>
      <div style={styles.rolePickerCard}>
        <div style={styles.rolePickerHeader}>
          <div style={styles.rolePickerEyebrow}>Welcome to Salus Staff</div>
          <h1 style={styles.rolePickerTitle}>What do you do at Salus House{currentUser.name ? `, ${currentUser.name.split(' ')[0]}` : ''}?</h1>
          <p style={styles.rolePickerSubtitle}>
            Pick one or both — you can change this later in your profile.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          <Option
            active={isCoach}
            onClick={() => setIsCoach(v => !v)}
            title="Coach"
            desc="I teach classes in the studio (Reformer, Hyrox, etc.)"
            icon="🧘"
          />
          <Option
            active={isFoh}
            onClick={() => setIsFoh(v => !v)}
            title="Front of House"
            desc="I work at reception, checking members in"
            icon="🪴"
          />
        </div>

        <button
          onClick={handleContinue}
          disabled={!canContinue || saving}
          className="salus-btn"
          style={{
            ...styles.rolePickerContinue,
            ...((!canContinue || saving) ? styles.rolePickerContinueDisabled : {}),
          }}
        >
          {saving ? 'Saving…' : (canContinue ? 'Continue' : 'Pick at least one')}
        </button>

        <button
          onClick={onSignOut}
          className="salus-btn"
          style={styles.rolePickerSignOut}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ONBOARDING FLOW — shown after sign-up before they reach Home
// ──────────────────────────────────────────────────────────────────────────────

const ONBOARDING_POLICIES = {
  during_class: {
    title: 'What we expect during your class',
    eyebrow: 'Coach · in the studio',
    bullets: [
      'Arrive 15 minutes before the class start time.',
      'Greet every member by name as they come in.',
      'Set the music to the right playlist for the class type before members arrive.',
      'Demo each exercise clearly before counting in.',
      'Walk the floor — give hands-on corrections where appropriate.',
      'No phones out except to control music or check the time.',
      'Finish on time. Members may have another class straight after.',
    ],
    ackColumn: 'during_class_acked_at',
  },
  after_class: {
    title: 'What we expect after each class',
    eyebrow: 'Coach · resetting the studio',
    bullets: [
      'Reset all equipment to its default position.',
      'Wipe down reformers, mats, and any small equipment used.',
      'Restock the studio (towels, water, sprays).',
      'Note any equipment issue in the Maintenance log.',
      'Thank every member as they leave.',
      'Check the next class is ready — even if it isn\'t yours.',
    ],
    ackColumn: 'after_class_acked_at',
  },
  during_shift: {
    title: 'What we expect during your FOH shift',
    eyebrow: 'FOH · on reception',
    bullets: [
      'Be at the desk and visible at all times during your shift.',
      'Greet every member walking in — eye contact and a hello.',
      'Phone away unless using it for member queries or the app.',
      'Answer the phone within 3 rings during opening hours.',
      'Know what classes are running, who is teaching, and capacity.',
      'Handle minor queries yourself; escalate complaints to the manager.',
      'Keep the front area tidy — no clutter, no half-empty cups.',
    ],
    ackColumn: 'during_class_acked_at',
  },
  after_shift: {
    title: 'What we expect at the end of your shift',
    eyebrow: 'FOH · shift handover',
    bullets: [
      'Restock anything you used during the shift (towels, kit, drinks).',
      'Write a quick handover note for the next person: anything unusual, any pending member requests, any deliveries due.',
      'Wipe down the reception desk and tidy the entrance area.',
      'Note any maintenance issue in the Maintenance log.',
      'If you\'re on the last shift: lock-up checklist (lights, doors, music off, alarm on).',
      'Don\'t leave until the next person has arrived (if applicable).',
    ],
    ackColumn: 'after_class_acked_at',
  },
  uniform: {
    title: 'Uniform & appearance',
    eyebrow: 'Everyone · how we present',
    bullets: [
      'Salus House branded top during all working hours.',
      'Plain black leggings, shorts, or joggers.',
      'Clean trainers (no outdoor mud).',
      'Hair tied back if long enough.',
      'Personal grooming: nails short and clean, no strong perfume/aftershave.',
      'If you need a new Salus top, message Luke directly.',
    ],
    ackColumn: 'uniform_acked_at',
  },
};

function OnboardingFlow({ currentUser, onSaveAck, onUpdateProfile, onSignOut }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [bankAccount, setBankAccount] = useState(currentUser.bankAccount || '');
  const [bankSortCode, setBankSortCode] = useState(currentUser.bankSortCode || '');

  // Build a role-aware step list.
  //   welcome → photo → bank → conduct → (coach steps) → (foh steps) → uniform → done
  const roleSteps = [];
  if (currentUser.isCoach) {
    roleSteps.push('during_class', 'after_class');
  }
  if (currentUser.isFoh) {
    roleSteps.push('during_shift', 'after_shift');
  }

  const steps = [
    { type: 'welcome' },
    { type: 'photo' },
    { type: 'bank' },
    { type: 'conduct' },
    ...roleSteps.map(key => ({ type: 'policy', key })),
    { type: 'policy', key: 'uniform' },
    { type: 'done' },
  ];

  const totalDots = steps.length;
  const policyStepsCount = roleSteps.length + 1; // +1 for uniform

  const firstName = (currentUser.name || 'there').split(' ')[0];
  const current = steps[step];

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const ackAndNext = async (column) => {
    setSaving(true);
    await onSaveAck({ [column]: new Date().toISOString() });
    setSaving(false);
    next();
  };

  const saveBankAndNext = async () => {
    setSaving(true);
    await onUpdateProfile({ bankAccount: bankAccount.trim(), bankSortCode: bankSortCode.trim() });
    setSaving(false);
    next();
  };

  const finish = async () => {
    setSaving(true);
    await onSaveAck({ onboarding_completed_at: new Date().toISOString() });
    setSaving(false);
  };

  const Header = ({ eyebrow, title }) => (
    <>
      <div style={styles.rolePickerEyebrow}>{eyebrow}</div>
      <h1 style={styles.rolePickerTitle}>{title}</h1>
    </>
  );

  const Footer = ({ onPrimary, primaryLabel, primaryDisabled, hideBack }) => (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={onPrimary}
        disabled={primaryDisabled || saving}
        className="salus-btn"
        style={{
          ...styles.rolePickerContinue,
          ...((primaryDisabled || saving) ? styles.rolePickerContinueDisabled : {}),
        }}
      >
        {saving ? 'Saving…' : primaryLabel}
      </button>
      {!hideBack && step > 0 && (
        <button onClick={back} className="salus-btn" style={styles.onbBackBtn}>
          ← Back
        </button>
      )}
    </div>
  );

  const PolicyList = ({ bullets }) => (
    <ul style={styles.onbPolicyList}>
      {bullets.map((b, i) => <li key={i} style={styles.onbPolicyItem}>{b}</li>)}
    </ul>
  );

  // Count step indicator for policy steps (e.g. "Step 4 of 6")
  const policyStepLabel = () => {
    // We're on the Nth policy step. Find which policy step we are in the list.
    const policyStepIndex = steps
      .slice(0, step + 1)
      .filter(s => s.type === 'policy').length;
    return `Step ${4 + policyStepIndex - 1} of ${4 + policyStepsCount - 1}`;
  };

  return (
    <div style={styles.rolePickerWrap}>
      <div style={{ ...styles.rolePickerCard, maxWidth: 480 }}>
        {/* Progress dots */}
        <div style={styles.onbDots}>
          {Array.from({ length: totalDots }, (_, i) => (
            <div key={i} style={{
              ...styles.onbDot,
              ...(i <= step ? styles.onbDotActive : {}),
            }} />
          ))}
        </div>

        {current.type === 'welcome' && (
          <>
            <Header eyebrow="Welcome aboard" title={`Quick setup, ${firstName}.`} />
            <p style={styles.rolePickerSubtitle}>
              A few minutes to set up your profile, then read the gym rules.
              You'll only do this once.
            </p>
            <Footer onPrimary={next} primaryLabel="Let's go" hideBack />
          </>
        )}

        {current.type === 'photo' && (
          <>
            <Header eyebrow="Step 1" title="Add a profile photo" />
            <p style={styles.rolePickerSubtitle}>
              Shows next to every shift you cover and every message you send.
              You can change it later from the Me tab.
            </p>
            <p style={{ ...styles.rolePickerSubtitle, fontSize: 12, marginTop: 10 }}>
              You can do this after onboarding too.
            </p>
            <Footer onPrimary={next} primaryLabel="Continue" />
          </>
        )}

        {current.type === 'bank' && (
          <>
            <Header eyebrow="Step 2" title="Bank details for invoices" />
            <p style={styles.rolePickerSubtitle}>
              Where Luke pays you. Only the manager can see this.
            </p>
            <div style={{ marginTop: 16 }}>
              <label style={styles.label}>Account number</label>
              <input
                className="salus-input"
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="8 digits"
                style={{ width: '100%', marginBottom: 12, fontFamily: 'inherit' }}
              />
              <label style={styles.label}>Sort code</label>
              <input
                className="salus-input"
                type="text"
                value={bankSortCode}
                onChange={(e) => setBankSortCode(e.target.value)}
                placeholder="00-00-00"
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
            </div>
            <Footer
              onPrimary={saveBankAndNext}
              primaryLabel={bankAccount && bankSortCode ? 'Save & continue' : 'Skip for now'}
            />
          </>
        )}

        {current.type === 'conduct' && (
          <>
            <Header eyebrow="Step 3" title="Code of conduct" />
            <p style={styles.rolePickerSubtitle}>
              Treat colleagues and members with respect. Be on time. Keep personal life out of the studio.
              Any concerns go directly to Luke. By continuing you confirm you've read and agree.
            </p>
            <Footer
              onPrimary={() => ackAndNext('code_of_conduct_acked_at')}
              primaryLabel="I agree · Continue"
            />
          </>
        )}

        {current.type === 'policy' && (() => {
          const policy = ONBOARDING_POLICIES[current.key];
          return (
            <>
              <Header eyebrow={`${policyStepLabel()} · ${policy.eyebrow}`} title={policy.title} />
              <PolicyList bullets={policy.bullets} />
              <Footer
                onPrimary={() => ackAndNext(policy.ackColumn)}
                primaryLabel="Got it · Continue"
              />
            </>
          );
        })()}

        {current.type === 'done' && (
          <>
            <Header eyebrow="All set" title="You're ready to go." />
            <p style={styles.rolePickerSubtitle}>
              You can revisit any of the policies from your Me tab. Welcome to the team, {firstName}.
            </p>
            <Footer onPrimary={finish} primaryLabel="Open Salus Staff" hideBack />
          </>
        )}

        {step === 0 && (
          <button onClick={onSignOut} className="salus-btn" style={styles.rolePickerSignOut}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAINTENANCE LOG
// ──────────────────────────────────────────────────────────────────────────────

const MAINTENANCE_LOCATIONS = [
  { val: 'reformer', label: 'Reformer studio' },
  { val: 'hybrid',   label: 'HYBRID' },
  { val: 'reception', label: 'Reception' },
  { val: 'changing', label: 'Changing rooms' },
  { val: 'other',    label: 'Other' },
];

function MaintenanceTile({ data, currentUser, isManager, onCreate, onOpenLog }) {
  const [open, setOpen] = useState(false);
  const active = data.maintenance.filter(m => m.status !== 'fixed');
  const sorted = [...active].sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'urgent' ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <section style={styles.homeSection}>
      <div style={styles.homeSectionHead}>
        <button onClick={() => setOpen(o => !o)} className="salus-btn" style={styles.homeSectionToggle}>
          <span style={styles.homeSectionTitle}>Maintenance</span>
          {sorted.length > 0 && (
            <span style={{ ...styles.tasksCountBadge, background: sorted.some(s => s.urgency === 'urgent') ? '#c8442a' : '#5c4a38' }}>
              {sorted.length}
            </span>
          )}
          <ChevronRight size={16} color="#a59478"
            style={{ marginLeft: 'auto', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
          />
        </button>
      </div>
      {open && (
        <div style={{ padding: '0 14px 4px' }}>
          {sorted.length === 0 ? (
            <div style={styles.tasksEmpty}>Nothing reported. Equipment is happy.</div>
          ) : (
            <div style={styles.tasksList}>
              {sorted.map(m => (
                <MaintenanceCard key={m.id} log={m} data={data} onOpen={() => onOpenLog(m.id)} />
              ))}
            </div>
          )}
          <button onClick={onCreate} className="salus-btn" style={styles.tasksCreateBtn}>
            <Plus size={16} /> Report an issue
          </button>
        </div>
      )}
    </section>
  );
}

function MaintenanceCard({ log, data, onOpen }) {
  const reporter = data.users.find(u => u.id === log.reportedBy);
  const locLabel = MAINTENANCE_LOCATIONS.find(l => l.val === log.location)?.label || log.location;
  const statusLabel = log.status === 'in_progress' ? 'In progress' : log.status === 'fixed' ? 'Fixed' : 'Reported';
  return (
    <button onClick={onOpen} className="salus-btn" style={{
      ...styles.taskCard,
      ...(log.urgency === 'urgent' ? styles.taskCardUrgent : {}),
    }}>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.taskCardTitle}>
          {log.urgency === 'urgent' && <span style={styles.taskUrgentDot}>●</span>}
          {log.title}
        </div>
        <div style={styles.taskCardMeta}>
          {locLabel && <span>{locLabel}</span>}
          {log.equipment && <span>· {log.equipment}</span>}
          <span style={{
            background: log.status === 'in_progress' ? '#fef0d8' : '#fef0ea',
            color: log.status === 'in_progress' ? '#8c6a3a' : '#c8442a',
            padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4,
          }}>{statusLabel}</span>
          <span>· by {reporter?.name?.split(' ')[0] || 'someone'}</span>
        </div>
      </div>
      <ChevronRight size={16} color="#a59478" />
    </button>
  );
}

function CreateMaintenanceModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [equipment, setEquipment] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const ok = await onCreate({ title, description, location, equipment, urgency });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Report an issue</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <label style={styles.label}>What's wrong?</label>
          <input className="salus-input" type="text" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reformer 3 carriage sticky"
            style={{ width: '100%', marginBottom: 14 }} autoFocus
          />
          <label style={styles.label}>Details (optional)</label>
          <textarea className="salus-input" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything else useful — when it started, what makes it worse, etc."
            rows={3}
            style={{ width: '100%', resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
          />
          <label style={styles.label}>Where?</label>
          <div style={styles.audienceRow}>
            {MAINTENANCE_LOCATIONS.map(l => (
              <button key={l.val}
                onClick={() => setLocation(l.val)}
                className="salus-btn"
                style={{ ...styles.audiencePill, ...(location === l.val ? styles.audiencePillActive : {}) }}>
                {l.label}
              </button>
            ))}
          </div>
          <label style={styles.label}>Specific equipment (optional)</label>
          <input className="salus-input" type="text" value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="e.g. Reformer 3, sound system, hand dryer"
            style={{ width: '100%', marginBottom: 14 }}
          />
          <label style={styles.label}>Urgency</label>
          <div style={styles.audienceRow}>
            <button onClick={() => setUrgency('normal')} className="salus-btn"
              style={{ ...styles.audiencePill, ...(urgency === 'normal' ? styles.audiencePillActive : {}) }}>
              Normal
            </button>
            <button onClick={() => setUrgency('urgent')} className="salus-btn"
              style={{ ...styles.audiencePill, ...(urgency === 'urgent' ? { background: '#c8442a', color: '#fff', borderColor: '#c8442a' } : {}) }}>
              Urgent
            </button>
          </div>
        </div>
        <div style={styles.threadActionBar}>
          <button onClick={handleSubmit} disabled={!title.trim() || saving}
            className="salus-btn"
            style={{ ...styles.threadClaimBtn, ...((!title.trim() || saving) ? styles.threadClaimBtnDisabled : {}) }}>
            {saving ? 'Reporting…' : 'Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaintenanceDetailModal({ log, data, currentUser, isManager, onClose, onUpdateStatus, onDelete }) {
  const [notes, setNotes] = useState('');
  if (!log) return null;
  const reporter = data.users.find(u => u.id === log.reportedBy);
  const resolver = data.users.find(u => u.id === log.resolvedBy);
  const locLabel = MAINTENANCE_LOCATIONS.find(l => l.val === log.location)?.label || log.location;

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Maintenance</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={styles.dayDetailHeader}>
          {log.urgency === 'urgent' && <div style={{ ...styles.dayDetailRelative, color: '#c8442a', fontWeight: 700 }}>● URGENT</div>}
          <div style={styles.dayDetailTitle}>{log.title}</div>
          <div style={styles.dayDetailMeta}>
            {locLabel && <span>{locLabel}</span>}
            {log.equipment && <span> · {log.equipment}</span>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {log.description && <div style={styles.taskNotes}>{log.description}</div>}
          <div style={styles.taskCreatedBy}>
            Reported by {reporter?.name || 'someone'} · {new Date(log.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
          {log.status === 'fixed' && (
            <>
              <div style={styles.taskCompletedBy}>
                ✓ Fixed by {resolver?.name || 'someone'} · {log.resolvedAt ? new Date(log.resolvedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short' }) : ''}
              </div>
              {log.resolutionNotes && <div style={{ ...styles.taskNotes, marginTop: 12 }}>{log.resolutionNotes}</div>}
            </>
          )}
          {isManager && log.status !== 'fixed' && (
            <div style={{ marginTop: 20 }}>
              <label style={styles.label}>Resolution notes (optional)</label>
              <textarea className="salus-input" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you do to fix it?"
                rows={2}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>
        <div style={styles.threadActionBar}>
          {isManager && log.status === 'reported' && (
            <button onClick={() => { onUpdateStatus(log.id, 'in_progress'); onClose(); }}
              className="salus-btn" style={styles.btnSecondary}>
              Mark in progress
            </button>
          )}
          {isManager && log.status !== 'fixed' && (
            <button onClick={() => { onUpdateStatus(log.id, 'fixed', notes); onClose(); }}
              className="salus-btn" style={styles.threadClaimBtn}>
              <Check size={14} /> Mark fixed
            </button>
          )}
          {isManager && log.status === 'fixed' && (
            <button onClick={() => { onUpdateStatus(log.id, 'reported'); onClose(); }}
              className="salus-btn" style={styles.btnGhost}>
              Reopen
            </button>
          )}
          {isManager && (
            <button onClick={() => { if (confirm('Delete this log?')) { onDelete(log.id); onClose(); } }}
              className="salus-btn" style={{ ...styles.btnGhost, color: '#c8442a' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MEMBER FEEDBACK
// ──────────────────────────────────────────────────────────────────────────────

function FeedbackTile({ data, currentUser, isManager, onCreate, onOpen }) {
  const [open, setOpen] = useState(false);
  const active = data.feedback.filter(f => f.status === 'new');
  const sorted = [...active].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section style={styles.homeSection}>
      <div style={styles.homeSectionHead}>
        <button onClick={() => setOpen(o => !o)} className="salus-btn" style={styles.homeSectionToggle}>
          <span style={styles.homeSectionTitle}>Member feedback</span>
          {sorted.length > 0 && <span style={styles.tasksCountBadge}>{sorted.length}</span>}
          <ChevronRight size={16} color="#a59478"
            style={{ marginLeft: 'auto', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
          />
        </button>
      </div>
      {open && (
        <div style={{ padding: '0 14px 4px' }}>
          {sorted.length === 0 ? (
            <div style={styles.tasksEmpty}>Nothing new to address.</div>
          ) : (
            <div style={styles.tasksList}>
              {sorted.map(f => <FeedbackCard key={f.id} item={f} data={data} onOpen={() => onOpen(f.id)} />)}
            </div>
          )}
          <button onClick={onCreate} className="salus-btn" style={styles.tasksCreateBtn}>
            <Plus size={16} /> Log feedback
          </button>
        </div>
      )}
    </section>
  );
}

function FeedbackCard({ item, data, onOpen }) {
  const logger = data.users.find(u => u.id === item.loggedBy);
  const sentColor = item.sentiment === 'complaint' ? '#c8442a' : item.sentiment === 'positive' ? '#5c8a5a' : '#7a8270';
  const sentDot = item.sentiment === 'complaint' ? '⚠' : item.sentiment === 'positive' ? '✓' : '·';
  return (
    <button onClick={onOpen} className="salus-btn" style={styles.taskCard}>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.taskCardTitle}>
          <span style={{ color: sentColor, marginRight: 4 }}>{sentDot}</span>
          {item.feedback.length > 80 ? item.feedback.slice(0, 80) + '…' : item.feedback}
        </div>
        <div style={styles.taskCardMeta}>
          {item.memberName && <span>{item.memberName}</span>}
          {item.context && <span>· {item.context}</span>}
          <span>· heard by {logger?.name?.split(' ')[0] || 'someone'}</span>
        </div>
      </div>
      <ChevronRight size={16} color="#a59478" />
    </button>
  );
}

function CreateFeedbackModal({ onClose, onCreate }) {
  const [memberName, setMemberName] = useState('');
  const [context, setContext] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim() || saving) return;
    setSaving(true);
    const ok = await onCreate({ memberName, context, feedback, sentiment });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Log feedback</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <label style={styles.label}>What did they say?</label>
          <textarea className="salus-input" value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. The heating in reformer was off again"
            rows={3} autoFocus
            style={{ width: '100%', resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
          />
          <label style={styles.label}>Type</label>
          <div style={styles.audienceRow}>
            <button onClick={() => setSentiment('positive')} className="salus-btn"
              style={{ ...styles.audiencePill, ...(sentiment === 'positive' ? { background: '#5c8a5a', color: '#fff', borderColor: '#5c8a5a' } : {}) }}>
              Positive
            </button>
            <button onClick={() => setSentiment('neutral')} className="salus-btn"
              style={{ ...styles.audiencePill, ...(sentiment === 'neutral' ? styles.audiencePillActive : {}) }}>
              Neutral
            </button>
            <button onClick={() => setSentiment('complaint')} className="salus-btn"
              style={{ ...styles.audiencePill, ...(sentiment === 'complaint' ? { background: '#c8442a', color: '#fff', borderColor: '#c8442a' } : {}) }}>
              Complaint
            </button>
          </div>
          <label style={styles.label}>Member name (optional)</label>
          <input className="salus-input" type="text" value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="e.g. Sarah K"
            style={{ width: '100%', marginBottom: 14 }}
          />
          <label style={styles.label}>Class / context (optional)</label>
          <input className="salus-input" type="text" value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. Sun 10am Hyrox"
            style={{ width: '100%', marginBottom: 14 }}
          />
        </div>
        <div style={styles.threadActionBar}>
          <button onClick={handleSubmit} disabled={!feedback.trim() || saving}
            className="salus-btn"
            style={{ ...styles.threadClaimBtn, ...((!feedback.trim() || saving) ? styles.threadClaimBtnDisabled : {}) }}>
            {saving ? 'Logging…' : 'Log feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackDetailModal({ item, data, currentUser, isManager, onClose, onUpdateStatus, onDelete }) {
  const [notes, setNotes] = useState('');
  if (!item) return null;
  const logger = data.users.find(u => u.id === item.loggedBy);
  const resolver = data.users.find(u => u.id === item.addressedBy);

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Member feedback</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={styles.dayDetailHeader}>
          <div style={styles.dayDetailRelative}>
            {item.sentiment === 'complaint' ? 'COMPLAINT' :
             item.sentiment === 'positive' ? 'POSITIVE FEEDBACK' : 'FEEDBACK'}
          </div>
          {item.memberName && <div style={styles.dayDetailMeta}>From {item.memberName}</div>}
          {item.context && <div style={styles.dayDetailMeta}>{item.context}</div>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={styles.taskNotes}>{item.feedback}</div>
          <div style={styles.taskCreatedBy}>
            Heard by {logger?.name || 'someone'} · {new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
          {item.status === 'addressed' && (
            <>
              <div style={styles.taskCompletedBy}>
                ✓ Addressed by {resolver?.name || 'someone'} · {item.addressedAt ? new Date(item.addressedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short' }) : ''}
              </div>
              {item.addressedNotes && <div style={{ ...styles.taskNotes, marginTop: 12 }}>{item.addressedNotes}</div>}
            </>
          )}
          {isManager && item.status === 'new' && (
            <div style={{ marginTop: 20 }}>
              <label style={styles.label}>How was it addressed? (optional)</label>
              <textarea className="salus-input" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What you did, or how you're handling it"
                rows={2}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>
        <div style={styles.threadActionBar}>
          {isManager && item.status === 'new' && (
            <button onClick={() => { onUpdateStatus(item.id, 'addressed', notes); onClose(); }}
              className="salus-btn" style={styles.threadClaimBtn}>
              <Check size={14} /> Mark addressed
            </button>
          )}
          {isManager && (
            <button onClick={() => { if (confirm('Delete this entry?')) { onDelete(item.id); onClose(); } }}
              className="salus-btn" style={{ ...styles.btnGhost, color: '#c8442a' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MY STATS (gamified) — for coaches & FOH on the Me tab
// ──────────────────────────────────────────────────────────────────────────────

function MyStatsCard({ data, currentUser }) {
  // Sessions taught (classes by me, regardless of date — count completed by today)
  const todayIso = toIsoDate(new Date());
  const mine = data.classes.filter(c => c.coachId === currentUser.id);
  const completed = mine.filter(c => c.date < todayIso);
  const upcoming = mine.filter(c => c.date >= todayIso);

  const myShifts = data.shifts.filter(s => s.staffId === currentUser.id);
  const completedShifts = myShifts.filter(s => s.date < todayIso);

  // Earnings (coach rate × completed sessions)
  const RATE = 30;
  const earningsAll = completed.length * RATE;

  // This month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const inMonth = (date, start, end) => {
    const d = new Date(date);
    return d >= start && (!end || d <= end);
  };
  const thisMonthSessions = completed.filter(c => inMonth(c.date, monthStart)).length;
  const lastMonthSessions = completed.filter(c => inMonth(c.date, lastMonthStart, lastMonthEnd)).length;
  const monthDelta = lastMonthSessions === 0 ? null :
    Math.round(((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100);

  // Covers picked up
  const coversClaimedByMe = data.coverRequests.filter(r => r.claimedBy === currentUser.id);

  // Streak: consecutive weeks with at least one class taught
  const weeksWithActivity = new Set();
  completed.forEach(c => {
    const d = new Date(c.date);
    const monday = getMonday(d);
    weeksWithActivity.add(toIsoDate(monday));
  });
  completedShifts.forEach(s => {
    const d = new Date(s.date);
    const monday = getMonday(d);
    weeksWithActivity.add(toIsoDate(monday));
  });
  let streak = 0;
  let cursor = getMonday(new Date());
  while (weeksWithActivity.has(toIsoDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -7);
  }

  // Achievements (badges)
  const totalActivity = completed.length + completedShifts.length;
  const achievements = [
    { id: 'first',     name: 'First class', desc: 'Taught your first session', threshold: 1,   value: totalActivity, icon: '🎯' },
    { id: 'ten',       name: '10 in',       desc: '10 sessions taught',       threshold: 10,  value: totalActivity, icon: '⭐' },
    { id: 'fifty',     name: 'Fifty club',  desc: '50 sessions taught',       threshold: 50,  value: totalActivity, icon: '🏅' },
    { id: 'century',   name: 'Centurion',   desc: '100 sessions taught',      threshold: 100, value: totalActivity, icon: '💯' },
    { id: 'cover5',    name: 'Cover hero',  desc: '5 cover shifts claimed',   threshold: 5,   value: coversClaimedByMe.length, icon: '🦸' },
    { id: 'streak4',   name: '1-month streak',  desc: '4 weeks in a row',     threshold: 4,   value: streak, icon: '🔥' },
    { id: 'streak12',  name: '3-month streak',  desc: '12 weeks in a row',    threshold: 12,  value: streak, icon: '🔥' },
    { id: 'streak26',  name: 'Half-year streak', desc: '26 weeks in a row',   threshold: 26,  value: streak, icon: '🔥' },
  ];

  // Find next milestone
  const locked = achievements.filter(a => a.value < a.threshold);
  const next = locked[0];

  return (
    <div style={styles.statsCard}>
      <div style={styles.statsHeaderRow}>
        <div>
          <div style={styles.statsEyebrow}>This month</div>
          <div style={styles.statsBigNumber}>£{(thisMonthSessions * RATE).toLocaleString()}</div>
          <div style={styles.statsSubLine}>
            {thisMonthSessions} session{thisMonthSessions === 1 ? '' : 's'} taught
            {monthDelta != null && (
              <span style={{ color: monthDelta >= 0 ? '#5c8a5a' : '#c8442a', marginLeft: 6 }}>
                {monthDelta >= 0 ? '↑' : '↓'} {Math.abs(monthDelta)}%
              </span>
            )}
          </div>
        </div>
        <div style={styles.statsStreak}>
          <div style={styles.statsStreakNum}>{streak}</div>
          <div style={styles.statsStreakLabel}>week<br />streak 🔥</div>
        </div>
      </div>

      <div style={styles.statsTilesRow}>
        <div style={styles.statsMiniTile}>
          <div style={styles.statsMiniNum}>{completed.length}</div>
          <div style={styles.statsMiniLabel}>All-time sessions</div>
        </div>
        <div style={styles.statsMiniTile}>
          <div style={styles.statsMiniNum}>£{earningsAll.toLocaleString()}</div>
          <div style={styles.statsMiniLabel}>All-time earnings</div>
        </div>
        <div style={styles.statsMiniTile}>
          <div style={styles.statsMiniNum}>{coversClaimedByMe.length}</div>
          <div style={styles.statsMiniLabel}>Covers claimed</div>
        </div>
      </div>

      {/* Next milestone */}
      {next && (
        <div style={styles.statsNext}>
          <div style={styles.statsNextHeader}>
            <span style={{ fontSize: 18, marginRight: 6 }}>{next.icon}</span>
            <span style={styles.statsNextName}>Next: {next.name}</span>
            <span style={styles.statsNextPct}>{Math.round((next.value / next.threshold) * 100)}%</span>
          </div>
          <div style={styles.statsNextBar}>
            <div style={{
              ...styles.statsNextBarFill,
              width: `${Math.min(100, (next.value / next.threshold) * 100)}%`,
            }} />
          </div>
          <div style={styles.statsNextHint}>
            {next.threshold - next.value} more to unlock
          </div>
        </div>
      )}

      {/* Achievement badges */}
      <div style={styles.statsBadgesLabel}>Achievements</div>
      <div style={styles.statsBadgesGrid}>
        {achievements.map(a => {
          const unlocked = a.value >= a.threshold;
          return (
            <div key={a.id}
              title={`${a.name} · ${a.desc}${unlocked ? '' : ` (${a.value}/${a.threshold})`}`}
              style={{
                ...styles.statsBadge,
                ...(unlocked ? styles.statsBadgeUnlocked : styles.statsBadgeLocked),
              }}
            >
              <div style={{ fontSize: 22, opacity: unlocked ? 1 : 0.3, filter: unlocked ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
              <div style={styles.statsBadgeName}>{a.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FLOWS — coach-driven creative feed
// ──────────────────────────────────────────────────────────────────────────────

const POST_TYPES = {
  flow:     { label: 'Flow',     icon: Sparkles,  color: '#5c4a38' },
  video:    { label: 'Video',    icon: Play,      color: '#c8442a' },
  playlist: { label: 'Playlist', icon: Music,     color: '#5c8a5a' },
  tip:      { label: 'Tip',      icon: Lightbulb, color: '#c6926a' },
};

const REACTIONS = [
  { key: 'love',     emoji: '❤️',  label: 'Love' },
  { key: 'fire',     emoji: '🔥',  label: 'Fire' },
  { key: 'tried',    emoji: '✅',  label: 'Tried it' },
  { key: 'bookmark', emoji: '🔖',  label: 'Save' },
];

const POPULAR_TAGS = ['Reformer', 'Hyrox', 'Mobility', 'Beginner', 'Advanced', 'Music', 'Technique', 'Cooldown'];

function FlowsFeed({ data, currentUser, isManager, onCreate, onOpenPost, onToggleReaction }) {
  const [filterType, setFilterType] = useState('all');
  const posts = filterType === 'all'
    ? data.posts
    : data.posts.filter(p => p.postType === filterType);

  return (
    <div style={styles.flowsContainer}>
      <div style={styles.flowsHero}>
        <div>
          <div style={styles.flowsEyebrow}>Salus Studio</div>
          <div style={styles.flowsTitle}>Flows</div>
          <div style={styles.flowsSubtitle}>Share what works. Try what others love.</div>
        </div>
        <button onClick={onCreate} className="salus-btn" style={styles.flowsCreateBtn}>
          <Plus size={18} />
        </button>
      </div>

      <div style={styles.flowsFilterRow}>
        {[
          { key: 'all',      label: 'All' },
          { key: 'flow',     label: '✨ Flows' },
          { key: 'video',    label: '▶ Videos' },
          { key: 'playlist', label: '♪ Playlists' },
          { key: 'tip',      label: '💡 Tips' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className="salus-btn"
            style={{
              ...styles.flowsFilterPill,
              ...(filterType === f.key ? styles.flowsFilterPillActive : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div style={styles.flowsEmpty}>
          <div style={styles.flowsEmptyIcon}>✨</div>
          <div style={styles.flowsEmptyTitle}>Nothing here yet</div>
          <div style={styles.flowsEmptySub}>
            Be the first to share a flow, a video, or a quick tip with the team.
          </div>
          <button onClick={onCreate} className="salus-btn" style={styles.flowsEmptyBtn}>
            <Plus size={14} /> Post something
          </button>
        </div>
      ) : (
        <div style={styles.flowsList}>
          {posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              data={data}
              currentUser={currentUser}
              onOpen={() => onOpenPost(p.id)}
              onToggleReaction={(rx) => onToggleReaction(p.id, rx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, data, currentUser, onOpen, onToggleReaction }) {
  const author = data.users.find(u => u.id === post.postedBy);
  const typeMeta = POST_TYPES[post.postType] || POST_TYPES.flow;
  const TypeIcon = typeMeta.icon;
  const commentCount = data.postComments.filter(c => c.postId === post.id).length;
  const myReactions = data.postReactions.filter(r => r.postId === post.id && r.userId === currentUser.id).map(r => r.reaction);

  // Reaction counts
  const reactionCounts = {};
  data.postReactions.forEach(r => {
    if (r.postId !== post.id) return;
    reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
  });

  const timeAgo = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={styles.postCard}>
      <div style={styles.postHeader} onClick={onOpen}>
        <UserAvatar user={author} size={36} fontSize={13} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.postAuthor}>{author?.name || 'Someone'}</div>
          <div style={styles.postTime}>
            {timeAgo(post.createdAt)}{post.editedAt ? ' · edited' : ''}
          </div>
        </div>
        <div style={{
          ...styles.postTypeBadge,
          background: typeMeta.color + '15',
          color: typeMeta.color,
        }}>
          <TypeIcon size={11} />
          {typeMeta.label}
        </div>
      </div>

      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={styles.postTitle}>{post.title}</div>
        {post.description && (
          <div style={styles.postDesc}>
            {post.description.length > 180 ? post.description.slice(0, 180) + '…' : post.description}
          </div>
        )}

        {post.videoUrl && (
          <a
            href={post.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={styles.postVideoLink}
          >
            <Play size={14} /> Watch / open
          </a>
        )}

        {post.tags && post.tags.length > 0 && (
          <div style={styles.postTags}>
            {post.tags.map((t, i) => (
              <span key={i} style={styles.postTag}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Reactions */}
      <div style={styles.postReactionsRow}>
        {REACTIONS.map(r => {
          const count = reactionCounts[r.key] || 0;
          const mine = myReactions.includes(r.key);
          return (
            <button
              key={r.key}
              onClick={() => onToggleReaction(r.key)}
              className="salus-btn"
              style={{
                ...styles.postReactionPill,
                ...(mine ? styles.postReactionPillActive : {}),
                ...(count === 0 && !mine ? styles.postReactionPillDim : {}),
              }}
            >
              <span>{r.emoji}</span>
              {count > 0 && <span style={styles.postReactionCount}>{count}</span>}
            </button>
          );
        })}
        <button
          onClick={onOpen}
          className="salus-btn"
          style={styles.postCommentBtn}
        >
          <MessageSquare size={13} />
          {commentCount > 0 && <span style={{ marginLeft: 4 }}>{commentCount}</span>}
        </button>
      </div>
    </div>
  );
}

function CreatePostModal({ data, currentUser, existing, onClose, onCreate, onUpdate }) {
  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [postType, setPostType] = useState(existing?.postType || 'flow');
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(existing?.tags || []);
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const payload = { title, description, postType, videoUrl, tags };
    const ok = isEdit ? await onUpdate(existing.id, payload) : await onCreate(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const addTag = (t) => {
    const clean = t.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTagInput('');
  };

  const removeTag = (t) => setTags(tags.filter(x => x !== t));

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>{isEdit ? 'Edit post' : 'New post'}</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <label style={styles.label}>Type</label>
          <div style={styles.audienceRow}>
            {Object.entries(POST_TYPES).map(([key, meta]) => {
              const Icon = meta.icon;
              const active = postType === key;
              return (
                <button
                  key={key}
                  onClick={() => setPostType(key)}
                  className="salus-btn"
                  style={{
                    ...styles.audiencePill,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    ...(active ? { background: meta.color, color: '#fff', borderColor: meta.color } : {}),
                  }}
                >
                  <Icon size={12} /> {meta.label}
                </button>
              );
            })}
          </div>

          <label style={styles.label}>Title</label>
          <input
            className="salus-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              postType === 'flow'     ? 'e.g. 20-min Reformer Power Flow' :
              postType === 'video'    ? 'e.g. Demo: footwork progressions' :
              postType === 'playlist' ? 'e.g. Sunday slow flow vibes' :
                                         'e.g. Cue I use for hip hinge'
            }
            style={{ width: '100%', marginBottom: 14 }}
            autoFocus
          />

          <label style={styles.label}>
            {postType === 'flow' ? 'The flow' :
             postType === 'tip'  ? 'The tip' :
                                   'Notes (optional)'}
          </label>
          <textarea
            className="salus-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              postType === 'flow' ?
                'Write the structure — warmup, main work, cooldown. Anything that helps another coach pick it up and run it.' :
              postType === 'tip' ?
                'What works, what to watch for, the magic detail.' :
                'Anything you want to add about this.'
            }
            rows={6}
            style={{ width: '100%', resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
          />

          {(postType === 'video' || postType === 'playlist' || postType === 'flow') && (
            <>
              <label style={styles.label}>
                {postType === 'video'    ? 'Video link' :
                 postType === 'playlist' ? 'Playlist link (Spotify, Apple Music)' :
                                            'Video link (optional)'}
              </label>
              <input
                className="salus-input"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
              />
            </>
          )}

          <label style={styles.label}>Tags</label>
          {tags.length > 0 && (
            <div style={{ ...styles.audienceRow, marginBottom: 8 }}>
              {tags.map(t => (
                <button
                  key={t}
                  onClick={() => removeTag(t)}
                  className="salus-btn"
                  style={{ ...styles.audiencePill, ...styles.audiencePillActive, paddingRight: 8 }}
                >
                  #{t} <X size={10} style={{ marginLeft: 4 }} />
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              className="salus-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Type a tag and hit enter"
              style={{ flex: 1, fontFamily: 'inherit' }}
            />
            <button
              onClick={() => addTag(tagInput)}
              className="salus-btn"
              disabled={!tagInput.trim()}
              style={{ ...styles.btnSecondary, padding: '8px 14px' }}
            >
              Add
            </button>
          </div>
          <div style={{ ...styles.audienceRow, marginBottom: 14 }}>
            {POPULAR_TAGS.filter(t => !tags.includes(t)).slice(0, 6).map(t => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className="salus-btn"
                style={{ ...styles.audiencePill, fontSize: 11, opacity: 0.85 }}
              >
                + {t}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.threadActionBar}>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="salus-btn"
            style={{
              ...styles.threadClaimBtn,
              ...((!title.trim() || saving) ? styles.threadClaimBtnDisabled : {}),
            }}
          >
            {saving ? 'Posting…' : (isEdit ? 'Save changes' : 'Post')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, data, currentUser, isManager, onClose, onEdit, onDelete, onToggleReaction, onComment, onDeleteComment }) {
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  if (!post) return null;

  const author = data.users.find(u => u.id === post.postedBy);
  const typeMeta = POST_TYPES[post.postType] || POST_TYPES.flow;
  const TypeIcon = typeMeta.icon;
  const isMine = post.postedBy === currentUser.id;
  const comments = data.postComments.filter(c => c.postId === post.id);
  const myReactions = data.postReactions.filter(r => r.postId === post.id && r.userId === currentUser.id).map(r => r.reaction);

  const reactionCounts = {};
  const reactionUsers = {};
  data.postReactions.forEach(r => {
    if (r.postId !== post.id) return;
    reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
    if (!reactionUsers[r.reaction]) reactionUsers[r.reaction] = [];
    reactionUsers[r.reaction].push(r.userId);
  });

  const handleSendComment = async () => {
    if (!commentText.trim() || saving) return;
    setSaving(true);
    await onComment(post.id, commentText);
    setSaving(false);
    setCommentText('');
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>
            <TypeIcon size={13} style={{ marginRight: 4, verticalAlign: '-2px', color: typeMeta.color }} />
            {typeMeta.label}
          </div>
          <div style={{ width: 36, textAlign: 'right' }}>
            {(isMine || isManager) && (
              <button
                onClick={() => {
                  if (isMine) {
                    onEdit(post.id);
                  } else if (isManager) {
                    if (confirm('Delete this post?')) { onDelete(post.id); onClose(); }
                  }
                }}
                className="salus-btn"
                style={{ background: 'transparent', border: 'none', padding: 4, color: '#7a8270' }}
              >
                <MoreHorizontal size={18} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <UserAvatar user={author} size={36} fontSize={13} />
            <div style={{ flex: 1 }}>
              <div style={styles.postAuthor}>{author?.name || 'Someone'}</div>
              <div style={styles.postTime}>
                {new Date(post.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {post.editedAt && ' · edited'}
              </div>
            </div>
          </div>

          <h2 style={styles.postDetailTitle}>{post.title}</h2>

          {post.description && (
            <div style={styles.postDetailDesc}>{post.description}</div>
          )}

          {post.videoUrl && (
            <a
              href={post.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.postVideoLink, fontSize: 13, padding: '10px 14px', marginTop: 12 }}
            >
              <Play size={15} /> Open link
            </a>
          )}

          {post.tags && post.tags.length > 0 && (
            <div style={{ ...styles.postTags, marginTop: 14 }}>
              {post.tags.map((t, i) => (
                <span key={i} style={styles.postTag}>#{t}</span>
              ))}
            </div>
          )}

          {/* Reactions */}
          <div style={{ ...styles.postReactionsRow, marginTop: 18, paddingTop: 14, borderTop: '1px solid #efe7d2' }}>
            {REACTIONS.map(r => {
              const count = reactionCounts[r.key] || 0;
              const mine = myReactions.includes(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => onToggleReaction(post.id, r.key)}
                  className="salus-btn"
                  style={{
                    ...styles.postReactionPill,
                    ...(mine ? styles.postReactionPillActive : {}),
                  }}
                >
                  <span>{r.emoji}</span>
                  {count > 0 && <span style={styles.postReactionCount}>{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Comments */}
          <div style={{ marginTop: 18 }}>
            <div style={styles.commentsLabel}>{comments.length === 0 ? 'No comments yet' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}</div>
            {comments.map(c => {
              const cu = data.users.find(u => u.id === c.userId);
              return (
                <div key={c.id} style={styles.commentRow}>
                  <UserAvatar user={cu} size={28} fontSize={11} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.commentHeader}>
                      <span style={styles.commentAuthor}>{cu?.name?.split(' ')[0] || 'Someone'}</span>
                      <span style={styles.commentTime}>
                        {new Date(c.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={styles.commentText}>{c.text}</div>
                  </div>
                  {(c.userId === currentUser.id || isManager) && (
                    <button
                      onClick={() => { if (confirm('Delete comment?')) onDeleteComment(c.id); }}
                      className="salus-btn"
                      style={{ background: 'transparent', border: 'none', padding: 4, color: '#a59478' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.threadActionBar}>
          <input
            type="text"
            className="salus-input"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
            placeholder="Add a comment…"
            style={{ flex: 1, fontFamily: 'inherit' }}
          />
          <button
            onClick={handleSendComment}
            disabled={!commentText.trim() || saving}
            className="salus-btn"
            style={{ ...styles.sendBtn, opacity: (!commentText.trim() || saving) ? 0.5 : 1 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STUDIO BOOKINGS — calendar for room hires & internal events
// ──────────────────────────────────────────────────────────────────────────────

const BOOKING_STUDIO_LABELS = {
  reformer: 'Reformer studio',
  hybrid:   'HYBRID studio',
  whole:    'Whole gym',
};

const BOOKING_TYPES = {
  external_event: { label: 'External event',   category: 'External', short: 'EVENT',     color: '#c6926a' },
  coach_1on1:     { label: '1:1 session',      category: 'Coach',    short: '1:1',       color: '#7a8c5c' },
  coach_class:    { label: 'Extra class',      category: 'Coach',    short: 'CLASS',     color: '#5c4a38' },
  coach_event:    { label: 'Workshop / event', category: 'Coach',    short: 'EVENT',     color: '#5c8a5a' },
};

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DOW_FULL   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Generate dates between start and end (inclusive) matching the chosen weekdays
function generateRecurringDates(startIso, endIso, days /* 0=Mon..6=Sun */) {
  const out = [];
  const start = new Date(startIso); start.setHours(12, 0, 0, 0);
  const end = new Date(endIso); end.setHours(12, 0, 0, 0);
  const cur = new Date(start);
  while (cur <= end && out.length < 200) {
    const dow = (cur.getDay() + 6) % 7; // Mon=0
    if (days.includes(dow)) out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function StudioBookingsView({ data, currentUser, isManager, onCreate, onOpenBooking }) {
  const [filter, setFilter] = useState('upcoming');
  const todayIso = toIsoDate(new Date());

  let bookings = [...data.bookings];
  if (filter === 'upcoming') bookings = bookings.filter(b => b.date >= todayIso && b.status !== 'cancelled');
  else if (filter === 'past') bookings = bookings.filter(b => b.date < todayIso);
  else if (filter === 'cancelled') bookings = bookings.filter(b => b.status === 'cancelled');
  bookings.sort((a, b) => {
    if (a.date !== b.date) return filter === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  // Group by date for the upcoming list
  const groups = {};
  bookings.forEach(b => {
    if (!groups[b.date]) groups[b.date] = [];
    groups[b.date].push(b);
  });
  const orderedDates = Object.keys(groups);

  return (
    <div style={styles.bookingsContainer}>
      <div style={styles.bookingsHero}>
        <div>
          <div style={styles.bookingsEyebrow}>Salus House</div>
          <div style={styles.bookingsTitle}>Studio Bookings</div>
          <div style={styles.bookingsSubtitle}>Hires, workshops, and special events.</div>
        </div>
        {isManager && (
          <button onClick={onCreate} className="salus-btn" style={styles.flowsCreateBtn}>
            <Plus size={18} />
          </button>
        )}
        {!isManager && currentUser.isCoach && (
          <button onClick={onCreate} className="salus-btn" style={styles.flowsCreateBtn}>
            <Plus size={18} />
          </button>
        )}
      </div>

      <div style={styles.flowsFilterRow}>
        {[
          { key: 'upcoming',  label: 'Upcoming' },
          { key: 'past',      label: 'Past' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="salus-btn"
            style={{
              ...styles.flowsFilterPill,
              ...(filter === f.key ? styles.flowsFilterPillActive : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div style={styles.flowsEmpty}>
          <div style={styles.flowsEmptyIcon}>📅</div>
          <div style={styles.flowsEmptyTitle}>
            {filter === 'upcoming' ? 'Nothing booked yet' :
             filter === 'past'     ? 'No past bookings' :
                                      'No cancelled bookings'}
          </div>
          <div style={styles.flowsEmptySub}>
            {filter === 'upcoming' && isManager && 'Add a booking with the + button above.'}
            {filter === 'upcoming' && !isManager && 'Bookings will appear here when added.'}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 14px' }}>
          {orderedDates.map(dateIso => {
            const d = new Date(dateIso);
            const isToday = dateIso === todayIso;
            return (
              <div key={dateIso} style={styles.fohDayBlock}>
                <div style={{ ...styles.fohDayHeader, ...(isToday ? styles.fohDayHeaderToday : {}) }}>
                  <span style={styles.fohDayName}>
                    {d.toLocaleDateString('en-GB', { weekday: 'long' })}
                  </span>
                  <span style={styles.fohDayDate}>
                    {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && <span style={styles.fohTodayBadge}>Today</span>}
                </div>
                <div style={styles.fohShiftList}>
                  {groups[dateIso].map(b => (
                    <BookingCard key={b.id} booking={b} onOpen={() => onOpenBooking(b.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, onOpen }) {
  const meta = BOOKING_TYPES[booking.bookingType] || BOOKING_TYPES.external_event;
  const isExternal = booking.bookingType === 'external_event';
  const sub = [
    BOOKING_STUDIO_LABELS[booking.studio] || booking.studio,
    isExternal ? booking.hirerName : null,
    booking.price != null ? `£${booking.price}` : null,
    booking.recurrenceSeriesId ? 'recurring' : null,
  ].filter(Boolean).join(' · ');
  return (
    <button onClick={onOpen} className="salus-btn" style={{
      ...styles.fohShiftCard,
      ...(booking.status === 'cancelled' ? { opacity: 0.5, textDecoration: 'line-through' } : {}),
      ...(booking.status === 'pending' ? { borderStyle: 'dashed' } : {}),
    }}>
      <div style={styles.fohShiftTimes}>
        <span style={{ ...styles.fohShiftLabel, color: meta.color }}>
          {meta.short}
        </span>
        <span style={styles.fohShiftHours}>{booking.startTime} – {booking.endTime}</span>
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2620' }}>{booking.title}</div>
        <div style={{ fontSize: 11, color: '#7a8270', marginTop: 2 }}>{sub}</div>
      </div>
      <ChevronRight size={16} color="#a59478" />
    </button>
  );
}

function CreateBookingModal({ existing, currentUser, isManager, onClose, onCreate, onUpdate }) {
  const isEdit = !!existing;
  const [bookingType, setBookingType] = useState(existing?.bookingType || (isManager ? 'external_event' : 'coach_1on1'));
  const [title, setTitle] = useState(existing?.title || '');
  const [hirerName, setHirerName] = useState(existing?.hirerName || '');
  const [hirerContact, setHirerContact] = useState(existing?.hirerContact || '');
  const [price, setPrice] = useState(existing?.price ?? '');
  const [studio, setStudio] = useState(existing?.studio || 'whole');
  const [date, setDate] = useState(existing?.date || toIsoDate(new Date()));
  const [startTime, setStartTime] = useState(existing?.startTime || '09:00');
  const [endTime, setEndTime] = useState(existing?.endTime || '10:00');
  const [status, setStatus] = useState(existing?.status || 'confirmed');
  const [description, setDescription] = useState(existing?.description || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  // Recurring (only available on new bookings, not when editing)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recDays, setRecDays] = useState([]);
  const [recEndDate, setRecEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return toIsoDate(d);
  });
  const [saving, setSaving] = useState(false);

  const meta = BOOKING_TYPES[bookingType];
  const isExternal = bookingType === 'external_event';
  const is1on1 = bookingType === 'coach_1on1';

  const toggleDay = (idx) => {
    setRecDays(d => d.includes(idx) ? d.filter(x => x !== idx) : [...d, idx].sort());
  };

  const handleSubmit = async () => {
    if (!title.trim() || !date || !startTime || !endTime || saving) return;
    if (isRecurring && !isEdit && recDays.length === 0) return;
    setSaving(true);
    const payload = {
      title, bookingType,
      hirerName, hirerContact,
      price: price || null,
      studio, date, startTime, endTime, status, description, notes,
      ...(isRecurring && !isEdit ? {
        recurrencePattern: 'weekly',
        recurrenceDays: recDays,
        recurrenceEndDate: recEndDate,
      } : {}),
    };
    const ok = isEdit ? await onUpdate(existing.id, payload) : await onCreate(payload);
    setSaving(false);
    if (ok) onClose();
  };

  // Which booking types can the current user create?
  const availableTypes = isManager
    ? ['external_event', 'coach_1on1', 'coach_class', 'coach_event']
    : ['coach_1on1', 'coach_class', 'coach_event'];

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>{isEdit ? 'Edit booking' : 'New booking'}</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!isEdit && (
            <>
              <label style={styles.label}>Type</label>
              {isManager && (
                <>
                  <div style={styles.bookingTypeCategoryLabel}>External</div>
                  <div style={{ ...styles.audienceRow, marginBottom: 8 }}>
                    <button onClick={() => setBookingType('external_event')} className="salus-btn"
                      style={{
                        ...styles.audiencePill,
                        ...(bookingType === 'external_event'
                          ? { background: BOOKING_TYPES.external_event.color, color: '#fff', borderColor: BOOKING_TYPES.external_event.color }
                          : {}),
                      }}>
                      🏷️ Paid hire / event
                    </button>
                  </div>
                </>
              )}
              <div style={styles.bookingTypeCategoryLabel}>Coach</div>
              <div style={{ ...styles.audienceRow, marginBottom: 14 }}>
                <button onClick={() => setBookingType('coach_1on1')} className="salus-btn"
                  style={{
                    ...styles.audiencePill,
                    ...(bookingType === 'coach_1on1'
                      ? { background: BOOKING_TYPES.coach_1on1.color, color: '#fff', borderColor: BOOKING_TYPES.coach_1on1.color }
                      : {}),
                  }}>
                  🤝 1:1 session
                </button>
                <button onClick={() => setBookingType('coach_class')} className="salus-btn"
                  style={{
                    ...styles.audiencePill,
                    ...(bookingType === 'coach_class'
                      ? { background: BOOKING_TYPES.coach_class.color, color: '#fff', borderColor: BOOKING_TYPES.coach_class.color }
                      : {}),
                  }}>
                  📅 Extra class
                </button>
                <button onClick={() => setBookingType('coach_event')} className="salus-btn"
                  style={{
                    ...styles.audiencePill,
                    ...(bookingType === 'coach_event'
                      ? { background: BOOKING_TYPES.coach_event.color, color: '#fff', borderColor: BOOKING_TYPES.coach_event.color }
                      : {}),
                  }}>
                  🎉 Workshop / event
                </button>
              </div>
            </>
          )}

          <label style={styles.label}>Title</label>
          <input className="salus-input" type="text" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isExternal ? 'e.g. Yoga retreat — Olivia G' :
              is1on1     ? 'e.g. 1:1 with John Smith' :
              bookingType === 'coach_class' ? 'e.g. Pop-up Reformer Sunday' :
                            'e.g. Mobility workshop'
            }
            style={{ width: '100%', marginBottom: 14 }} autoFocus
          />

          <label style={styles.label}>{isRecurring ? 'First date' : 'Date'}</label>
          <input className="salus-input" type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Start</label>
              <input className="salus-input" type="time" value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>End</label>
              <input className="salus-input" type="time" value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <label style={styles.label}>Studio</label>
          <div style={styles.audienceRow}>
            {Object.entries(BOOKING_STUDIO_LABELS).map(([key, label]) => (
              <button key={key}
                onClick={() => setStudio(key)}
                className="salus-btn"
                style={{ ...styles.audiencePill, ...(studio === key ? styles.audiencePillActive : {}) }}>
                {label}
              </button>
            ))}
          </div>

          {isExternal && (
            <>
              <label style={styles.label}>Hirer name</label>
              <input className="salus-input" type="text" value={hirerName}
                onChange={(e) => setHirerName(e.target.value)}
                placeholder="Person or company"
                style={{ width: '100%', marginBottom: 14 }}
              />
              <label style={styles.label}>Hirer contact (optional)</label>
              <input className="salus-input" type="text" value={hirerContact}
                onChange={(e) => setHirerContact(e.target.value)}
                placeholder="Phone or email"
                style={{ width: '100%', marginBottom: 14 }}
              />
              <label style={styles.label}>Price (£)</label>
              <input className="salus-input" type="number" min="0" step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
              />
            </>
          )}

          {is1on1 && (
            <>
              <label style={styles.label}>Client name (optional)</label>
              <input className="salus-input" type="text" value={hirerName}
                onChange={(e) => setHirerName(e.target.value)}
                placeholder="e.g. John Smith"
                style={{ width: '100%', marginBottom: 14 }}
              />
            </>
          )}

          <label style={styles.label}>Status</label>
          <div style={styles.audienceRow}>
            {[
              { key: 'pending',   label: 'Pending' },
              { key: 'confirmed', label: 'Confirmed' },
              { key: 'cancelled', label: 'Cancelled' },
            ].map(s => (
              <button key={s.key}
                onClick={() => setStatus(s.key)}
                className="salus-btn"
                style={{ ...styles.audiencePill, ...(status === s.key ? styles.audiencePillActive : {}) }}>
                {s.label}
              </button>
            ))}
          </div>

          {!isEdit && (
            <>
              <label style={styles.label}>Repeat?</label>
              <div style={{ ...styles.audienceRow, marginBottom: 8 }}>
                <button onClick={() => setIsRecurring(false)} className="salus-btn"
                  style={{ ...styles.audiencePill, ...(!isRecurring ? styles.audiencePillActive : {}) }}>
                  One-off
                </button>
                <button onClick={() => setIsRecurring(true)} className="salus-btn"
                  style={{ ...styles.audiencePill, ...(isRecurring ? styles.audiencePillActive : {}) }}>
                  Weekly
                </button>
              </div>
              {isRecurring && (
                <div style={{
                  background: '#fef7e8', border: '1px solid #efe7d2',
                  borderRadius: 8, padding: 12, marginBottom: 14,
                }}>
                  <label style={{ ...styles.label, marginTop: 0 }}>Which days?</label>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    {DOW_LABELS.map((d, i) => (
                      <button key={i}
                        onClick={() => toggleDay(i)}
                        className="salus-btn"
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8,
                          background: recDays.includes(i) ? '#5c4a38' : '#fffdf7',
                          color: recDays.includes(i) ? '#fff' : '#5c4a38',
                          border: '1px solid ' + (recDays.includes(i) ? '#5c4a38' : '#ebe3cf'),
                          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <label style={{ ...styles.label, marginTop: 0 }}>Until</label>
                  <input className="salus-input" type="date" value={recEndDate}
                    onChange={(e) => setRecEndDate(e.target.value)}
                    style={{ width: '100%', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: 11, color: '#7a8270', marginTop: 8, lineHeight: 1.4 }}>
                    Will create one booking per chosen weekday between {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} and {new Date(recEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.
                  </div>
                </div>
              )}
            </>
          )}

          <label style={styles.label}>Notes (optional)</label>
          <textarea className="salus-input" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else…"
            rows={3}
            style={{ width: '100%', resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
          />
        </div>
        <div style={styles.threadActionBar}>
          <button onClick={handleSubmit}
            disabled={!title.trim() || saving || (isRecurring && !isEdit && recDays.length === 0)}
            className="salus-btn"
            style={{
              ...styles.threadClaimBtn,
              ...((!title.trim() || saving || (isRecurring && !isEdit && recDays.length === 0)) ? styles.threadClaimBtnDisabled : {}),
            }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : (isRecurring ? 'Create series' : 'Add booking'))}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingDetailModal({ booking, currentUser, isManager, onClose, onEdit, onDelete, onDeleteSeries }) {
  if (!booking) return null;
  const meta = BOOKING_TYPES[booking.bookingType] || BOOKING_TYPES.external_event;
  const isExternal = booking.bookingType === 'external_event';
  const isMine = booking.createdBy === currentUser.id;
  const canEdit = isManager || isMine;
  const d = new Date(booking.date);
  const inSeries = !!booking.recurrenceSeriesId;

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Booking</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={styles.dayDetailHeader}>
          <div style={{ ...styles.dayDetailRelative, color: meta.color, fontWeight: 700 }}>
            {meta.label.toUpperCase()}
            {booking.status === 'pending' && ' · PENDING'}
            {booking.status === 'cancelled' && ' · CANCELLED'}
            {inSeries && ' · RECURRING'}
          </div>
          <div style={styles.dayDetailTitle}>{booking.title}</div>
          <div style={styles.dayDetailMeta}>
            {d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={styles.dayDetailMeta}>
            {booking.startTime} – {booking.endTime} · {BOOKING_STUDIO_LABELS[booking.studio]}
          </div>
          <a
            href={googleCalendarUrl({
              title: `${booking.title} — Salus House`,
              dateIso: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              description: [booking.notes, booking.hirerName ? `Hirer: ${booking.hirerName}` : null].filter(Boolean).join('\n\n'),
              location: 'Salus House, Sidcup',
            })}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.gcalLink}
          >
            📅 Add to Google Calendar
          </a>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {(isExternal || booking.bookingType === 'coach_1on1') && booking.hirerName && (
            <div style={{ marginBottom: 14 }}>
              <div style={styles.label}>{isExternal ? 'Hirer' : 'Client'}</div>
              <div style={{ fontSize: 14, color: '#1a2620' }}>{booking.hirerName}</div>
              {booking.hirerContact && (
                <div style={{ fontSize: 12, color: '#7a8270', marginTop: 2 }}>{booking.hirerContact}</div>
              )}
            </div>
          )}
          {booking.price != null && (
            <div style={{ marginBottom: 14 }}>
              <div style={styles.label}>Price</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#5c4a38' }}>£{booking.price}</div>
            </div>
          )}
          {booking.notes && (
            <div style={{ marginBottom: 14 }}>
              <div style={styles.label}>Notes</div>
              <div style={styles.taskNotes}>{booking.notes}</div>
            </div>
          )}
        </div>
        {canEdit && (
          <div style={styles.threadActionBar}>
            <button onClick={() => onEdit(booking.id)} className="salus-btn" style={styles.btnSecondary}>
              Edit this one
            </button>
            <button onClick={() => { if (confirm('Delete this booking?')) { onDelete(booking.id); onClose(); } }}
              className="salus-btn" style={{ ...styles.btnGhost, color: '#c8442a' }}>
              <Trash2 size={14} /> Delete
            </button>
            {inSeries && (
              <button onClick={() => {
                if (confirm('Delete the ENTIRE recurring series? This removes all past and future bookings in this series.')) {
                  onDeleteSeries(booking.recurrenceSeriesId);
                  onClose();
                }
              }}
                className="salus-btn"
                style={{ ...styles.btnGhost, color: '#c8442a', flex: 1 }}>
                Delete whole series
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DIRECT MESSAGES — 1-to-1 thread with another team member
// ──────────────────────────────────────────────────────────────────────────────

function DmThreadModal({ otherUser, data, currentUser, onClose, onSend, onMarkRead }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Get all messages between currentUser and otherUser
  const thread = data.dms.filter(m =>
    (m.senderId === currentUser.id && m.recipientId === otherUser.id) ||
    (m.senderId === otherUser.id && m.recipientId === currentUser.id)
  ).sort((a, b) => a.createdAt - b.createdAt);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length]);

  // Mark unread DMs as read when opening
  useEffect(() => {
    const hasUnread = thread.some(m => m.senderId === otherUser.id && m.readAt == null);
    if (hasUnread) onMarkRead(otherUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUser.id]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await onSend(otherUser.id, text);
    setText('');
    setSending(false);
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={{ ...styles.threadHeaderTitle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UserAvatar user={otherUser} size={26} fontSize={10} />
            {otherUser.name}
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#f5f1e8' }}>
          {thread.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#7a8270', fontSize: 13 }}>
              No messages yet. Start the conversation 👋
            </div>
          ) : (
            thread.map(msg => {
              const mine = msg.senderId === currentUser.id;
              return (
                <div key={msg.id} style={{
                  display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: '78%',
                    padding: '8px 12px',
                    borderRadius: 14,
                    background: mine ? '#5c4a38' : '#fffdf7',
                    color: mine ? '#fff' : '#1a2620',
                    border: mine ? 'none' : '1px solid #efe7d2',
                    fontSize: 13, lineHeight: 1.4,
                    boxShadow: '0 1px 2px rgba(60,40,20,0.05)',
                  }}>
                    <div>{msg.text}</div>
                    <div style={{ fontSize: 9, opacity: 0.65, marginTop: 4 }}>
                      {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderTop: '1px solid #ebe3cf', background: '#fffdf7' }}>
          <input
            type="text"
            className="salus-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Message ${otherUser.name.split(' ')[0]}…`}
            style={{ flex: 1, fontFamily: 'inherit' }}
          />
          <button onClick={handleSend} disabled={!text.trim() || sending} className="salus-btn"
            style={{ ...styles.sendBtn, opacity: (!text.trim() || sending) ? 0.5 : 1 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS DRAWER
// ──────────────────────────────────────────────────────────────────────────────

function NotificationsDrawer({ data, currentUser, isManager, onClose, onGoTo, onOpenDm }) {
  // Build a list of notification items, newest first
  const items = [];
  const todayIso = toIsoDate(new Date());

  // Cover requests still needing cover
  data.coverRequests
    .filter(r => r.requestedBy !== currentUser.id && (r.status === 'pending' || r.status === 'open'))
    .forEach(r => {
      const cls = data.classes.find(c => c.id === r.classId);
      if (!cls) return;
      const coach = data.users.find(u => u.id === r.requestedBy);
      items.push({
        kind: 'cover',
        ts: r.timestamp || r.createdAt || 0,
        icon: <AlertCircle size={16} color="#c8442a" />,
        title: 'Cover needed',
        body: `${coach?.name?.split(' ')[0] || 'Someone'} · ${cls.type} ${cls.time}`,
        onTap: () => { onGoTo('home'); onClose(); },
      });
    });

  // Tasks assigned to me (or audience matches)
  data.tasks
    .filter(t => t.status !== 'done' && !t.isTemplate)
    .filter(t =>
      (t.audience === 'specific' && t.assigneeId === currentUser.id) ||
      (t.audience === 'all_foh'  && currentUser.isFoh) ||
      (t.audience === 'all_coach'&& currentUser.isCoach) ||
      (t.audience === 'all_staff')
    )
    .forEach(t => {
      items.push({
        kind: 'task',
        ts: t.createdAt,
        icon: <Check size={16} color={t.priority === 'urgent' ? '#c8442a' : '#5c4a38'} />,
        title: t.priority === 'urgent' ? 'Urgent task' : 'Task',
        body: t.title,
        onTap: () => { onGoTo('home'); onClose(); },
      });
    });

  // Unread DMs
  const dmsByOther = {};
  data.dms.filter(m => m.recipientId === currentUser.id && m.readAt == null).forEach(m => {
    if (!dmsByOther[m.senderId]) dmsByOther[m.senderId] = { ts: 0, count: 0, last: '' };
    dmsByOther[m.senderId].count++;
    if (m.createdAt > dmsByOther[m.senderId].ts) {
      dmsByOther[m.senderId].ts = m.createdAt;
      dmsByOther[m.senderId].last = m.text;
    }
  });
  Object.entries(dmsByOther).forEach(([userId, info]) => {
    const u = data.users.find(x => x.id === userId);
    if (!u) return;
    items.push({
      kind: 'dm',
      ts: info.ts,
      icon: <MessageSquare size={16} color="#5c4a38" />,
      title: `${u.name.split(' ')[0]} messaged you`,
      body: info.last.length > 60 ? info.last.slice(0, 60) + '…' : info.last,
      onTap: () => { onClose(); onOpenDm(u.id); },
    });
  });

  // Urgent broadcasts (recent)
  data.messages
    .filter(m => m.isUrgent && m.userId !== currentUser.id)
    .slice(-3)
    .forEach(m => {
      const u = data.users.find(x => x.id === m.userId);
      items.push({
        kind: 'urgent',
        ts: m.timestamp,
        icon: <AlertOctagon size={16} color="#c8442a" />,
        title: `Urgent from ${u?.name?.split(' ')[0] || 'Someone'}`,
        body: m.text,
        onTap: () => { onGoTo('chat'); onClose(); },
      });
    });

  // Maintenance (managers only)
  if (isManager) {
    data.maintenance.filter(m => m.status === 'reported').forEach(m => {
      items.push({
        kind: 'maint',
        ts: m.createdAt,
        icon: <AlertCircle size={16} color="#c6926a" />,
        title: 'Maintenance reported',
        body: m.title,
        onTap: () => { onGoTo('home'); onClose(); },
      });
    });
    data.feedback.filter(f => f.status === 'new').forEach(f => {
      items.push({
        kind: 'fb',
        ts: f.createdAt,
        icon: <MessageSquare size={16} color="#7a8c5c" />,
        title: 'New member feedback',
        body: f.feedback.length > 60 ? f.feedback.slice(0, 60) + '…' : f.feedback,
        onTap: () => { onGoTo('home'); onClose(); },
      });
    });
  }

  items.sort((a, b) => b.ts - a.ts);

  const timeAgo = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  };

  return (
    <div style={styles.notifsBackdrop} onClick={onClose}>
      <div style={styles.notifsDrawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.notifsHeader}>
          <div style={styles.notifsTitle}>Notifications</div>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
        </div>
        {items.length === 0 ? (
          <div style={styles.notifsEmpty}>
            <div style={{ fontSize: 32 }}>🌿</div>
            <div style={{ fontSize: 14, color: '#5c4a38', marginTop: 8 }}>All caught up</div>
            <div style={{ fontSize: 11, color: '#7a8270', marginTop: 4 }}>Nothing needs your attention right now.</div>
          </div>
        ) : (
          <div style={styles.notifsList}>
            {items.map((item, i) => (
              <button key={i} onClick={item.onTap} className="salus-btn" style={styles.notifRow}>
                <div style={styles.notifIcon}>{item.icon}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={styles.notifTitle}>{item.title}</div>
                  <div style={styles.notifBody}>{item.body}</div>
                </div>
                <div style={styles.notifTime}>{timeAgo(item.ts)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ error, onLogin, onSignup, onClearError }) {
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const canSubmit = email.trim().length > 3
    && password.length >= 6
    && accepted
    && !submitting
    && (mode === 'signin' || fullName.trim().length > 0);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSubmitting(true);
    setSuccessMsg(null);
    try {
      if (mode === 'signin') {
        await onLogin(email, password);
      } else {
        const ok = await onSignup(email, password, fullName);
        if (ok) {
          setSuccessMsg("Account created! You're signed in.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    onClearError?.();
    setSuccessMsg(null);
  };

  return (
    <div style={styles.loginWrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Geist:wght@300;400;500;600;700&display=swap');
        body { margin: 0; background: #f5f1e8; }
      `}</style>

      <form onSubmit={handleSubmit} style={styles.loginCard}>
        <div style={styles.loginLogo}>
          <div style={styles.loginLogoMark}>
            <img src="https://cdn.prod.website-files.com/66803175747777a7dd2956e8/668c04b49ff0954ea73d39ef_download-compresskaru.com.png" alt="Salus" style={styles.loginLogoMarkImg} />
          </div>
        </div>

        <h1 style={styles.loginTitle}>Salus Staff</h1>
        <p style={styles.loginSub}>
          {mode === 'signin'
            ? "Sign in to access your team's timetable, cover board, and chat."
            : "Create your account — your manager will assign your role once you're in."}
        </p>

        {/* Mode toggle */}
        <div style={styles.modeToggle}>
          <button
            type="button"
            onClick={() => switchMode('signin')}
            style={{ ...styles.modeToggleBtn, ...(mode === 'signin' ? styles.modeToggleBtnActive : {}) }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            style={{ ...styles.modeToggleBtn, ...(mode === 'signup' ? styles.modeToggleBtnActive : {}) }}
          >
            Sign up
          </button>
        </div>

        {mode === 'signup' && (
          <div style={styles.loginField}>
            <label style={styles.label}>Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); if (error) onClearError(); }}
              placeholder="e.g. Tilly Ould"
              className="salus-input"
              style={styles.loginInput}
              autoComplete="name"
            />
          </div>
        )}

        <div style={styles.loginField}>
          <label style={styles.label}>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) onClearError(); }}
            placeholder="you@salus.house"
            className="salus-input"
            style={styles.loginInput}
            autoFocus={mode === 'signin'}
            autoComplete="email"
          />
        </div>

        <div style={styles.loginField}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) onClearError(); }}
            placeholder={mode === 'signin' ? 'Your password' : 'At least 6 characters'}
            className="salus-input"
            style={styles.loginInput}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && (
          <div style={styles.loginError}>{error}</div>
        )}
        {successMsg && (
          <div style={{ ...styles.loginError, background: '#e8ede0', borderColor: '#c2d0a8', color: '#4a6b3a' }}>{successMsg}</div>
        )}

        <div
          style={styles.termsRow}
          onClick={() => setAccepted(!accepted)}
          role="button"
        >
          <div style={{ ...styles.checkbox, ...(accepted ? styles.checkboxActive : {}) }}>
            {accepted && <Check size={12} strokeWidth={3} />}
          </div>
          <span>
            I agree to the{' '}
            <span style={styles.termsLink} onClick={(e) => { e.stopPropagation(); setTermsOpen(true); }}>
              Terms &amp; Conditions
            </span>
            {' '}and consent to receiving operational emails about cover requests and my classes.
          </span>
        </div>

        <button
          type="submit"
          className="salus-btn"
          style={{ ...styles.loginBtn, ...(!canSubmit ? styles.loginBtnDisabled : {}) }}
          disabled={!canSubmit}
        >
          {submitting
            ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
            : (mode === 'signin' ? 'Sign in' : 'Create account')}
        </button>

        <div style={styles.loginFoot}>
          {mode === 'signin'
            ? <>Don't have an account yet? <span style={styles.termsLink} onClick={() => switchMode('signup')}>Sign up</span></>
            : <>Already have an account? <span style={styles.termsLink} onClick={() => switchMode('signin')}>Sign in</span></>}
        </div>
      </form>

      {termsOpen && (
        <Modal onClose={() => setTermsOpen(false)}>
          <div style={{ padding: 28 }}>
            <div style={styles.modalDayBadge}>Salus Staff</div>
            <h2 style={{ ...styles.h2, marginTop: 6, marginBottom: 16 }}>Terms &amp; Conditions</h2>
            <div style={{ fontSize: 13, color: '#5a6258', lineHeight: 1.6 }}>
              <p><strong>1. Purpose.</strong> Salus Staff is provided by Salus House as an internal tool for coaches and managers to coordinate the studio timetable, cover requests, and team communications.</p>
              <p><strong>2. Account use.</strong> Your account is for your personal professional use only. Don't share login details with anyone else, including other team members.</p>
              <p><strong>3. Emails.</strong> By signing in you consent to receive operational emails about your classes, cover requests, schedule changes, and team announcements at the address you signed in with. You can adjust which emails you receive in Settings at any time.</p>
              <p><strong>4. Conduct in team chat.</strong> Keep team chat professional and respectful. Manager has full visibility of all messages.</p>
              <p><strong>5. Cover &amp; swap conduct.</strong> Cover requests must be made in good faith. Once you've agreed to cover a class, you're responsible for teaching it or finding alternative cover with your manager's approval.</p>
              <p><strong>6. Data.</strong> Salus House holds your name, email, and activity in this app for the purposes of running the studio. Data is not shared with third parties beyond essential service providers (email, hosting).</p>
              <p><strong>7. Termination.</strong> Access to Salus Staff ends when your contracted relationship with Salus House ends.</p>
              <p style={{ fontSize: 12, color: '#a8a895', marginTop: 16 }}>By signing in you confirm you've read and agreed to these terms.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setTermsOpen(false)} className="salus-btn" style={styles.btnPrimary}>Got it</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MONTH VIEW — 3-month overview with cover indicators
// ──────────────────────────────────────────────────────────────────────────────

function MonthView({ classes, coverRequests, currentUser, onDayClick }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const months = [];

  // Build 3 months starting from current month
  for (let m = 0; m < 3; m++) {
    const date = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const monthLabel = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const firstWeekday = (date.getDay() + 6) % 7; // Mon=0..Sun=6
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    const cells = [];
    // Pad start with empty cells
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(date.getFullYear(), date.getMonth(), d);
      const isoDate = toIsoDate(cellDate); // local date, not UTC
      const classesThisDay = classes.filter(c => c.date === isoDate);
      const coverCount = classesThisDay.filter(c => c.status === 'needsCover').length;
      const isToday = cellDate.getTime() === today.getTime();
      const isPast = cellDate < today;
      cells.push({
        day: d, date: cellDate, isoDate,
        classCount: classesThisDay.length,
        coverCount,
        isToday, isPast,
      });
    }

    months.push({ label: monthLabel, cells });
  }

  return (
    <div>
      {/* Legend */}
      <div style={styles.monthLegend}>
        <span style={styles.monthLegendItem}>
          <span style={{ ...styles.monthLegendDot, background: '#5c4a38' }} /> Today
        </span>
        <span style={styles.monthLegendItem}>
          <span style={{ ...styles.monthLegendDot, background: '#c8442a' }} /> Needs cover
        </span>
        <span style={styles.monthLegendItem}>
          <span style={{ ...styles.monthLegendDot, background: '#a59478' }} /> Has classes
        </span>
      </div>

      {months.map((m, idx) => (
        <div key={idx} style={{ marginBottom: 28 }}>
          <h3 style={styles.monthLabel}>{m.label}</h3>
          <div style={styles.monthGridHeader}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} style={styles.monthDayLabel}>{d}</div>
            ))}
          </div>
          <div style={styles.monthGrid}>
            {m.cells.map((cell, i) => {
              if (!cell) return <div key={i} style={styles.monthCellEmpty} />;
              const bg = cell.coverCount > 0
                ? '#fef0ea'
                : cell.isToday
                  ? '#5c4a38'
                  : cell.classCount > 0
                    ? '#fffdf7'
                    : 'transparent';
              const color = cell.isToday ? '#fff' : (cell.isPast ? '#c4bca8' : '#1a2620');
              const border = cell.coverCount > 0 ? '2px solid #c8442a' : '1px solid #ebe3cf';
              return (
                <button
                  key={i}
                  onClick={() => onDayClick(cell.isoDate)}
                  className="salus-btn"
                  style={{
                    ...styles.monthCell,
                    background: bg,
                    color,
                    border,
                    cursor: cell.classCount > 0 ? 'pointer' : 'default',
                  }}
                  disabled={cell.classCount === 0}
                  title={cell.classCount > 0
                    ? `${cell.classCount} class${cell.classCount === 1 ? '' : 'es'}${cell.coverCount > 0 ? ` · ${cell.coverCount} need cover` : ''}`
                    : 'No classes scheduled'}
                >
                  <div style={styles.monthCellDay}>{cell.day}</div>
                  {cell.classCount > 0 && (
                    <div style={{
                      ...styles.monthCellDots,
                      background: cell.coverCount > 0 ? '#c8442a' : (cell.isToday ? '#fff' : '#a59478'),
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HOME — cover-first dashboard, the new app landing screen
// ──────────────────────────────────────────────────────────────────────────────

function Home({ data, currentUser, isManager, onClassClick, onRequestCover, onHireStudio, onClaim, onExpressInterest, onViewAllCover, onViewChat, onCreateTask, onOpenTask, onOpenTour, onCreateMaintenance, onOpenMaintenance, onCreateFeedback, onOpenFeedback }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const todayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayIso = now.toISOString().slice(0, 10);

  const classesToday = data.classes.filter(c => c.date === todayIso);

  // Open cover requests (excluding ones the user posted themselves)
  const openCovers = data.coverRequests
    .filter(r => r.status === 'open' && r.requestedBy !== currentUser.id)
    .map(r => ({ ...r, cls: data.classes.find(c => c.id === r.classId) }))
    .filter(r => r.cls)
    .sort((a, b) => `${a.cls.date} ${a.cls.time}`.localeCompare(`${b.cls.date} ${b.cls.time}`));

  // Manager-only pending queue
  const pendingForManager = isManager
    ? data.coverRequests
        .filter(r => r.status === 'pending')
        .map(r => ({ ...r, cls: data.classes.find(c => c.id === r.classId) }))
        .filter(r => r.cls)
    : [];

  // Upcoming classes — everything within the next 7 days from today
  const oneWeekOutIso = toIsoDate(addDays(now, 7));
  const myUpcoming = data.classes
    .filter(c => c.coachId === currentUser.id && c.date >= todayIso && c.date <= oneWeekOutIso)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const totalCoverAttention = openCovers.length + pendingForManager.length;
  const [coverOpen, setCoverOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);

  // Summary line for collapsed cover tile
  const coverSummary = (() => {
    if (totalCoverAttention === 0) return 'All shifts covered';
    const first = openCovers[0] || pendingForManager[0];
    if (!first?.cls) return `${totalCoverAttention} need attention`;
    const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][first.cls.day];
    return `Next: ${day} ${first.cls.time} · ${first.cls.type}`;
  })();

  // Summary line for collapsed day tile
  const daySummary = (() => {
    if (myUpcoming.length === 0) return 'No upcoming classes';
    const next = myUpcoming[0];
    const isToday = next.date === todayIso;
    const prefix = isToday ? 'Today' : new Date(next.date).toLocaleDateString('en-GB', { weekday: 'short' });
    return `Up next: ${prefix} ${next.time} · ${next.type}`;
  })();

  const firstName = currentUser.name?.split(' ')[0] || 'there';

  return (
    <div style={styles.homeContainer}>
      {/* Greeting */}
      <div style={styles.homeGreeting}>
        <h1 style={styles.homeH1}>{greeting}, {firstName}</h1>
        <p style={styles.homeGreetSub}>{todayStr} · {classesToday.length} {classesToday.length === 1 ? 'class' : 'classes'} today</p>
      </div>

      {/* Cover tile */}
      <HomeTile
        title="Needs cover"
        count={totalCoverAttention}
        summary={coverSummary}
        open={coverOpen}
        onToggle={() => setCoverOpen(o => !o)}
        urgent={totalCoverAttention > 0}
        onViewAll={totalCoverAttention > 0 ? onViewAllCover : null}
      >
        {totalCoverAttention === 0 ? (
          <div style={styles.homeEmptyCover}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5c4a38' }}>All shifts covered</div>
            <div style={{ fontSize: 11, color: '#a59478', marginTop: 2 }}>Nothing on the board right now.</div>
          </div>
        ) : (
          <>
            {openCovers.map((req, idx) => (
              <CoverHomeCard
                key={req.id}
                req={req}
                users={data.users}
                interested={data.users.filter(u => req.interestedCovers?.includes(u.id))}
                urgent={idx === 0}
                onClick={() => onClassClick(req.cls.id)}
                onClaim={() => onClaim(req)}
                currentUser={currentUser}
              />
            ))}
            {pendingForManager.length > 0 && (
              <>
                <div style={{ ...styles.homeSectionTitle, marginTop: 14, marginBottom: 8, color: '#7a8270', paddingLeft: 4 }}>
                  Awaiting your approval
                </div>
                {pendingForManager.map(req => (
                  <CoverHomeCard
                    key={req.id}
                    req={req}
                    users={data.users}
                    interested={[]}
                    pending={true}
                    onClick={() => onClassClick(req.cls.id)}
                    currentUser={currentUser}
                  />
                ))}
              </>
            )}
          </>
        )}
      </HomeTile>

      {/* Your day tile */}
      <HomeTile
        title="Your upcoming classes"
        count={myUpcoming.length}
        summary={daySummary}
        open={dayOpen}
        onToggle={() => setDayOpen(o => !o)}
      >
        {myUpcoming.length === 0 ? (
          <div style={{ ...styles.homeEmptyCover, padding: '18px 14px' }}>
            <div style={{ fontSize: 12, color: '#7a8270' }}>Nothing scheduled.</div>
          </div>
        ) : (
          <div style={styles.homeDayCard}>
            {myUpcoming.map((cls, idx) => {
              const isToday = cls.date === todayIso;
              const dayPrefix = isToday ? '' : new Date(cls.date).toLocaleDateString('en-GB', { weekday: 'short' });
              return (
                <button
                  key={cls.id}
                  onClick={() => onClassClick(cls.id)}
                  className="salus-btn"
                  style={{ ...styles.homeDayRow, ...(idx > 0 ? styles.homeDayRowBorder : {}) }}
                >
                  <div style={styles.homeDayTime}>
                    {dayPrefix && <div style={{ fontSize: 9, color: '#a59478', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>{dayPrefix}</div>}
                    {cls.time}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={styles.homeDayTitle}>{cls.type}</div>
                    <div style={styles.homeDayMeta}>{cls.dur} min · {STUDIOS[cls.studio]?.short}</div>
                  </div>
                  {idx === 0 && isToday && <span style={styles.homeDayTagNow}>Up next</span>}
                </button>
              );
            })}
          </div>
        )}
      </HomeTile>

      {/* Tours (synced from Google Calendar) */}
      <ToursTile
        data={data}
        currentUser={currentUser}
        onOpenTour={onOpenTour}
      />

      {/* Tasks / reminders */}
      <TasksTile
        data={data}
        currentUser={currentUser}
        isManager={isManager}
        onCreate={onCreateTask}
        onOpenTask={onOpenTask}
      />

      {/* Request cover CTA */}
      <button onClick={onRequestCover} style={styles.homeRequestCard} className="salus-btn">
        <div style={styles.homeRequestIcon}><Plus size={18} /></div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={styles.homeRequestTitle}>
            {isManager ? 'Post a shift for cover' : 'I need cover for one of my classes'}
          </div>
          <div style={styles.homeRequestSub}>Your team will see it instantly</div>
        </div>
      </button>

      {/* Hire studio CTA */}
      <button onClick={onHireStudio} style={styles.homeHireCard} className="salus-btn">
        <div style={styles.homeHireIcon}>
          <Calendar size={18} />
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={styles.homeRequestTitle}>Hire a studio</div>
          <div style={styles.homeRequestSub}>For a 1:1 session or private event</div>
        </div>
      </button>
    </div>
  );
}

function HomeTile({ title, count, summary, open, onToggle, urgent, onViewAll, children }) {
  return (
    <div style={styles.tile}>
      <button onClick={onToggle} className="salus-btn" style={styles.tileHeader}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={styles.tileHeaderTitleRow}>
            <span style={styles.tileTitle}>{title}</span>
            {count > 0 && (
              <span style={{
                ...styles.tileCount,
                background: urgent ? '#c8442a' : '#a59478',
              }}>
                {count}
              </span>
            )}
          </div>
          {!open && summary && <div style={styles.tileSummary}>{summary}</div>}
        </div>
        <ChevronRight
          size={18}
          color="#a59478"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {open && (
        <div style={styles.tileBody}>
          {children}
          {onViewAll && (
            <button onClick={onViewAll} className="salus-btn" style={styles.tileViewAll}>
              View all →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CoverHomeCard({ req, users, interested, urgent, pending, onClick, onClaim, currentUser }) {
  const requester = users.find(u => u.id === req.requestedBy);
  const cls = req.cls;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const classDate = new Date(cls.date);
  const daysAway = Math.round((classDate - today) / 86400000);
  const relativeText =
    daysAway === 0 ? 'today' :
    daysAway === 1 ? 'tomorrow' :
    daysAway < 7 ? `${daysAway} days` :
    daysAway < 14 ? '1 week' :
    `${Math.floor(daysAway / 7)} weeks`;
  const isUrgentColor = daysAway <= 1;
  const dayLabel = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][cls.day];

  return (
    <div style={{ ...styles.coverHome, ...(urgent ? styles.coverHomeUrgent : {}) }}>
      <div style={styles.coverHomeTop}>
        <div style={{ ...styles.coverHomeWhen, ...(isUrgentColor ? {} : styles.coverHomeWhenMuted) }}>
          <div style={{ ...styles.coverHomeWhenDay, color: isUrgentColor ? '#c8442a' : '#7a8270' }}>{dayLabel}</div>
          <div style={styles.coverHomeWhenTime}>{cls.time}</div>
          <div style={{ ...styles.coverHomeWhenRel, color: isUrgentColor ? '#c8442a' : '#7a8270' }}>{relativeText}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.coverHomeTitle}>{cls.type}</div>
          <div style={styles.coverHomeCoach}>
            {requester && <UserAvatar user={requester} size={18} fontSize={8} />}
            <span>{requester?.name?.split(' ')[0] || 'Someone'} can't make it</span>
          </div>
          {req.reason && (
            <div style={styles.coverHomeReason}>"{req.reason}"</div>
          )}
        </div>
      </div>

      {interested.length > 0 && (
        <div style={styles.coverHomeInterested}>
          <div style={styles.coverHomeInterestedAvs}>
            {interested.slice(0, 3).map((u, i) => (
              <div key={u.id} style={{ ...styles.coverHomeInterestedAv, marginLeft: i === 0 ? 0 : -6, zIndex: 10 - i }}>
                <UserAvatar user={u} size={20} fontSize={9} />
              </div>
            ))}
          </div>
          <span>{interested.length} interested</span>
        </div>
      )}

      <div style={styles.coverHomeFooter}>
        <button onClick={onClick} className="salus-btn" style={styles.coverHomeViewBtn}>
          View details
        </button>
        {!pending && onClaim && currentUser.coachType === 'permanent' && currentUser.id !== req.requestedBy && (
          <button onClick={onClaim} className="salus-btn" style={styles.coverHomeClaimBtn}>
            Claim shift
          </button>
        )}
        {pending && (
          <span style={styles.coverHomePendingPill}>Pending</span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SCHEDULE VIEW — wraps Timetable (Studio) and FOHSchedule with a manager toggle
// ──────────────────────────────────────────────────────────────────────────────

function ScheduleView({
  data, currentUser, isManager, isMobile, scheduleView, setScheduleView,
  onClassClick, onShiftClick, onAddClass, onDayClick,
}) {
  const fohOnly = currentUser.isFoh && !currentUser.isCoach;
  const studioOnly = currentUser.isCoach && !currentUser.isFoh;
  const canSeeBoth = isManager || (currentUser.isCoach && currentUser.isFoh);

  // Decide which view to render
  const view = fohOnly ? 'foh' :
               studioOnly ? 'studio' :
               scheduleView;

  return (
    <>
      {canSeeBoth && (
        <div style={styles.viewToggleRow}>
          <button
            onClick={() => setScheduleView('studio')}
            className="salus-btn"
            style={{
              ...styles.viewToggleBtn,
              ...(view === 'studio' ? styles.viewToggleBtnActive : {}),
            }}
          >
            Studio
          </button>
          <button
            onClick={() => setScheduleView('foh')}
            className="salus-btn"
            style={{
              ...styles.viewToggleBtn,
              ...(view === 'foh' ? styles.viewToggleBtnActive : {}),
            }}
          >
            Front of House
          </button>
        </div>
      )}

      {view === 'studio' ? (
        <Timetable
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          isMobile={isMobile}
          onClassClick={onClassClick}
          onAddClass={onAddClass}
          onDayClick={onDayClick}
        />
      ) : (
        <FOHSchedule
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          isMobile={isMobile}
          onShiftClick={onShiftClick}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FOH SCHEDULE — week-by-week view of reception shifts
// ──────────────────────────────────────────────────────────────────────────────

function FOHSchedule({ data, currentUser, isManager, isMobile, onShiftClick }) {
  const [viewMode, setViewMode] = useState('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [filter, setFilter] = useState('all');

  const renderCard = (s) => {
    const userById = Object.fromEntries(data.users.map(u => [u.id, u]));
    const staff = s.staffId ? userById[s.staffId] : null;
    return (
      <ScheduleCard
        key={s.id}
        onClick={() => onShiftClick(s.id)}
        timeLeft={s.shiftLabel}
        timeBottom={`${s.startTime}–${s.endTime}`}
        title="FOH shift"
        subtitle={null}
        person={staff}
        needsCover={!staff}
        isMine={s.staffId === currentUser.id}
        isManager={isManager}
      />
    );
  };

  const filterFn = (s) => {
    if (filter === 'mine')       return s.staffId === currentUser.id;
    if (filter === 'needsCover') return !s.staffId;
    return true;
  };

  return (
    <div style={styles.timetable}>
      <SchedulePeriodToggle viewMode={viewMode} setViewMode={setViewMode} />

      {viewMode === 'day' && (
        <DayView
          items={data.shifts.filter(filterFn)}
          allItems={data.shifts}
          dayOffset={dayOffset}
          setDayOffset={setDayOffset}
          getDate={(s) => s.date}
          getTime={(s) => s.startTime}
          isCover={(s) => !s.staffId}
          totalLabel="shifts"
          filter={filter}
          setFilter={setFilter}
          isManager={isManager}
          renderCard={renderCard}
        />
      )}

      {viewMode === 'week' && (
        <WeekViewBody
          items={data.shifts.filter(filterFn)}
          allItems={data.shifts}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          getDate={(s) => s.date}
          getTime={(s) => s.startTime}
          isCover={(s) => !s.staffId}
          totalLabel="shifts"
          filter={filter}
          setFilter={setFilter}
          isManager={isManager}
          renderCard={renderCard}
        />
      )}

      {viewMode === 'month' && (
        <MonthGrid
          items={data.shifts}
          monthOffset={monthOffset}
          setMonthOffset={setMonthOffset}
          getDate={(s) => s.date}
          isCover={(s) => !s.staffId}
          onDayTap={(iso) => {
            const targetDate = new Date(iso);
            const today = new Date(); today.setHours(0,0,0,0);
            const days = Math.round((targetDate - today) / 86400000);
            setDayOffset(days);
            setViewMode('day');
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SHIFT DETAIL MODAL — view/assign a single FOH shift
// ──────────────────────────────────────────────────────────────────────────────

function ShiftDetailModal({ shift, data, currentUser, isManager, onClose, onAssign, onRequestCover, onAddShiftNote, onDeleteShiftNote }) {
  const [pickedStaffId, setPickedStaffId] = useState(shift?.staffId || null);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  if (!shift) return null;

  const fohStaff = data.users
    .filter(u => u.isFoh)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const assignedStaff = shift.staffId ? data.users.find(u => u.id === shift.staffId) : null;
  const isMine = shift.staffId === currentUser.id;
  const dateLabel = new Date(shift.date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Notes for THIS shift
  const myNotes = data.shiftNotes
    .filter(n => n.shiftId === shift.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Notes from the PREVIOUS shift on the same day (to read what's been handed over)
  const sameDayShifts = data.shifts
    .filter(s => s.date === shift.date && s.id !== shift.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const previousShift = sameDayShifts
    .filter(s => s.startTime < shift.startTime)
    .pop();
  const previousNotes = previousShift
    ? data.shiftNotes.filter(n => n.shiftId === previousShift.id).sort((a, b) => a.createdAt - b.createdAt)
    : [];

  const canPostNote = isMine || isManager;

  const handleAssign = async () => {
    setSaving(true);
    await onAssign(shift.id, pickedStaffId || null);
    setSaving(false);
    onClose();
  };

  const handleSendNote = async () => {
    if (!noteText.trim() || postingNote) return;
    setPostingNote(true);
    await onAddShiftNote(shift.id, noteText);
    setNoteText('');
    setPostingNote(false);
  };

  // Google Calendar link — works for the person assigned (or anyone curious)
  const calUrl = googleCalendarUrl({
    title: `FOH ${shift.shiftLabel} shift — Salus House`,
    dateIso: shift.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    description: 'Front of House shift at Salus House.',
    location: 'Salus House, Sidcup',
  });

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>{shift.shiftLabel} shift</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={styles.dayDetailHeader}>
          <div style={styles.dayDetailRelative}>FOH · {dateLabel}</div>
          <div style={styles.dayDetailTitle}>{shift.startTime} – {shift.endTime}</div>
          <div style={styles.dayDetailMeta}>
            {assignedStaff ? `Assigned to ${assignedStaff.name}` : 'Currently unassigned'}
          </div>
          <a href={calUrl} target="_blank" rel="noopener noreferrer" style={styles.gcalLink}>
            📅 Add to Google Calendar
          </a>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {/* Manager — assign UI */}
          {isManager && (
            <>
              <div style={styles.label}>Assign staff</div>
              <button
                onClick={() => setPickedStaffId(null)}
                className="salus-btn"
                style={{ ...styles.transferCoachRow, ...(!pickedStaffId ? styles.transferCoachRowActive : {}) }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ebe3cf', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8270', flexShrink: 0 }}>
                  <X size={14} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, color: '#1a2620' }}>No one (clear)</div>
                </div>
                {!pickedStaffId && <Check size={18} color="#5c4a38" strokeWidth={2.5} />}
              </button>
              {fohStaff.map(s => {
                const picked = pickedStaffId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setPickedStaffId(s.id)}
                    className="salus-btn"
                    style={{ ...styles.transferCoachRow, ...(picked ? styles.transferCoachRowActive : {}) }}
                  >
                    <UserAvatar user={s} size={32} fontSize={11} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, color: '#1a2620' }}>{s.name}</div>
                    </div>
                    {picked && <Check size={18} color="#5c4a38" strokeWidth={2.5} />}
                  </button>
                );
              })}
              <button
                onClick={handleAssign}
                disabled={saving}
                className="salus-btn"
                style={{ ...styles.threadClaimBtn, marginTop: 10, width: '100%', ...(saving ? styles.threadClaimBtnDisabled : {}) }}
              >
                {saving ? 'Saving…' : 'Save assignment'}
              </button>
            </>
          )}

          {/* Non-manager — assigned to me CTA */}
          {!isManager && (
            <p style={{ fontSize: 13, color: '#5c4a38', margin: 0 }}>
              {isMine ? "This is your shift." : (assignedStaff ? `Assigned to ${assignedStaff.name}.` : 'No one is on this shift yet.')}
            </p>
          )}
          {!isManager && isMine && (
            <button
              onClick={() => { onRequestCover(shift.id); onClose(); }}
              className="salus-btn"
              style={{ ...styles.btnPrimary, marginTop: 12, width: '100%' }}
            >
              <AlertCircle size={14} /> Request cover for this shift
            </button>
          )}

          {/* Handover from previous shift (read-only) */}
          {previousNotes.length > 0 && (
            <div style={{ marginTop: 18, padding: 12, background: '#fef7e8', borderRadius: 10, border: '1px solid #efe7d2' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Handover from {previousShift.shiftLabel} shift
              </div>
              {previousNotes.map(n => {
                const u = data.users.find(u => u.id === n.userId);
                return (
                  <div key={n.id} style={styles.shiftNoteCard}>
                    <div style={styles.shiftNoteHead}>
                      <strong style={{ fontSize: 11, color: '#5c4a38' }}>{u?.name?.split(' ')[0] || 'Someone'}</strong>
                      <span style={{ fontSize: 10, color: '#a59478' }}>
                        {new Date(n.createdAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={styles.shiftNoteText}>{n.text}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes for THIS shift — what gets handed over to next shift */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              Handover notes {myNotes.length > 0 && `(${myNotes.length})`}
            </div>
            <div style={{ fontSize: 11, color: '#7a8270', marginBottom: 10, fontStyle: 'italic' }}>
              Anything the next shift should know.
            </div>
            {myNotes.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: '#a59478', fontSize: 12, background: '#fffdf7', borderRadius: 8, border: '1px dashed #ebe3cf' }}>
                No notes yet.
              </div>
            )}
            {myNotes.map(n => {
              const u = data.users.find(u => u.id === n.userId);
              const canDelete = n.userId === currentUser.id || isManager;
              return (
                <div key={n.id} style={styles.shiftNoteCard}>
                  <div style={styles.shiftNoteHead}>
                    <strong style={{ fontSize: 11, color: '#5c4a38' }}>{u?.name?.split(' ')[0] || 'Someone'}</strong>
                    <span style={{ fontSize: 10, color: '#a59478' }}>
                      {new Date(n.createdAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {canDelete && (
                      <button onClick={() => { if (confirm('Delete this note?')) onDeleteShiftNote(n.id); }}
                        className="salus-btn"
                        style={{ background: 'transparent', border: 'none', padding: 2, color: '#a59478', marginLeft: 'auto' }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div style={styles.shiftNoteText}>{n.text}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Composer at bottom — only for the assigned person or manager */}
        {canPostNote && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderTop: '1px solid #ebe3cf', background: '#fffdf7' }}>
            <input
              type="text"
              className="salus-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendNote()}
              placeholder="Note for next shift…"
              style={{ flex: 1, fontFamily: 'inherit' }}
            />
            <button onClick={handleSendNote}
              disabled={!noteText.trim() || postingNote}
              className="salus-btn"
              style={{ ...styles.sendBtn, opacity: (!noteText.trim() || postingNote) ? 0.5 : 1 }}>
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Timetable({ data, currentUser, isManager, isMobile, onClassClick, onAddClass, onDayClick }) {
  const [viewMode, setViewMode] = useState('week');  // 'day' | 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);     // days from today
  const [monthOffset, setMonthOffset] = useState(0); // months from current
  const [filter, setFilter] = useState('all');

  const renderCard = (cls, isMine) => {
    const userById = Object.fromEntries(data.users.map(u => [u.id, u]));
    const coach = cls.coachId ? userById[cls.coachId] : null;
    const needsCover = cls.status === 'needsCover';
    return (
      <ScheduleCard
        key={cls.id}
        onClick={() => onClassClick(cls.id)}
        timeLeft={cls.time}
        timeBottom={`${cls.dur} min`}
        title={cls.type}
        subtitle={STUDIOS[cls.studio]?.short || cls.studio}
        person={coach}
        needsCover={needsCover}
        isMine={cls.coachId === currentUser.id}
        isManager={isManager}
      />
    );
  };

  const filterFn = (cls) => {
    if (filter === 'mine')       return cls.coachId === currentUser.id;
    if (filter === 'needsCover') return cls.status === 'needsCover';
    return true;
  };

  return (
    <div style={styles.timetable}>
      <SchedulePeriodToggle viewMode={viewMode} setViewMode={setViewMode} />

      {viewMode === 'day' && (
        <DayView
          items={data.classes.filter(filterFn)}
          allItems={data.classes}
          dayOffset={dayOffset}
          setDayOffset={setDayOffset}
          getDate={(c) => c.date}
          getTime={(c) => c.time}
          isCover={(c) => c.status === 'needsCover'}
          totalLabel="classes"
          filter={filter}
          setFilter={setFilter}
          isManager={isManager}
          renderCard={renderCard}
        />
      )}

      {viewMode === 'week' && (
        <WeekViewBody
          items={data.classes.filter(filterFn)}
          allItems={data.classes}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          getDate={(c) => c.date}
          getTime={(c) => c.time}
          isCover={(c) => c.status === 'needsCover'}
          totalLabel="classes"
          filter={filter}
          setFilter={setFilter}
          isManager={isManager}
          renderCard={renderCard}
        />
      )}

      {viewMode === 'month' && (
        <MonthGrid
          items={data.classes}
          monthOffset={monthOffset}
          setMonthOffset={setMonthOffset}
          getDate={(c) => c.date}
          isCover={(c) => c.status === 'needsCover'}
          onDayTap={(iso) => {
            // Switch to day view at that day
            const targetDate = new Date(iso);
            const today = new Date(); today.setHours(0,0,0,0);
            const days = Math.round((targetDate - today) / 86400000);
            setDayOffset(days);
            setViewMode('day');
          }}
        />
      )}

      {isManager && (
        <button onClick={onAddClass} className="salus-btn" style={styles.scheduleFab}>
          <Plus size={16} /> Add class
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SHARED SCHEDULE PIECES
// ──────────────────────────────────────────────────────────────────────────────

function SchedulePeriodToggle({ viewMode, setViewMode }) {
  return (
    <div style={styles.periodToggleRow}>
      {[
        { key: 'day',   label: 'Day' },
        { key: 'week',  label: 'Week' },
        { key: 'month', label: 'Month' },
      ].map(opt => (
        <button
          key={opt.key}
          onClick={() => setViewMode(opt.key)}
          className="salus-btn"
          style={{
            ...styles.periodToggleBtn,
            ...(viewMode === opt.key ? styles.periodToggleBtnActive : {}),
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DayView({ items, allItems, dayOffset, setDayOffset, getDate, getTime, isCover, totalLabel, filter, setFilter, isManager, renderCard }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const targetDate = addDays(today, dayOffset);
  const iso = toIsoDate(targetDate);
  const dayItems = items.filter(it => getDate(it) === iso).sort((a, b) => getTime(a).localeCompare(getTime(b)));
  const allDayItems = allItems.filter(it => getDate(it) === iso);
  const coverCount = allDayItems.filter(isCover).length;
  const totalCount = allDayItems.length;

  // Limits: 14 days back, ~3 months ahead
  const canBack = dayOffset > -14;
  const canFwd  = dayOffset < 90;
  const isToday = dayOffset === 0;

  const headerLabel = targetDate.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short',
  });

  return (
    <>
      <div style={styles.weekNav}>
        <button onClick={() => canBack && setDayOffset(d => d - 1)}
          disabled={!canBack} className="salus-btn"
          style={{ ...styles.weekNavBtn, opacity: canBack ? 1 : 0.3 }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={styles.weekNavLabel}>{headerLabel}</div>
          {!isToday && (
            <button onClick={() => setDayOffset(0)} className="salus-btn" style={styles.weekTodayLink}>
              Jump to today
            </button>
          )}
          {isToday && (
            <span style={{ ...styles.fohTodayBadge, marginTop: 2 }}>Today</span>
          )}
        </div>
        <button onClick={() => canFwd && setDayOffset(d => d + 1)}
          disabled={!canFwd} className="salus-btn"
          style={{ ...styles.weekNavBtn, opacity: canFwd ? 1 : 0.3 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <ScheduleStatsRow coverCount={coverCount} totalCount={totalCount} totalLabel={totalLabel} />

      <ScheduleFilterRow filter={filter} setFilter={setFilter} isManager={isManager} />

      <div style={{ padding: '12px 14px 0' }}>
        <div style={styles.fohShiftList}>
          {dayItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#7a8270' }}>
              Nothing on this day.
            </div>
          ) : (
            dayItems.map(item => renderCard(item))
          )}
        </div>
      </div>
    </>
  );
}

function WeekViewBody({ items, allItems, weekOffset, setWeekOffset, getDate, getTime, isCover, totalLabel, filter, setFilter, isManager, renderCard }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentMonday = getMonday(today);
  const weekStart = addDays(currentMonday, weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekIso = weekDates.map(toIsoDate);
  const todayIso = toIsoDate(today);

  const visible = items.filter(it => weekIso.includes(getDate(it)));
  const allWeek = allItems.filter(it => weekIso.includes(getDate(it)));

  const byDay = weekIso.map(iso =>
    visible.filter(it => getDate(it) === iso).sort((a, b) => getTime(a).localeCompare(getTime(b)))
  );

  const totalCover = allWeek.filter(isCover).length;
  const totalCount = allWeek.length;
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <ScheduleWeekNav weekStart={weekStart} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      <ScheduleStatsRow coverCount={totalCover} totalCount={totalCount} totalLabel={totalLabel} />
      <ScheduleFilterRow filter={filter} setFilter={setFilter} isManager={isManager} />

      {weekDates.map((d, dayIdx) => {
        const dayItems = byDay[dayIdx];
        const isToday = toIsoDate(d) === todayIso;
        if (dayItems.length === 0) return null;
        return (
          <div key={dayIdx} style={styles.fohDayBlock}>
            <div style={{ ...styles.fohDayHeader, ...(isToday ? styles.fohDayHeaderToday : {}) }}>
              <span style={styles.fohDayName}>{dayLabels[dayIdx]}</span>
              <span style={styles.fohDayDate}>
                {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              {isToday && <span style={styles.fohTodayBadge}>Today</span>}
            </div>
            <div style={styles.fohShiftList}>
              {dayItems.map(item => renderCard(item))}
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8270' }}>
          {filter === 'needsCover'
            ? '🎉 Nothing needs cover this week.'
            : filter === 'mine'
              ? `You have no ${totalLabel} this week.`
              : `No ${totalLabel} scheduled for this week.`}
        </div>
      )}
    </>
  );
}

function MonthGrid({ items, monthOffset, setMonthOffset, getDate, isCover, onDayTap }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = toIsoDate(today);

  // Compute target month
  const target = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = target.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Build calendar cells: Mon as first day of week
  const firstOfMonth = new Date(target.getFullYear(), target.getMonth(), 1);
  const lastOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  const startDayOfWeek = (firstOfMonth.getDay() + 6) % 7; // 0=Mon..6=Sun
  const daysInMonth = lastOfMonth.getDate();
  const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;

  // Group items by date for quick lookup
  const byDate = {};
  items.forEach(it => {
    const d = getDate(it);
    if (!byDate[d]) byDate[d] = { count: 0, cover: 0 };
    byDate[d].count++;
    if (isCover(it)) byDate[d].cover++;
  });

  const canBack = monthOffset > 0;
  const canFwd = monthOffset < 3;
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null);
    } else {
      const d = new Date(target.getFullYear(), target.getMonth(), dayNum);
      const iso = toIsoDate(d);
      cells.push({ date: d, iso, info: byDate[iso] });
    }
  }

  return (
    <>
      <div style={styles.weekNav}>
        <button onClick={() => canBack && setMonthOffset(m => m - 1)}
          disabled={!canBack} className="salus-btn"
          style={{ ...styles.weekNavBtn, opacity: canBack ? 1 : 0.3 }}>
          <ChevronLeft size={18} />
        </button>
        <div style={styles.weekNavLabel}>{monthLabel}</div>
        <button onClick={() => canFwd && setMonthOffset(m => m + 1)}
          disabled={!canFwd} className="salus-btn"
          style={{ ...styles.weekNavBtn, opacity: canFwd ? 1 : 0.3 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={styles.monthGridDayHeader}>
        {dayLabels.map((lbl, i) => (
          <div key={i} style={styles.monthGridDayLabel}>{lbl}</div>
        ))}
      </div>

      <div style={styles.monthGrid}>
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={i} style={styles.monthGridEmpty} />;
          }
          const isToday = cell.iso === todayIso;
          const info = cell.info;
          return (
            <button
              key={i}
              onClick={() => onDayTap(cell.iso)}
              className="salus-btn"
              style={{
                ...styles.monthGridCell,
                ...(isToday ? styles.monthGridCellToday : {}),
                ...(info?.cover > 0 ? styles.monthGridCellCover : {}),
              }}
            >
              <span style={{
                ...styles.monthGridCellDate,
                ...(isToday ? { color: '#fff', fontWeight: 700 } : {}),
              }}>
                {cell.date.getDate()}
              </span>
              {info && (
                <div style={styles.monthGridDots}>
                  {info.cover > 0 && (
                    <span style={{ ...styles.monthGridDot, background: '#c8442a' }} />
                  )}
                  {info.count > info.cover && (
                    <span style={{ ...styles.monthGridDot, background: isToday ? '#fff' : '#5c4a38' }} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={styles.monthGridLegend}>
        <div style={styles.monthGridLegendItem}>
          <span style={{ ...styles.monthGridDot, background: '#c8442a' }} />
          Needs cover
        </div>
        <div style={styles.monthGridLegendItem}>
          <span style={{ ...styles.monthGridDot, background: '#5c4a38' }} />
          Scheduled
        </div>
      </div>
    </>
  );
}

// Shared subcomponents used by both Timetable and FOHSchedule
function ScheduleWeekNav({ weekStart, weekOffset, setWeekOffset }) {
  return (
    <div style={styles.weekNav}>
      <button
        onClick={() => setWeekOffset(w => Math.max(w - 1, -2))}
        className="salus-btn"
        style={styles.weekNavBtn}
        disabled={weekOffset <= -2}
      >
        <ChevronLeft size={18} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={styles.weekNavLabel}>
          {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {
            addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          }
        </div>
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="salus-btn"
            style={styles.weekTodayLink}
          >
            Jump to this week
          </button>
        )}
      </div>
      <button
        onClick={() => setWeekOffset(w => Math.min(w + 1, 12))}
        className="salus-btn"
        style={styles.weekNavBtn}
        disabled={weekOffset >= 12}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function ScheduleStatsRow({ coverCount, totalCount, totalLabel }) {
  return (
    <div style={styles.scheduleStatsRow}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 32, fontWeight: 700, lineHeight: 1,
          color: coverCount > 0 ? '#c8442a' : '#5c8a5a',
          fontFamily: '"Fraunces", Georgia, serif',
        }}>
          {coverCount}
        </div>
        <div style={{ fontSize: 11, color: '#7a8270', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {coverCount === 0 ? 'all filled this week' : `${coverCount === 1 ? 'needs' : 'need'} cover`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Total
        </div>
        <div style={{ fontSize: 14, color: '#5c4a38', marginTop: 4, fontWeight: 600 }}>
          {totalCount} {totalLabel}
        </div>
      </div>
    </div>
  );
}

function ScheduleFilterRow({ filter, setFilter, isManager }) {
  return (
    <div style={styles.scheduleFilterRow}>
      <button
        onClick={() => setFilter('all')}
        className="salus-btn"
        style={{ ...styles.scheduleFilterPill, ...(filter === 'all' ? styles.scheduleFilterPillActive : {}) }}
      >
        All
      </button>
      <button
        onClick={() => setFilter('needsCover')}
        className="salus-btn"
        style={{
          ...styles.scheduleFilterPill,
          ...(filter === 'needsCover'
            ? { background: '#c8442a', color: '#fff', borderColor: '#c8442a' }
            : {}),
        }}
      >
        Needs cover
      </button>
      {!isManager && (
        <button
          onClick={() => setFilter('mine')}
          className="salus-btn"
          style={{ ...styles.scheduleFilterPill, ...(filter === 'mine' ? styles.scheduleFilterPillActive : {}) }}
        >
          Mine
        </button>
      )}
    </div>
  );
}

function ScheduleCard({ onClick, timeLeft, timeBottom, title, subtitle, person, needsCover, isMine, isManager }) {
  const open = !person;
  return (
    <button
      onClick={onClick}
      className="salus-btn"
      style={{
        ...styles.scheduleCard,
        ...(needsCover ? styles.scheduleCardCover : {}),
        ...(isMine ? styles.scheduleCardMine : {}),
      }}
    >
      <div style={styles.scheduleCardTime}>
        <div style={styles.scheduleCardTimeMain}>{timeLeft}</div>
        {timeBottom && <div style={styles.scheduleCardTimeSub}>{timeBottom}</div>}
      </div>
      <div style={styles.scheduleCardMid}>
        <div style={styles.scheduleCardTitle}>{title}</div>
        {subtitle && <div style={styles.scheduleCardSub}>{subtitle}</div>}
      </div>
      <div style={styles.scheduleCardRight}>
        {needsCover ? (
          <span style={styles.scheduleCoverChip}>Cover</span>
        ) : person ? (
          <>
            <UserAvatar user={person} size={26} fontSize={11} />
            <span style={styles.scheduleCardName}>{person.name?.split(' ')[0]}</span>
          </>
        ) : (
          <span style={styles.scheduleUnassigned}>
            {isManager ? 'Tap to assign' : 'Unassigned'}
          </span>
        )}
      </div>
    </button>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="salus-btn"
      style={{
        ...styles.filterPill,
        ...(active ? styles.filterPillActive : {}),
      }}
    >
      {label}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COVER BOARD
// ──────────────────────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }) {
  const labelText = urgency.daysLeft === null
    ? urgency.label
    : urgency.daysLeft <= 0 ? 'Today'
    : urgency.daysLeft === 1 ? 'Tomorrow'
    : `${urgency.daysLeft} days`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
      color: urgency.color, background: urgency.bg,
      padding: '4px 8px', borderRadius: 10,
      border: `1px solid ${urgency.color}33`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: urgency.color }} />
      {labelText}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STATUS BAR — personalized "what matters right now" at the top
// ──────────────────────────────────────────────────────────────────────────────

function StatusBar({ data, currentUser, isManager, onJumpTo }) {
  // Find the user's next teaching commitment
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingForMe = data.classes
    .filter(c => c.coachId === currentUser.id && c.date)
    .map(c => ({ ...c, when: new Date(c.date + 'T' + c.time + ':00') }))
    .filter(c => c.when >= today)
    .sort((a, b) => a.when - b.when);
  const nextClass = upcomingForMe[0];

  let content;

  if (isManager) {
    const pending = data.coverRequests.filter(r => r.status === 'pending').length;
    const needsCover = data.classes.filter(c => c.status === 'needsCover').length;
    const covered = data.coverRequests.filter(r => r.status === 'claimed' || r.status === 'assigned').length;

    if (pending > 0) {
      content = {
        accent: '#c8442a',
        title: `${pending} cover ${pending === 1 ? 'request needs' : 'requests need'} your decision`,
        sub: `${needsCover} class${needsCover === 1 ? '' : 'es'} still need cover · ${covered} sorted this week`,
        actionLabel: 'Review',
        action: () => onJumpTo('cover'),
      };
    } else {
      content = {
        accent: '#5c4a38',
        title: 'All caught up',
        sub: `${needsCover} class${needsCover === 1 ? '' : 'es'} need cover · ${covered} sorted this week`,
      };
    }
  } else if (currentUser.coachType === 'cover') {
    const open = data.coverRequests.filter(r => r.status === 'open').length;
    const myInterested = data.coverRequests.filter(r => (r.interestedCovers || []).includes(currentUser.id)).length;

    if (nextClass) {
      content = {
        accent: currentUser.color,
        title: `Up next: ${DAYS[nextClass.day]} ${nextClass.date.slice(8)} May · ${nextClass.time} · ${nextClass.type}`,
        sub: `${STUDIOS[nextClass.studio]?.label} · ${open} more cover ${open === 1 ? 'opportunity' : 'opportunities'} on the board`,
        actionLabel: 'View board',
        action: () => onJumpTo('cover'),
      };
    } else if (open > 0) {
      content = {
        accent: currentUser.color,
        title: `${open} cover ${open === 1 ? 'opportunity' : 'opportunities'} available`,
        sub: myInterested > 0
          ? `You've marked yourself available for ${myInterested} · waiting on the manager`
          : 'Mark yourself available for any shift you can take',
        actionLabel: 'View board',
        action: () => onJumpTo('cover'),
      };
    } else {
      content = {
        accent: currentUser.color,
        title: 'No open shifts right now',
        sub: "We'll email you when new cover opportunities open up",
      };
    }
  } else {
    // Permanent coach
    const mineThisWeek = data.classes.filter(c => c.coachId === currentUser.id).length;
    const needsCoverThisWeek = data.classes.filter(c => c.status === 'needsCover').length;

    if (nextClass) {
      content = {
        accent: currentUser.color,
        title: `Up next: ${DAYS[nextClass.day]} ${nextClass.date.slice(8)} May · ${nextClass.time} · ${nextClass.type}`,
        sub: `${STUDIOS[nextClass.studio]?.label} · ${mineThisWeek} class${mineThisWeek === 1 ? '' : 'es'} this week${needsCoverThisWeek > 0 ? ` · ${needsCoverThisWeek} need cover` : ''}`,
        actionLabel: needsCoverThisWeek > 0 ? 'See cover board' : null,
        action: needsCoverThisWeek > 0 ? () => onJumpTo('cover') : null,
      };
    } else {
      content = {
        accent: currentUser.color,
        title: 'No upcoming classes this week',
        sub: needsCoverThisWeek > 0 ? `${needsCoverThisWeek} class${needsCoverThisWeek === 1 ? '' : 'es'} need cover — could you help out?` : 'Enjoy a quiet week',
        actionLabel: needsCoverThisWeek > 0 ? 'See cover board' : null,
        action: needsCoverThisWeek > 0 ? () => onJumpTo('cover') : null,
      };
    }
  }

  return (
    <div style={{ ...styles.statusBar, borderLeftColor: content.accent }}>
      <div style={styles.statusBarContent}>
        <div style={styles.statusBarTitle}>{content.title}</div>
        {content.sub && <div style={styles.statusBarSub}>{content.sub}</div>}
      </div>
      {content.action && (
        <button onClick={content.action} className="salus-btn" style={styles.statusBarBtn}>
          {content.actionLabel}
        </button>
      )}
    </div>
  );
}

function CoverBoard({ data, currentUser, isManager, isCoverCoach, onClaim, onCancel, onManage, onExpressInterest }) {
  const sortByDay = (a, b) => {
    const ca = data.classes.find(c => c.id === a.classId);
    const cb = data.classes.find(c => c.id === b.classId);
    if (ca.day !== cb.day) return ca.day - cb.day;
    return ca.time.localeCompare(cb.time);
  };

  const allPending = data.coverRequests.filter(r => r.status === 'pending').sort(sortByDay);
  const myPending = allPending.filter(r => r.requestedBy === currentUser.id);
  const openRequests = data.coverRequests.filter(r => r.status === 'open').sort(sortByDay);
  const resolvedRequests = data.coverRequests.filter(r => r.status === 'claimed' || r.status === 'assigned');

  const totalActive = (isManager ? allPending.length : myPending.length) + openRequests.length;

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.h2}>Cover Board</h2>
          <p style={styles.subtitle}>
            {isManager
              ? `${allPending.length} awaiting your decision · ${openRequests.length} on the board`
              : `${myPending.length} of yours pending · ${openRequests.length} on the board`
            }
          </p>
        </div>
      </div>

      {/* Manager: pending approvals */}
      {isManager && allPending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ ...styles.h3, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} color="#c8442a" />
            Awaiting your decision
          </h3>
          <div style={styles.coverList}>
            {allPending.map(req => {
              const cls = data.classes.find(c => c.id === req.classId);
              const requester = data.users.find(u => u.id === req.requestedBy);
              const typeCfg = CLASS_TYPES[cls.type];
              const urgency = getUrgency(cls.date);
              return (
                <div key={req.id} className="salus-card" style={{ ...styles.coverCard, background: '#fffaf2' }}>
                  <div style={{ ...styles.coverCardStripe, background: urgency.color }} />
                  <div style={styles.coverCardBody}>
                    <div style={styles.coverCardTop}>
                      <div>
                        <div style={styles.coverCardDay}>{DAYS[cls.day]} {cls.date?.slice(8)} May · {cls.time}–{endTime(cls.time, cls.dur)}</div>
                        <div style={styles.coverCardType}>{cls.type}</div>
                        <div style={styles.coverCardSub}>
                          <span style={{ ...styles.studioTagInline, color: typeCfg.color }}>{STUDIOS[cls.studio]?.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <UrgencyBadge urgency={urgency} />
                        <div style={styles.coverCardMeta}>
                          <UserAvatar user={requester} size={20} fontSize={9} />
                          <div>
                            <div style={styles.coverCardRequester}>{requester.name.split(' ')[0]}</div>
                            <div style={styles.coverCardTime}>{fmtTime(req.timestamp)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={styles.coverCardReason}>
                      <span style={styles.reasonLabel}>Reason</span>
                      <span>{req.reason}</span>
                    </div>
                    <div style={styles.coverCardActions}>
                      <button onClick={() => onManage(req.id)} className="salus-btn" style={styles.btnPrimary}>
                        Review &amp; decide
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Coach: my own pending requests */}
      {!isManager && myPending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ ...styles.h3, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#7a8270" />
            Your pending requests
          </h3>
          <div style={styles.coverList}>
            {myPending.map(req => {
              const cls = data.classes.find(c => c.id === req.classId);
              const typeCfg = CLASS_TYPES[cls.type];
              const urgency = getUrgency(cls.date);
              return (
                <div key={req.id} className="salus-card" style={styles.coverCard}>
                  <div style={{ ...styles.coverCardStripe, background: urgency.color }} />
                  <div style={styles.coverCardBody}>
                    <div style={styles.coverCardTop}>
                      <div>
                        <div style={styles.coverCardDay}>{DAYS[cls.day]} {cls.date?.slice(8)} May · {cls.time}–{endTime(cls.time, cls.dur)}</div>
                        <div style={styles.coverCardType}>{cls.type}</div>
                        <div style={styles.coverCardSub}>
                          <span style={{ ...styles.studioTagInline, color: typeCfg.color }}>{STUDIOS[cls.studio]?.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <UrgencyBadge urgency={urgency} />
                        <div style={styles.pendingBadge}>
                          <Clock size={11} /> Awaiting manager
                        </div>
                      </div>
                    </div>
                    <div style={styles.coverCardReason}>
                      <span style={styles.reasonLabel}>Your reason</span>
                      <span>{req.reason}</span>
                    </div>
                    <div style={styles.coverCardActions}>
                      <button onClick={() => onCancel(req.id)} className="salus-btn" style={styles.btnGhost}>
                        Cancel request
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Everyone: open on board */}
      {openRequests.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ ...styles.h3, marginTop: 0 }}>On the board</h3>
          <div style={styles.coverList}>
            {openRequests.map(req => {
              const cls = data.classes.find(c => c.id === req.classId);
              const requester = data.users.find(u => u.id === req.requestedBy);
              const typeCfg = CLASS_TYPES[cls.type];
              const isMine = req.requestedBy === currentUser.id;
              const urgency = getUrgency(cls.date);
              return (
                <div key={req.id} className="salus-card" style={styles.coverCard}>
                  <div style={{ ...styles.coverCardStripe, background: urgency.color }} />
                  <div style={styles.coverCardBody}>
                    <div style={styles.coverCardTop}>
                      <div>
                        <div style={styles.coverCardDay}>{DAYS[cls.day]} {cls.date?.slice(8)} May · {cls.time}–{endTime(cls.time, cls.dur)}</div>
                        <div style={styles.coverCardType}>{cls.type}</div>
                        <div style={styles.coverCardSub}>
                          <span style={{ ...styles.studioTagInline, color: typeCfg.color }}>{STUDIOS[cls.studio]?.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <UrgencyBadge urgency={urgency} />
                        <div style={styles.coverCardMeta}>
                          <UserAvatar user={requester} size={20} fontSize={9} />
                          <div>
                            <div style={styles.coverCardRequester}>{requester.name.split(' ')[0]}</div>
                            <div style={styles.coverCardTime}>{fmtTime(req.timestamp)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={styles.coverCardReason}>
                      <span style={styles.reasonLabel}>Reason</span>
                      <span>{req.reason}</span>
                    </div>

                    {/* Interested coaches (cover + permanent who might be available) */}
                    {(req.interestedCovers && req.interestedCovers.length > 0) && (
                      <div style={styles.interestedSection}>
                        <div style={styles.interestedLabel}>Coaches available</div>
                        <div style={styles.interestedList}>
                          {req.interestedCovers.map(cid => {
                            const cv = data.users.find(u => u.id === cid);
                            if (!cv) return null;
                            const isCoverCv = cv.coachType === 'cover';
                            return (
                              <div key={cid} style={styles.interestedChip}>
                                <UserAvatar user={cv} size={22} fontSize={9} />
                                <span>{cv.name.split(' ')[0]}</span>
                                <span style={{ ...styles.chipTypeTag, ...(isCoverCv ? styles.chipTypeCover : styles.chipTypePermanent) }}>
                                  {isCoverCv ? 'Cover' : 'Perm'}
                                </span>
                                {isManager && (
                                  <button
                                    onClick={() => onClaim(req.id, cid)}
                                    className="salus-btn"
                                    style={styles.assignChipBtn}
                                  >
                                    Assign
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={styles.coverCardActions}>
                      {isMine ? (
                        <button onClick={() => onCancel(req.id)} className="salus-btn" style={styles.btnGhost}>
                          Cancel request
                        </button>
                      ) : isManager ? (
                        <span style={styles.hint}>Posted to the team — waiting for a coach to claim</span>
                      ) : isCoverCoach ? (
                        (() => {
                          const interested = (req.interestedCovers || []).includes(currentUser.id);
                          return (
                            <button
                              onClick={() => onExpressInterest(req.id)}
                              className="salus-btn"
                              style={interested ? styles.btnSecondary : styles.btnPrimary}
                            >
                              {interested ? (
                                <><Check size={14} /> You've marked yourself available</>
                              ) : (
                                <>I'm available for this</>
                              )}
                            </button>
                          );
                        })()
                      ) : (
                        // Permanent coach — both options
                        (() => {
                          const interested = (req.interestedCovers || []).includes(currentUser.id);
                          return (
                            <>
                              <button onClick={() => onClaim(req.id)} className="salus-btn" style={styles.btnPrimary}>
                                <Check size={14} /> I'll cover this
                              </button>
                              <button
                                onClick={() => onExpressInterest(req.id)}
                                className="salus-btn"
                                style={styles.btnSecondary}
                              >
                                {interested
                                  ? <><Check size={14} /> Marked available</>
                                  : 'I might be available'}
                              </button>
                            </>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalActive === 0 && (
        <div style={styles.emptyState}>
          <Check size={32} color="#7a8c5c" />
          <div style={styles.emptyTitle}>All clear</div>
          <div style={styles.emptyText}>No cover requests right now.</div>
        </div>
      )}

      {/* Recently resolved */}
      {resolvedRequests.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={styles.h3}>Recently covered</h3>
          <div style={styles.coverList}>
            {resolvedRequests.slice(-5).reverse().map(req => {
              const cls = data.classes.find(c => c.id === req.classId);
              const claimer = data.users.find(u => u.id === req.claimedBy);
              const requester = data.users.find(u => u.id === req.requestedBy);
              const wasAssigned = req.status === 'assigned';
              return (
                <div key={req.id} style={{ ...styles.coverCard, opacity: 0.65 }}>
                  <div style={{ ...styles.coverCardStripe, background: '#7a8c5c' }} />
                  <div style={styles.coverCardBody}>
                    <div style={styles.coverCardTop}>
                      <div>
                        <div style={styles.coverCardDay}>{DAYS[cls.day]} · {cls.time} · {cls.type}</div>
                        <div style={styles.coveredText}>
                          <span style={{ color: '#7a8c5c', fontWeight: 600 }}>{claimer?.name.split(' ')[0]}</span>
                          {wasAssigned ? ' assigned by manager' : ' covering'} for {requester.name.split(' ')[0]}
                        </div>
                      </div>
                      <Check size={20} color="#7a8c5c" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CHAT
// ──────────────────────────────────────────────────────────────────────────────

function Chat({ data, currentUser, isManager, onSend, onDeleteMessage, onEditMessage, onClearAll, onOpenDm }) {
  const [chatView, setChatView] = useState('team');  // 'team' | 'dms'
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.messages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const handleSendUrgent = () => {
    if (!text.trim()) return;
    if (!confirm(`Send "${text.trim()}" as an URGENT broadcast to everyone?\n\nThis will fire a high-priority push notification to every staff member.`)) return;
    onSend(text, true);
    setText('');
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditText(msg.text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };
  const saveEdit = (msgId) => {
    if (!editText.trim()) return;
    onEditMessage(msgId, editText.trim());
    setEditingId(null);
    setEditText('');
  };

  // Build DMs grouped by the other person
  const dmThreads = (() => {
    const byOther = {};
    data.dms.forEach(m => {
      const otherId = m.senderId === currentUser.id ? m.recipientId : m.senderId;
      if (!otherId) return;
      if (!byOther[otherId]) {
        byOther[otherId] = { otherId, messages: [], lastAt: 0, unread: 0 };
      }
      byOther[otherId].messages.push(m);
      if (m.createdAt > byOther[otherId].lastAt) {
        byOther[otherId].lastAt = m.createdAt;
        byOther[otherId].lastMessage = m;
      }
      if (m.recipientId === currentUser.id && m.readAt == null) {
        byOther[otherId].unread++;
      }
    });
    return Object.values(byOther).sort((a, b) => b.lastAt - a.lastAt);
  })();

  const totalDmUnread = dmThreads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <div style={styles.chatContainer}>
      <div style={styles.chatToggleRow}>
        <button
          onClick={() => setChatView('team')}
          className="salus-btn"
          style={{
            ...styles.chatToggleBtn,
            ...(chatView === 'team' ? styles.chatToggleBtnActive : {}),
          }}
        >
          Team chat
        </button>
        <button
          onClick={() => setChatView('dms')}
          className="salus-btn"
          style={{
            ...styles.chatToggleBtn,
            ...(chatView === 'dms' ? styles.chatToggleBtnActive : {}),
            position: 'relative',
          }}
        >
          Private messages
          {totalDmUnread > 0 && (
            <span style={styles.chatToggleBadge}>{totalDmUnread}</span>
          )}
        </button>
      </div>

      {chatView === 'dms' ? (
        <DmsListView
          threads={dmThreads}
          data={data}
          currentUser={currentUser}
          onOpenDm={onOpenDm}
        />
      ) : (
        <>
      <div style={styles.chatHeader}>
        <div style={{ flex: 1 }}>
          <h2 style={styles.chatTitle}>Team Salus</h2>
          <p style={styles.chatSubtitle}>{data.users.length} members</p>
        </div>
        {isManager && data.messages.length > 0 && (
          <button
            onClick={onClearAll}
            className="salus-btn"
            style={styles.chatClearAllBtn}
            title="Delete every message in the chat"
          >
            <Trash2 size={14} />
            <span>Clear chat</span>
          </button>
        )}
      </div>

      <div ref={scrollRef} className="salus-scroll" style={styles.messagesList}>
        {data.messages.map((msg, i) => {
          const user = data.users.find(u => u.id === msg.userId);
          const prevMsg = data.messages[i - 1];
          const showHeader = !prevMsg || prevMsg.userId !== msg.userId ||
                             (msg.timestamp - prevMsg.timestamp) > 600000;
          const isMine = msg.userId === currentUser.id;
          const canDelete = isManager || isMine;
          const isEditing = editingId === msg.id;
          return (
            <div
              key={msg.id}
              style={{ ...styles.message, ...(isMine ? styles.messageMine : {}), position: 'relative' }}
            >
              {showHeader && user && (
                <div style={styles.messageHeader}>
                  <UserAvatar user={user} size={28} fontSize={11} />
                  <span style={styles.messageName}>{user.name}{user.role === 'manager' ? ' · Manager' : ''}</span>
                  <span style={styles.messageTime}>
                    {fmtTime(msg.timestamp)}
                    {msg.editedAt && <span style={{ marginLeft: 4, fontStyle: 'italic' }}>· edited</span>}
                  </span>
                </div>
              )}
              <div style={{ ...styles.messageBubble, marginLeft: 36, position: 'relative', ...(msg.isUrgent ? styles.messageBubbleUrgent : {}) }}>
                {msg.isUrgent && (
                  <div style={styles.urgentBanner}>
                    <AlertOctagon size={12} /> URGENT
                  </div>
                )}
                {isEditing ? (
                  <div style={styles.messageEditWrap}>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(msg.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      style={styles.messageEditInput}
                    />
                    <div style={styles.messageEditActions}>
                      <button onClick={cancelEdit} className="salus-btn" style={styles.messageEditCancel}>Cancel</button>
                      <button onClick={() => saveEdit(msg.id)} className="salus-btn" style={styles.messageEditSave}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>{msg.text}</div>
                    {(isMine || canDelete) && (
                      <div style={styles.messageActions}>
                        {isMine && (
                          <button
                            onClick={() => startEdit(msg)}
                            className="salus-btn"
                            style={styles.messageActionBtn}
                            title="Edit"
                            aria-label="Edit message"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this message?')) onDeleteMessage(msg.id);
                            }}
                            className="salus-btn"
                            style={{ ...styles.messageActionBtn, color: '#c8442a' }}
                            title="Delete"
                            aria-label="Delete message"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {data.messages.length === 0 && (
          <div style={styles.chatEmpty}>
            No messages yet. Be the first to say hello.
          </div>
        )}
      </div>

      <div style={styles.chatInputRow}>
        <button
          onClick={handleSendUrgent}
          className="salus-btn"
          style={styles.urgentBroadcastBtn}
          title="Send as urgent broadcast"
          disabled={!text.trim()}
        >
          <AlertOctagon size={16} />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Message as ${currentUser.name.split(' ')[0]}…`}
          className="salus-input"
          style={styles.chatInput}
        />
        <button onClick={handleSend} className="salus-btn" style={styles.sendBtn}>
          <Send size={16} />
        </button>
      </div>
        </>
      )}
    </div>
  );
}

function DmsListView({ threads, data, currentUser, onOpenDm }) {
  const timeAgo = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (threads.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>✉️</div>
        <div style={{ fontFamily: '"Fraunces", serif', fontSize: 18, color: '#5c4a38', marginTop: 8 }}>
          No private messages yet
        </div>
        <div style={{ fontSize: 12, color: '#7a8270', marginTop: 6, lineHeight: 1.5 }}>
          Go to <strong>Me → Team</strong> and tap <strong>DM</strong> next to anyone to start a private thread.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {threads.map(t => {
        const other = data.users.find(u => u.id === t.otherId);
        if (!other) return null;
        const last = t.lastMessage;
        const lastWasMine = last?.senderId === currentUser.id;
        const preview = last
          ? (lastWasMine ? 'You: ' : '') + (last.text.length > 50 ? last.text.slice(0, 50) + '…' : last.text)
          : '';
        return (
          <button
            key={t.otherId}
            onClick={() => onOpenDm(t.otherId)}
            className="salus-btn"
            style={styles.dmRow}
          >
            <UserAvatar user={other} size={44} fontSize={15} />
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={styles.dmRowTop}>
                <div style={styles.dmRowName}>{other.name}</div>
                {last && <div style={styles.dmRowTime}>{timeAgo(last.createdAt)}</div>}
              </div>
              <div style={{
                ...styles.dmRowPreview,
                ...(t.unread > 0 ? { fontWeight: 600, color: '#1a2620' } : {}),
              }}>
                {preview || 'No messages yet'}
              </div>
            </div>
            {t.unread > 0 && (
              <span style={styles.dmUnreadBadge}>{t.unread}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MANAGER STATS
// ──────────────────────────────────────────────────────────────────────────────

const RATE_PER_SESSION = 30; // £ per class taught

// ──────────────────────────────────────────────────────────────────────────────
// ME — personal hub: profile, stats, settings link
// ──────────────────────────────────────────────────────────────────────────────

function MePage({ data, currentUser, isManager, onOpenSettings, onSignOut, onShowInvoices, onShowTimeOff, onShowTeam }) {
  const myClasses = data.classes.filter(c => c.coachId === currentUser.id);
  const sessionCount = myClasses.length;
  const totalMinutes = myClasses.reduce((acc, c) => acc + c.dur, 0);
  const owed = sessionCount * 30;

  const roleLabel = isManager
    ? 'Manager'
    : (currentUser.coachType === 'permanent' ? 'Permanent coach' : 'Cover coach');

  const maskBank = (acc) => {
    if (!acc || acc.length < 4) return null;
    return `••••${acc.slice(-4)}`;
  };

  return (
    <div style={styles.homeContainer}>
      {/* Profile card */}
      <div style={styles.meProfileCard}>
        <UserAvatar user={currentUser} size={64} fontSize={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.meName}>{currentUser.name}</div>
          <div style={styles.meRole}>{roleLabel}</div>
        </div>
        <button onClick={onOpenSettings} className="salus-btn" style={styles.meEditBtn}>
          Edit
        </button>
      </div>

      {/* Stats — gamified for coaches/FOH, simple for manager */}
      {isManager ? (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>This week</div>
          </div>
          <div style={styles.meStatsGrid}>
            <div style={styles.meStatCell}>
              <div style={styles.meStatNum}>{sessionCount}</div>
              <div style={styles.meStatLabel}>Sessions</div>
            </div>
            <div style={styles.meStatCell}>
              <div style={styles.meStatNum}>{Math.round(totalMinutes / 60 * 10) / 10}</div>
              <div style={styles.meStatLabel}>Hours</div>
            </div>
            <div style={styles.meStatCell}>
              <div style={styles.meStatNum}>£{owed}</div>
              <div style={styles.meStatLabel}>Owed</div>
            </div>
          </div>
        </section>
      ) : (
        <section style={styles.homeSection}>
          <MyStatsCard data={data} currentUser={currentUser} />
        </section>
      )}

      {/* Push notifications — inline, not in a modal */}
      <section style={styles.homeSection}>
        <PushNotificationsSection />
      </section>

      {/* Time off & bank holidays */}
      <section style={styles.homeSection}>
        <div style={styles.homeSectionHead}>
          <div style={styles.homeSectionTitle}>Calendar</div>
        </div>
        <div style={styles.meActionsList}>
          <button onClick={onShowTimeOff} className="salus-btn" style={styles.meActionRow}>
            <Calendar size={18} color="#5c4a38" />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, color: '#1a2620' }}>Time off & bank holidays</div>
              <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>Upcoming UK bank holidays</div>
            </div>
            <ChevronRight size={16} color="#a59478" />
          </button>
        </div>
      </section>

      {/* Your team */}
      <section style={styles.homeSection}>
        <div style={styles.homeSectionHead}>
          <div style={styles.homeSectionTitle}>Know your team</div>
        </div>
        <div style={styles.meActionsList}>
          <button onClick={onShowTeam} className="salus-btn" style={styles.meActionRow}>
            <Users size={18} color="#5c4a38" />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, color: '#1a2620' }}>Your team ({data.users.length})</div>
              <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>Everyone at Salus House</div>
            </div>
            <ChevronRight size={16} color="#a59478" />
          </button>
        </div>
      </section>

      {/* Bank details summary */}
      <section style={styles.homeSection}>
        <div style={styles.homeSectionHead}>
          <div style={styles.homeSectionTitle}>Bank details</div>
        </div>
        <button onClick={onOpenSettings} className="salus-btn" style={styles.meBankCard}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={styles.meBankLabel}>Account</div>
            <div style={styles.meBankValue}>
              {currentUser.bankAccount ? maskBank(currentUser.bankAccount) :
                <span style={{ color: '#c8442a' }}>Not set — tap to add</span>}
            </div>
            {currentUser.bankSortCode && (
              <>
                <div style={{ ...styles.meBankLabel, marginTop: 8 }}>Sort code</div>
                <div style={styles.meBankValue}>{currentUser.bankSortCode}</div>
              </>
            )}
          </div>
          <ChevronRight size={16} color="#a59478" />
        </button>
      </section>

      {/* Manager tools */}
      {isManager && (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>Manager tools</div>
          </div>
          <div style={styles.meActionsList}>
            <button onClick={onShowInvoices} className="salus-btn" style={styles.meActionRow}>
              <FileText size={18} color="#5c4a38" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: '#1a2620' }}>Generate invoices</div>
                <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>£30 per session, this week</div>
              </div>
              <ChevronRight size={16} color="#a59478" />
            </button>
          </div>
        </section>
      )}

      {/* Sign out */}
      <section style={{ ...styles.homeSection, marginBottom: 40 }}>
        <button onClick={onSignOut} className="salus-btn" style={styles.meSignOutBtn}>
          <LogOut size={16} /> Sign out
        </button>
      </section>
    </div>
  );
}

function ManagerStats({ data, onShowInvoices }) {
  const allCoaches = data.users.filter(u => u.role === 'coach');
  const permanentCoaches = allCoaches.filter(c => (c.coachType || 'permanent') === 'permanent');
  const coverCoaches = allCoaches.filter(c => c.coachType === 'cover');

  const computeStats = (coach) => {
    const myClasses = data.classes.filter(c => c.coachId === coach.id);
    const totalHours = myClasses.reduce((sum, c) => sum + c.dur / 60, 0);
    const coverRequested = data.coverRequests.filter(r => r.requestedBy === coach.id).length;
    const coverTaken = data.coverRequests.filter(r => r.claimedBy === coach.id).length;
    const interestExpressed = data.coverRequests.filter(r => (r.interestedCovers || []).includes(coach.id)).length;
    const earnings = myClasses.length * RATE_PER_SESSION;
    return { coach, classes: myClasses.length, hours: totalHours, coverRequested, coverTaken, interestExpressed, earnings };
  };

  const permStats = permanentCoaches.map(computeStats).sort((a, b) => b.classes - a.classes);
  const coverStats = coverCoaches.map(computeStats).sort((a, b) => b.coverTaken - a.coverTaken);

  const totalClasses = data.classes.length;
  const totalHours = permStats.reduce((s, x) => s + x.hours, 0);
  const needsCover = data.classes.filter(c => c.status === 'needsCover').length;
  const covered = data.coverRequests.filter(r => r.status === 'claimed' || r.status === 'assigned').length;
  const totalPayroll = [...permStats, ...coverStats].reduce((s, x) => s + x.earnings, 0);

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.h2}>Team Stats · This Week</h2>
          <p style={styles.subtitle}>Workload, payments, and cover activity</p>
        </div>
        <button onClick={onShowInvoices} className="salus-btn" style={styles.btnPrimary}>
          <Mail size={14} /> Generate invoices
        </button>
      </div>

      {/* Summary cards */}
      <div style={styles.statGrid}>
        <StatCard icon={Activity} label="Total classes" value={totalClasses} accent="#5c4a38" />
        <StatCard icon={Clock} label="Total hours" value={totalHours.toFixed(1)} accent="#b85c38" />
        <StatCard icon={AlertCircle} label="Need cover" value={needsCover} accent="#c8442a" />
        <StatCard icon={Check} label="Total payroll" value={`£${totalPayroll.toLocaleString()}`} accent="#7a8c5c" />
      </div>

      {/* Permanent coach breakdown */}
      <h3 style={{ ...styles.h3, display: 'flex', alignItems: 'center', gap: 10 }}>
        Permanent coaches
        <span style={{ ...styles.coachTypeBadge, ...styles.coachTypePermanent }}>On the timetable</span>
      </h3>
      <div className="salus-stats-table" style={styles.coachStatsCard}>
        <div style={{ ...styles.coachStatsHeader, gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
          <div>Coach</div>
          <div style={{ textAlign: 'right' }}>Sessions</div>
          <div style={{ textAlign: 'right' }}>Hours</div>
          <div style={{ textAlign: 'right' }}>Cover asked</div>
          <div style={{ textAlign: 'right' }}>Cover taken</div>
          <div style={{ textAlign: 'right' }}>Owed</div>
        </div>
        {permStats.map(({ coach, classes, hours, coverRequested, coverTaken, earnings }) => {
          const maxClasses = Math.max(...permStats.map(s => s.classes), 1);
          const barWidth = (classes / maxClasses) * 100;
          return (
            <div key={coach.id} style={{ ...styles.coachStatsRow, gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
              <div style={styles.coachStatsName}>
                <UserAvatar user={coach} size={20} fontSize={9} />
                <div>
                  <div style={{ fontWeight: 500 }}>{coach.name}</div>
                  <div style={styles.barWrap}>
                    <div style={{ ...styles.bar, width: `${barWidth}%`, background: coach.color }} />
                  </div>
                </div>
              </div>
              <div style={styles.coachStatsValue}>{classes}</div>
              <div style={styles.coachStatsValue}>{hours.toFixed(1)}h</div>
              <div style={styles.coachStatsValue}>{coverRequested}</div>
              <div style={styles.coachStatsValue}>{coverTaken}</div>
              <div style={{ ...styles.coachStatsValue, fontWeight: 700, color: '#5c4a38' }}>£{earnings}</div>
            </div>
          );
        })}
      </div>

      {/* Cover coach breakdown */}
      {coverStats.length > 0 && (
        <>
          <h3 style={{ ...styles.h3, display: 'flex', alignItems: 'center', gap: 10, marginTop: 30 }}>
            Cover coaches
            <span style={{ ...styles.coachTypeBadge, ...styles.coachTypeCover }}>On standby</span>
          </h3>
          <div className="salus-stats-table" style={styles.coachStatsCard}>
            <div style={{ ...styles.coachStatsHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}>
              <div>Coach</div>
              <div>Qualified to teach</div>
              <div style={{ textAlign: 'right' }}>Cover taken</div>
              <div style={{ textAlign: 'right' }}>Interest shown</div>
              <div style={{ textAlign: 'right' }}>Owed</div>
            </div>
            {coverStats.map(({ coach, coverTaken, interestExpressed, earnings }) => (
              <div key={coach.id} style={{ ...styles.coachStatsRow, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}>
                <div style={styles.coachStatsName}>
                  <UserAvatar user={coach} size={20} fontSize={9} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{coach.name}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#7a8270', lineHeight: 1.4 }}>
                  {(coach.qualifications || []).join(', ') || '—'}
                </div>
                <div style={styles.coachStatsValue}>{coverTaken}</div>
                <div style={styles.coachStatsValue}>{interestExpressed}</div>
                <div style={{ ...styles.coachStatsValue, fontWeight: 700, color: '#5c4a38' }}>£{earnings}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cover alerts */}
      {needsCover > 0 && (
        <div style={{ ...styles.alertPanel, marginTop: 24 }}>
          <div style={styles.alertPanelHeader}>
            <AlertCircle size={18} color="#c8442a" />
            <span>Classes still needing cover</span>
          </div>
          <div>
            {data.classes.filter(c => c.status === 'needsCover').map(c => {
              const originalCoach = data.users.find(u => u.id === c.originalCoachId);
              return (
                <div key={c.id} style={styles.alertRow}>
                  <span style={{ fontWeight: 500 }}>{DAYS[c.day]} {c.time}</span>
                  <span>{c.type}</span>
                  <span style={{ color: '#666' }}>was {originalCoach?.name.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="salus-card" style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: accent + '15', color: accent }}>
        <Icon size={18} />
      </div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COACH STATS
// ──────────────────────────────────────────────────────────────────────────────

function CoachStats({ data, currentUser }) {
  const myClasses = data.classes.filter(c => c.coachId === currentUser.id);
  const totalHours = myClasses.reduce((sum, c) => sum + c.dur / 60, 0);
  const coverRequested = data.coverRequests.filter(r => r.requestedBy === currentUser.id).length;
  const coverTaken = data.coverRequests.filter(r => r.claimedBy === currentUser.id).length;
  const byType = {};
  myClasses.forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1; });

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.h2}>My Stats · This Week</h2>
          <p style={styles.subtitle}>Your teaching activity and cover history</p>
        </div>
      </div>

      <div style={styles.statGrid}>
        <StatCard icon={Activity} label="Your classes" value={myClasses.length} accent={currentUser.color} />
        <StatCard icon={Clock} label="Teaching hours" value={totalHours.toFixed(1)} accent="#b85c38" />
        <StatCard icon={ArrowLeftRight} label="Cover requested" value={coverRequested} accent="#c8442a" />
        <StatCard icon={Award} label="Cover taken" value={coverTaken} accent="#7a8c5c" />
      </div>

      <div style={styles.coachStatsCard}>
        <h3 style={{ ...styles.h3, marginTop: 0 }}>Classes by type</h3>
        {Object.entries(byType).map(([type, count]) => {
          const cfg = CLASS_TYPES[type];
          const max = Math.max(...Object.values(byType));
          return (
            <div key={type} style={styles.typeRow}>
              <div style={styles.typeLabel}>
                <div style={{ ...styles.legendDot, background: cfg.color }} />
                <span>{type}</span>
              </div>
              <div style={styles.typeBarWrap}>
                <div style={{ ...styles.typeBar, width: `${(count/max)*100}%`, background: cfg.color }} />
              </div>
              <div style={styles.typeCount}>{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MODALS
// ──────────────────────────────────────────────────────────────────────────────

function ClassDetailModal({ classObj, data, currentUser, isManager, onClose, onRequestCover, onProposeSwap, onTransfer, onEdit, onDelete }) {
  const [mode, setMode] = useState('view'); // view | requestCover | swap
  const [reason, setReason] = useState('');
  const [swapTarget, setSwapTarget] = useState('');

  const coach = data.users.find(u => u.id === classObj.coachId);
  const typeCfg = CLASS_TYPES[classObj.type];
  const isMine = classObj.coachId === currentUser.id;
  const needsCover = classObj.status === 'needsCover';

  // Swappable: my classes that aren't this one
  const myOtherClasses = data.classes.filter(c =>
    c.coachId === currentUser.id && c.id !== classObj.id && c.status !== 'needsCover'
  );

  return (
    <Modal onClose={onClose}>
      <div style={{ borderTop: `4px solid ${typeCfg.color}`, padding: 24 }}>
        <div style={styles.modalDayBadge}>{DAYS[classObj.day]} · {classObj.time}–{endTime(classObj.time, classObj.dur)}</div>
        <h2 style={{ ...styles.h2, marginTop: 8 }}>{classObj.type}</h2>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Coach</span>
          <div style={styles.detailValue}>
            <UserAvatar user={coach} size={20} fontSize={9} />
            <span>{coach.name}</span>
            {isMine && <span style={styles.youBadge}>You</span>}
          </div>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Duration</span>
          <span>{classObj.dur} minutes</span>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Studio</span>
          <span>{STUDIOS[classObj.studio]?.label || '—'}</span>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Status</span>
          <span style={{ color: needsCover ? '#c8442a' : '#5c4a38', fontWeight: 500 }}>
            {needsCover ? 'Needs cover' : classObj.status === 'covered' ? 'Covered' : 'Assigned'}
          </span>
        </div>

        {mode === 'view' && (
          <div style={{ marginTop: 16 }}>
            <a
              href={googleCalendarUrl({
                title: `${classObj.type} — Salus House`,
                dateIso: classObj.date,
                startTime: classObj.time,
                endTime: (() => {
                  const [h, m] = classObj.time.split(':').map(Number);
                  const total = h * 60 + m + (classObj.dur || 45);
                  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                })(),
                description: `Teaching at ${STUDIOS[classObj.studio]?.name || classObj.studio}.`,
                location: 'Salus House, Sidcup',
              })}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.gcalLink}
            >
              📅 Add to Google Calendar
            </a>
          </div>
        )}

        {mode === 'view' && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isManager && (
              <>
                <button onClick={onEdit} className="salus-btn" style={styles.btnPrimary}>
                  Edit class
                </button>
                <button onClick={onDelete} className="salus-btn" style={styles.btnDanger}>
                  Delete
                </button>
              </>
            )}
            {isMine && !needsCover && (
              <>
                <button onClick={() => setMode('requestCover')} className="salus-btn" style={isManager ? styles.btnSecondary : styles.btnPrimary}>
                  <AlertCircle size={14} /> Request cover
                </button>
                <button onClick={onTransfer} className="salus-btn" style={styles.btnSecondary}>
                  <ArrowLeftRight size={14} /> Transfer to coach
                </button>
                {!isManager && myOtherClasses.length > 0 && (
                  <button onClick={() => setMode('swap')} className="salus-btn" style={styles.btnSecondary}>
                    <ArrowLeftRight size={14} /> Propose swap
                  </button>
                )}
              </>
            )}
            {!isManager && !isMine && !needsCover && data.classes.filter(c => c.coachId === currentUser.id).length > 0 && (
              <button onClick={() => setMode('swap')} className="salus-btn" style={styles.btnSecondary}>
                <ArrowLeftRight size={14} /> Propose swap
              </button>
            )}
            <button onClick={onClose} className="salus-btn" style={styles.btnGhost}>Close</button>
          </div>
        )}

        {mode === 'requestCover' && (
          <div style={{ marginTop: 24 }}>
            <label style={styles.label}>Reason for needing cover</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Medical appointment, family commitment…"
              className="salus-input"
              style={styles.textarea}
              rows={3}
            />
            <p style={styles.hint}>
              {isManager
                ? 'This will be posted to the cover board straight away — coaches can claim or express interest.'
                : "This will be sent to the manager, who'll either assign someone to cover or post it to the team."}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => onRequestCover(reason)} className="salus-btn" style={styles.btnPrimary}>
                {isManager ? 'Post to board' : 'Send to manager'}
              </button>
              <button onClick={() => setMode('view')} className="salus-btn" style={styles.btnGhost}>Back</button>
            </div>
          </div>
        )}

        {mode === 'swap' && (
          <div style={{ marginTop: 24 }}>
            <label style={styles.label}>Swap this for one of your classes</label>
            <select
              value={swapTarget}
              onChange={(e) => setSwapTarget(e.target.value)}
              className="salus-input"
              style={styles.select}
            >
              <option value="">Choose a class…</option>
              {(isMine
                ? data.classes.filter(c => c.coachId !== currentUser.id && c.status !== 'needsCover')
                : myOtherClasses
              ).map(c => (
                <option key={c.id} value={c.id}>
                  {DAYS[c.day]} {c.time} · {c.type} · {data.users.find(u => u.id === c.coachId)?.name.split(' ')[0]}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => swapTarget && onProposeSwap(swapTarget)}
                disabled={!swapTarget}
                className="salus-btn"
                style={{ ...styles.btnPrimary, opacity: swapTarget ? 1 : 0.5 }}
              >
                Send swap request
              </button>
              <button onClick={() => setMode('view')} className="salus-btn" style={styles.btnGhost}>Back</button>
            </div>
            <p style={styles.hint}>The other coach will be notified and can accept or decline.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ManageCoverModal({ request, data, onClose, onAssign, onPost, onDecline }) {
  const [assignTo, setAssignTo] = useState('');
  const cls = data.classes.find(c => c.id === request.classId);
  const requester = data.users.find(u => u.id === request.requestedBy);
  const typeCfg = CLASS_TYPES[cls.type];
  const otherCoaches = data.users.filter(u =>
    u.role === 'coach' && u.id !== request.requestedBy
  );

  return (
    <Modal onClose={onClose}>
      <div style={{ borderTop: `4px solid ${typeCfg.color}`, padding: 24 }}>
        <div style={styles.modalDayBadge}>Cover request · {fmtTime(request.timestamp)}</div>
        <h2 style={{ ...styles.h2, marginTop: 8 }}>{cls.type}</h2>

        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>When</span>
          <span>{DAYS[cls.day]} · {cls.time}–{endTime(cls.time, cls.dur)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Requested by</span>
          <div style={styles.detailValue}>
            <UserAvatar user={requester} size={20} fontSize={9} />
            <span>{requester.name}</span>
          </div>
        </div>
        <div style={{ ...styles.coverCardReason, marginTop: 16 }}>
          <span style={styles.reasonLabel}>Reason</span>
          <span>{request.reason}</span>
        </div>

        <div style={{ marginTop: 24 }}>
          <label style={styles.label}>Option 1 · Assign directly to a coach</label>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="salus-input"
            style={styles.select}
          >
            <option value="">Choose a coach…</option>
            {otherCoaches.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => assignTo && onAssign(assignTo)}
            disabled={!assignTo}
            className="salus-btn"
            style={{ ...styles.btnPrimary, marginTop: 10, opacity: assignTo ? 1 : 0.5 }}
          >
            Assign &amp; notify
          </button>
        </div>

        <div style={styles.orDivider}>
          <span>or</span>
        </div>

        <div>
          <label style={styles.label}>Option 2 · Post to the cover board</label>
          <p style={{ ...styles.hint, marginTop: 0, marginBottom: 10 }}>
            All coaches will be able to claim it. First to volunteer takes the class.
          </p>
          <button onClick={onPost} className="salus-btn" style={styles.btnSecondary}>
            Post to cover board
          </button>
        </div>

        <div style={styles.orDivider}>
          <span>or</span>
        </div>

        <div>
          <label style={styles.label}>Option 3 · Decline this request</label>
          <p style={{ ...styles.hint, marginTop: 0, marginBottom: 10 }}>
            The class stays with {requester.name.split(' ')[0]}. Worth a quick chat with them.
          </p>
          <button onClick={onDecline} className="salus-btn" style={styles.btnDanger}>
            Decline request
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditClassModal({ classObj, data, onClose, onSave }) {
  const isNew = !classObj;
  const [day, setDay] = useState(classObj?.day ?? 0);
  const [time, setTime] = useState(classObj?.time ?? '09:00');
  const [dur, setDur] = useState(classObj?.dur ?? 45);
  const [type, setType] = useState(classObj?.type ?? Object.keys(CLASS_TYPES)[0]);
  const [studio, setStudio] = useState(classObj?.studio ?? 'reformer');
  const [coachId, setCoachId] = useState(classObj?.coachId ?? data.users.find(u => u.role === 'coach')?.id);

  const coaches = data.users.filter(u => u.role === 'coach');
  const typeCfg = CLASS_TYPES[type];

  const handleSave = () => {
    if (!time || !type || !coachId || !studio) return;
    const dayNum = Number(day);
    onSave({
      day: dayNum,
      date: DATES[dayNum],
      time,
      dur: Number(dur),
      type,
      coachId,
      studio,
    });
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ borderTop: `4px solid ${typeCfg.color}`, padding: 24 }}>
        <div style={styles.modalDayBadge}>{isNew ? 'New class' : 'Edit class'}</div>
        <h2 style={{ ...styles.h2, marginTop: 8, marginBottom: 20 }}>
          {isNew ? 'Add to timetable' : type}
        </h2>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Day</label>
            <select value={day} onChange={(e) => setDay(e.target.value)} className="salus-input" style={styles.select}>
              {DAYS.map((d, i) => <option key={d} value={i}>{DAY_LABELS[i]} May</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="salus-input"
              style={styles.select}
            />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Duration</label>
            <select value={dur} onChange={(e) => setDur(e.target.value)} className="salus-input" style={styles.select}>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={75}>75 min</option>
              <option value={90}>90 min</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>Studio</label>
            <select value={studio} onChange={(e) => setStudio(e.target.value)} className="salus-input" style={styles.select}>
              {Object.entries(STUDIOS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={styles.label}>Class type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="salus-input" style={styles.select}>
            {Object.keys(CLASS_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label style={styles.label}>Coach</label>
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="salus-input" style={styles.select}>
            {coaches.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button onClick={handleSave} className="salus-btn" style={styles.btnPrimary}>
            {isNew ? 'Add class' : 'Save changes'}
          </button>
          <button onClick={onClose} className="salus-btn" style={styles.btnGhost}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

const AVATAR_COLOR_PALETTE = [
  '#b85c38', '#7a8c5c', '#5b7a8c', '#c89c4a', '#4a6b3a',
  '#8c5b7a', '#a8703a', '#6b7a8c', '#8c4a5c', '#c8442a',
  '#7a6b8c', '#8c8c4a', '#4a5c8c', '#7a8c8c', '#6b5c3a',
  '#5c7a6b', '#5c4a38',
];

// ──────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS — OneSignal subscription UI
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS — native Web Push (VAPID, stored in Supabase)
// ──────────────────────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = 'BCDujhnkO0iRoRtzHOoSj9A8gfPt6Wc_IDdfI8VJMjT6PEJWdZHiqFDyWv64Tq3XtCsNZGP_yUYNIq3daCBAfMk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function PushNotificationsSection() {
  const [status, setStatus] = useState('checking');
  // checking | not-installed | unsupported | denied | subscribed | supported
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isIOS && !isStandalone) {
      setStatus('not-installed');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing && Notification.permission === 'granted') setStatus('subscribed');
        else setStatus('supported');
      } catch {
        setStatus('supported');
      }
    })();
  }, []);

  const handleEnable = async () => {
    setWorking(true);
    setErrorMsg('');

    try {
      // 1. Ask iOS for permission (must run in user-gesture context — this handler is one)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'supported');
        setErrorMsg(permission === 'denied'
          ? 'Permission was denied.'
          : 'No response received. The prompt may not have appeared — make sure you opened Salus from the home screen, not Safari.');
        return;
      }

      // 2. Wait for service worker to be ready
      const reg = await navigator.serviceWorker.ready;

      // 3. Subscribe via PushManager using our VAPID public key
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 4. Save subscription to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const subJson = subscription.toJSON();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: session.user.id,
            endpoint: subJson.endpoint,
            subscription: subJson,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );
      if (error) throw error;

      setStatus('subscribed');
    } catch (e) {
      console.error('push subscribe failed', e);
      setErrorMsg(`Couldn't enable notifications: ${e.message || 'unknown error'}. Force-close and reopen from home screen, then try again.`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <h2 style={{ ...styles.h2, marginTop: 30, marginBottom: 4 }}>Push notifications</h2>
      <p style={{ ...styles.subtitle, marginBottom: 16 }}>
        Lock-screen alerts when cover is needed or someone messages the team.
      </p>
      {status === 'checking' && (
        <div style={styles.pushBox}>Checking…</div>
      )}
      {status === 'unsupported' && (
        <div style={{ ...styles.pushBox, color: '#7a8270' }}>
          Your browser doesn't support push notifications.
        </div>
      )}
      {status === 'not-installed' && (
        <div style={{ ...styles.pushBox, background: '#fef0ea', borderColor: '#e8b8a8' }}>
          <strong style={{ color: '#c8442a' }}>You're in Safari, not the installed app.</strong>
          <p style={{ fontSize: 12, color: '#1a2620', marginTop: 8, lineHeight: 1.5 }}>
            Push notifications on iPhone only work from the home-screen version. Share → Add to Home Screen → open from the beige tile.
          </p>
        </div>
      )}
      {status === 'supported' && (
        <div style={styles.pushBox}>
          <p style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
            Notifications are <strong>off</strong>. Turn them on to get a banner on your lock screen.
          </p>
          <button
            onClick={handleEnable}
            disabled={working}
            className="salus-btn"
            style={styles.btnPrimary}
          >
            {working ? 'Setting up…' : 'Turn on notifications'}
          </button>
          {errorMsg && (
            <p style={{ fontSize: 12, color: '#c8442a', marginTop: 10, lineHeight: 1.5 }}>{errorMsg}</p>
          )}
          <p style={{ fontSize: 11, color: '#a59478', marginTop: 10 }}>
            iPhone: open this app from the beige tile on your home screen. iOS 16.4 or later required.
          </p>
        </div>
      )}
      {status === 'subscribed' && (
        <div style={{ ...styles.pushBox, background: '#e8efe1', borderColor: '#c4d1b8' }}>
          <strong style={{ color: '#5c4a38' }}>✓ Notifications are on.</strong>
          <p style={{ fontSize: 12, color: '#5c4a38', marginTop: 6 }}>
            You'll get a banner when cover is needed or someone messages the team.
          </p>
        </div>
      )}
      {status === 'denied' && (
        <div style={{ ...styles.pushBox, background: '#fef0ea', borderColor: '#e8b8a8' }}>
          <strong style={{ color: '#c8442a' }}>Notifications are blocked.</strong>
          <p style={{ fontSize: 12, color: '#1a2620', marginTop: 6, lineHeight: 1.5 }}>
            iPhone Settings → Notifications → Salus Staff → toggle Allow Notifications on, then come back.
          </p>
        </div>
      )}
    </>
  );
}

function PushNotificationsSection_DISABLED_NEEDS_ONESIGNAL_IOS26_FIX() {
  const [status, setStatus] = useState('checking'); // checking | supported | subscribed | denied | unsupported | not-installed
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check current state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    // Detect iOS Safari outside of installed PWA — push won't work
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isIOS && !isStandalone) {
      setStatus('not-installed');
      return;
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        const perm = OneSignal.Notifications.permission;
        if (perm === true) setStatus('subscribed');
        else if (Notification.permission === 'denied') setStatus('denied');
        else setStatus('supported');
      } catch {
        setStatus('supported');
      }
    });
  }, []);

  const handleEnable = async () => {
    setWorking(true);
    setErrorMsg('');

    // 15-second safety net so the button can never hang forever
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    const request = new Promise((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          const result = await OneSignal.Notifications.requestPermission();
          resolve({ result, OneSignal });
        } catch (e) {
          reject(e);
        }
      });
    });

    try {
      const { OneSignal } = await Promise.race([request, timeout]);
      const perm = OneSignal.Notifications.permission;
      if (perm === true) {
        setStatus('subscribed');
      } else if (Notification.permission === 'denied') {
        setStatus('denied');
      } else {
        // Prompt was dismissed without choosing — stay on supported
        setErrorMsg('No response received. If the iOS prompt didn\'t appear, the app likely isn\'t opened from your home screen.');
      }
    } catch (e) {
      if (e?.message === 'TIMEOUT') {
        setErrorMsg('The notification prompt didn\'t appear. Make sure you opened Salus Staff from the beige tile on your home screen (not from Safari). Force-close the app and reopen it from the home screen, then try again.');
      } else {
        setErrorMsg('Something went wrong turning on notifications. Try force-closing the app and reopening from the home screen.');
      }
      console.error('push enable failed', e);
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <h2 style={{ ...styles.h2, marginTop: 30, marginBottom: 4 }}>Push notifications</h2>
      <p style={{ ...styles.subtitle, marginBottom: 16 }}>
        Get alerts on your phone when cover is needed or someone messages the team.
      </p>
      {status === 'checking' && (
        <div style={styles.pushBox}>Checking…</div>
      )}
      {status === 'unsupported' && (
        <div style={{ ...styles.pushBox, color: '#7a8270' }}>
          Your browser doesn't support push notifications. Try Safari (after installing the app to your home screen) or Chrome.
        </div>
      )}
      {status === 'not-installed' && (
        <div style={{ ...styles.pushBox, background: '#fef0ea', borderColor: '#e8b8a8' }}>
          <strong style={{ color: '#c8442a' }}>You're in Safari, not the installed app.</strong>
          <p style={{ fontSize: 12, color: '#1a2620', marginTop: 8, lineHeight: 1.5 }}>
            iPhone push notifications only work from the home-screen version of Salus Staff. To fix:
          </p>
          <ol style={{ fontSize: 12, color: '#1a2620', marginTop: 8, paddingLeft: 20, lineHeight: 1.6 }}>
            <li>Tap the <strong>Share</strong> button (square with arrow up)</li>
            <li>Scroll down → <strong>Add to Home Screen</strong> → tap Add</li>
            <li>Close Safari completely (swipe up, flick away)</li>
            <li>Open the <strong>beige Salus tile</strong> from your home screen</li>
            <li>Come back to this Settings page and try again</li>
          </ol>
        </div>
      )}
      {status === 'supported' && (
        <div style={styles.pushBox}>
          <p style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
            Notifications are <strong>off</strong>. Turn them on to get a banner on your lock screen for cover requests and chat messages.
          </p>
          <button
            onClick={handleEnable}
            disabled={working}
            className="salus-btn"
            style={styles.btnPrimary}
          >
            {working ? 'Asking…' : 'Turn on notifications'}
          </button>
          {errorMsg && (
            <p style={{ fontSize: 12, color: '#c8442a', marginTop: 10, lineHeight: 1.5 }}>
              {errorMsg}
            </p>
          )}
          <p style={{ fontSize: 11, color: '#a59478', marginTop: 10 }}>
            On iPhone: you must have added Salus Staff to your home screen first. iOS 16.4 or later required.
          </p>
        </div>
      )}
      {status === 'subscribed' && (
        <div style={{ ...styles.pushBox, background: '#e8efe1', borderColor: '#c4d1b8' }}>
          <strong style={{ color: '#5c4a38' }}>✓ Notifications are on.</strong>
          <p style={{ fontSize: 12, color: '#5c4a38', marginTop: 6 }}>
            You'll get a banner when cover is needed or someone messages the team chat.
          </p>
        </div>
      )}
      {status === 'denied' && (
        <div style={{ ...styles.pushBox, background: '#fef0ea', borderColor: '#e8b8a8' }}>
          <strong style={{ color: '#c8442a' }}>Notifications are blocked.</strong>
          <p style={{ fontSize: 12, color: '#1a2620', marginTop: 6, lineHeight: 1.5 }}>
            You denied permission previously. To turn back on:
            <br/>iPhone: Settings → Salus Staff → Notifications → Allow.
            <br/>Browser: site settings → Notifications → Allow.
          </p>
        </div>
      )}
    </>
  );
}

function SettingsModal({ user, isManager, onClose, onSave }) {
  const isCoverCoach = user.coachType === 'cover';
  const defaults = isManager ? DEFAULT_MANAGER_PREFS : isCoverCoach ? DEFAULT_COVER_PREFS : DEFAULT_COACH_PREFS;

  const [email, setEmail] = useState(user.email || '');
  const [name, setName] = useState(user.name || '');
  const [initials, setInitials] = useState(user.initials || '');
  const [color, setColor] = useState(user.color || '#7a8c5c');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || null);
  const [bankAccount, setBankAccount] = useState(user.bankAccount || '');
  const [bankSortCode, setBankSortCode] = useState(user.bankSortCode || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [prefs, setPrefs] = useState({ ...defaults, ...(user.emailPrefs || {}) });

  const togglePref = (key) => setPrefs({ ...prefs, [key]: !prefs[key] });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Photo must be under 5MB');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('avatar upload', err);
      setUploadError(err.message || 'Upload failed. Check that the avatars storage bucket exists.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleSave = () => onSave({
    email,
    name: name.trim() || user.name,
    initials: initials.trim().toUpperCase().slice(0, 3) || user.initials,
    color,
    avatarUrl,
    bankAccount: bankAccount.trim(),
    bankSortCode: bankSortCode.trim(),
    emailPrefs: prefs,
  });

  // Preview user object for the avatar preview
  const previewUser = { ...user, name, initials, color, avatarUrl };

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <div style={styles.modalDayBadge}>
          Settings · {user.name}
          {isCoverCoach && <span style={{ ...styles.coachTypeBadge, ...styles.coachTypeCover, marginLeft: 8 }}>Cover coach</span>}
        </div>

        <h2 style={{ ...styles.h2, marginTop: 8, marginBottom: 4 }}>Profile</h2>
        <p style={{ ...styles.subtitle, marginBottom: 20 }}>
          How you appear across the team.
        </p>

        {/* Avatar preview + upload */}
        <div style={styles.avatarRow}>
          <UserAvatar user={previewUser} size={64} fontSize={22} />
          <div style={{ flex: 1 }}>
            <label htmlFor="avatar-upload" className="salus-btn" style={styles.avatarUploadBtn}>
              {uploading ? 'Uploading…' : (avatarUrl ? 'Change photo' : 'Upload photo')}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
            {avatarUrl && (
              <button onClick={handleRemoveAvatar} className="salus-btn" style={styles.avatarRemoveBtn}>
                Remove
              </button>
            )}
            <div style={styles.avatarHint}>JPEG or PNG · max 5MB</div>
            {uploadError && <div style={{ ...styles.loginError, marginTop: 8 }}>{uploadError}</div>}
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="salus-input"
              style={styles.select}
            />
          </div>
          <div>
            <label style={styles.label}>Initials</label>
            <input
              type="text"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 3))}
              className="salus-input"
              style={styles.select}
              maxLength={3}
              placeholder="e.g. TO"
            />
          </div>
        </div>

        <label style={styles.label}>Profile colour</label>
        <div style={styles.colorPickerRow}>
          <input
            type="color"
            value={color || '#5c4a38'}
            onChange={(e) => setColor(e.target.value)}
            style={styles.colorPickerWell}
            aria-label="Pick a profile colour"
          />
          <input
            type="text"
            value={color || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v);
            }}
            placeholder="#5c4a38"
            className="salus-input"
            style={styles.colorPickerHex}
            maxLength={7}
          />
          <div style={{ ...styles.colorPickerPreview, background: color || '#5c4a38' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
              {(user?.name || '').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#a59478', marginTop: 6, marginBottom: 20 }}>
          Tap the swatch to pick any colour, or type a hex code like #c8442a.
        </p>

        <PushNotificationsSection />

        <h2 style={{ ...styles.h2, marginTop: 30, marginBottom: 4 }}>Bank details</h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          {isManager
            ? 'For your own records — coaches add their bank details so you can pay them.'
            : 'Used for invoicing. Only the manager can see these.'}
        </p>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Account number</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              className="salus-input"
              style={styles.select}
              placeholder="12345678"
              maxLength={8}
            />
          </div>
          <div>
            <label style={styles.label}>Sort code</label>
            <input
              type="text"
              value={bankSortCode}
              onChange={(e) => {
                let v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                // Auto-format as XX-XX-XX
                if (v.length > 4) v = v.slice(0, 2) + '-' + v.slice(2, 4) + '-' + v.slice(4);
                else if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2);
                setBankSortCode(v);
              }}
              className="salus-input"
              style={styles.select}
              placeholder="12-34-56"
              maxLength={8}
            />
          </div>
        </div>

        <h2 style={{ ...styles.h2, marginTop: 30, marginBottom: 4 }}>Email notifications</h2>
        <p style={{ ...styles.subtitle, marginBottom: 20 }}>
          {isCoverCoach
            ? "We'll email you when cover opportunities open up."
            : 'Choose when we should email you.'}
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={styles.label}>Your email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="salus-input"
            style={styles.select}
            placeholder="you@salus.house"
          />
        </div>

        {/* COVER COACH VIEW — different priorities */}
        {isCoverCoach && (
          <>
            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Cover opportunities</div>

              <PrefToggle
                label="When a new cover request is posted"
                hint="The main reason you're here — get notified as soon as a shift opens up"
                checked={prefs.coverPosted}
                onChange={() => togglePref('coverPosted')}
              />

              <PrefToggle
                label="When the manager assigns me a class"
                hint="Urgent — you've just been picked to cover"
                checked={prefs.assignedCover}
                onChange={() => togglePref('assignedCover')}
              />

              <PrefToggle
                label="When someone else is picked for a class I marked available"
                hint="Courtesy heads-up so you know the slot is filled"
                checked={prefs.notSelected}
                onChange={() => togglePref('notSelected')}
              />
            </div>

            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Reminders</div>

              <PrefToggle
                label="24 hours before classes I'm covering"
                hint="A heads-up the day before"
                checked={prefs.classReminder24h}
                onChange={() => togglePref('classReminder24h')}
              />
            </div>

            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Summaries</div>

              <PrefToggle
                label="Weekly summary of available shifts"
                hint="Every Sunday evening — all open requests for the coming week in one email"
                checked={prefs.weeklyOpportunities}
                onChange={() => togglePref('weeklyOpportunities')}
              />
            </div>
          </>
        )}

        {/* PERMANENT COACH VIEW */}
        {!isManager && !isCoverCoach && (
          <>
            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Cover &amp; schedule</div>

              <PrefToggle
                label="When the manager assigns me cover"
                hint="Urgent — you've just been put on a class"
                checked={prefs.assignedCover}
                onChange={() => togglePref('assignedCover')}
              />
              <PrefToggle
                label="When a class is posted to the cover board"
                hint="So you can claim it before someone else does"
                checked={prefs.coverPosted}
                onChange={() => togglePref('coverPosted')}
              />
              <PrefToggle
                label="24 hours before my classes"
                hint="A quick heads-up the day before"
                checked={prefs.classReminder24h}
                onChange={() => togglePref('classReminder24h')}
              />
            </div>

            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Summaries</div>
              <PrefToggle
                label="Weekly schedule summary"
                hint="Every Sunday evening — your classes for the week ahead"
                checked={prefs.weeklySummary}
                onChange={() => togglePref('weeklySummary')}
              />
            </div>
          </>
        )}

        {/* MANAGER VIEW */}
        {isManager && (
          <>
            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Cover requests</div>

              <PrefToggle
                label="When a coach requests cover"
                hint="Sent to you so you can review and decide"
                checked={prefs.newCoverRequest}
                onChange={() => togglePref('newCoverRequest')}
              />
              <PrefToggle
                label="When a coach claims a posted cover request"
                hint="Nice to know who's stepping up"
                checked={prefs.coverClaimed}
                onChange={() => togglePref('coverClaimed')}
              />
            </div>

            <div style={styles.prefsSection}>
              <div style={styles.prefsHeader}>Summaries</div>
              <PrefToggle
                label="Weekly activity summary"
                hint="Every Sunday evening — covers, swaps, hours per coach"
                checked={prefs.weeklyActivity}
                onChange={() => togglePref('weeklyActivity')}
              />
            </div>
          </>
        )}

        <div style={styles.infoBox}>
          <Mail size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Emails will be sent to the address above once Phase 2 deployment is complete.
            Your preferences are saved now and will apply automatically on first email.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button onClick={handleSave} className="salus-btn" style={styles.btnPrimary}>
            Save settings
          </button>
          <button onClick={onClose} className="salus-btn" style={styles.btnGhost}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function PrefToggle({ label, hint, checked, onChange }) {
  return (
    <button onClick={onChange} className="salus-btn" style={styles.prefRow}>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.prefLabel}>{label}</div>
        {hint && <div style={styles.prefHint}>{hint}</div>}
      </div>
      <div style={{
        ...styles.toggleTrack,
        background: checked ? '#ede4cf' : 'rgba(245,241,232,0.12)',
      }}>
        <div style={{
          ...styles.toggleKnob,
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          background: checked ? '#1a1714' : 'rgba(245,241,232,0.6)',
        }} />
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// INVOICES — generate printable HTML invoices for each coach
// ──────────────────────────────────────────────────────────────────────────────

function generateInvoiceHtml({ coach, sessions, rate, fromDate, toDate }) {
  const subtotal = sessions.length * rate;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNumber = `SAL-${Date.now().toString().slice(-6)}-${coach.initials}`;
  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const dateRange = fromDate && toDate
    ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
    : sessions.length > 0
      ? (() => {
          const dates = sessions.map(s => s.date).filter(Boolean).sort();
          return dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'this week';
        })()
      : 'this week';
  const rowsHtml = sessions.map(s => `
    <tr>
      <td>${s.date || '—'}</td>
      <td>${DAYS[s.day] || ''}</td>
      <td>${s.time}</td>
      <td>${s.type}</td>
      <td>${(s.studio || '').toUpperCase()}</td>
      <td style="text-align:right">£${rate.toFixed(2)}</td>
    </tr>
  `).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${invoiceNumber} — ${coach.name}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a2620; max-width: 760px; margin: 40px auto; padding: 40px; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 30px; border-bottom: 2px solid #5c4a38; margin-bottom: 30px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-mark { width: 48px; height: 48px; border-radius: 12px; background: #5c4a38; color: #f5f1e8; display: flex; align-items: center; justify-content: center; font-family: 'Georgia', serif; font-size: 26px; font-weight: 600; }
  .brand-name { font-family: 'Georgia', serif; font-size: 24px; font-weight: 500; }
  .brand-sub { font-size: 11px; color: #7a8270; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
  .invoice-meta { text-align: right; font-size: 13px; color: #7a8270; }
  .invoice-num { font-size: 18px; color: #5c4a38; font-weight: 700; margin-bottom: 6px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
  .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a59478; margin: 0 0 8px; font-weight: 600; }
  .party-name { font-size: 16px; font-weight: 600; }
  .party-detail { font-size: 13px; color: #5a5a4a; margin-top: 4px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { text-align: left; padding: 12px 10px; background: #f5f1e8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5c4a38; border-bottom: 2px solid #5c4a38; }
  th:last-child { text-align: right; }
  td { padding: 10px; font-size: 13px; border-bottom: 1px solid #ebe3cf; }
  tfoot td { font-weight: 700; font-size: 15px; padding-top: 16px; border-bottom: none; border-top: 2px solid #5c4a38; }
  tfoot td:last-child { color: #5c4a38; font-size: 18px; }
  .footer-note { font-size: 12px; color: #7a8270; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ebe3cf; line-height: 1.6; }
  .bank-details-warn { background: #fff5e5; border: 1px solid #ffc88a; padding: 12px 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #8c5b1a; }
  @media print {
    body { margin: 0; padding: 20px; }
    @page { margin: 1.5cm; }
  }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 12px 20px; background: #5c4a38; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
<div class="header">
  <div class="brand">
    <div class="brand-mark">S</div>
    <div>
      <div class="brand-name">Salus House</div>
      <div class="brand-sub">17 Foots Cray High St, Sidcup DA14 5HJ</div>
    </div>
  </div>
  <div class="invoice-meta">
    <div class="invoice-num">INVOICE ${invoiceNumber}</div>
    <div>Issued: ${today}</div>
    <div>Period: ${dateRange}</div>
  </div>
</div>
${(!coach.bankAccount || !coach.bankSortCode) ? `<div class="bank-details-warn">⚠ ${coach.name} has not added bank details to their profile yet. Ask them to fill these in via Settings.</div>` : ''}
<div class="parties">
  <div class="party">
    <h3>From</h3>
    <div class="party-name">Salus House</div>
    <div class="party-detail">17 Foots Cray High St<br>Foots Cray, Sidcup DA14 5HJ<br>reception@salus.house</div>
  </div>
  <div class="party">
    <h3>Pay to</h3>
    <div class="party-name">${coach.name}</div>
    <div class="party-detail">
      ${coach.email || ''}<br>
      ${coach.bankAccount ? `Account: <strong>${coach.bankAccount}</strong>` : '<em style="color:#c8442a">No account number on file</em>'}<br>
      ${coach.bankSortCode ? `Sort code: <strong>${coach.bankSortCode}</strong>` : '<em style="color:#c8442a">No sort code on file</em>'}
    </div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Day</th>
      <th>Time</th>
      <th>Class</th>
      <th>Studio</th>
      <th>Fee</th>
    </tr>
  </thead>
  <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:30px;color:#a59478">No sessions taught in this period.</td></tr>'}</tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="text-align:right">Total (${sessions.length} session${sessions.length === 1 ? '' : 's'} × £${rate.toFixed(2)})</td>
      <td style="text-align:right">£${subtotal.toFixed(2)}</td>
    </tr>
  </tfoot>
</table>
<div class="footer-note">
  Payment terms: 7 days from issue. Please pay by bank transfer to the account above.<br>
  Questions about this invoice? Contact reception@salus.house.
</div>
</body>
</html>`;
}

function downloadInvoice({ coach, sessions, rate, fromDate, toDate }) {
  const html = generateInvoiceHtml({ coach, sessions, rate, fromDate, toDate });
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Fallback if popup blocked: download as file
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${coach.name.replace(/\s+/g, '-')}-${Date.now()}.html`;
    a.click();
  }
}

function InvoicesModal({ data, onClose }) {
  const coaches = data.users.filter(u => u.role === 'coach');
  const rate = RATE_PER_SESSION;

  // Default range: this week (Monday to Sunday)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = toIsoDate(today);
  const thisMon = getMonday(today);
  const thisSun = addDays(thisMon, 6);

  const [fromDate, setFromDate] = useState(toIsoDate(thisMon));
  const [toDate, setToDate] = useState(toIsoDate(thisSun));

  // Quick-range presets
  const setRange = (preset) => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    if (preset === 'thisWeek') {
      const m = getMonday(t);
      setFromDate(toIsoDate(m));
      setToDate(toIsoDate(addDays(m, 6)));
    } else if (preset === 'lastWeek') {
      const m = addDays(getMonday(t), -7);
      setFromDate(toIsoDate(m));
      setToDate(toIsoDate(addDays(m, 6)));
    } else if (preset === 'thisMonth') {
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      setFromDate(toIsoDate(first));
      setToDate(toIsoDate(last));
    } else if (preset === 'lastMonth') {
      const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const last = new Date(t.getFullYear(), t.getMonth(), 0);
      setFromDate(toIsoDate(first));
      setToDate(toIsoDate(last));
    }
  };

  const buildSessions = (coach) => data.classes
    .filter(c => c.coachId === coach.id && c.date >= fromDate && c.date <= toDate)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.time.localeCompare(b.time));

  const total = coaches.reduce((s, c) => s + buildSessions(c).length * rate, 0);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Is preset active?
  const isPreset = (preset) => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    if (preset === 'thisWeek') {
      const m = getMonday(t);
      return fromDate === toIsoDate(m) && toDate === toIsoDate(addDays(m, 6));
    } else if (preset === 'lastWeek') {
      const m = addDays(getMonday(t), -7);
      return fromDate === toIsoDate(m) && toDate === toIsoDate(addDays(m, 6));
    } else if (preset === 'thisMonth') {
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      return fromDate === toIsoDate(first) && toDate === toIsoDate(last);
    } else if (preset === 'lastMonth') {
      const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const last = new Date(t.getFullYear(), t.getMonth(), 0);
      return fromDate === toIsoDate(first) && toDate === toIsoDate(last);
    }
    return false;
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <div style={styles.modalDayBadge}>Invoices · £{rate}/session</div>
        <h2 style={{ ...styles.h2, marginTop: 8, marginBottom: 4 }}>
          Coach payments · {formatDate(fromDate)} – {formatDate(toDate)}
        </h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          Pick the period you want to invoice for, then download a printable PDF for each coach.
        </p>

        {/* Quick-range presets */}
        <div style={styles.invoicePresetRow}>
          {[
            { key: 'thisWeek',  label: 'This week' },
            { key: 'lastWeek',  label: 'Last week' },
            { key: 'thisMonth', label: 'This month' },
            { key: 'lastMonth', label: 'Last month' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setRange(p.key)}
              className="salus-btn"
              style={{
                ...styles.invoicePresetPill,
                ...(isPreset(p.key) ? styles.invoicePresetPillActive : {}),
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div style={styles.invoiceDateRow}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="salus-input"
              style={styles.invoiceDateInput}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="salus-input"
              style={styles.invoiceDateInput}
            />
          </div>
        </div>

        <div style={styles.invoiceList}>
          {coaches.map(coach => {
            const sessions = buildSessions(coach);
            const earnings = sessions.length * rate;
            const hasBank = !!(coach.bankAccount && coach.bankSortCode);
            return (
              <div key={coach.id} style={styles.invoiceRow}>
                <UserAvatar user={coach} size={36} fontSize={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.invoiceName}>
                    {coach.name}
                    {!hasBank && <span style={styles.invoiceWarn}>· no bank details</span>}
                  </div>
                  <div style={styles.invoiceDetail}>
                    {sessions.length} session{sessions.length === 1 ? '' : 's'} · £{earnings}
                  </div>
                </div>
                <button
                  onClick={() => downloadInvoice({ coach, sessions, rate, fromDate, toDate })}
                  className="salus-btn"
                  style={sessions.length === 0 ? styles.btnGhost : styles.btnPrimary}
                  disabled={sessions.length === 0}
                >
                  {sessions.length === 0 ? 'No sessions' : 'Open invoice'}
                </button>
              </div>
            );
          })}
        </div>

        <div style={styles.invoiceTotal}>
          <span>Total for {formatDate(fromDate)} – {formatDate(toDate)}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#5c4a38' }}>£{total.toLocaleString()}</span>
        </div>

        <div style={styles.infoBox}>
          <Mail size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Coaches set their bank details in <strong>Settings → Profile → Bank details</strong>.
            If any coach is missing details, the invoice will still generate but will flag the missing fields in red.
          </span>
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={onClose} className="salus-btn" style={styles.btnGhost}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

function TimeOffModal({ onClose }) {
  const upcoming = getUpcomingBankHolidays(12);
  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const daysUntil = (iso) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / (1000 * 60 * 60 * 24));
  };
  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <div style={styles.modalDayBadge}>Time off</div>
        <h2 style={{ ...styles.h2, marginTop: 8, marginBottom: 4 }}>UK Bank Holidays</h2>
        <p style={{ ...styles.subtitle, marginBottom: 20 }}>
          Upcoming public holidays for the next year. The studio is closed on these days.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.map(h => {
            const d = daysUntil(h.date);
            return (
              <div key={h.date} style={styles.holidayRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.holidayName}>{h.name}</div>
                  <div style={styles.holidayDate}>{formatDate(h.date)}</div>
                </div>
                <div style={styles.holidayCountdown}>
                  {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`}
                </div>
              </div>
            );
          })}
          {upcoming.length === 0 && (
            <div style={styles.holidayEmpty}>No upcoming bank holidays in the next year.</div>
          )}
        </div>
        <div style={styles.infoBox}>
          <Calendar size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Coach annual leave tracking is coming soon. For now, mark scheduled absences in the team chat.</span>
        </div>
        <div style={{ marginTop: 20 }}>
          <button onClick={onClose} className="salus-btn" style={styles.btnPrimary}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// URGENT COVER PROMPT — shown on login when there are open cover requests
// ──────────────────────────────────────────────────────────────────────────────

function UrgentCoverModal({ requests, classes, users, currentUser, onClaim, onView, onClose }) {
  if (!requests || requests.length === 0) return null;

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <div style={{ ...styles.modalDayBadge, background: '#fef0ea', color: '#c8442a' }}>
          {requests.length === 1 ? '1 class needs cover' : `${requests.length} classes need cover`}
        </div>
        <h2 style={{ ...styles.h2, marginTop: 8, marginBottom: 4 }}>
          {requests.length === 1 ? 'Can you help?' : 'Can you help with any of these?'}
        </h2>
        <p style={{ ...styles.subtitle, marginBottom: 18 }}>
          {currentUser.coachType === 'cover'
            ? 'Tap one to express interest — the manager will assign.'
            : 'Tap a class to claim it, or view all on the Cover Board.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {requests.slice(0, 4).map(req => {
            const cls = classes.find(c => c.id === req.classId);
            const requester = users.find(u => u.id === req.requestedBy);
            if (!cls) return null;
            return (
              <button
                key={req.id}
                onClick={() => onClaim(req)}
                className="salus-btn"
                style={styles.urgentCoverRow}
              >
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={styles.urgentCoverWhen}>
                    {DAYS[cls.day]} {cls.time} · {cls.type}
                  </div>
                  <div style={styles.urgentCoverMeta}>
                    {requester ? `${requester.name} unavailable` : 'Cover needed'} · {STUDIOS[cls.studio]?.short}
                    {req.reason ? ` · "${req.reason.slice(0, 40)}${req.reason.length > 40 ? '…' : ''}"` : ''}
                  </div>
                </div>
                <ChevronRight size={16} color="#5c4a38" />
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onView} className="salus-btn" style={styles.btnPrimary}>
            View Cover Board
          </button>
          <button onClick={onClose} className="salus-btn" style={styles.btnGhost}>
            Later
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <h3 style={{ ...styles.h3, marginTop: 0 }}>{title}</h3>
        <p style={{ color: '#666', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onConfirm} className="salus-btn" style={styles.btnPrimary}>{confirmLabel}</button>
          <button onClick={onClose} className="salus-btn" style={styles.btnGhost}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PICK CLASS — when user taps "I need cover", shows their upcoming classes
// ──────────────────────────────────────────────────────────────────────────────

function PickClassModal({ data, currentUser, isManager, onPick, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const eligible = isManager
    ? data.classes.filter(c => c.date >= today && c.status !== 'needsCover').slice(0, 30)
    : data.classes.filter(c => c.coachId === currentUser.id && c.date >= today && c.status !== 'needsCover');
  const sorted = [...eligible].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <h2 style={{ ...styles.h2, marginTop: 0, marginBottom: 4 }}>Which class needs cover?</h2>
        <p style={{ ...styles.subtitle, marginBottom: 16 }}>
          {isManager
            ? 'Pick any upcoming class to post cover for.'
            : 'Pick one of your upcoming classes.'}
        </p>
        {sorted.length === 0 ? (
          <p style={{ fontSize: 13, color: '#7a8270', padding: 20, textAlign: 'center' }}>
            No upcoming classes to request cover for.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(cls => {
              const dayLabel = new Date(cls.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <button
                  key={cls.id}
                  onClick={() => onPick(cls.id)}
                  className="salus-btn"
                  style={styles.pickClassRow}
                >
                  <div style={{ minWidth: 80, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{dayLabel}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#5c4a38', marginTop: 2 }}>{cls.time}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2620' }}>{cls.type}</div>
                    <div style={{ fontSize: 11, color: '#7a8270', marginTop: 2 }}>{cls.dur} min · {STUDIOS[cls.studio]?.short}</div>
                  </div>
                  <ChevronRight size={16} color="#a59478" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COVER THREAD MODAL — Slack-style conversation for each cover request
// ──────────────────────────────────────────────────────────────────────────────

function CoverThreadModal({ coverRequest, classObj, data, currentUser, isManager, onClose, onClaim, onCancel, onExpressInterest, onApprove, onAssignTo }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const requester = data.users.find(u => u.id === coverRequest.requestedBy);
  const dayLabel = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][classObj.day];
  const dateLabel = new Date(classObj.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const interested = data.users.filter(u => coverRequest.interestedCovers?.includes(u.id));
  const isPermanent = currentUser.coachType === 'permanent';
  const isRequester = currentUser.id === coverRequest.requestedBy;

  // Load messages on open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: msgs, error } = await supabase
        .from('cover_messages')
        .select('*')
        .eq('cover_request_id', coverRequest.id)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMessages(msgs || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [coverRequest.id]);

  // Realtime subscription — new messages appear instantly
  useEffect(() => {
    const channel = supabase
      .channel(`cover-thread-${coverRequest.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cover_messages', filter: `cover_request_id=eq.${coverRequest.id}` },
        (payload) => {
          setMessages(prev => {
            // De-dupe in case the optimistic update already added it
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coverRequest.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const { error } = await supabase
      .from('cover_messages')
      .insert({
        cover_request_id: coverRequest.id,
        user_id: currentUser.id,
        text: text,
      });
    if (error) {
      setDraft(text); // restore
      console.error('send failed', error);
    }
    setSending(false);
  };

  const handleClaim = () => { onClaim(coverRequest); onClose(); };
  const handleCancel = () => { onCancel(coverRequest.id); onClose(); };
  const handleInterest = () => { onExpressInterest(coverRequest.id); };

  const formatTime = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>Cover thread</div>
          <div style={{ width: 36 }} />
        </div>

        {/* Class summary card */}
        <div style={styles.threadClassCard}>
          <div style={styles.threadClassDate}>{dateLabel}</div>
          <div style={styles.threadClassTitle}>{classObj.time} · {classObj.type}</div>
          <div style={styles.threadClassMeta}>{classObj.dur} min · {STUDIOS[classObj.studio]?.short}</div>
          {requester && (
            <div style={styles.threadRequester}>
              <UserAvatar user={requester} size={22} fontSize={10} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2620' }}>
                  {requester.name} can't make it
                </div>
                {coverRequest.reason && (
                  <div style={styles.threadReason}>"{coverRequest.reason}"</div>
                )}
              </div>
            </div>
          )}
          {interested.length > 0 && (
            <div style={styles.threadInterestedBar}>
              <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600 }}>
                Interested:
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {interested.map(u => (
                  <div key={u.id} style={styles.threadInterestedAv}>
                    <UserAvatar user={u} size={22} fontSize={10} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {coverRequest.status === 'open' && !isRequester && (
          <div style={styles.threadActionBar}>
            {isPermanent && (
              <button onClick={handleClaim} className="salus-btn" style={styles.threadClaimBtn}>
                <Check size={16} /> Claim shift
              </button>
            )}
            {!isPermanent && (
              <button
                onClick={handleInterest}
                disabled={interested.some(u => u.id === currentUser.id)}
                className="salus-btn"
                style={{
                  ...styles.threadClaimBtn,
                  ...(interested.some(u => u.id === currentUser.id) ? styles.threadClaimBtnDisabled : {})
                }}
              >
                {interested.some(u => u.id === currentUser.id) ? '✓ Interest noted' : 'I\'m interested'}
              </button>
            )}
          </div>
        )}
        {isRequester && (coverRequest.status === 'open' || coverRequest.status === 'pending') && (
          <div style={styles.threadActionBar}>
            <button onClick={handleCancel} className="salus-btn" style={styles.threadCancelBtn}>
              Cancel my request
            </button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} style={styles.threadMessages}>
          {loading && (
            <div style={styles.threadEmpty}>Loading…</div>
          )}
          {!loading && messages.length === 0 && (
            <div style={styles.threadEmpty}>
              <MessageSquare size={28} color="#c4b8a0" />
              <div style={{ marginTop: 8, fontSize: 13, color: '#7a8270' }}>
                No messages yet
              </div>
              <div style={{ fontSize: 11, color: '#a59478', marginTop: 4 }}>
                Ask a question, offer cover, or chat about this shift.
              </div>
            </div>
          )}
          {!loading && messages.map((msg) => {
            const author = data.users.find(u => u.id === msg.user_id);
            const isMine = msg.user_id === currentUser.id;
            return (
              <div key={msg.id} style={{ ...styles.threadMsgRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                {!isMine && author && (
                  <UserAvatar user={author} size={28} fontSize={11} />
                )}
                <div style={{ ...styles.threadMsgBubble, ...(isMine ? styles.threadMsgBubbleMine : {}) }}>
                  {!isMine && author && (
                    <div style={styles.threadMsgAuthor}>{author.name?.split(' ')[0] || 'Someone'}</div>
                  )}
                  <div style={styles.threadMsgText}>{msg.text}</div>
                  <div style={{ ...styles.threadMsgTime, ...(isMine ? { color: 'rgba(255,255,255,0.6)' } : {}) }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div style={styles.threadInputBar}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Reply…"
            style={styles.threadInput}
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="salus-btn"
            style={{ ...styles.threadSendBtn, ...((!draft.trim() || sending) ? styles.threadSendBtnDisabled : {}) }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DAY DETAIL MODAL — tap a date in 3-Month view → see schedule for that day
// Direct flow: pick day → see classes → tap own class → request cover
// ──────────────────────────────────────────────────────────────────────────────

function DayDetailModal({ isoDate, data, currentUser, isManager, onClose, onClassClick }) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const dateLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysDiff = Math.round((date - today) / 86400000);
  const weeksDiff = Math.floor(Math.abs(daysDiff) / 7);
  const relativeLabel =
    daysDiff === 0  ? 'Today' :
    daysDiff === 1  ? 'Tomorrow' :
    daysDiff === -1 ? 'Yesterday' :
    daysDiff > 0 && daysDiff < 7 ? `In ${daysDiff} days` :
    daysDiff > 0 && daysDiff < 14 ? '1 week away' :
    daysDiff > 0 ? `${weeksDiff} weeks away` :
    daysDiff > -7 ? `${-daysDiff} days ago` :
    `${weeksDiff} weeks ago`;

  const dayClasses = data.classes
    .filter(c => c.date === isoDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const myCount = dayClasses.filter(c => c.coachId === currentUser.id).length;
  const coverCount = dayClasses.filter(c => c.status === 'needsCover').length;

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>{dayLabel}</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={styles.dayDetailHeader}>
          <div style={styles.dayDetailRelative}>{relativeLabel}</div>
          <div style={styles.dayDetailTitle}>{dateLabel}</div>
          <div style={styles.dayDetailMeta}>
            {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
            {myCount > 0 && ` · ${myCount} of yours`}
            {coverCount > 0 && ` · ${coverCount} need cover`}
          </div>
        </div>

        <div style={styles.dayDetailList}>
          {dayClasses.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#7a8270', fontSize: 13 }}>
              No classes scheduled this day.
            </div>
          ) : dayClasses.map(cls => {
            const coach = data.users.find(u => u.id === cls.coachId);
            const isMine = cls.coachId === currentUser.id;
            const needsCover = cls.status === 'needsCover';
            return (
              <button
                key={cls.id}
                onClick={() => onClassClick(cls.id)}
                className="salus-btn"
                style={{
                  ...styles.dayDetailRow,
                  background: needsCover ? '#fef0ea' : '#fff',
                  borderLeft: needsCover
                    ? '3px solid #c8442a'
                    : (isMine ? '3px solid #5c4a38' : '3px solid transparent'),
                }}
              >
                <div style={styles.dayDetailRowTime}>
                  <div style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 600, color: '#1a2620' }}>{cls.time}</div>
                  <div style={{ fontSize: 10, color: '#a59478', marginTop: 1 }}>{cls.dur}m</div>
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2620' }}>{cls.type}</div>
                  <div style={{ fontSize: 11, color: '#7a8270', display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    {coach && <UserAvatar user={coach} size={16} fontSize={7} />}
                    <span>{coach?.name?.split(' ')[0] || 'Unassigned'} · {STUDIOS[cls.studio]?.short}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {needsCover && (
                    <div style={styles.dayDetailTag}>Cover</div>
                  )}
                  {isMine && !needsCover && (
                    <div style={styles.dayDetailTagMine}>Tap to request cover →</div>
                  )}
                  {!isMine && !needsCover && isManager && (
                    <div style={{ ...styles.dayDetailTagMine, background: '#7a8270' }}>Tap to manage →</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HIRE STUDIO MODAL — book a studio for an event or 1:1 session
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// TEAM DIRECTORY MODAL — see everyone on the team, contact via chat
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// TASKS — manager-assigned jobs / reminders, Monday.com-style
// ──────────────────────────────────────────────────────────────────────────────

// Helper: which tasks are relevant to this user?
const TASK_STATUS_LABELS = {
  todo:        'To do',
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked:     'Blocked',
  done:        'Done',
};

const PROJECT_STATUSES = ['not_started', 'in_progress', 'blocked', 'done'];

const TASK_STATUS_COLORS = {
  todo:        { bg: '#fffdf7', fg: '#5c4a38', border: '#ebe3cf' },
  not_started: { bg: '#fffdf7', fg: '#5c4a38', border: '#ebe3cf' },
  in_progress: { bg: '#fef7e8', fg: '#c6926a', border: '#d4b87a' },
  blocked:     { bg: '#fef0ea', fg: '#c8442a', border: '#e8b8a8' },
  done:        { bg: '#f3f5ed', fg: '#5c8a5a', border: '#a8c4a6' },
};

function tasksForUser(allTasks, user) {
  if (!user) return [];
  return allTasks.filter(t => {
    if (t.audience === 'specific') return t.assigneeId === user.id;
    if (t.audience === 'all_foh')   return user.isFoh;
    if (t.audience === 'all_coach') return user.isCoach;
    if (t.audience === 'all_staff') return true;
    return false;
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// TOURS — synced from Google Calendar
// ──────────────────────────────────────────────────────────────────────────────

function ToursTile({ data, currentUser, onOpenTour }) {
  const [open, setOpen] = useState(false);
  const now = Date.now();
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const tomorrowEnd = todayStart + 2 * 86400 * 1000;

  // Show today + tomorrow's tours, scheduled only
  const upcoming = data.tours
    .filter(t => t.status !== 'cancelled' && t.startTime >= todayStart && t.startTime < tomorrowEnd)
    .sort((a, b) => a.startTime - b.startTime);

  const todays = upcoming.filter(t => t.startTime < todayStart + 86400 * 1000);
  const tomorrows = upcoming.filter(t => t.startTime >= todayStart + 86400 * 1000);

  const summary = upcoming.length === 0
    ? 'No tours today or tomorrow'
    : (todays.length > 0
        ? `${todays.length} today${tomorrows.length ? ` · ${tomorrows.length} tomorrow` : ''}`
        : `${tomorrows.length} tomorrow`);

  return (
    <HomeTile
      title="Tours"
      count={upcoming.length}
      summary={summary}
      open={open}
      onToggle={() => setOpen(o => !o)}
    >
      {upcoming.length === 0 ? (
        <div style={{ ...styles.homeEmptyCover, padding: '18px 14px' }}>
          <div style={{ fontSize: 12, color: '#7a8270' }}>No tours scheduled in the next 48 hours.</div>
          <div style={{ fontSize: 11, color: '#a59478', marginTop: 4 }}>Tours sync from your Google Calendar every 15 min.</div>
        </div>
      ) : (
        <div style={styles.tasksList}>
          {todays.length > 0 && (
            <>
              <div style={styles.toursSectionLabel}>Today</div>
              {todays.map(t => <TourCard key={t.id} tour={t} onOpen={() => onOpenTour(t.id)} />)}
            </>
          )}
          {tomorrows.length > 0 && (
            <>
              <div style={styles.toursSectionLabel}>Tomorrow</div>
              {tomorrows.map(t => <TourCard key={t.id} tour={t} onOpen={() => onOpenTour(t.id)} />)}
            </>
          )}
        </div>
      )}
    </HomeTile>
  );
}

function TourCard({ tour, onOpen }) {
  const start = new Date(tour.startTime);
  const timeLabel = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const passed = tour.startTime < Date.now();
  return (
    <button onClick={onOpen} className="salus-btn" style={{
      ...styles.taskCard,
      ...(passed && tour.status === 'scheduled' ? { opacity: 0.65 } : {}),
      ...(tour.status === 'completed' ? { background: '#f3f5ed', borderColor: '#a8c4a6' } : {}),
      ...(tour.status === 'no_show' ? { background: '#fef0ea', borderColor: '#e8b8a8' } : {}),
    }}>
      <div style={styles.tourCardTime}>
        <div style={styles.tourCardTimeMain}>{timeLabel}</div>
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.taskCardTitle}>
          {tour.guestName || tour.title || 'Tour'}
        </div>
        <div style={styles.taskCardMeta}>
          {tour.status === 'completed' && <span style={{ color: '#5c8a5a' }}>✓ Done · </span>}
          {tour.status === 'no_show' && <span style={{ color: '#c8442a' }}>✗ No-show · </span>}
          {tour.guestPhone && <span>📱 {tour.guestPhone}</span>}
          {tour.guestEmail && !tour.guestPhone && <span>✉ {tour.guestEmail}</span>}
          {!tour.guestPhone && !tour.guestEmail && <span>Tour</span>}
        </div>
      </div>
      <ChevronRight size={16} color="#a59478" />
    </button>
  );
}

function TourDetailModal({ tour, currentUser, onClose, onUpdate }) {
  const [notes, setNotes] = useState(tour?.notes || '');
  const [saving, setSaving] = useState(false);
  if (!tour) return null;

  const start = new Date(tour.startTime);
  const end = tour.endTime ? new Date(tour.endTime) : null;
  const dateLabel = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    + (end ? ` – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '');

  const handleStatus = async (status) => {
    setSaving(true);
    await onUpdate(tour.id, { status });
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await onUpdate(tour.id, { notes });
    setSaving(false);
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Tour</div>
          <div style={{ width: 36 }} />
        </div>
        <div style={styles.dayDetailHeader}>
          <div style={styles.dayDetailRelative}>FROM GOOGLE CALENDAR</div>
          <div style={styles.dayDetailTitle}>{tour.guestName || tour.title || 'Tour'}</div>
          <div style={styles.dayDetailMeta}>{dateLabel}</div>
          <div style={styles.dayDetailMeta}>{timeLabel}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {(tour.guestEmail || tour.guestPhone) && (
            <div style={{ marginBottom: 14 }}>
              <div style={styles.label}>Contact</div>
              {tour.guestPhone && (
                <a href={`tel:${tour.guestPhone}`} style={{ display: 'block', fontSize: 14, color: '#5c4a38', textDecoration: 'none', marginTop: 2 }}>
                  📱 {tour.guestPhone}
                </a>
              )}
              {tour.guestEmail && (
                <a href={`mailto:${tour.guestEmail}`} style={{ display: 'block', fontSize: 14, color: '#5c4a38', textDecoration: 'none', marginTop: 4 }}>
                  ✉ {tour.guestEmail}
                </a>
              )}
            </div>
          )}

          {tour.description && (
            <div style={{ marginBottom: 14 }}>
              <div style={styles.label}>Details from booking</div>
              <div style={styles.taskNotes}>{tour.description}</div>
            </div>
          )}

          <div style={styles.label}>Outcome</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
            {[
              { key: 'scheduled', label: 'Scheduled', color: '#5c4a38' },
              { key: 'completed', label: '✓ Done',    color: '#5c8a5a' },
              { key: 'no_show',   label: '✗ No-show', color: '#c8442a' },
              { key: 'cancelled', label: 'Cancelled', color: '#a59478' },
            ].map(s => {
              const active = tour.status === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => handleStatus(s.key)}
                  disabled={saving}
                  className="salus-btn"
                  style={{
                    padding: '9px 12px', borderRadius: 8,
                    background: active ? s.color : '#fffdf7',
                    color: active ? '#fff' : s.color,
                    border: '1px solid ' + s.color,
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                  {s.label}
                </button>
              );
            })}
          </div>

          <div style={styles.label}>Internal notes (only visible in Salus)</div>
          <textarea
            className="salus-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Member loved the reformer studio, mentioned signing up. Or — running 10 min late, called and rebooking."
            rows={4}
            style={{ width: '100%', resize: 'vertical', marginBottom: 10, fontFamily: 'inherit' }}
          />
          <button
            onClick={handleSaveNotes}
            disabled={saving || notes === (tour.notes || '')}
            className="salus-btn"
            style={{ ...styles.btnPrimary, opacity: (saving || notes === (tour.notes || '')) ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TasksTile({ data, currentUser, isManager, onCreate, onOpenTask }) {
  const [open, setOpen] = useState(false);

  // Manager sees all open tasks; everyone else sees only theirs.
  // Templates are hidden — they only spawn instances via the cron.
  const allOpen = data.tasks.filter(t =>
    !t.isTemplate
    && t.status !== 'done'
    && t.status !== 'completed'
  );
  const relevant = isManager
    ? allOpen
    : tasksForUser(allOpen, currentUser);

  const sorted = [...relevant].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt - a.createdAt;
  });

  const hasUrgent = sorted.some(t => t.priority === 'urgent');
  const summary = sorted.length === 0
    ? (isManager ? 'No open tasks' : 'Nothing to do')
    : sorted.length === 1
      ? sorted[0].title
      : `${sorted.length} open · ${sorted[0].title}`;

  return (
    <HomeTile
      title="Tasks"
      count={sorted.length}
      summary={summary}
      open={open}
      onToggle={() => setOpen(o => !o)}
      urgent={hasUrgent}
    >
      {sorted.length === 0 ? (
        <div style={{ ...styles.homeEmptyCover, padding: '18px 14px' }}>
          <div style={{ fontSize: 12, color: '#7a8270' }}>
            {isManager ? 'No open tasks. Create one below.' : 'No tasks assigned to you.'}
          </div>
        </div>
      ) : (
        <div style={styles.tasksList}>
          {sorted.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              data={data}
              currentUser={currentUser}
              onOpen={() => onOpenTask(t.id)}
            />
          ))}
        </div>
      )}
      {isManager && (
        <button onClick={onCreate} className="salus-btn" style={styles.tasksCreateBtn}>
          <Plus size={16} /> New task or reminder
        </button>
      )}
    </HomeTile>
  );
}

function TaskCard({ task, data, currentUser, onOpen }) {
  const assignee = task.assigneeId ? data.users.find(u => u.id === task.assigneeId) : null;
  const audienceLabel = {
    specific:  assignee ? assignee.name : 'Unassigned',
    all_foh:   'Everyone in FOH',
    all_coach: 'Every coach',
    all_staff: 'Everyone at Salus',
  }[task.audience];

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = task.dueDate && task.dueDate < toIsoDate(today);
  const isToday = task.dueDate === toIsoDate(today);
  const dueLabel = task.dueDate
    ? (isToday ? 'Today' : new Date(task.dueDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
    : null;

  const isProject = task.taskKind === 'project';
  const statusColor = TASK_STATUS_COLORS[task.status];
  const commentCount = data.taskComments?.filter(c => c.taskId === task.id && c.kind === 'comment').length || 0;

  return (
    <button
      onClick={onOpen}
      className="salus-btn"
      style={{
        ...styles.taskCard,
        ...(task.priority === 'urgent' ? styles.taskCardUrgent : {}),
      }}
    >
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.taskCardTitle}>
          {task.priority === 'urgent' && <span style={styles.taskUrgentDot}>●</span>}
          {isProject && <span style={{ marginRight: 5 }}>🎯</span>}
          {task.title}
        </div>
        <div style={styles.taskCardMeta}>
          <span>{audienceLabel}</span>
          {dueLabel && (
            <span style={{ color: isOverdue ? '#c8442a' : (isToday ? '#5c8a5a' : '#7a8270') }}>
              · {dueLabel}{isOverdue ? ' (overdue)' : ''}
            </span>
          )}
          {commentCount > 0 && (
            <span style={{ color: '#7a8270' }}>· 💬 {commentCount}</span>
          )}
        </div>
      </div>
      {isProject && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '4px 8px',
          borderRadius: 999, marginRight: 6,
          background: statusColor?.bg, color: statusColor?.fg,
          border: '1px solid ' + statusColor?.border,
          whiteSpace: 'nowrap',
        }}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
      )}
      <ChevronRight size={16} color="#a59478" />
    </button>
  );
}

function CreateTaskModal({ data, currentUser, onClose, onCreate }) {
  const [taskKind, setTaskKind] = useState('daily');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('specific');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    if (audience === 'specific' && !assigneeId) return;
    if ((recurrence === 'weekly' || recurrence === 'monthly') && recurrenceDays.length === 0) return;
    setSaving(true);
    const ok = await onCreate({
      title, description, assigneeId, audience, dueDate, priority,
      recurrence: taskKind === 'project' ? 'none' : recurrence,
      recurrenceDays: taskKind === 'project' ? [] : recurrenceDays,
      taskKind,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const toggleDay = (d) => {
    setRecurrenceDays(days => days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
  };

  // Sort: FOH first, then coaches, alphabetical within
  const pickableStaff = data.users
    .filter(u => u.id !== currentUser.id && (u.isFoh || u.isCoach))
    .sort((a, b) => {
      if (a.isFoh !== b.isFoh) return a.isFoh ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>New task</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <label style={styles.label}>Task kind</label>
          <div style={{ ...styles.audienceRow, marginBottom: 14 }}>
            <button onClick={() => setTaskKind('daily')} className="salus-btn"
              style={{
                ...styles.audiencePill,
                flex: 1,
                ...(taskKind === 'daily' ? styles.audiencePillActive : {}),
              }}>
              📋 Daily / routine
            </button>
            <button onClick={() => setTaskKind('project')} className="salus-btn"
              style={{
                ...styles.audiencePill,
                flex: 1,
                ...(taskKind === 'project'
                  ? { background: '#7a8c5c', color: '#fff', borderColor: '#7a8c5c' }
                  : {}),
              }}>
              🎯 Project / one-off
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#7a8270', marginBottom: 14, lineHeight: 1.4 }}>
            {taskKind === 'daily'
              ? 'Simple to-do. Tick off when done. Can repeat daily/weekly.'
              : 'Multi-stage task with status, comments, and progress tracking — best for bigger jobs.'}
          </div>

          <label style={styles.label}>What needs doing?</label>
          <input
            className="salus-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={taskKind === 'project'
              ? 'e.g. Set up new pricing tier and update marketing'
              : 'e.g. Restock towels in reformer studio'
            }
            style={{ width: '100%', marginBottom: 14 }}
            autoFocus
          />

          <label style={styles.label}>Notes (optional)</label>
          <textarea
            className="salus-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra detail or context"
            rows={3}
            style={{ width: '100%', resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
          />

          <label style={styles.label}>Who's it for?</label>
          <div style={styles.audienceRow}>
            {[
              { val: 'specific',  label: 'One person' },
              { val: 'all_foh',   label: 'All FOH' },
              { val: 'all_coach', label: 'All coaches' },
              { val: 'all_staff', label: 'Everyone' },
            ].map(a => (
              <button
                key={a.val}
                onClick={() => setAudience(a.val)}
                className="salus-btn"
                style={{
                  ...styles.audiencePill,
                  ...(audience === a.val ? styles.audiencePillActive : {}),
                }}
              >
                {a.label}
              </button>
            ))}
          </div>

          {audience === 'specific' && (
            <>
              <label style={styles.label}>Pick a person</label>
              <select
                className="salus-input"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
              >
                <option value="">— Select —</option>
                <optgroup label="FOH">
                  {pickableStaff.filter(u => u.isFoh).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Coaches">
                  {pickableStaff.filter(u => u.isCoach && !u.isFoh).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </optgroup>
              </select>
            </>
          )}

          <label style={styles.label}>Due date (optional)</label>
          <input
            className="salus-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
          />

          {taskKind !== 'project' && (
            <>
          <label style={styles.label}>Repeat</label>
          <div style={styles.audienceRow}>
            {[
              { val: 'none',    label: 'Never' },
              { val: 'daily',   label: 'Every day' },
              { val: 'weekly',  label: 'Weekly' },
              { val: 'monthly', label: 'Monthly' },
            ].map(r => (
              <button
                key={r.val}
                onClick={() => { setRecurrence(r.val); setRecurrenceDays([]); }}
                className="salus-btn"
                style={{
                  ...styles.audiencePill,
                  ...(recurrence === r.val ? styles.audiencePillActive : {}),
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {recurrence === 'weekly' && (
            <div style={{ ...styles.audienceRow, marginTop: -4 }}>
              {dayLabels.map((d, i) => {
                const picked = recurrenceDays.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className="salus-btn"
                    style={{
                      ...styles.audiencePill,
                      minWidth: 38, padding: '8px 0', textAlign: 'center',
                      ...(picked ? styles.audiencePillActive : {}),
                    }}
                  >
                    {d.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          )}

          {recurrence === 'monthly' && (
            <div style={{ marginTop: -4, marginBottom: 14 }}>
              <input
                className="salus-input"
                type="number"
                min="1" max="31"
                value={recurrenceDays[0] || ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setRecurrenceDays(n >= 1 && n <= 31 ? [n] : []);
                }}
                placeholder="Day of month (1-31)"
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
            </div>
          )}
            </>
          )}

          <label style={styles.label}>Priority</label>
          <div style={styles.audienceRow}>
            <button
              onClick={() => setPriority('normal')}
              className="salus-btn"
              style={{
                ...styles.audiencePill,
                ...(priority === 'normal' ? styles.audiencePillActive : {}),
              }}
            >
              Normal
            </button>
            <button
              onClick={() => setPriority('urgent')}
              className="salus-btn"
              style={{
                ...styles.audiencePill,
                ...(priority === 'urgent' ? { background: '#c8442a', color: '#fff', borderColor: '#c8442a' } : {}),
              }}
            >
              Urgent
            </button>
          </div>
        </div>

        <div style={styles.threadActionBar}>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || (audience === 'specific' && !assigneeId) || saving}
            className="salus-btn"
            style={{
              ...styles.threadClaimBtn,
              ...((!title.trim() || (audience === 'specific' && !assigneeId) || saving) ? styles.threadClaimBtnDisabled : {}),
            }}
          >
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, data, currentUser, isManager, onClose, onMarkDone, onSetStatus, onDelete, onAddComment, onDeleteComment }) {
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  if (!task) return null;
  const assignee = task.assigneeId ? data.users.find(u => u.id === task.assigneeId) : null;
  const creator = task.createdBy ? data.users.find(u => u.id === task.createdBy) : null;
  const completer = task.completedBy ? data.users.find(u => u.id === task.completedBy) : null;
  const isProject = task.taskKind === 'project';
  const isDone = task.status === 'done';
  const audienceLabel = {
    specific:  assignee ? `Assigned to ${assignee.name}` : 'Unassigned',
    all_foh:   'Everyone in FOH',
    all_coach: 'Every coach',
    all_staff: 'Everyone at Salus',
  }[task.audience];

  const canUpdate = isManager
    || task.assigneeId === currentUser.id
    || (task.audience === 'all_foh'   && currentUser.isFoh)
    || (task.audience === 'all_coach' && currentUser.isCoach)
    || task.audience === 'all_staff';

  const comments = data.taskComments
    .filter(c => c.taskId === task.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  const handleSendComment = async () => {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    await onAddComment(task.id, commentText);
    setCommentText('');
    setPosting(false);
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>
            {isProject ? '🎯 Project task' : '📋 Task'}
          </div>
          <div style={{ width: 36 }} />
        </div>

        <div style={styles.dayDetailHeader}>
          {task.priority === 'urgent' && (
            <div style={{ ...styles.dayDetailRelative, color: '#c8442a', fontWeight: 700 }}>
              ● URGENT
            </div>
          )}
          <div style={styles.dayDetailTitle}>{task.title}</div>
          <div style={styles.dayDetailMeta}>{audienceLabel}</div>
          {task.dueDate && (
            <div style={{ ...styles.dayDetailMeta, marginTop: 4 }}>
              Due {new Date(task.dueDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {task.description && (
            <div style={styles.taskNotes}>{task.description}</div>
          )}
          <div style={styles.taskCreatedBy}>
            Created by {creator ? creator.name : 'someone'} · {new Date(task.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Status picker — project tasks only */}
          {isProject && canUpdate && (
            <>
              <div style={{ ...styles.label, marginTop: 14 }}>Status</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
                {PROJECT_STATUSES.map(s => {
                  const active = task.status === s;
                  const c = TASK_STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => onSetStatus(task.id, s)}
                      className="salus-btn"
                      style={{
                        padding: '10px 12px', borderRadius: 8,
                        background: active ? c.fg : c.bg,
                        color: active ? '#fff' : c.fg,
                        border: '1px solid ' + (active ? c.fg : c.border),
                        fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      {TASK_STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Status read-only for non-participants */}
          {isProject && !canUpdate && (
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={styles.label}>Status</div>
              <span style={{
                display: 'inline-block',
                fontSize: 12, fontWeight: 700,
                padding: '6px 12px', borderRadius: 999,
                background: TASK_STATUS_COLORS[task.status]?.bg,
                color: TASK_STATUS_COLORS[task.status]?.fg,
                border: '1px solid ' + TASK_STATUS_COLORS[task.status]?.border,
              }}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
            </div>
          )}

          {/* Comments thread — for project tasks */}
          {isProject && (
            <div style={{ marginTop: 8, borderTop: '1px solid #efe7d2', paddingTop: 14 }}>
              <div style={styles.commentsLabel}>
                {comments.length === 0 ? 'No activity yet' : `${comments.length} activity`}
              </div>
              {comments.map(c => {
                const u = data.users.find(u => u.id === c.userId);
                const isSystem = c.kind === 'status_change';
                if (isSystem) {
                  return (
                    <div key={c.id} style={styles.taskCommentSystem}>
                      <div>{c.text}</div>
                      <div style={{ fontSize: 9, color: '#a59478', marginTop: 2 }}>
                        {new Date(c.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={c.id} style={styles.commentRow}>
                    <UserAvatar user={u} size={28} fontSize={11} />
                    <div style={{ flex: 1 }}>
                      <div style={styles.commentHeader}>
                        <span style={styles.commentAuthor}>{u?.name?.split(' ')[0] || 'Someone'}</span>
                        <span style={styles.commentTime}>
                          {new Date(c.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={styles.commentText}>{c.text}</div>
                    </div>
                    {(c.userId === currentUser.id || isManager) && (
                      <button
                        onClick={() => { if (confirm('Delete this comment?')) onDeleteComment(c.id); }}
                        className="salus-btn"
                        style={{ background: 'transparent', border: 'none', padding: 4, color: '#a59478' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Daily task: keep the done-banner */}
          {!isProject && isDone && (
            <div style={styles.taskCompletedBy}>
              ✓ Marked done by {completer ? completer.name : 'someone'} · {task.completedAt ? new Date(task.completedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          )}
        </div>

        {/* Comment composer (project tasks) OR Mark-done button (daily tasks) */}
        {isProject ? (
          <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderTop: '1px solid #ebe3cf', background: '#fffdf7' }}>
            <input
              type="text"
              className="salus-input"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              placeholder="Add a note or share feedback…"
              style={{ flex: 1, fontFamily: 'inherit' }}
            />
            <button onClick={handleSendComment}
              disabled={!commentText.trim() || posting}
              className="salus-btn"
              style={{ ...styles.sendBtn, opacity: (!commentText.trim() || posting) ? 0.5 : 1 }}>
              <Send size={16} />
            </button>
            {isManager && (
              <button
                onClick={() => { if (confirm('Delete this task?')) { onDelete(task.id); onClose(); } }}
                className="salus-btn"
                style={{ ...styles.btnGhost, color: '#c8442a' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          <div style={styles.threadActionBar}>
            {canUpdate && (
              <button
                onClick={() => { onMarkDone(task.id, !isDone); onClose(); }}
                className="salus-btn"
                style={isDone ? styles.btnGhost : styles.threadClaimBtn}>
                {isDone ? 'Mark not done' : 'Mark done'}
              </button>
            )}
            {isManager && (
              <button
                onClick={() => { if (confirm('Delete this task?')) { onDelete(task.id); onClose(); } }}
                className="salus-btn"
                style={{ ...styles.btnGhost, color: '#c8442a' }}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamDirectoryModal({ data, currentUser, isManager, onClose, onMessageInChat, onToggleRole }) {
  // Sort: manager first, then everyone alphabetical
  const sorted = [...data.users].sort((a, b) => {
    if (a.role === 'manager') return -1;
    if (b.role === 'manager') return 1;
    return (a.name || '').localeCompare(b.name || '');
  });
  const manager = sorted.find(u => u.role === 'manager');
  const coaches = sorted.filter(u => u.role !== 'manager' && u.isCoach);
  const fohOnly = sorted.filter(u => u.role !== 'manager' && u.isFoh && !u.isCoach);
  const unset = sorted.filter(u => u.role !== 'manager' && !u.isCoach && !u.isFoh);

  const RoleChip = ({ active, label, onTap, color = '#5c4a38' }) => (
    <button
      onClick={onTap}
      disabled={!onTap}
      className="salus-btn"
      style={{
        fontSize: 10, fontWeight: 700, padding: '3px 8px',
        borderRadius: 999, marginRight: 4,
        background: active ? color : 'transparent',
        color: active ? '#fff' : '#a59478',
        border: `1px solid ${active ? color : '#ebe3cf'}`,
        cursor: onTap ? 'pointer' : 'default',
        textTransform: 'uppercase', letterSpacing: 0.6,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  const renderUser = (u) => {
    const isMe = u.id === currentUser.id;
    const isMgr = u.role === 'manager';
    return (
      <div key={u.id} style={styles.teamRow}>
        <UserAvatar user={u} size={48} fontSize={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.teamRowName}>
            {u.name} {isMe && <span style={styles.teamMeTag}>You</span>}
          </div>
          <div style={{ ...styles.teamRowMeta, display: 'flex', alignItems: 'center', marginTop: 4 }}>
            {isMgr ? (
              <RoleChip active label="Manager" color="#5c4a38" />
            ) : (
              <>
                <RoleChip
                  active={u.isCoach}
                  label="Coach"
                  color="#5c4a38"
                  onTap={isManager && !isMe ? () => onToggleRole(u.id, 'isCoach', !u.isCoach) : null}
                />
                <RoleChip
                  active={u.isFoh}
                  label="FOH"
                  color="#c6926a"
                  onTap={isManager && !isMe ? () => onToggleRole(u.id, 'isFoh', !u.isFoh) : null}
                />
              </>
            )}
          </div>
        </div>
        {!isMe && (
          <button onClick={() => onMessageInChat(u.id)} className="salus-btn" style={styles.teamMessageBtn} title={`Private DM ${u.name.split(' ')[0]}`}>
            <MessageSquare size={14} /> DM
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>Your team</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {isManager && (
            <div style={{
              padding: '10px 12px', marginBottom: 12,
              background: '#fef7e8', border: '1px solid #efe7d2',
              borderRadius: 8, fontSize: 11, color: '#5c4a38', lineHeight: 1.5,
            }}>
              Tap a role chip on any person to toggle it.
              A user can be both Coach and FOH.
            </div>
          )}
          {manager && (
            <>
              <div style={styles.teamSectionLabel}>Manager</div>
              {renderUser(manager)}
            </>
          )}
          {coaches.length > 0 && (
            <>
              <div style={styles.teamSectionLabel}>Coaches ({coaches.length})</div>
              {coaches.map(renderUser)}
            </>
          )}
          {fohOnly.length > 0 && (
            <>
              <div style={styles.teamSectionLabel}>Front of House ({fohOnly.length})</div>
              {fohOnly.map(renderUser)}
            </>
          )}
          {unset.length > 0 && isManager && (
            <>
              <div style={styles.teamSectionLabel}>Awaiting role ({unset.length})</div>
              {unset.map(renderUser)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TRANSFER CLASS MODAL — privately hand a class to another coach
// ──────────────────────────────────────────────────────────────────────────────

function TransferClassModal({ classObj, data, currentUser, onClose, onTransfer }) {
  const [pickedCoachId, setPickedCoachId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const coaches = data.users
    .filter(u => u.role === 'coach' && u.id !== currentUser.id)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const dayLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][classObj.day];
  const dateLabel = new Date(classObj.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleTransfer = async () => {
    if (!pickedCoachId || submitting) return;
    setSubmitting(true);
    await onTransfer(classObj.id, pickedCoachId);
    setSubmitting(false);
    onClose();
  };

  const pickedCoach = coaches.find(c => c.id === pickedCoachId);

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>Transfer class</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={styles.dayDetailHeader}>
          <div style={styles.dayDetailRelative}>Class to transfer</div>
          <div style={styles.dayDetailTitle}>{classObj.time} · {classObj.type}</div>
          <div style={styles.dayDetailMeta}>{dateLabel} · {classObj.dur} min · {STUDIOS[classObj.studio]?.short}</div>
        </div>

        <div style={{ padding: '14px 16px 4px', flexShrink: 0 }}>
          <p style={{ fontSize: 13, color: '#7a8270', lineHeight: 1.5, margin: 0 }}>
            Only do this if you've already agreed privately with the other coach. The class will move
            from your schedule to theirs immediately — no approval needed.
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {coaches.map(c => {
            const picked = pickedCoachId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setPickedCoachId(c.id)}
                className="salus-btn"
                style={{
                  ...styles.transferCoachRow,
                  ...(picked ? styles.transferCoachRowActive : {}),
                }}
              >
                <UserAvatar user={c} size={36} fontSize={13} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2620' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#7a8270', marginTop: 2 }}>
                    {c.coachType === 'permanent' ? 'Permanent coach' : 'Cover coach'}
                  </div>
                </div>
                {picked && <Check size={20} color="#5c4a38" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>

        <div style={styles.threadActionBar}>
          <button
            onClick={handleTransfer}
            disabled={!pickedCoachId || submitting}
            className="salus-btn"
            style={{
              ...styles.threadClaimBtn,
              ...((!pickedCoachId || submitting) ? styles.threadClaimBtnDisabled : {}),
            }}
          >
            {submitting ? 'Transferring…' :
             pickedCoach ? `Transfer to ${pickedCoach.name.split(' ')[0]}` :
             'Pick a coach above'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HireStudioModal({ onClose, onSubmit, currentUser }) {
  const [hireType, setHireType] = useState('1on1'); // '1on1' | 'event'
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [dur, setDur] = useState(60);
  const [studio, setStudio] = useState('reformer');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const todayIso = toIsoDate(new Date());

  const handleSubmit = async () => {
    if (!date || !time) return;
    setSubmitting(true);
    const ok = await onSubmit({ date, time, dur, studio, hireType, notes });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={styles.threadSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}>
            <X size={20} />
          </button>
          <div style={styles.threadHeaderTitle}>Hire studio</div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 13, color: '#7a8270', marginBottom: 18, lineHeight: 1.5 }}>
            Block off a studio for a private booking. Your team will see it on the schedule. Reception will be notified to update Xplor.
          </p>

          {/* Type toggle */}
          <div style={styles.hireFieldLabel}>What's it for?</div>
          <div style={styles.hireTypeToggle}>
            <button
              onClick={() => setHireType('1on1')}
              className="salus-btn"
              style={{ ...styles.hireTypeBtn, ...(hireType === '1on1' ? styles.hireTypeBtnActive : {}) }}
            >
              1:1 Session
            </button>
            <button
              onClick={() => setHireType('event')}
              className="salus-btn"
              style={{ ...styles.hireTypeBtn, ...(hireType === 'event' ? styles.hireTypeBtnActive : {}) }}
            >
              Event / Private hire
            </button>
          </div>

          {/* Date */}
          <div style={styles.hireFieldLabel}>Date</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={todayIso}
            className="salus-input"
            style={styles.hireInput}
          />

          {/* Time + duration */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={styles.hireFieldLabel}>Start time</div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="salus-input"
                style={styles.hireInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.hireFieldLabel}>Duration</div>
              <select
                value={dur}
                onChange={(e) => setDur(Number(e.target.value))}
                className="salus-input"
                style={styles.hireInput}
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>
          </div>

          {/* Studio */}
          <div style={styles.hireFieldLabel}>Studio</div>
          <div style={styles.hireTypeToggle}>
            <button
              onClick={() => setStudio('reformer')}
              className="salus-btn"
              style={{ ...styles.hireTypeBtn, ...(studio === 'reformer' ? styles.hireTypeBtnActive : {}) }}
            >
              Reformer
            </button>
            <button
              onClick={() => setStudio('hybrid')}
              className="salus-btn"
              style={{ ...styles.hireTypeBtn, ...(studio === 'hybrid' ? styles.hireTypeBtnActive : {}) }}
            >
              Hybrid
            </button>
          </div>

          {/* Notes */}
          <div style={styles.hireFieldLabel}>
            {hireType === '1on1' ? 'Client name' : 'Event details'}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={hireType === '1on1'
              ? "e.g. Sarah Williams - regular client"
              : "e.g. Corporate wellness day for Acme Ltd, 12 attendees"}
            className="salus-input"
            style={{ ...styles.hireInput, minHeight: 80, resize: 'vertical' }}
          />

          <button
            onClick={handleSubmit}
            disabled={!date || !time || submitting}
            className="salus-btn"
            style={{
              ...styles.hireSubmitBtn,
              ...((!date || !time || submitting) ? styles.hireSubmitBtnDisabled : {}),
            }}
          >
            {submitting ? 'Booking…' : 'Confirm booking'}
          </button>

          <p style={{ fontSize: 11, color: '#a59478', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
            Reception will receive an email to update Xplor for members.
          </p>
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div className="salus-modal-content salus-modal-card" style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.modalClose}><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────────────────────────────────────

const styles = {
  app: {
    height: '100%',
    background: '#f5f1e8',
    fontFamily: '"Geist", -apple-system, sans-serif',
    color: '#1a2620',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 18px',
    background: '#f5f1e8',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  quoteBar: {
    background: 'rgba(232, 224, 204, 0.35)',
    borderBottom: '1px solid #ebe3cf',
    padding: '8px 16px', textAlign: 'center',
  },
  quoteText: {
    fontFamily: '"Fraunces", serif', fontSize: 13, fontStyle: 'italic',
    color: '#5c4a38', lineHeight: 1.4, maxWidth: 700, margin: '0 auto',
  },
  quoteAttr: {
    fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase',
    color: '#a59478', marginTop: 2, fontWeight: 500,
  },
  holidayRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: '#fdfbf5',
    borderRadius: 10, border: '1px solid #ebe3cf',
  },
  holidayName: { fontSize: 14, fontWeight: 600, color: '#1a2620' },
  holidayDate: { fontSize: 12, color: '#7a8270', marginTop: 2 },
  holidayCountdown: {
    fontSize: 12, color: '#5c4a38', fontWeight: 600,
    background: '#f0e6d0', padding: '4px 10px', borderRadius: 12,
  },
  holidayEmpty: {
    padding: 20, textAlign: 'center', color: '#a8a895',
    fontSize: 13, fontStyle: 'italic',
  },
  invoicePresetRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14,
  },
  invoicePresetPill: {
    background: '#fff', border: '1px solid #ebe3cf', color: '#5c4a38',
    padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  invoicePresetPillActive: {
    background: '#5c4a38', color: '#fff', borderColor: '#5c4a38',
  },
  invoiceDateRow: {
    display: 'flex', gap: 12, marginBottom: 20,
  },
  invoiceDateInput: {
    width: '100%', fontFamily: 'inherit', fontSize: 14,
    padding: '10px 12px',
  },
  invoiceList: {
    display: 'flex', flexDirection: 'column', gap: 8,
    marginBottom: 16,
  },
  invoiceRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 14px', background: '#fdfbf5',
    borderRadius: 10, border: '1px solid #ebe3cf',
  },
  invoiceName: { fontSize: 14, fontWeight: 600, color: '#1a2620' },
  invoiceDetail: { fontSize: 12, color: '#7a8270', marginTop: 2 },
  invoiceWarn: { fontSize: 11, color: '#c8442a', fontWeight: 500, marginLeft: 6 },
  invoiceTotal: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', background: '#f0e6d0', borderRadius: 10,
    marginTop: 12, marginBottom: 16,
    fontSize: 13, fontWeight: 600, color: '#5c4a38',
  },
  pushBox: {
    padding: '14px 16px', borderRadius: 10,
    background: '#fdfbf5', border: '1px solid #ebe3cf',
    fontSize: 13,
  },

  // ─── HOME (cover-first dashboard) ───
  homeContainer: { padding: '0 14px 80px' },
  homeGreeting: { padding: '12px 4px 8px' },
  homeH1: { fontFamily: '"Fraunces", serif', fontSize: 26, fontWeight: 500, color: '#1a2620', margin: 0 },
  homeGreetSub: { fontSize: 13, color: '#7a8270', marginTop: 2, margin: 0 },
  homeSection: { marginTop: 16 },
  homeSectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, padding: '0 4px' },
  homeSectionTitle: { fontSize: 11, fontWeight: 700, color: '#5c4a38', letterSpacing: 1.2, textTransform: 'uppercase', display: 'flex', alignItems: 'center' },
  homeSectionCount: { background: '#c8442a', color: '#fff', padding: '2px 7px', borderRadius: 8, fontSize: 10, marginLeft: 6, fontWeight: 700, letterSpacing: 0 },
  homeSectionLink: { fontSize: 11, color: '#7a8270', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer', padding: 4 },
  homeEmptyCover: { padding: '24px 14px', background: '#fffdf7', borderRadius: 14, border: '1px solid #efe7d2', textAlign: 'center' },

  // ─── Collapsible tile (Home) ───
  tile: {
    background: '#fffdf7', borderRadius: 14, border: '1px solid #efe7d2',
    marginTop: 10, overflow: 'hidden',
  },
  tileHeader: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '14px 16px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  tileHeaderTitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  tileTitle: { fontSize: 14, fontWeight: 600, color: '#1a2620' },
  tileCount: {
    color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '2px 7px', borderRadius: 8, minWidth: 18, textAlign: 'center',
  },
  tileSummary: { fontSize: 12, color: '#7a8270', marginTop: 3 },
  tileBody: { padding: '0 12px 12px' },
  tileViewAll: {
    width: '100%', marginTop: 6, padding: '8px',
    background: 'transparent', border: 'none', color: '#7a8270',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    textAlign: 'center',
  },

  // ─── Week navigator (Schedule) ───
  weekNav: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fffdf7', borderRadius: 14, border: '1px solid #efe7d2',
    padding: '8px', marginBottom: 12,
  },
  weekNavBtn: {
    width: 40, height: 40, borderRadius: 10,
    background: '#f5f1e8', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#5c4a38', cursor: 'pointer', flexShrink: 0,
  },
  weekNavCenter: {
    flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 2,
  },
  weekNavRange: {
    fontSize: 15, fontWeight: 600, color: '#1a2620', fontFamily: '"Fraunces", serif',
  },
  weekNavTodayBtn: {
    fontSize: 10, color: '#7a8270', background: 'transparent', border: 'none',
    fontFamily: 'inherit', cursor: 'pointer', padding: '2px 8px',
    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
  },

  // Cover home cards
  coverHome: { background: '#fff', borderRadius: 14, border: '1px solid #efe7d2', marginBottom: 10, overflow: 'hidden' },
  coverHomeUrgent: { borderLeft: '3px solid #c8442a' },
  coverHomeTop: { padding: '14px 14px 10px', display: 'flex', gap: 12 },
  coverHomeWhen: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 10px', background: '#fef0ea', borderRadius: 10, minWidth: 56, flexShrink: 0 },
  coverHomeWhenMuted: { background: '#fdfbf5' },
  coverHomeWhenDay: { fontSize: 9, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase' },
  coverHomeWhenTime: { fontFamily: '"Fraunces", serif', fontSize: 17, color: '#1a2620', marginTop: 2, fontWeight: 600 },
  coverHomeWhenRel: { fontSize: 9, marginTop: 2, fontWeight: 600 },
  coverHomeTitle: { fontSize: 15, fontWeight: 600, color: '#1a2620', marginBottom: 4 },
  coverHomeCoach: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a8270' },
  coverHomeReason: { fontSize: 12, color: '#7a8270', fontStyle: 'italic', marginTop: 6, lineHeight: 1.4 },
  coverHomeInterested: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px 10px', fontSize: 11, color: '#7a8270' },
  coverHomeInterestedAvs: { display: 'flex' },
  coverHomeInterestedAv: { border: '2px solid #fff', borderRadius: '50%' },
  coverHomeFooter: { background: '#fdfbf5', padding: '8px 14px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #efe7d2', gap: 8 },
  coverHomeViewBtn: { background: 'transparent', color: '#7a8270', border: 'none', padding: '6px 8px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  coverHomeClaimBtn: { background: '#5c4a38', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  coverHomePendingPill: { background: '#fef3e2', color: '#b85c38', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Request cover CTA
  homeRequestCard: { background: '#fffdf7', border: '1px dashed #c4b8a0', borderRadius: 14, padding: 16, marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, width: '100%', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' },
  homeRequestIcon: { width: 36, height: 36, borderRadius: '50%', background: '#5c4a38', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  homeRequestTitle: { fontSize: 14, fontWeight: 600, color: '#1a2620' },
  homeRequestSub: { fontSize: 11, color: '#7a8270', marginTop: 1 },

  // Hire studio CTA (sibling to homeRequestCard)
  homeHireCard: {
    background: '#fffdf7', border: '1px solid #efe7d2', borderRadius: 14,
    padding: 16, marginTop: 10, display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
  },
  homeHireIcon: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#7a8c5c', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Your day
  homeDayCard: { background: '#fffdf7', borderRadius: 14, border: '1px solid #efe7d2', padding: '4px 14px' },
  homeDayRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  homeDayRowBorder: { borderTop: '1px solid #f5f0e0' },
  homeDayTime: { fontSize: 14, fontWeight: 600, color: '#5c4a38', minWidth: 50, textAlign: 'left' },
  homeDayTitle: { fontSize: 14, fontWeight: 500, color: '#1a2620' },
  homeDayMeta: { fontSize: 11, color: '#7a8270', marginTop: 2 },
  homeDayTagNow: { fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#5c4a38', color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ─── NEW SIMPLIFIED HEADER ───
  logoNew: {
    width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
    flexShrink: 0,
  },
  logoNewImg: { width: '100%', height: '100%', display: 'block' },
  logoTextWrap: { display: 'flex', flexDirection: 'column' },
  bellBtn: {
    position: 'relative', width: 40, height: 40, borderRadius: 20,
    background: '#fffdf7', border: '1px solid #ebe3cf',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  bellBtnBadge: {
    position: 'absolute', top: -3, right: -3,
    background: '#c8442a', color: '#fff', fontSize: 10, fontWeight: 700,
    minWidth: 18, height: 18, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 5px', border: '2px solid #f5f1e8',
  },
  headerAvBtn: {
    background: 'none', border: 'none', padding: 0,
    cursor: 'pointer', borderRadius: '50%',
  },

  // ─── ME PAGE ───
  meProfileCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: 16, background: '#fffdf7', borderRadius: 14,
    border: '1px solid #efe7d2', marginTop: 12,
  },
  meName: { fontSize: 18, fontWeight: 600, color: '#1a2620' },
  meRole: { fontSize: 12, color: '#7a8270', marginTop: 2 },
  meEditBtn: {
    padding: '6px 14px', borderRadius: 999, background: '#f0eee4',
    color: '#5c4a38', fontSize: 12, fontWeight: 600,
    border: 'none', fontFamily: 'inherit', cursor: 'pointer',
  },
  meStatsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
    background: '#fffdf7', borderRadius: 14, padding: 14, border: '1px solid #efe7d2',
  },
  meStatCell: { textAlign: 'center', padding: '8px 4px' },
  meStatNum: { fontFamily: '"Fraunces", serif', fontSize: 24, fontWeight: 500, color: '#1a2620' },
  meStatLabel: { fontSize: 10, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, fontWeight: 600 },
  meActionsList: { background: '#fffdf7', borderRadius: 14, border: '1px solid #efe7d2', overflow: 'hidden' },
  meActionRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', width: '100%',
    background: 'none', border: 'none', fontFamily: 'inherit',
    fontSize: 14, color: '#1a2620', cursor: 'pointer',
    borderBottom: '1px solid #f5f0e0',
  },
  meBankCard: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: 16, background: '#fffdf7', borderRadius: 14,
    border: '1px solid #efe7d2', fontFamily: 'inherit', cursor: 'pointer',
  },
  meBankLabel: {
    fontSize: 10, color: '#a59478', textTransform: 'uppercase',
    letterSpacing: 0.8, fontWeight: 600, marginBottom: 2,
  },
  meBankValue: {
    fontSize: 15, color: '#1a2620', fontFamily: 'monospace', letterSpacing: 1,
  },
  meSignOutBtn: {
    width: '100%', padding: '14px 16px', background: '#fdfbf5',
    border: '1px solid #ebe3cf', borderRadius: 12,
    color: '#c8442a', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  pickClassRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', background: '#fffdf7', borderRadius: 10,
    border: '1px solid #efe7d2', fontFamily: 'inherit', cursor: 'pointer',
  },

  // ─── COVER THREAD MODAL (Slack-style) ───
  threadBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.5)',
    zIndex: 200, display: 'flex', flexDirection: 'column',
    backdropFilter: 'blur(4px)',
  },
  threadSheet: {
    background: '#f5f1e8', flex: 1,
    display: 'flex', flexDirection: 'column',
    maxWidth: 540, width: '100%', margin: '0 auto',
    overflow: 'hidden',
  },
  threadHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 14px 12px', background: '#fffdf7',
    borderBottom: '1px solid #ebe3cf', flexShrink: 0,
    paddingTop: 'calc(14px + env(safe-area-inset-top))',
  },
  threadCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    background: '#f0eee4', border: 'none', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    color: '#5c4a38',
  },
  threadHeaderTitle: {
    fontSize: 14, fontWeight: 600, color: '#5c4a38',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  threadClassCard: {
    background: '#fffdf7', padding: '16px 18px', flexShrink: 0,
    borderBottom: '1px solid #ebe3cf',
  },
  threadClassDate: {
    fontSize: 11, color: '#7a8270', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  threadClassTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 22, fontWeight: 500,
    color: '#1a2620', marginBottom: 2,
  },
  threadClassMeta: {
    fontSize: 12, color: '#7a8270', marginBottom: 14,
  },
  threadRequester: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: 12, background: '#fef0ea', borderRadius: 10,
  },
  threadReason: {
    fontSize: 12, color: '#5c4a38', fontStyle: 'italic',
    marginTop: 4, lineHeight: 1.4,
  },
  threadInterestedBar: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
    padding: '8px 12px', background: '#f0eee4', borderRadius: 10,
  },
  threadInterestedAv: { borderRadius: '50%', border: '2px solid #fff' },
  threadActionBar: {
    padding: '12px 18px', background: '#fffdf7', flexShrink: 0,
    borderBottom: '1px solid #ebe3cf',
  },
  threadClaimBtn: {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    background: '#5c4a38', color: '#fff', fontSize: 14, fontWeight: 600,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  threadClaimBtnDisabled: { background: '#a59478', cursor: 'default' },
  threadCancelBtn: {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    background: '#fdfbf5', color: '#c8442a', fontSize: 14, fontWeight: 600,
    border: '1px solid #e8b8a8', cursor: 'pointer', fontFamily: 'inherit',
  },
  threadMessages: {
    flex: 1, overflowY: 'auto', padding: '16px 14px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  threadEmpty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px', textAlign: 'center',
  },
  threadMsgRow: {
    display: 'flex', alignItems: 'flex-end', gap: 8,
    maxWidth: '100%',
  },
  threadMsgBubble: {
    padding: '8px 12px', borderRadius: 14,
    background: '#fff', border: '1px solid #efe7d2',
    maxWidth: '78%',
  },
  threadMsgBubbleMine: {
    background: '#5c4a38', borderColor: '#5c4a38',
  },
  threadMsgAuthor: {
    fontSize: 11, fontWeight: 600, color: '#7a8c5c',
    marginBottom: 2,
  },
  threadMsgText: {
    fontSize: 14, color: '#1a2620', lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  threadMsgTime: {
    fontSize: 10, color: '#a59478', marginTop: 3,
  },
  threadInputBar: {
    display: 'flex', gap: 8, padding: '10px 12px',
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
    background: '#fffdf7', borderTop: '1px solid #ebe3cf', flexShrink: 0,
  },
  threadInput: {
    flex: 1, padding: '10px 14px', borderRadius: 999,
    border: '1px solid #ebe3cf', background: '#f5f1e8',
    fontSize: 14, fontFamily: 'inherit', color: '#1a2620',
    outline: 'none',
  },
  threadSendBtn: {
    width: 40, height: 40, borderRadius: 20,
    background: '#5c4a38', color: '#fff', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  threadSendBtnDisabled: { background: '#c4b8a0', cursor: 'default' },

  // ─── DAY DETAIL MODAL ───
  dayDetailHeader: {
    padding: '18px 18px 16px', flexShrink: 0,
    borderBottom: '1px solid #ebe3cf', background: '#fffdf7',
  },
  dayDetailRelative: {
    fontSize: 11, color: '#7a8270', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  dayDetailTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 24, fontWeight: 500,
    color: '#1a2620', marginTop: 4,
  },
  dayDetailMeta: {
    fontSize: 12, color: '#7a8270', marginTop: 6,
  },
  dayDetailList: {
    flex: 1, overflowY: 'auto', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  dayDetailRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, border: '1px solid #efe7d2',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  },
  dayDetailRowTime: { minWidth: 56, textAlign: 'left' },
  dayDetailTag: {
    fontSize: 9, padding: '3px 7px', borderRadius: 4,
    background: '#c8442a', color: '#fff', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
  },
  dayDetailTagMine: {
    fontSize: 9, padding: '3px 7px', borderRadius: 4,
    background: '#5c4a38', color: '#fff', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
  },

  // ─── HIRE STUDIO MODAL ───
  hireFieldLabel: {
    fontSize: 11, color: '#5c4a38', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, marginTop: 16,
  },
  hireInput: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #ebe3cf', background: '#fff',
    fontSize: 15, fontFamily: 'inherit', color: '#1a2620',
    outline: 'none', boxSizing: 'border-box',
  },
  hireTypeToggle: { display: 'flex', gap: 8 },
  hireTypeBtn: {
    flex: 1, padding: '12px', borderRadius: 10,
    background: '#fff', border: '1px solid #ebe3cf',
    color: '#5c4a38', fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  hireTypeBtnActive: {
    background: '#5c4a38', borderColor: '#5c4a38', color: '#fff',
  },
  hireSubmitBtn: {
    width: '100%', marginTop: 24, padding: '14px',
    background: '#5c4a38', color: '#fff', borderRadius: 12,
    border: 'none', fontSize: 15, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  hireSubmitBtnDisabled: { background: '#c4b8a0', cursor: 'default' },

  // ─── TEAM DIRECTORY ───
  teamSectionLabel: {
    fontSize: 11, color: '#7a8270', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.8,
    padding: '14px 4px 6px',
  },
  teamRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 12, background: '#fffdf7', borderRadius: 12,
    border: '1px solid #efe7d2', marginBottom: 8,
  },
  teamRowName: { fontSize: 14, fontWeight: 600, color: '#1a2620' },
  teamRowMeta: { fontSize: 11, color: '#7a8270', marginTop: 2 },
  teamMeTag: {
    background: '#f0eee4', color: '#7a8270',
    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
    textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6,
  },
  teamMessageBtn: {
    background: 'transparent', border: '1px solid #ebe3cf',
    padding: '6px 10px', borderRadius: 999, color: '#5c4a38',
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
  },

  // ─── TRANSFER CLASS ───
  transferCoachRow: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: 12, background: '#fffdf7', borderRadius: 12,
    border: '1px solid #efe7d2', marginBottom: 8,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  transferCoachRowActive: {
    background: '#fef0ea', borderColor: '#5c4a38', borderWidth: 2,
  },

  // ─── FOH SCHEDULE ───
  viewToggleRow: {
    display: 'flex', gap: 6, padding: '12px 14px 0',
    background: '#fff', borderBottom: '1px solid #ebe3cf',
  },
  viewToggleBtn: {
    flex: 1, padding: '10px 12px', borderRadius: 999,
    background: 'transparent', border: '1px solid #ebe3cf',
    fontSize: 13, fontWeight: 600, color: '#7a8270',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  viewToggleBtnActive: {
    background: '#5c4a38', color: '#fff', borderColor: '#5c4a38',
  },
  fohStatsRow: {
    display: 'flex', gap: 8, padding: '12px 14px',
    background: '#fff', borderBottom: '1px solid #ebe3cf',
  },
  fohStat: {
    flex: 1, background: '#fffdf7', borderRadius: 10,
    padding: '10px 8px', textAlign: 'center', border: '1px solid #efe7d2',
  },
  fohStatNumber: { fontSize: 22, fontWeight: 700, color: '#5c4a38', lineHeight: 1 },
  fohStatLabel: { fontSize: 10, color: '#7a8270', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  fohDayBlock: { padding: '14px 14px 0' },
  fohDayHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
    padding: '6px 10px', borderRadius: 8, background: '#fffdf7',
  },
  fohDayHeaderToday: { background: '#fef0ea' },
  fohDayName: { fontSize: 13, fontWeight: 700, color: '#5c4a38' },
  fohDayDate: { fontSize: 12, color: '#7a8270' },
  fohTodayBadge: {
    background: '#c8442a', color: '#fff', fontSize: 9, fontWeight: 700,
    padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.4,
    marginLeft: 'auto',
  },
  fohShiftList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 },
  fohShiftCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: 10,
    background: '#fffdf7', border: '1px solid #efe7d2',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  },
  fohShiftCardOpen: {
    background: '#fef0ea', borderColor: '#e8b8a8', borderStyle: 'dashed',
  },
  fohShiftCardMine: {
    background: '#f3f5ed', borderColor: '#7a8c5c', borderWidth: 2,
  },
  fohShiftTimes: { display: 'flex', flexDirection: 'column', minWidth: 88, gap: 2 },
  fohShiftLabel: { fontSize: 12, fontWeight: 700, color: '#5c4a38', textTransform: 'uppercase', letterSpacing: 0.4 },
  fohShiftHours: { fontSize: 11, color: '#7a8270' },
  fohShiftStaff: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  fohShiftStaffName: { fontSize: 13, color: '#1a2620', fontWeight: 500 },
  fohShiftOpen: { fontSize: 12, color: '#c8442a', fontStyle: 'italic' },

  // ─── UNIFIED SCHEDULE (Studio + FOH) ───
  weekTodayLink: {
    background: 'transparent', border: 'none', padding: '2px 4px',
    fontSize: 10, color: '#7a8270', fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
    textDecoration: 'underline', textUnderlineOffset: 2,
  },
  scheduleStatsRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '14px 16px',
    background: '#fffdf7',
    borderBottom: '1px solid #efe7d2',
  },
  scheduleFilterRow: {
    display: 'flex', gap: 6, padding: '10px 14px 4px',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  },
  scheduleFilterPill: {
    flexShrink: 0, padding: '7px 13px', borderRadius: 999,
    background: '#fffdf7', border: '1px solid #ebe3cf',
    color: '#5c4a38', fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  scheduleFilterPillActive: {
    background: '#5c4a38', color: '#fff', borderColor: '#5c4a38',
  },
  scheduleCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10,
    background: '#fffdf7', border: '1px solid #efe7d2',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
    textAlign: 'left',
  },
  scheduleCardCover: {
    background: '#fef0ea', borderColor: '#e8b8a8',
    borderLeftWidth: 4, borderLeftColor: '#c8442a',
  },
  scheduleCardMine: {
    background: '#f3f5ed', borderColor: '#7a8c5c', borderWidth: 2,
  },
  scheduleCardTime: {
    display: 'flex', flexDirection: 'column', gap: 2,
    minWidth: 78, flexShrink: 0,
  },
  scheduleCardTimeMain: {
    fontSize: 13, fontWeight: 700, color: '#5c4a38',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  scheduleCardTimeSub: { fontSize: 11, color: '#7a8270' },
  scheduleCardMid: { flex: 1, minWidth: 0 },
  scheduleCardTitle: {
    fontSize: 13, fontWeight: 600, color: '#1a2620',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  scheduleCardSub: { fontSize: 11, color: '#7a8270', marginTop: 2 },
  scheduleCardRight: {
    display: 'flex', alignItems: 'center', gap: 6,
    flexShrink: 0,
  },
  scheduleCardName: {
    fontSize: 12, fontWeight: 600, color: '#1a2620',
  },
  scheduleCoverChip: {
    background: '#c8442a', color: '#fff',
    fontSize: 10, fontWeight: 700, padding: '4px 10px',
    borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  scheduleUnassigned: { fontSize: 11, color: '#a59478', fontStyle: 'italic' },
  scheduleFab: {
    position: 'fixed', right: 16,
    bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    background: '#5c4a38', color: '#fff', border: 'none',
    padding: '12px 18px', borderRadius: 999,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: '0 4px 16px rgba(92,74,56,0.25)',
    zIndex: 50,
  },

  // ─── PERIOD TOGGLE (Day/Week/Month) ───
  periodToggleRow: {
    display: 'flex', gap: 4, padding: '10px 14px 6px',
    background: '#fffdf7',
  },
  periodToggleBtn: {
    flex: 1, padding: '7px 12px', borderRadius: 8,
    background: 'transparent', border: '1px solid transparent',
    fontSize: 12, fontWeight: 600, color: '#7a8270',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  periodToggleBtnActive: {
    background: '#5c4a38', color: '#fff',
  },

  // ─── MONTH GRID ───
  monthGridDayHeader: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    padding: '6px 14px',
    gap: 4,
  },
  monthGridDayLabel: {
    textAlign: 'center', fontSize: 10, fontWeight: 700,
    color: '#7a8270', letterSpacing: 0.4, textTransform: 'uppercase',
    padding: '4px 0',
  },
  monthGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4, padding: '0 14px',
  },
  monthGridCell: {
    aspectRatio: '1 / 1',
    background: '#fffdf7', border: '1px solid #efe7d2',
    borderRadius: 8, padding: 4,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  monthGridCellToday: {
    background: '#5c4a38', borderColor: '#5c4a38',
  },
  monthGridCellCover: {
    background: '#fef0ea', borderColor: '#e8b8a8',
  },
  monthGridEmpty: {
    aspectRatio: '1 / 1',
  },
  monthGridCellDate: {
    fontSize: 13, fontWeight: 600, color: '#1a2620', textAlign: 'center',
  },
  monthGridDots: {
    display: 'flex', justifyContent: 'center', gap: 3,
  },
  monthGridDot: {
    width: 5, height: 5, borderRadius: '50%',
  },
  monthGridLegend: {
    display: 'flex', gap: 14, padding: '14px',
    fontSize: 11, color: '#7a8270', justifyContent: 'center',
  },
  monthGridLegendItem: {
    display: 'flex', alignItems: 'center', gap: 5,
  },

  // ─── ROLE PICKER ───
  rolePickerWrap: {
    minHeight: '100vh', background: '#f5f1e8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, fontFamily: 'Geist, sans-serif',
  },
  rolePickerCard: {
    width: '100%', maxWidth: 440,
    background: '#fffdf7', borderRadius: 16,
    padding: 28, border: '1px solid #efe7d2',
    boxShadow: '0 8px 32px rgba(92, 74, 56, 0.08)',
  },
  rolePickerHeader: { textAlign: 'left' },
  rolePickerEyebrow: {
    fontSize: 11, fontWeight: 700, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  rolePickerTitle: {
    fontFamily: '"Fraunces", Georgia, serif', fontSize: 24, lineHeight: 1.25,
    color: '#5c4a38', margin: 0,
  },
  rolePickerSubtitle: {
    fontSize: 13, color: '#7a8270', marginTop: 8, marginBottom: 0, lineHeight: 1.5,
  },
  rolePickerOption: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 12,
    background: '#fffdf7', border: '1px solid #efe7d2',
    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
  },
  rolePickerOptionActive: {
    background: '#fef7e8', borderColor: '#5c4a38', borderWidth: 2,
  },
  rolePickerOptionIcon: {
    width: 44, height: 44, borderRadius: '50%', background: '#f5f1e8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, flexShrink: 0,
  },
  rolePickerOptionTitle: { fontSize: 15, fontWeight: 700, color: '#1a2620' },
  rolePickerOptionDesc: { fontSize: 12, color: '#7a8270', marginTop: 3, lineHeight: 1.4 },
  rolePickerCheckbox: {
    width: 24, height: 24, borderRadius: 6,
    border: '1.5px solid #ebe3cf', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  rolePickerCheckboxActive: { background: '#5c4a38', borderColor: '#5c4a38' },
  rolePickerContinue: {
    width: '100%', padding: '14px 16px', marginTop: 20,
    background: '#5c4a38', color: '#fff', border: 'none', borderRadius: 10,
    fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  rolePickerContinueDisabled: { background: '#c4b8a0', cursor: 'default' },
  rolePickerSignOut: {
    width: '100%', padding: '10px 16px', marginTop: 8,
    background: 'transparent', color: '#7a8270', border: 'none',
    fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
  },

  // ─── TASKS ───
  tasksCountBadge: {
    background: '#5c4a38', color: '#fff', fontSize: 11, fontWeight: 700,
    padding: '2px 8px', borderRadius: 999, marginLeft: 8,
  },
  tasksEmpty: {
    padding: '14px', textAlign: 'center', fontSize: 12, color: '#7a8270',
    background: '#fffdf7', borderRadius: 10, border: '1px dashed #ebe3cf',
  },
  tasksList: { display: 'flex', flexDirection: 'column', gap: 6 },
  taskCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10,
    background: '#fffdf7', border: '1px solid #efe7d2',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  },
  taskCardUrgent: { borderColor: '#e8b8a8', borderLeftWidth: 4, borderLeftColor: '#c8442a' },
  taskCardTitle: { fontSize: 13, fontWeight: 600, color: '#1a2620', lineHeight: 1.35 },
  taskCardMeta: { fontSize: 11, color: '#7a8270', marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' },
  taskUrgentDot: { color: '#c8442a', marginRight: 5, fontSize: 10 },
  tasksCreateBtn: {
    width: '100%', padding: '10px 14px', marginTop: 10,
    background: 'transparent', border: '1px dashed #c4b8a0', borderRadius: 10,
    color: '#5c4a38', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  audienceRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  audiencePill: {
    background: '#fff', border: '1px solid #ebe3cf', color: '#5c4a38',
    padding: '8px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  audiencePillActive: { background: '#5c4a38', color: '#fff', borderColor: '#5c4a38' },
  taskNotes: {
    background: '#fffdf7', padding: 14, borderRadius: 10,
    border: '1px solid #efe7d2', fontSize: 13, color: '#1a2620',
    whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 14,
  },
  taskCreatedBy: { fontSize: 11, color: '#7a8270', marginTop: 8 },
  taskCompletedBy: { fontSize: 12, color: '#5c8a5a', marginTop: 8, fontWeight: 600 },

  // ─── URGENT BROADCAST ───
  urgentBroadcastBtn: {
    width: 40, height: 40, borderRadius: 8,
    background: '#fef0ea', border: '1px solid #e8b8a8',
    color: '#c8442a', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  messageBubbleUrgent: {
    background: '#fef0ea',
    border: '2px solid #c8442a',
    borderRadius: 12,
    padding: '10px 12px 10px 12px',
  },
  urgentBanner: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: '#c8442a', color: '#fff',
    fontSize: 10, fontWeight: 700, padding: '3px 8px',
    borderRadius: 4, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // ─── ONBOARDING ───
  onbDots: {
    display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 20,
  },
  onbDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#e8e0cc',
  },
  onbDotActive: { background: '#5c4a38' },
  onbPolicyList: {
    margin: '14px 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: '#2a3028',
  },
  onbPolicyItem: { marginBottom: 5 },
  onbSkipBtn: {
    width: '100%', padding: '10px', background: 'transparent',
    border: '1px solid #ebe3cf', borderRadius: 10,
    color: '#7a8270', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  onbBackBtn: {
    width: '100%', padding: '8px', background: 'transparent', border: 'none',
    color: '#7a8270', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },

  // ─── GAMIFIED STATS ───
  statsCard: { padding: '4px 0' },
  statsHeaderRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '14px 16px', background: '#fffdf7',
    border: '1px solid #efe7d2', borderRadius: 12,
  },
  statsEyebrow: { fontSize: 10, color: '#7a8270', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  statsBigNumber: {
    fontFamily: '"Fraunces", Georgia, serif', fontSize: 32, color: '#5c4a38',
    marginTop: 4, lineHeight: 1,
  },
  statsSubLine: { fontSize: 12, color: '#7a8270', marginTop: 6 },
  statsStreak: {
    background: '#fef0ea', border: '1px solid #f3c8b5',
    borderRadius: 12, padding: '10px 12px', textAlign: 'center', minWidth: 78,
  },
  statsStreakNum: { fontFamily: '"Fraunces", serif', fontSize: 26, color: '#c8442a', lineHeight: 1 },
  statsStreakLabel: { fontSize: 9, color: '#7a8270', marginTop: 6, lineHeight: 1.3, fontWeight: 600 },
  statsTilesRow: { display: 'flex', gap: 6, marginTop: 8 },
  statsMiniTile: {
    flex: 1, background: '#fffdf7', border: '1px solid #efe7d2', borderRadius: 10,
    padding: '10px 6px', textAlign: 'center',
  },
  statsMiniNum: { fontSize: 17, fontWeight: 700, color: '#5c4a38' },
  statsMiniLabel: { fontSize: 9, color: '#7a8270', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  statsNext: {
    background: '#fffdf7', border: '1px solid #efe7d2', borderRadius: 12,
    padding: 12, marginTop: 8,
  },
  statsNextHeader: { display: 'flex', alignItems: 'center', marginBottom: 8 },
  statsNextName: { fontSize: 13, fontWeight: 600, color: '#5c4a38', flex: 1 },
  statsNextPct: { fontSize: 12, fontWeight: 700, color: '#7a8270' },
  statsNextBar: {
    height: 8, background: '#f0eee4', borderRadius: 999, overflow: 'hidden',
  },
  statsNextBarFill: {
    height: '100%', background: 'linear-gradient(90deg, #7a8c5c, #5c4a38)',
    borderRadius: 999, transition: 'width 300ms',
  },
  statsNextHint: { fontSize: 10, color: '#7a8270', marginTop: 6, fontStyle: 'italic' },
  statsBadgesLabel: {
    fontSize: 11, fontWeight: 700, color: '#7a8270',
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 14, marginBottom: 6,
  },
  statsBadgesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
  },
  statsBadge: {
    background: '#fffdf7', borderRadius: 10, padding: '10px 4px',
    textAlign: 'center', border: '1px solid #efe7d2',
  },
  statsBadgeUnlocked: {
    background: '#fef7e8', borderColor: '#d4b87a',
  },
  statsBadgeLocked: { background: '#f6f1e3', opacity: 0.85 },
  statsBadgeName: { fontSize: 9, color: '#5c4a38', marginTop: 4, fontWeight: 600, lineHeight: 1.2 },

  // ─── FLOWS ───
  flowsContainer: {
    paddingBottom: 80, background: '#f5f1e8', minHeight: '100%',
  },
  flowsHero: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: '24px 18px 14px',
    background: 'linear-gradient(180deg, #fef7e8 0%, #f5f1e8 100%)',
  },
  flowsEyebrow: {
    fontSize: 10, color: '#7a8270', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  flowsTitle: {
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: 32, color: '#5c4a38', lineHeight: 1, marginTop: 4,
  },
  flowsSubtitle: { fontSize: 12, color: '#7a8270', marginTop: 6, fontStyle: 'italic' },
  flowsCreateBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: '#5c4a38', color: '#fff', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(92,74,56,0.25)', cursor: 'pointer',
    fontFamily: 'inherit', flexShrink: 0,
  },
  flowsFilterRow: {
    display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  flowsFilterPill: {
    flexShrink: 0, padding: '7px 13px', borderRadius: 999,
    background: '#fffdf7', border: '1px solid #ebe3cf',
    color: '#5c4a38', fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  flowsFilterPillActive: {
    background: '#5c4a38', color: '#fff', borderColor: '#5c4a38',
  },
  flowsList: { padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 12 },
  flowsEmpty: {
    margin: '24px 16px', padding: '40px 24px',
    background: '#fffdf7', border: '1px dashed #ebe3cf', borderRadius: 16,
    textAlign: 'center',
  },
  flowsEmptyIcon: { fontSize: 38, marginBottom: 8 },
  flowsEmptyTitle: { fontFamily: '"Fraunces", serif', fontSize: 18, color: '#5c4a38' },
  flowsEmptySub: { fontSize: 12, color: '#7a8270', marginTop: 6, lineHeight: 1.4 },
  flowsEmptyBtn: {
    marginTop: 14, padding: '10px 16px', borderRadius: 999,
    background: '#5c4a38', color: '#fff', border: 'none',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  postCard: {
    background: '#fffdf7', borderRadius: 14, padding: 14,
    border: '1px solid #efe7d2',
  },
  postHeader: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer',
  },
  postAuthor: { fontSize: 13, fontWeight: 600, color: '#1a2620' },
  postTime: { fontSize: 11, color: '#7a8270', marginTop: 1 },
  postTypeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontWeight: 700, padding: '4px 8px',
    borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  postTitle: {
    fontFamily: '"Fraunces", Georgia, serif', fontSize: 17,
    color: '#1a2620', lineHeight: 1.25,
  },
  postDesc: {
    fontSize: 13, color: '#2a3028', lineHeight: 1.55, marginTop: 6,
    whiteSpace: 'pre-wrap',
  },
  postVideoLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    marginTop: 10, padding: '7px 12px',
    background: '#fef0ea', border: '1px solid #f3c8b5',
    borderRadius: 999, fontSize: 12, fontWeight: 600,
    color: '#c8442a', textDecoration: 'none',
  },
  postTags: {
    display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10,
  },
  postTag: {
    fontSize: 11, color: '#7a8c5c', fontWeight: 600,
    background: '#f3f5ed', padding: '2px 8px', borderRadius: 4,
  },
  postReactionsRow: {
    display: 'flex', gap: 5, marginTop: 12,
    flexWrap: 'wrap', alignItems: 'center',
  },
  postReactionPill: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 999,
    background: '#f5f1e8', border: '1px solid transparent',
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 120ms',
  },
  postReactionPillActive: {
    background: '#fef7e8', border: '1px solid #d4b87a',
  },
  postReactionPillDim: { opacity: 0.6 },
  postReactionCount: { fontSize: 11, fontWeight: 700, color: '#5c4a38' },
  postCommentBtn: {
    display: 'inline-flex', alignItems: 'center',
    padding: '5px 10px', borderRadius: 999,
    background: 'transparent', border: 'none',
    color: '#7a8270', fontSize: 12, cursor: 'pointer',
    fontFamily: 'inherit', marginLeft: 'auto',
  },
  postDetailTitle: {
    fontFamily: '"Fraunces", Georgia, serif', fontSize: 22,
    color: '#1a2620', lineHeight: 1.25, margin: '4px 0 10px',
  },
  postDetailDesc: {
    fontSize: 14, color: '#2a3028', lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
  },
  commentsLabel: {
    fontSize: 11, fontWeight: 700, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, paddingTop: 14, borderTop: '1px solid #efe7d2',
  },
  commentRow: {
    display: 'flex', gap: 10, padding: '10px 0',
    borderBottom: '1px solid #f4ecd8',
  },
  commentHeader: { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  commentAuthor: { fontSize: 12, fontWeight: 600, color: '#1a2620' },
  commentTime: { fontSize: 10, color: '#a59478' },
  commentText: { fontSize: 13, color: '#1a2620', lineHeight: 1.45 },
  taskCommentSystem: {
    fontSize: 11, color: '#7a8270', fontStyle: 'italic',
    padding: '6px 10px', margin: '4px 0',
    background: '#f5f1e8', borderRadius: 6,
    textAlign: 'center', lineHeight: 1.4,
  },

  // ─── GOOGLE CALENDAR LINK ───
  gcalLink: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    marginTop: 12, padding: '7px 13px',
    background: '#fffdf7', border: '1px solid #ebe3cf',
    borderRadius: 999, fontSize: 12, fontWeight: 600,
    color: '#5c4a38', textDecoration: 'none',
  },

  // ─── SHIFT NOTES ───
  shiftNoteCard: {
    background: '#fffdf7', border: '1px solid #efe7d2',
    borderRadius: 8, padding: '8px 10px', marginBottom: 6,
  },
  shiftNoteHead: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
  },
  shiftNoteText: { fontSize: 13, color: '#1a2620', lineHeight: 1.5, whiteSpace: 'pre-wrap' },

  // ─── TOURS ───
  toursSectionLabel: {
    fontSize: 10, fontWeight: 700, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 1.2,
    padding: '8px 12px 2px',
  },
  tourCardTime: {
    minWidth: 60, flexShrink: 0,
    display: 'flex', flexDirection: 'column',
  },
  tourCardTimeMain: {
    fontSize: 14, fontWeight: 700, color: '#5c4a38',
    fontFamily: '"Fraunces", Georgia, serif',
  },

  // ─── STUDIO BOOKINGS ───
  bookingsContainer: { paddingBottom: 80, background: '#f5f1e8', minHeight: '100%' },
  bookingsHero: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: '22px 18px 12px',
    background: 'linear-gradient(180deg, #f3f5ed 0%, #f5f1e8 100%)',
  },
  bookingsEyebrow: {
    fontSize: 10, color: '#7a8270', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  bookingsTitle: {
    fontFamily: '"Fraunces", Georgia, serif',
    fontSize: 28, color: '#5c4a38', lineHeight: 1, marginTop: 4,
  },
  bookingsSubtitle: { fontSize: 12, color: '#7a8270', marginTop: 6, fontStyle: 'italic' },
  bookingTypeCategoryLabel: {
    fontSize: 10, fontWeight: 700, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: 5, marginTop: 4,
  },

  // ─── NOTIFICATIONS DRAWER ───
  notifsBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(26,20,16,0.5)',
    zIndex: 200, display: 'flex', justifyContent: 'flex-end',
  },
  notifsDrawer: {
    width: '100%', maxWidth: 420, height: '100%',
    background: '#fffdf7', display: 'flex', flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(60,40,20,0.18)',
  },
  notifsHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid #ebe3cf',
  },
  notifsTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 20, color: '#5c4a38',
  },
  notifsEmpty: {
    padding: '60px 30px', textAlign: 'center',
  },
  notifsList: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  notifRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 16px', background: 'transparent',
    border: 'none', borderBottom: '1px solid #f4ecd8',
    width: '100%', cursor: 'pointer', fontFamily: 'inherit',
  },
  notifIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: '#f5f1e8', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  notifTitle: { fontSize: 13, fontWeight: 600, color: '#1a2620' },
  notifBody: { fontSize: 12, color: '#7a8270', marginTop: 3, lineHeight: 1.4 },
  notifTime: { fontSize: 10, color: '#a59478', flexShrink: 0, marginTop: 3 },

  // ─── CHAT TOGGLE + DMs LIST ───
  chatToggleRow: {
    display: 'flex', gap: 4, padding: '10px 12px 6px',
    background: '#fffdf7', borderBottom: '1px solid #ebe3cf',
  },
  chatToggleBtn: {
    flex: 1, padding: '7px 12px', borderRadius: 8,
    background: 'transparent', border: '1px solid transparent',
    fontSize: 12, fontWeight: 600, color: '#7a8270',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  chatToggleBtnActive: {
    background: '#5c4a38', color: '#fff',
  },
  chatToggleBadge: {
    position: 'absolute', top: 2, right: 6,
    background: '#c8442a', color: '#fff', fontSize: 9, fontWeight: 700,
    padding: '1px 5px', borderRadius: 8, minWidth: 14, textAlign: 'center',
  },
  dmRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', width: '100%',
    background: '#fffdf7', border: 'none',
    borderBottom: '1px solid #f4ecd8',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  dmRowTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6,
  },
  dmRowName: {
    fontSize: 14, fontWeight: 600, color: '#1a2620',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  dmRowTime: { fontSize: 11, color: '#a59478', flexShrink: 0 },
  dmRowPreview: {
    fontSize: 12, color: '#7a8270', marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  dmUnreadBadge: {
    background: '#c8442a', color: '#fff',
    fontSize: 11, fontWeight: 700, padding: '2px 7px',
    borderRadius: 999, minWidth: 18, textAlign: 'center',
    flexShrink: 0,
  },

  // ─── COVER THREAD MODAL ends ───

  // ─── BOTTOM NAV ───
  bottomNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fffdf7', borderTop: '1px solid #ebe3cf',
    display: 'flex', padding: '8px 12px',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
    zIndex: 100,
  },
  bottomTab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: 6, color: '#7a8270', background: 'none', border: 'none',
    fontFamily: 'inherit', cursor: 'pointer', position: 'relative',
  },
  bottomTabActive: { color: '#5c4a38' },
  bottomTabLabel: { fontSize: 10, fontWeight: 600 },
  bottomTabLabelActive: { fontWeight: 700 },
  bottomTabBadge: {
    position: 'absolute', top: 2, right: '28%',
    background: '#c8442a', color: '#fff', fontSize: 9, fontWeight: 700,
    minWidth: 16, height: 16, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
  },

  // View toggle (Week / 3-Month)
  viewToggle: {
    display: 'flex', padding: 2, background: '#f0eee4',
    borderRadius: 8, gap: 2,
  },
  viewToggleBtn: {
    padding: '6px 12px', borderRadius: 6,
    background: 'transparent', color: '#7a8270',
    fontSize: 12, fontWeight: 500, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  viewToggleBtnActive: {
    background: '#fffdf7', color: '#5c4a38', fontWeight: 600,
    boxShadow: '0 1px 2px rgba(92, 74, 56, 0.08)',
  },

  // Month view
  monthLegend: {
    display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap',
    fontSize: 11, color: '#7a8270',
  },
  monthLegendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  monthLegendDot: { width: 8, height: 8, borderRadius: '50%' },
  monthLabel: {
    fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 500,
    color: '#1a2620', margin: '0 0 12px',
  },
  monthGridHeader: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4, marginBottom: 4,
  },
  monthDayLabel: {
    textAlign: 'center', fontSize: 10, fontWeight: 600,
    color: '#a59478', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  monthGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
  },
  monthCell: {
    aspectRatio: '1 / 1', borderRadius: 8,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 4px', fontFamily: 'inherit', minHeight: 44,
  },
  monthCellEmpty: { aspectRatio: '1 / 1', minHeight: 44 },
  monthCellDay: { fontSize: 13, fontWeight: 600 },
  monthCellDots: { width: 6, height: 6, borderRadius: '50%' },
  urgentCoverRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px',
    background: '#fef0ea', border: '1px solid #f0c8b8',
    borderRadius: 10, cursor: 'pointer',
    fontFamily: 'inherit', width: '100%',
  },
  urgentCoverWhen: {
    fontSize: 14, fontWeight: 600, color: '#1a2620', marginBottom: 2,
  },
  urgentCoverMeta: {
    fontSize: 12, color: '#7a8270', lineHeight: 1.4,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 38, height: 38, borderRadius: 10,
    background: '#f5f1e8', border: '1px solid #ebe3cf',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logoMarkImg: {
    width: '100%', height: '100%',
    objectFit: 'contain', padding: 4,
    filter: 'brightness(0)',
  },
  logoText: { fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500, lineHeight: 1.1, color: '#1a2620' },
  logoSub: { fontSize: 10, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 },
  alertBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 20,
    background: '#fef3e2', color: '#b85c38',
    border: '1px solid #f3d8b8', fontSize: 12, fontWeight: 500,
  },
  userSelector: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 12px', borderRadius: 24, background: '#f5f1e8', border: '1px solid #e8e0cc', cursor: 'pointer' },
  userSelectorBare: { display: 'flex', alignItems: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' },
  userSelectorName: { fontSize: 13, fontWeight: 500, color: '#1a2620' },
  userSelectorRole: { fontSize: 10, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },
  iconBtn: {
    padding: 8, borderRadius: 8, border: '1px solid #d4cdb8',
    background: '#fffdf7', color: '#7a8270', display: 'flex',
  },

  nav: {
    display: 'flex', gap: 4, padding: '16px 32px 0',
    borderBottom: '1px solid #e8e0cc', background: '#fffdf7',
  },
  navTab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '10px 8px', border: 'none', background: 'transparent',
    fontFamily: 'inherit', fontSize: 13, color: '#7a8270',
    borderBottom: '2px solid transparent', marginBottom: -1,
    fontWeight: 500, cursor: 'pointer',
  },
  navTabActive: {
    color: '#5c4a38', borderBottom: '2px solid #5c4a38',
  },
  navBadge: {
    background: '#c8442a', color: '#fff', fontSize: 10, fontWeight: 600,
    padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
  },

  main: {
    padding: '28px 32px 100px',
    maxWidth: 1400,
    margin: '0 auto',
    width: '100%',
    flex: 1,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  },
  mainChat: {
    position: 'fixed',
    top: 'calc(60px + env(safe-area-inset-top, 0px))',
    bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
    left: 0, right: 0,
    padding: 8,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },

  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 20, gap: 16, flexWrap: 'wrap',
  },
  h2: {
    fontFamily: '"Fraunces", serif', fontSize: 30, fontWeight: 500,
    margin: 0, color: '#1a2620', lineHeight: 1.15, letterSpacing: -0.3,
  },
  h3: {
    fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 500,
    margin: '20px 0 12px', color: '#1a2620',
  },
  subtitle: { fontSize: 13, color: '#7a8270', marginTop: 6 },

  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterPill: {
    padding: '7px 13px', borderRadius: 20, border: '1px solid #d4cdb8',
    background: '#fffdf7', fontSize: 12, fontFamily: 'inherit', color: '#7a8270',
    fontWeight: 500,
  },
  filterPillActive: {
    background: '#5c4a38', color: '#fff', borderColor: '#5c4a38',
  },

  // Studio toggle (segmented control)
  studioToggle: {
    display: 'inline-flex', gap: 0, marginBottom: 20,
    padding: 3, background: '#f0eee4', borderRadius: 10,
    border: '1px solid #e8e0cc',
  },
  studioPill: {
    padding: '8px 16px', borderRadius: 7, border: 'none',
    background: 'transparent', fontSize: 12, fontFamily: 'inherit',
    color: '#7a8270', fontWeight: 500,
  },
  studioPillActive: {
    background: '#fffdf7', color: '#5c4a38', fontWeight: 600,
    boxShadow: '0 1px 2px rgba(92, 74, 56, 0.08)',
  },

  // Studio tag on class cards
  studioTag: {
    position: 'absolute', top: 10, right: 10,
    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6,
    color: '#a8a895',
  },
  studioTagInline: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  coverCardSub: { marginTop: 6 },

  // Day header date
  dayDate: { fontSize: 10, color: '#a8a895', marginTop: 2, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 },

  weekGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 10, marginTop: 8,
  },
  dayColumn: {
    background: '#fffdf7', borderRadius: 12, padding: 12,
    border: '1px solid #e8e0cc', minHeight: 200,
  },
  dayHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingBottom: 10, borderBottom: '1px solid #e8e0cc', marginBottom: 10,
  },
  dayName: { fontFamily: '"Fraunces", serif', fontSize: 15, fontWeight: 500, color: '#1a2620' },
  dayCount: {
    fontSize: 10, color: '#7a8270', background: '#f0eee4',
    padding: '3px 8px', borderRadius: 10, fontWeight: 500,
  },
  dayClasses: { display: 'flex', flexDirection: 'column', gap: 8 },
  emptyDay: {
    fontSize: 11, color: '#a8a895', textAlign: 'center',
    padding: '24px 0', fontStyle: 'italic',
  },
  classCard: {
    padding: '12px 12px 12px 14px', borderRadius: 12, background: '#fff',
    border: '1px solid #efe7d2', borderLeft: '3px solid transparent',
    fontFamily: 'inherit', textAlign: 'left', width: '100%',
    cursor: 'pointer', position: 'relative',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  classCardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6, gap: 6, flexWrap: 'wrap',
  },
  classTime: { fontSize: 15, fontWeight: 600, color: '#1a2620', letterSpacing: -0.2 },
  classType: { fontSize: 12, fontWeight: 500, marginBottom: 8, color: '#1a2620', lineHeight: 1.3 },
  classCoach: { display: 'flex', alignItems: 'center', gap: 6 },
  classCoachName: { fontSize: 10, color: '#7a8270' },
  miniAvatar: {
    width: 20, height: 20, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
  },
  coverBadge: {
    display: 'flex', alignItems: 'center', gap: 3,
    fontSize: 9, fontWeight: 600, color: '#b85c38',
    background: '#fef3e2', padding: '2px 6px', borderRadius: 10,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  coverBadgeProminent: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontWeight: 700, color: '#fff',
    background: '#c8442a', padding: '4px 8px', borderRadius: 6,
    textTransform: 'uppercase', letterSpacing: 0.8,
    flexShrink: 0,
  },

  legend: {
    display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28,
    padding: 18, background: '#fffdf7', borderRadius: 12, border: '1px solid #e8e0cc',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5a6258' },
  legendDot: { width: 9, height: 9, borderRadius: 2 },

  // Cover board
  coverList: { display: 'flex', flexDirection: 'column', gap: 12 },
  coverCard: {
    display: 'flex', background: '#fffdf7', borderRadius: 12,
    border: '1px solid #e8e0cc', overflow: 'hidden',
  },
  coverCardStripe: { width: 4, flexShrink: 0 },
  coverCardBody: { padding: 18, flex: 1 },
  coverCardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, marginBottom: 14,
  },
  coverCardDay: { fontSize: 11, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 },
  coverCardType: {
    fontFamily: '"Fraunces", serif', fontSize: 22, fontWeight: 500,
    marginTop: 4, color: '#1a2620', letterSpacing: -0.3,
  },
  coverCardMeta: { display: 'flex', alignItems: 'center', gap: 10 },
  coverCardRequester: { fontSize: 13, fontWeight: 500, color: '#1a2620' },
  coverCardTime: { fontSize: 11, color: '#7a8270' },
  coverCardReason: {
    background: '#f5f1e8', padding: '12px 14px', borderRadius: 8,
    fontSize: 13, marginBottom: 14, color: '#5a6258',
  },
  reasonLabel: {
    fontSize: 10, fontWeight: 600, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 10,
  },
  coverCardActions: { display: 'flex', gap: 8 },
  coveredText: { fontSize: 13, marginTop: 4, color: '#5a6258' },

  emptyState: {
    background: '#fffdf7', borderRadius: 12, padding: '56px 24px',
    textAlign: 'center', border: '1px solid #e8e0cc',
  },
  emptyTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500,
    marginTop: 14, color: '#1a2620',
  },
  emptyText: { fontSize: 13, color: '#7a8270', marginTop: 8 },

  // Chat
  chatContainer: {
    background: '#fffdf7', borderRadius: 12, border: '1px solid #e8e0cc',
    display: 'flex', flexDirection: 'column',
    flex: 1, minHeight: 0,
    overflow: 'hidden',
  },
  chatHeader: {
    padding: '14px 18px', borderBottom: '1px solid #e8e0cc',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  chatTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500,
    color: '#1a2620', margin: 0, letterSpacing: -0.2, lineHeight: 1.2,
  },
  chatSubtitle: {
    fontSize: 11, color: '#7a8270', margin: '2px 0 0',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  chatClearAllBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 8,
    background: 'transparent', color: '#c8442a', fontSize: 12,
    fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    border: '1px solid #e8c5b8',
  },
  chatEmpty: {
    textAlign: 'center', color: '#a8a895', fontSize: 13,
    padding: '40px 20px', fontStyle: 'italic',
  },
  messageDeleteBtn: {
    position: 'absolute', top: -4, right: -6,
    width: 22, height: 22, borderRadius: '50%',
    background: '#fffdf7', color: '#7a8270', border: '1px solid #e8e0cc',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0, fontFamily: 'inherit',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    transition: 'opacity 0.15s',
  },
  messageActions: {
    display: 'flex', gap: 12, marginTop: 4,
  },
  messageActionBtn: {
    background: 'none', border: 'none', padding: 0,
    fontSize: 11, color: '#7a8270', fontFamily: 'inherit',
    cursor: 'pointer', fontWeight: 500,
  },
  messageEditWrap: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '4px 0',
  },
  messageEditInput: {
    padding: '8px 12px', borderRadius: 8,
    border: '1px solid #d4cdb8', background: '#fff',
    fontSize: 14, fontFamily: 'inherit', color: '#1a2620',
    outline: 'none',
  },
  messageEditActions: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  messageEditCancel: {
    padding: '4px 12px', borderRadius: 6,
    background: 'transparent', color: '#7a8270', border: 'none',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
  },
  messageEditSave: {
    padding: '4px 12px', borderRadius: 6,
    background: '#5c4a38', color: '#fff', border: 'none',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
  },
  messagesList: {
    flex: 1, overflowY: 'auto', padding: '18px 22px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  message: { display: 'flex', flexDirection: 'column' },
  messageMine: {},
  messageHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 4,
  },
  messageName: { fontSize: 13, fontWeight: 500, color: '#1a2620' },
  messageTime: { fontSize: 11, color: '#a8a895' },
  messageBubble: {
    fontSize: 14, lineHeight: 1.55, color: '#1a2620',
    padding: '2px 0',
  },
  chatInputRow: {
    display: 'flex', gap: 8, padding: 16,
    borderTop: '1px solid #e8e0cc', background: '#fffdf7',
    flexShrink: 0,
  },
  chatInput: {
    flex: 1, padding: '12px 16px', borderRadius: 24,
    border: '1px solid #d4cdb8', background: '#f5f1e8',
    fontFamily: 'inherit', fontSize: 14, color: '#1a2620',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: '50%', border: 'none',
    background: '#5c4a38', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12, marginBottom: 24,
  },
  statCard: {
    background: '#fffdf7', borderRadius: 12, padding: 22,
    border: '1px solid #e8e0cc',
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    fontFamily: '"Fraunces", serif', fontSize: 34, fontWeight: 500,
    lineHeight: 1, color: '#1a2620', letterSpacing: -0.5,
  },
  statLabel: { fontSize: 12, color: '#7a8270', marginTop: 6 },

  coachStatsCard: {
    background: '#fffdf7', borderRadius: 12, padding: 22,
    border: '1px solid #e8e0cc', marginBottom: 16,
  },
  coachStatsHeader: {
    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: 12, padding: '0 0 12px',
    borderBottom: '1px solid #e8e0cc',
    fontSize: 10, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 0.8,
    fontWeight: 500,
  },
  coachStatsRow: {
    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: 12, padding: '14px 0',
    borderBottom: '1px solid #f0eee4',
    alignItems: 'center',
  },
  coachStatsName: { display: 'flex', alignItems: 'center', gap: 12, color: '#1a2620' },
  coachStatsValue: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#1a2620' },
  barWrap: {
    height: 3, background: '#f0eee4', borderRadius: 2,
    marginTop: 4, width: 140, overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: 2 },

  alertPanel: {
    background: '#fef3e2', border: '1px solid #f3d8b8',
    borderRadius: 12, padding: 22,
  },
  alertPanelHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500,
    marginBottom: 14, color: '#1a2620',
  },
  alertRow: {
    display: 'flex', gap: 16, padding: '10px 0',
    fontSize: 13, color: '#5a6258',
    borderTop: '1px solid #f3d8b8',
  },

  typeRow: {
    display: 'grid', gridTemplateColumns: '140px 1fr 40px',
    gap: 12, alignItems: 'center', padding: '10px 0',
  },
  typeLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1a2620' },
  typeBarWrap: {
    height: 8, background: '#f0eee4', borderRadius: 4, overflow: 'hidden',
  },
  typeBar: { height: '100%', borderRadius: 4 },
  typeCount: { textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#1a2620' },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, zIndex: 100,
    backdropFilter: 'blur(2px)',
  },
  modalCard: {
    background: '#fffdf7', borderRadius: 16, maxWidth: 520, width: '100%',
    maxHeight: '90vh', overflow: 'auto', position: 'relative',
    boxShadow: '0 20px 50px rgba(26, 38, 32, 0.15)',
  },
  modalClose: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: '#f5f1e8', cursor: 'pointer', color: '#7a8270',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  modalDayBadge: {
    fontSize: 11, color: '#7a8270', textTransform: 'uppercase',
    letterSpacing: 0.8, fontWeight: 500,
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid #f0eee4', fontSize: 14,
    color: '#1a2620',
  },
  detailLabel: { color: '#7a8270', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { display: 'flex', alignItems: 'center', gap: 8 },
  youBadge: {
    background: '#5c4a38', color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  label: {
    display: 'block', fontSize: 11, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 500,
  },
  textarea: {
    width: '100%', padding: 12, borderRadius: 8,
    border: '1px solid #d4cdb8', background: '#fff',
    fontFamily: 'inherit', fontSize: 14, resize: 'vertical',
    color: '#1a2620',
  },
  select: {
    width: '100%', padding: 12, borderRadius: 8,
    border: '1px solid #d4cdb8', background: '#fff',
    fontFamily: 'inherit', fontSize: 14, color: '#1a2620',
  },
  hint: { fontSize: 12, color: '#7a8270', marginTop: 12, fontStyle: 'italic' },

  // Buttons
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 8, border: 'none',
    background: '#5c4a38', color: '#fff', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
  },
  btnSecondary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 8,
    border: '1px solid #5c4a38', background: 'transparent',
    color: '#5c4a38', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  },
  btnGhost: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 8,
    border: '1px solid #d4cdb8', background: 'transparent',
    color: '#5a6258', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  },
  btnDanger: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 8,
    border: '1px solid #e8c4bd', background: 'transparent',
    color: '#c8442a', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 12, marginBottom: 16,
  },
  pendingBadge: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 500, color: '#7a8270',
    background: '#f0eee4', padding: '4px 10px', borderRadius: 12,
  },
  orDivider: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '20px 0 14px', position: 'relative', color: '#a8a895',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 2,
  },

  // Settings modal toggles
  prefsSection: {
    marginBottom: 22, borderTop: '1px solid #f0eee4',
    paddingTop: 18,
  },
  prefsHeader: {
    fontSize: 10, fontWeight: 600, color: '#7a8270',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
  },
  prefRow: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '14px 0', width: '100%',
    background: 'transparent', border: 'none', borderBottom: '1px solid #f0eee4',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  prefLabel: { fontSize: 14, color: '#1a2620', fontWeight: 500, lineHeight: 1.3 },
  prefHint: { fontSize: 12, color: '#7a8270', marginTop: 3, lineHeight: 1.4 },
  toggleTrack: {
    width: 38, height: 20, borderRadius: 12,
    padding: 2, transition: 'background 0.18s ease', flexShrink: 0,
  },
  toggleKnob: {
    width: 16, height: 16, borderRadius: '50%',
    transition: 'transform 0.18s ease, background 0.18s ease',
  },
  infoBox: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#f4ead4', border: '1px solid #e8d8a8',
    borderRadius: 10, padding: '12px 14px', marginTop: 8,
    fontSize: 12, color: '#7a6238', lineHeight: 1.5,
  },

  // Login screen
  loginWrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f5f1e8', padding: 24, fontFamily: '"Geist", -apple-system, sans-serif',
  },
  loginCard: {
    background: '#fffdf7', borderRadius: 16, padding: '40px 36px',
    maxWidth: 420, width: '100%', border: '1px solid #e8e0cc',
    boxShadow: '0 8px 32px rgba(26, 38, 32, 0.06)',
  },
  loginLogo: {
    display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
    marginBottom: 28,
  },
  loginLogoMark: {
    width: 44, height: 44, borderRadius: 12,
    background: '#f5f1e8', border: '1px solid #ebe3cf',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  loginLogoMarkImg: {
    width: '100%', height: '100%',
    objectFit: 'contain', padding: 5,
    filter: 'brightness(0)',
  },
  loginTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 28, fontWeight: 500,
    color: '#1a2620', textAlign: 'center', marginBottom: 6, letterSpacing: -0.3,
  },
  loginSub: {
    fontSize: 13, color: '#7a8270', textAlign: 'center', marginBottom: 28,
  },
  loginField: { marginBottom: 16 },
  loginInput: {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid #d4cdb8', background: '#fff',
    fontFamily: 'inherit', fontSize: 14, color: '#1a2620',
  },
  loginError: {
    fontSize: 12, color: '#c8442a', marginTop: 8, padding: '8px 12px',
    background: '#fdebe5', borderRadius: 6, border: '1px solid #f3c8bd',
  },
  termsRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '14px 0 18px', cursor: 'pointer',
    fontSize: 13, color: '#5a6258', lineHeight: 1.5,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    border: '1.5px solid #d4cdb8', background: '#fff',
    flexShrink: 0, marginTop: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: {
    background: '#5c4a38', borderColor: '#5c4a38', color: '#fff',
  },
  termsLink: { color: '#5c4a38', textDecoration: 'underline', cursor: 'pointer' },
  loginBtn: {
    width: '100%', padding: '12px 18px', borderRadius: 8, border: 'none',
    background: '#5c4a38', color: '#fff', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.2,
    transition: 'all 0.18s ease',
  },

  // Sign in / Sign up toggle on login screen
  modeToggle: {
    display: 'flex', gap: 0, marginBottom: 20,
    padding: 3, background: '#f0eee4', borderRadius: 10,
    border: '1px solid #e8e0cc',
  },
  modeToggleBtn: {
    flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none',
    background: 'transparent', fontSize: 13, fontFamily: 'inherit',
    color: '#7a8270', fontWeight: 500, cursor: 'pointer',
  },
  modeToggleBtnActive: {
    background: '#fffdf7', color: '#5c4a38', fontWeight: 600,
    boxShadow: '0 1px 2px rgba(92, 74, 56, 0.08)',
  },

  // Profile editing in settings
  avatarRow: {
    display: 'flex', alignItems: 'center', gap: 18,
    padding: '12px 0 20px',
    borderBottom: '1px solid #f0eee4',
    marginBottom: 20,
  },
  avatarUploadBtn: {
    display: 'inline-block', padding: '8px 14px', borderRadius: 8,
    background: '#5c4a38', color: '#fff', fontSize: 12,
    fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none',
  },
  avatarRemoveBtn: {
    padding: '8px 14px', borderRadius: 8,
    background: 'transparent', color: '#7a8270', fontSize: 12,
    fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
    border: '1px solid #d4cdb8', marginLeft: 8,
  },
  avatarHint: {
    fontSize: 11, color: '#a8a895', marginTop: 8,
  },
  colorPalette: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
    gap: 8, marginBottom: 20, maxWidth: 380,
  },
  colorPickerRow: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  colorPickerWell: {
    width: 50, height: 44, border: '1px solid #d4cdb8', borderRadius: 8,
    cursor: 'pointer', padding: 0, background: 'none',
  },
  colorPickerHex: {
    flex: 1, padding: '11px 14px', fontSize: 14,
    fontFamily: 'monospace', textTransform: 'uppercase',
  },
  colorPickerPreview: {
    width: 44, height: 44, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  colorSwatch: {
    width: 40, height: 40, borderRadius: '50%',
    border: '2px solid transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  colorSwatchActive: {
    border: '2px solid #1a2620',
    boxShadow: '0 0 0 2px #fffdf7',
  },
  loginBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  loginFoot: {
    marginTop: 20, fontSize: 11, color: '#a8a895', textAlign: 'center', lineHeight: 1.5,
  },
  loginHint: {
    marginTop: 14, padding: 12, background: '#f5f1e8', borderRadius: 8,
    fontSize: 11, color: '#7a8270', lineHeight: 1.5,
  },

  // Interested cover coaches section on a cover card
  interestedSection: {
    background: '#eef1e8',
    border: '1px solid #d8e0c8',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 14,
  },
  interestedLabel: {
    fontSize: 10, fontWeight: 600, color: '#5b7245',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  interestedList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  interestedChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#fff', padding: '4px 4px 4px 8px',
    borderRadius: 14, border: '1px solid #d8e0c8',
    fontSize: 12, color: '#1a2620',
  },
  assignChipBtn: {
    padding: '4px 10px', borderRadius: 10, border: 'none',
    background: '#5c4a38', color: '#fff', fontFamily: 'inherit',
    fontSize: 11, fontWeight: 600, marginLeft: 4,
  },
  chipTypeTag: {
    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '2px 5px', borderRadius: 3,
  },
  chipTypePermanent: { background: '#dce4df', color: '#5c4a38' },
  chipTypeCover: { background: '#f0e3cc', color: '#8c5b3a' },

  // Personalized status bar at top of main content
  statusBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '16px 22px',
    background: '#fffdf7',
    borderLeft: '4px solid #5c4a38',
    borderRadius: 12,
    border: '1px solid #e8e0cc',
    borderLeftWidth: 4,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statusBarContent: { flex: 1, minWidth: 200 },
  statusBarTitle: {
    fontFamily: '"Fraunces", serif', fontSize: 16, fontWeight: 500,
    color: '#1a2620', lineHeight: 1.3, letterSpacing: -0.1,
  },
  statusBarSub: {
    fontSize: 12, color: '#7a8270', marginTop: 4,
  },
  statusBarBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#5c4a38', color: '#fff', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
    flexShrink: 0,
  },

  // Mobile: horizontal day selector
  daySelector: {
    display: 'flex', gap: 8, overflowX: 'auto',
    paddingBottom: 12, marginBottom: 16,
    WebkitOverflowScrolling: 'touch',
  },
  dayPill: {
    flexShrink: 0, padding: '10px 16px', borderRadius: 12,
    border: '1px solid #e8e0cc', background: '#fffdf7',
    fontFamily: 'inherit', cursor: 'pointer', position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: 64, color: '#1a2620',
  },
  dayPillActive: {
    background: '#5c4a38', borderColor: '#5c4a38', color: '#fff',
  },
  dayPillDay: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: 0.6, color: 'inherit', opacity: 0.7,
  },
  dayPillDate: {
    fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500,
    color: 'inherit', marginTop: 2, lineHeight: 1,
  },
  dayPillDot: {
    position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%',
  },
  mobileDayHeader: {
    marginBottom: 12,
  },
  mobileDayHeaderDay: {
    fontFamily: '"Fraunces", serif', fontSize: 20, fontWeight: 500,
    color: '#1a2620', letterSpacing: -0.2,
  },
  mobileDayList: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },

  // Mobile-variant class card (horizontal layout, full width)
  classCardMobile: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '16px 14px 16px 14px',
    width: '100%',
  },
  mobileCardLeft: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    minWidth: 48, flexShrink: 0,
  },
  mobileCardTime: {
    fontSize: 15, fontWeight: 600,
    color: '#5c4a38', lineHeight: 1, letterSpacing: -0.2,
    fontFamily: 'inherit',
  },
  mobileCardDur: {
    fontSize: 10, color: '#a8a895', marginTop: 4, fontWeight: 500,
    letterSpacing: 0.4,
  },
  mobileCardMid: { flex: 1, minWidth: 0 },
  mobileCardType: {
    fontSize: 16, fontWeight: 600, color: '#1a2620',
    marginBottom: 4, lineHeight: 1.3, letterSpacing: -0.1,
  },
  mobileCardMeta: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: '#7a8270',
  },
  mobileCardCoach: { whiteSpace: 'nowrap' },
  mobileCardStudio: { color: '#a8a895' },

  // Coach type badge (Permanent / Cover) on stats and elsewhere
  coachTypeBadge: {
    display: 'inline-block', fontSize: 9, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.6,
    padding: '2px 6px', borderRadius: 3, marginLeft: 6,
  },
  coachTypePermanent: { background: '#dce4df', color: '#5c4a38' },
  coachTypeCover: { background: '#f0e3cc', color: '#8c5b3a' },

  // Demo quick sign-in section on login screen
  demoSection: {
    marginTop: 24, paddingTop: 22, borderTop: '1px dashed #d4cdb8',
  },
  demoLabel: {
    fontSize: 10, fontWeight: 600, color: '#a8a895',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
    textAlign: 'center',
  },
  demoButtons: { display: 'flex', flexDirection: 'column', gap: 8 },
  demoBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e8e0cc', background: '#fffdf7',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  },
  demoBtnName: { fontSize: 13, fontWeight: 500, color: '#1a2620' },
  demoBtnRole: { fontSize: 10, color: '#7a8270', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.6 },
};
