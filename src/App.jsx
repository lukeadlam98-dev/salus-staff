import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, MessageSquare, Users, BarChart3, AlertCircle, AlertOctagon, Plus,
  Send, ArrowLeftRight, Check, X, Clock, Bell, RotateCcw, Settings, Mail, LogOut, Eye,
  ChevronLeft, ChevronRight, TrendingUp, Award, Activity, Trash2,
  Sparkles, Play, Heart, Flame, Bookmark, MoreHorizontal, Music, Lightbulb,
  Inbox, Shield, RefreshCw, MapPin, Target, Phone, AtSign, Briefcase,
  RotateCcw as CoverIcon, ListChecks, Quote, Building2, MessageCircle,
  Home as HomeIcon, FileText, User as UserIcon, Settings as SettingsIcon,
  Package, ExternalLink,
  Star, Trophy, Medal, Crown, Gem
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
  emailIntegrationFromDb,
  stockItemFromDb,
  storeCardFromDb,
  broadcastFromDb,
  broadcastReadFromDb,
  incidentFromDb,
  onboardingStepFromDb,
  expenseFromDb,
  flowFromDb,
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
  emailIntegration: null,
  stock: [],
  storeCards: [],
  broadcasts: [],
  broadcastReads: [],
  incidents: [],
  onboardingSteps: [],
  expenses: [],
  flows: [],
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

// ─── DESIGN SYSTEM — single source of truth for typography & colors ──────
const COLOR = {
  forest:   '#1a2620',  // primary text, primary buttons
  brown:    '#5c4a38',  // secondary text, decorative
  amber:    '#c6926a',  // accent (hires, warm)
  sage:     '#7a8c5c',  // accent (mine, internal)
  coral:    '#c8442a',  // urgency only — cover needed, errors
  cream:    '#fffdf7',  // primary background
  sand:     '#f5f1e8',  // app background, recessed surfaces
  bone:     '#efe7d2',  // dividers, subtle borders
  shell:    '#d4cdb8',  // stronger dividers
  taupe:    '#a59478',  // tertiary text, meta
  moss:     '#7a8270',  // body grey
  serif:    '"Playfair Display", Georgia, serif',
  sans:     "'Inter', -apple-system, sans-serif",
};

const TYPE = {
  // Page heros — top of major sections
  pageTitle:    { fontFamily: COLOR.serif, fontSize: 30, fontWeight: 400, color: COLOR.forest, letterSpacing: '-0.015em', lineHeight: 1.1 },
  pageTitleSm:  { fontFamily: COLOR.serif, fontSize: 22, fontWeight: 400, color: COLOR.forest, letterSpacing: '-0.005em', lineHeight: 1.2 },
  // Modal heros
  modalTitle:   { fontFamily: COLOR.serif, fontSize: 22, fontWeight: 400, color: COLOR.forest, letterSpacing: '-0.005em', lineHeight: 1.2 },
  // Card / list-item titles
  cardTitle:    { fontFamily: COLOR.serif, fontSize: 18, fontWeight: 400, color: COLOR.forest, letterSpacing: '-0.005em' },
  itemTitle:    { fontFamily: COLOR.serif, fontSize: 15, fontWeight: 500, color: COLOR.forest, letterSpacing: '-0.005em' },
  // Section dividers
  sectionLabel: { fontFamily: COLOR.serif, fontSize: 14, fontStyle: 'italic', color: COLOR.brown, letterSpacing: '0.005em' },
  // Eyebrow — small caps above titles
  eyebrow:      { fontSize: 10, fontWeight: 500, color: COLOR.taupe, letterSpacing: 2.5, textTransform: 'uppercase' },
  // Body / meta
  body:         { fontSize: 14, color: COLOR.forest },
  bodySub:      { fontSize: 13, color: COLOR.moss },
  meta:         { fontSize: 12, color: COLOR.moss },
  metaSmall:    { fontSize: 11, color: COLOR.taupe, letterSpacing: '0.02em' },
  // Caps inline labels (e.g. tabs)
  capsLabel:    { fontSize: 11, fontWeight: 500, color: COLOR.taupe, letterSpacing: '0.08em', textTransform: 'uppercase' },
  capsLabelActive: { fontSize: 11, fontWeight: 600, color: COLOR.forest, letterSpacing: '0.08em', textTransform: 'uppercase' },
  // Empty state — italic Playfair
  emptyState:   { fontFamily: COLOR.serif, fontSize: 16, fontStyle: 'italic', color: COLOR.brown, letterSpacing: '-0.005em' },
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
function minutesBetween(startHM, endHM) {
  // "HH:MM" → minutes
  if (!startHM || !endHM) return null;
  const [sh, sm] = startHM.split(':').map(Number);
  const [eh, em] = endHM.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return null;
  return (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
}

// Renders text with @mentions highlighted. If `me` is mentioned, the highlight is stronger.
function renderMentionedText(text, mentionUserIds, meId) {
  if (!text) return null;
  // Split on @word patterns
  const parts = text.split(/(@[\p{L}\p{N}_-]+)/gu);
  return parts.map((p, i) => {
    if (p.startsWith('@')) {
      const meMentioned = mentionUserIds && mentionUserIds.length > 0; // approximate
      return (
        <span key={i} style={{
          color: meMentioned ? '#c6926a' : '#5c4a38',
          fontWeight: 600,
          background: meMentioned ? '#fef7e8' : 'transparent',
          padding: meMentioned ? '0 4px' : 0,
          borderRadius: 4,
        }}>{p}</span>
      );
    }
    return p;
  });
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

  // Listen for Me page admin section button clicks
  useEffect(() => {
    const handler = (e) => {
      const section = e?.detail?.section;
      if (section) setModal({ type: 'adminSection', section });
    };
    window.addEventListener('salus:openAdmin', handler);
    return () => window.removeEventListener('salus:openAdmin', handler);
  }, []);

  // Listen for tab switch requests from child components (e.g. home avatar tap → Me)
  useEffect(() => {
    const handler = (e) => {
      const t = e?.detail;
      if (t && typeof t === 'string') setTab(t);
    };
    window.addEventListener('salus:tab', handler);
    return () => window.removeEventListener('salus:tab', handler);
  }, []);

  // Listen for modal open requests from child components (e.g. home bell/gear)
  useEffect(() => {
    const handler = (e) => {
      const m = e?.detail;
      if (m && typeof m === 'object') setModal(m);
    };
    window.addEventListener('salus:openModal', handler);
    return () => window.removeEventListener('salus:openModal', handler);
  }, []);

  // View-as-staff toggle — lets managers preview the staff experience
  const [viewAsStaff, setViewAsStaff] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('salus_view_as_staff') === '1';
  });
  const toggleViewAsStaff = () => {
    setViewAsStaff(prev => {
      const next = !prev;
      if (typeof localStorage !== 'undefined') {
        if (next) localStorage.setItem('salus_view_as_staff', '1');
        else localStorage.removeItem('salus_view_as_staff');
      }
      return next;
    });
  };

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
      const [profilesRes, classesRes, coverReqRes, swapReqRes, messagesRes, shiftsRes, tasksRes, taskCmRes, shiftNotesRes, toursRes, maintRes, fbRes, postsRes, postRxRes, postCmRes, bookingsRes, dmsRes, emailIntRes, stockRes, storeCardsRes, broadcastsRes, broadcastReadsRes, incidentsRes, onboardingStepsRes, expensesRes, flowsRes] = await Promise.all([
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
        supabase.from('email_integrations').select('*').eq('user_id', session.user?.id).maybeSingle(),
        supabase.from('stock_items').select('*').eq('archived', false).order('name'),
        supabase.from('store_cards').select('*').eq('archived', false).order('display_order'),
        supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('broadcast_reads').select('*').eq('user_id', session.user?.id),
        supabase.from('incidents').select('*').order('created_at', { ascending: false }),
        supabase.from('onboarding_steps').select('*'),
        supabase.from('expenses').select('*').eq('user_id', session.user?.id).order('spent_on', { ascending: false }),
        supabase.from('flows').select('*').eq('user_id', session.user?.id).order('updated_at', { ascending: false }),
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
        emailIntegration: emailIntRes?.data ? emailIntegrationFromDb(emailIntRes.data) : null,
        stock: (stockRes.data || []).map(stockItemFromDb),
        storeCards: (storeCardsRes.data || []).map(storeCardFromDb),
        broadcasts: (broadcastsRes.data || []).map(broadcastFromDb),
        broadcastReads: (broadcastReadsRes.data || []).map(broadcastReadFromDb),
        incidents: (incidentsRes.data || []).map(incidentFromDb),
        onboardingSteps: (onboardingStepsRes.data || []).map(onboardingStepFromDb),
        expenses: (expensesRes.data || []).map(expenseFromDb),
        flows: (flowsRes.data || []).map(flowFromDb),
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_integrations' }, silentReload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Tour sync: pull from Google Calendar via /api/sync-tours.
  // Triggers on app load + every 5 min while open. Realtime channel above
  // automatically refreshes the UI once new tours land in Supabase.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const trigger = async () => {
      try {
        await fetch('/api/sync-tours', { method: 'GET' });
      } catch (err) {
        // Silent — sync is best-effort; if it fails we just show whatever's already in DB
      }
    };
    trigger();
    const id = setInterval(() => { if (!cancelled) trigger(); }, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
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

  // ─── Gmail OAuth handlers ───────────────────────────────────────────────────
  const handleConnectGmail = async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) {
        alert('You need to be signed in to connect Gmail.');
        return;
      }
      // Redirect to our oauth-start endpoint, which redirects to Google.
      window.location.href = `/api/oauth-start?token=${encodeURIComponent(s.access_token)}`;
    } catch (e) {
      console.error('Connect Gmail failed:', e);
      alert('Could not start Gmail connection. Please try again.');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      const { error } = await supabase
        .from('email_integrations')
        .delete()
        .eq('user_id', currentUserId);
      if (error) throw error;
      await reloadData(true);
    } catch (e) {
      console.error('Disconnect Gmail failed:', e);
      alert('Could not disconnect Gmail: ' + (e.message || e));
    }
  };

  // Handle redirect back from Google OAuth (?gmail=connected / ?gmail=error&reason=X)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailParam = params.get('gmail');
    if (!gmailParam) return;
    if (gmailParam === 'connected') {
      // Reload data to pick up the new integration row, then show a toast.
      reloadData(true).then(() => {
        setTimeout(() => alert('Gmail connected successfully. Open the Me tab to verify.'), 200);
      });
    } else if (gmailParam === 'error') {
      const reason = params.get('reason') || 'unknown';
      alert(`Gmail connection failed (${reason}). Please try again.`);
    }
    // Clean up the URL so a refresh doesn't re-trigger
    const cleanUrl = window.location.pathname;
    window.history.replaceState(null, '', cleanUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Loading screens — animated logo ────────────────────────────────────
  if (!authChecked) {
    return <LoadingLogo />;
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
    return <LoadingLogo />;
  }

  const currentUserId = session.user?.id;

  // No profile row for this auth user — guide them
  if (!data.users.find(u => u.id === currentUserId)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f1e8', fontFamily: "'Inter', sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 440, background: '#fffdf7', border: '1px solid #e8e0cc', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, marginTop: 0, color: '#1a2620' }}>Account isn't fully set up yet</h2>
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

  // ─── Onboarding gate — new hires complete the wizard before seeing the app ─
  const currentUserProfile = data.users.find(u => u.id === currentUserId);
  if (currentUserProfile && currentUserProfile.role !== 'manager' && !isOnboardingComplete(currentUserProfile)) {
    return (
      <OnboardingScreen
        currentUser={currentUserProfile}
        onComplete={() => reloadData(true)}
      />
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

  const markBroadcastRead = async (broadcastId) => {
    if (!broadcastId || !currentUserId) return;
    await supabase.from('broadcast_reads').upsert({
      broadcast_id: broadcastId,
      user_id: currentUserId,
    });
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

  // ─── Subtasks ───
  // A subtask is a normal task row with parent_task_id set to the parent.
  // Inherits audience='specific' and the parent's assignee unless overridden.
  const addSubtask = async (parentId, title, assigneeId) => {
    if (!parentId || !title?.trim()) return false;
    const parent = data.tasks.find(t => t.id === parentId);
    if (!parent) return false;
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      audience: 'specific',
      assignee_id: assigneeId || parent.assigneeId || currentUserId,
      created_by: currentUserId,
      status: 'todo',
      priority: 'normal',
      task_kind: 'daily', // subtasks are simple ✓/✗
      parent_task_id: parentId,
    });
    if (error) { console.error('addSubtask', error); return false; }
    await reloadData(true);
    return true;
  };

  const toggleSubtask = async (subtaskId, done) => {
    return await setTaskStatus(subtaskId, done ? 'done' : 'todo');
  };

  const deleteSubtask = async (subtaskId) => {
    if (!subtaskId) return false;
    const { error } = await supabase.from('tasks').delete().eq('id', subtaskId);
    if (error) { console.error('deleteSubtask', error); return false; }
    await reloadData(true);
    return true;
  };

  // ─── Comment with @mentions ───
  // Parses @firstName from the text and stores matched user IDs.
  const addTaskCommentWithMentions = async (taskId, text) => {
    if (!taskId || !text?.trim()) return false;
    const trimmed = text.trim();
    // Match @word — captures the name following the @
    const matches = [...trimmed.matchAll(/@([\p{L}\p{N}_-]+)/gu)].map(m => m[1].toLowerCase());
    const mentionIds = matches
      .map(name => data.users.find(u =>
        (u.name || '').toLowerCase().split(' ')[0] === name
        || (u.name || '').toLowerCase().replace(/\s+/g, '') === name
      )?.id)
      .filter(Boolean);
    const unique = [...new Set(mentionIds)];

    const { error } = await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: currentUserId,
      text: trimmed,
      kind: 'comment',
      mention_user_ids: unique.length ? unique : null,
    });
    if (error) { console.error('addTaskComment', error); return false; }
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
  const realIsManager = currentUser.role === 'manager';

  // Effective manager flag — false when previewing staff view
  const isManager = realIsManager && !viewAsStaff;
  const previewingAsStaff = realIsManager && viewAsStaff;

  // First-time onboarding — if the user hasn't picked any role yet, show the picker.
  // Manager bypasses this entirely. Use realIsManager so view-as-staff doesn't trigger the picker.
  if (!realIsManager && !currentUser.isCoach && !currentUser.isFoh) {
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
  if (!realIsManager && !currentUser.onboardingCompletedAt) {
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
        /* Fonts loaded via index.html */
        * { box-sizing: border-box; }
        body {
          margin: 0; background: #f5f1e8;
          /* App feels native — text is not user-selectable */
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        /* Allow selection in actual input fields so people can edit */
        input, textarea, [contenteditable] {
          -webkit-user-select: text;
          user-select: text;
        }
        .salus-btn { transition: all 0.15s ease; cursor: pointer; }
        .salus-btn:hover { transform: translateY(-1px); }
        .salus-card { transition: all 0.2s ease; }
        .salus-card:hover { box-shadow: 0 4px 12px rgba(92, 74, 56, 0.08); }
        .salus-tab { transition: all 0.2s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .salus-modal-content { animation: slideUp 0.22s ease; }
        .salus-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .salus-scroll::-webkit-scrollbar-track { background: transparent; }
        .salus-scroll::-webkit-scrollbar-thumb { background: #d4cdb8; border-radius: 3px; }
        .salus-scroll-h::-webkit-scrollbar { display: none; height: 0; }
        .salus-scroll-h { scrollbar-width: none; -ms-overflow-style: none; }
        .salus-input:focus { outline: none; border-color: #5c4a38 !important; }

        /* Home page full-bleed wrapper — escapes main's horizontal padding
           so the warm gradient reaches the screen edges. Matches main's
           14px mobile / 32px desktop padding. */
        .salus-home-bleed {
          margin-left: -32px;
          margin-right: -32px;
          padding-left: 32px;
          padding-right: 32px;
        }
        @media (max-width: 768px) {
          .salus-home-bleed {
            margin-left: -14px;
            margin-right: -14px;
            padding-left: 14px;
            padding-right: 14px;
          }
        }

        /* Mobile-specific overrides */
        @media (max-width: 768px) {
          .salus-header { padding: 10px 14px !important; }
          .salus-header-right { gap: 4px !important; }
          .salus-nav { padding: 6px 8px 0 !important; gap: 2px !important; }
          .salus-nav-tab { padding: 8px 10px !important; font-size: 12px !important; }
          .salus-main { padding: 14px 14px 100px !important; }
          /* Chat tab is fixed-position, no scroll buffer needed.
             Higher specificity (.A.B) beats .A so this wins. */
          .salus-main.salus-main-chat { padding: 8px 8px 0 !important; }
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

      {/* Main */}
      <main className={tab === 'chat' ? 'salus-main salus-main-chat' : 'salus-main'} style={tab === 'chat' ? styles.mainChat : styles.main}>
        {tab === 'home' && (
          <Home
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onReload={reloadData}
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
            onHireStudio={() => { setTab('admin'); setModal({ type: 'createBooking' }); }}
            onClaim={(req) => setModal({ type: 'coverThread', coverRequestId: req.id })}
            onExpressInterest={expressInterest}
            onViewAllCover={() => setTab('cover')}
            onViewChat={() => setTab('chat')}
            onCreateTask={() => setModal({ type: 'createTask' })}
            onOpenTask={(taskId) => setModal({ type: 'taskDetail', taskId })}
            onOpenAllTasks={() => setModal({ type: 'tasksPage' })}
            onOpenTour={(tourId) => setModal({ type: 'tourDetail', tourId })}
            onCreateMaintenance={() => setModal({ type: 'createMaintenance' })}
            onOpenMaintenance={(id) => setModal({ type: 'maintenanceDetail', id })}
            onCreateFeedback={() => setModal({ type: 'createFeedback' })}
            onOpenFeedback={(id) => setModal({ type: 'feedbackDetail', id })}
            onMarkBroadcastRead={markBroadcastRead}
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
            onBookingClick={(id) => setModal({ type: 'bookingDetail', id })}
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
        {tab === 'cover' && (
          <CoverPage
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onClassClick={(id) => setModal({ type: 'classDetail', classId: id })}
          />
        )}
        {tab === 'me' && (
          <MePage
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            realIsManager={realIsManager}
            viewAsStaff={viewAsStaff}
            onToggleViewAsStaff={toggleViewAsStaff}
            emailIntegration={data.emailIntegration}
            sessionToken={session?.access_token}
            onOpenSettings={() => setModal({ type: 'settings' })}
            onShowInvoices={() => setModal({ type: 'invoices' })}
            onShowStaffInvoices={() => setModal({ type: 'staffInvoices' })}
            onShowTimeOff={() => setModal({ type: 'timeOff' })}
            onShowTeam={() => setModal({ type: 'team' })}
            onShowExpenses={() => setModal({ type: 'expenses' })}
            onShowFlows={() => setModal({ type: 'flows' })}
            onSignOut={handleLogout}
            onConnectGmail={handleConnectGmail}
            onDisconnectGmail={handleDisconnectGmail}
            onCreate={() => setModal({ type: 'createBooking' })}
            onOpenBooking={(id) => setModal({ type: 'bookingDetail', id })}
            onCreateTask={createTask}
            onReload={reloadData}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={styles.bottomNav}>
        <BottomTab icon={HomeIcon} label="Home" active={tab==='home'} onClick={() => setTab('home')} />
        <BottomTab icon={CoverIcon} label="Cover" active={tab==='cover'} onClick={() => setTab('cover')} badge={(data.coverRequests || []).filter(r => r.status === 'open' || r.status === 'pending').length} />
        <BottomTab icon={Calendar} label="Schedule" active={tab==='timetable'} onClick={() => setTab('timetable')} />
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
            onAddComment={addTaskCommentWithMentions}
            onDeleteComment={deleteTaskComment}
            onAddSubtask={addSubtask}
            onToggleSubtask={toggleSubtask}
            onDeleteSubtask={deleteSubtask}
          />
        );
      })()}
      {modal?.type === 'tasksPage' && (
        <TasksPage
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onClose={() => setModal(null)}
          onOpenTask={(taskId) => setModal({ type: 'taskDetail', taskId })}
          onCreateTask={() => setModal({ type: 'createTask' })}
        />
      )}
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
      {modal?.type === 'expenses' && (
        <ExpensesModal
          data={data}
          currentUser={currentUser}
          sessionToken={session?.access_token}
          onClose={() => setModal(null)}
          onReload={reloadData}
        />
      )}
      {modal?.type === 'staffInvoices' && (
        <StaffInvoicesModal
          data={data}
          currentUser={currentUser}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'adminSection' && (
        <AdminSectionModal
          section={modal.section}
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          emailIntegration={data.emailIntegration}
          sessionToken={session?.access_token}
          onClose={() => setModal(null)}
          onConnectGmail={handleConnectGmail}
          onCreateTask={createTask}
          onCreate={() => setModal({ type: 'createBooking' })}
          onOpenBooking={(id) => setModal({ type: 'bookingDetail', id })}
          onReload={reloadData}
          onShowInvoices={() => setModal({ type: 'invoices' })}
        />
      )}
      {modal?.type === 'flows' && (
        <FlowsModal
          data={data}
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onReload={reloadData}
        />
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
            icon={<Activity size={20} color="#7a8c5c" />}
          />
          <Option
            active={isFoh}
            onClick={() => setIsFoh(v => !v)}
            title="Front of House"
            desc="I work at reception, checking members in"
            icon={<UserIcon size={20} color="#c6926a" />}
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

  // Achievements (badges) — luxury lucide-react icons, no emoji
  const totalActivity = completed.length + completedShifts.length;
  const achievements = [
    { id: 'first',     name: 'First class',      desc: 'Taught your first session', threshold: 1,   value: totalActivity, Icon: Target,  tint: '#5c4a38' },
    { id: 'ten',       name: '10 in',            desc: '10 sessions taught',        threshold: 10,  value: totalActivity, Icon: Star,    tint: '#c6926a' },
    { id: 'fifty',     name: 'Fifty club',       desc: '50 sessions taught',        threshold: 50,  value: totalActivity, Icon: Medal,   tint: '#c6926a' },
    { id: 'century',   name: 'Centurion',        desc: '100 sessions taught',       threshold: 100, value: totalActivity, Icon: Trophy,  tint: '#c6926a' },
    { id: 'cover5',    name: 'Cover hero',       desc: '5 cover shifts claimed',    threshold: 5,   value: coversClaimedByMe.length, Icon: Shield, tint: '#7a8c5c' },
    { id: 'streak4',   name: '1-month streak',   desc: '4 weeks in a row',          threshold: 4,   value: streak, Icon: Flame, tint: '#c6926a' },
    { id: 'streak12',  name: '3-month streak',   desc: '12 weeks in a row',         threshold: 12,  value: streak, Icon: Flame, tint: '#c8442a' },
    { id: 'streak26',  name: 'Half-year streak', desc: '26 weeks in a row',         threshold: 26,  value: streak, Icon: Crown, tint: '#5c4a38' },
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

      {/* Achievement badges — luxury icons in soft circle */}
      <div style={styles.statsBadgesLabel}>Achievements</div>
      <div style={styles.statsBadgesGrid}>
        {achievements.map(a => {
          const unlocked = a.value >= a.threshold;
          const IconCmp = a.Icon;
          return (
            <div key={a.id}
              title={`${a.name} · ${a.desc}${unlocked ? '' : ` (${a.value}/${a.threshold})`}`}
              style={{
                ...styles.statsBadge,
                ...(unlocked ? styles.statsBadgeUnlocked : styles.statsBadgeLocked),
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 22,
                background: unlocked ? '#f5f1e8' : '#efe7d2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: unlocked ? a.tint : '#d4cdb8',
                marginBottom: 6,
              }}>
                <IconCmp
                  size={20}
                  strokeWidth={1.6}
                  fill={unlocked ? a.tint : 'none'}
                  color={unlocked ? a.tint : '#d4cdb8'}
                />
              </div>
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
          { key: 'flow',     label: 'Flows' },
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

// ============================================================
// AdminPage — wraps Inbox, Cancellations, Tours, and Bookings.
// Coaches see Bookings only; manager + FOH see all sections.
// ============================================================
// ─── StaffAdminPage — simplified personal-tools page for non-managers ────
// Coaches and FOH see this instead of the full Admin tab bar. Focused on
// their own personal integrations and studio bookings.
// ─── StaffAdminPage — your personal admin tools ──────────────────────────
// Calendar & email integrations · Expenses · Flows · Time off.
// No Studio Bookings (that's a manager concern).
function StaffAdminPage({ data, currentUser, emailIntegration, onConnectGmail, onShowExpenses, onShowFlows, onShowTimeOff, onShowStaffInvoices, embedded }) {
  const inner = (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="Your tools"
          title="Admin"
          subtitle="Your personal admin — calendar, inbox, expenses, time off."
          compact
        />
      )}

      {/* Integrations */}
      <SectionLabel>Integrations</SectionLabel>

      <div style={{
        background: '#fffdf7', border: '1px solid #efe7d2',
        borderRadius: 14, padding: '18px 18px 16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#f5f1e8', color: '#5c4a38',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            <Calendar size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...TYPE.itemTitle }}>Google Calendar</div>
            <div style={{ ...TYPE.metaSmall, marginTop: 4, lineHeight: 1.5 }}>
              Your Salus classes appear in your personal calendar. Cover changes update automatically.
            </div>
          </div>
        </div>
        <button
          disabled
          className="salus-btn"
          style={{
            width: '100%', marginTop: 8, padding: '10px 16px',
            background: 'transparent', color: '#a59478',
            border: '1px solid #efe7d2', borderRadius: 10,
            fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'not-allowed', fontWeight: 500,
          }}
        >
          Coming soon
        </button>
      </div>

      <div style={{
        background: '#fffdf7', border: '1px solid #efe7d2',
        borderRadius: 14, padding: '18px 18px 16px', marginBottom: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#f5f1e8', color: '#5c4a38',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            <Mail size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...TYPE.itemTitle }}>Gmail</div>
            {emailIntegration ? (
              <div style={{ ...TYPE.metaSmall, marginTop: 4, lineHeight: 1.5 }}>
                Connected as {emailIntegration.emailAddress || 'your Gmail account'}.
              </div>
            ) : (
              <div style={{ ...TYPE.metaSmall, marginTop: 4, lineHeight: 1.5 }}>
                Connect your personal Gmail so member messages can be triaged inside Salus.
              </div>
            )}
          </div>
        </div>
        {emailIntegration ? (
          <div style={{
            marginTop: 8, padding: '10px 16px',
            color: '#7a8c5c',
            border: '1px solid #efe7d2', borderRadius: 10,
            fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'inherit', textAlign: 'center', fontWeight: 500,
          }}>
            ✓ Connected
          </div>
        ) : (
          <button
            onClick={onConnectGmail}
            className="salus-btn"
            style={{
              width: '100%', marginTop: 8, padding: '10px 16px',
              background: '#1a2620', color: '#fffdf7',
              border: 'none', borderRadius: 10,
              fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Connect Gmail
          </button>
        )}
      </div>

      {/* Personal admin tools */}
      <SectionLabel>Personal admin</SectionLabel>
      <div style={styles.meActionsList}>
        {(() => {
          // Compute this month's invoice preview for the row subtitle
          const now = new Date();
          const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          const monthEndIso = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
          const myMonth = (data.classes || []).filter(c =>
            c.coachId === currentUser.id && c.date >= monthStartIso && c.date <= monthEndIso
          );
          const rate = currentUser.sessionRatePence || 3000;
          const monthTotal = (rate * myMonth.length) / 100;
          const monthLabel = now.toLocaleDateString('en-GB', { month: 'long' });
          return (
            <button onClick={onShowStaffInvoices} className="salus-btn" style={styles.meActionRow}>
              <FileText size={18} color="#5c4a38" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: '#1a2620' }}>Invoices</div>
                <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                  {monthLabel}: {myMonth.length} {myMonth.length === 1 ? 'class' : 'classes'} · £{monthTotal.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <ChevronRight size={16} color="#a59478" />
            </button>
          );
        })()}
        <button onClick={onShowExpenses} className="salus-btn" style={styles.meActionRow}>
          <FileText size={18} color="#5c4a38" />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 14, color: '#1a2620' }}>Expenses</div>
            <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
              {data.expenses?.length || 0} receipts · for your tax return
            </div>
          </div>
          <ChevronRight size={16} color="#a59478" />
        </button>
        <button onClick={onShowFlows} className="salus-btn" style={styles.meActionRow}>
          <Bookmark size={18} color="#5c4a38" />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 14, color: '#1a2620' }}>Flows</div>
            <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
              {(data.flows || []).filter(f => !f.archived).length} active · session library
            </div>
          </div>
          <ChevronRight size={16} color="#a59478" />
        </button>
        <button onClick={onShowTimeOff} className="salus-btn" style={{ ...styles.meActionRow, borderBottom: 'none' }}>
          <Calendar size={18} color="#5c4a38" />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 14, color: '#1a2620' }}>Time off & bank holidays</div>
            <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>Upcoming UK bank holidays</div>
          </div>
          <ChevronRight size={16} color="#a59478" />
        </button>
      </div>
    </>
  );
  return embedded ? inner : <div style={styles.homeContainer}>{inner}</div>;
}

function AdminPage({ data, currentUser, isManager, emailIntegration, sessionToken, onCreate, onOpenBooking, onConnectGmail, onCreateTask, onReload, onShowExpenses, onShowFlows, onShowTimeOff, onShowInvoices, onShowStaffInvoices, embedded }) {
  // Hooks MUST be at the top — before any conditional returns — or React loses
  // track of hook order when isManager flips (eg. View-as-staff toggle).
  const canSeeAdminSections = isManager || currentUser.isFoh;
  const [section, setSection] = useState(canSeeAdminSections ? 'reports' : 'bookings');
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Non-managers see a simplified personal admin — focused on their own tools, not running the studio.
  if (!isManager) {
    return (
      <StaffAdminPage
        data={data}
        currentUser={currentUser}
        emailIntegration={emailIntegration}
        onConnectGmail={onConnectGmail}
        onShowExpenses={onShowExpenses}
        onShowFlows={onShowFlows}
        onShowTimeOff={onShowTimeOff}
        onShowStaffInvoices={onShowStaffInvoices}
        embedded={embedded}
      />
    );
  }

  const Wrapper = embedded ? 'div' : 'div';
  const wrapperStyle = embedded ? {} : styles.homeContainer;

  return (
    <Wrapper style={wrapperStyle}>
      {/* Section tabs */}
      <div style={styles.adminTabRow}>
        <button onClick={() => setSection('reports')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'reports' ? styles.adminTabActive : {}) }}>
          <BarChart3 size={14} /> Reports
        </button>
        <button onClick={() => setSection('inbox')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'inbox' ? styles.adminTabActive : {}) }}>
          <Inbox size={14} /> Inbox
        </button>
        <button onClick={() => setSection('cancellations')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'cancellations' ? styles.adminTabActive : {}) }}>
          <AlertCircle size={14} /> Cancellations
        </button>
        <button onClick={() => setSection('tours')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'tours' ? styles.adminTabActive : {}) }}>
          <MapPin size={14} /> Tours
        </button>
        <button onClick={() => setSection('stock')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'stock' ? styles.adminTabActive : {}) }}>
          <Package size={14} /> Stock
        </button>
        <button onClick={() => setSection('bookings')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'bookings' ? styles.adminTabActive : {}) }}>
          <Bookmark size={14} /> Bookings
        </button>
        <button onClick={() => setSection('incidents')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'incidents' ? styles.adminTabActive : {}) }}>
          <AlertCircle size={14} /> Incidents
        </button>
        <button onClick={() => setSection('invoices')} className="salus-btn"
          style={{ ...styles.adminTab, ...(section === 'invoices' ? styles.adminTabActive : {}) }}>
          <FileText size={14} /> Invoices
        </button>
      </div>

      {/* Manager broadcast button — visible only to managers, above section content */}
      {isManager && (
        <button onClick={() => setBroadcastOpen(true)} className="salus-btn" style={{
          width: '100%', padding: '12px 16px',
          background: 'transparent', border: `1px solid ${COLOR.bone}`,
          borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: COLOR.brown, fontSize: 12, fontWeight: 500,
          letterSpacing: '0.04em', marginBottom: 14,
          fontFamily: 'inherit', cursor: 'pointer',
        }}>
          📣  Broadcast to all staff
        </button>
      )}

      {/* Section content */}
      {section === 'inbox' && (
        <AdminInboxSection
          emailIntegration={emailIntegration}
          onConnectGmail={onConnectGmail}
          data={data}
          currentUser={currentUser}
          onCreateTask={onCreateTask}
        />
      )}
      {section === 'reports' && (
        <AdminReportsSection
          emailIntegration={emailIntegration}
          onConnectGmail={onConnectGmail}
        />
      )}
      {section === 'cancellations' && <AdminCancellationsSection />}
      {section === 'tours' && <AdminToursSection data={data} currentUser={currentUser} />}
      {section === 'stock' && (
        <AdminStockSection
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onReload={onReload}
        />
      )}
      {section === 'bookings' && (
        <StudioBookingsView
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onCreate={onCreate}
          onOpenBooking={onOpenBooking}
        />
      )}
      {section === 'incidents' && (
        <AdminIncidentsSection
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          onReload={onReload}
        />
      )}

      {section === 'invoices' && (
        <div>
          <SectionLabel>Pay run</SectionLabel>
          <div style={{
            background: '#fffdf7', border: '1px solid #efe7d2',
            borderRadius: 14, padding: '18px 18px 16px', marginBottom: 14,
          }}>
            <div style={{ ...TYPE.itemTitle, marginBottom: 6 }}>Generate invoices</div>
            <div style={{ ...TYPE.metaSmall, marginBottom: 14, lineHeight: 1.5 }}>
              Build CSV invoices for all coaches based on classes taught.
              £30 per session by default, override per-coach via Team settings.
            </div>
            <button onClick={() => setBroadcastOpen(false) || onShowInvoices?.()} className="salus-btn"
              style={{
                width: '100%', padding: '12px 16px',
                background: '#1a2620', color: '#fffdf7',
                border: 'none', borderRadius: 10,
                fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
              }}
            >
              Open pay run
            </button>
          </div>
        </div>
      )}

      {/* Broadcast composer */}
      {broadcastOpen && (
        <BroadcastModal
          currentUserId={currentUser.id}
          sessionToken={sessionToken}
          onClose={() => setBroadcastOpen(false)}
          onSent={() => { setBroadcastOpen(false); onReload?.(); }}
        />
      )}
    </Wrapper>
  );
}

// ─── Admin · Inbox section ────────────────────────────────────────────────
// ─── Category metadata (colours + icons) ───
const CATEGORY_META = {
  cancellation:  { label: 'Cancel',     bg: '#f5dcd6', fg: '#c8442a' },
  refund:        { label: 'Refund',     bg: '#fef0d8', fg: '#b87034' },
  inquiry:       { label: 'Inquiry',    bg: '#e0e8ee', fg: '#3d6478' },
  tour:          { label: 'Tour',       bg: '#e3ecd8', fg: '#5b7245' },
  complaint:     { label: 'Complaint',  bg: '#f5dcd6', fg: '#c8442a' },
  newsletter:    { label: 'Newsletter', bg: '#efe7d2', fg: '#7a8270' },
  internal:      { label: 'Internal',   bg: '#efe7d2', fg: '#7a8270' },
  other:         { label: 'Other',      bg: '#efe7d2', fg: '#7a8270' },
};

function AdminInboxSection({ emailIntegration, onConnectGmail, data, currentUser, onCreateTask }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [newlyClassified, setNewlyClassified] = useState(0);
  const [filter, setFilter] = useState('urgent'); // urgent | open | cancellation | refund | inquiry | tour | complaint | handled
  const [busyIds, setBusyIds] = useState(new Set());
  const [nudgeTarget, setNudgeTarget] = useState(null); // msg being nudged about
  const [draftReplyTarget, setDraftReplyTarget] = useState(null); // msg being replied to
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('salus_inbox_density') || 'comfortable'; } catch { return 'comfortable'; }
  });
  const [expandedIds, setExpandedIds] = useState(new Set()); // for compact mode, tap to expand
  const toggleExpanded = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const cycleDensity = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    try { localStorage.setItem('salus_inbox_density', next); } catch {}
  };

  // Load existing classifications from Supabase (fast — no API call)
  const loadFromDb = async () => {
    if (!emailIntegration) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { data, error: err } = await supabase
      .from('email_classifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('classified_at', { ascending: false })
      .limit(100);
    if (err) { setError(err.message); return; }
    setMessages(data || []);
  };

  // Sync = fetch new emails from Gmail + classify via Claude
  const syncEmails = async () => {
    if (!emailIntegration) return;
    setLoading(true);
    setError(null);
    setNewlyClassified(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError('Not signed in'); return; }
      const res = await fetch(`/api/gmail-sync?token=${encodeURIComponent(session.access_token)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Sync failed'); return; }
      setMessages(json.messages || []);
      setNewlyClassified(json.newly_classified || 0);
      setLastFetched(Date.now());
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  // On mount: load from DB instantly, then sync in background
  useEffect(() => {
    if (!emailIntegration) return;
    loadFromDb();
    syncEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailIntegration?.id]);

  const handleMarkHandled = async (msgId) => {
    setBusyIds(prev => new Set(prev).add(msgId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error: err } = await supabase
        .from('email_classifications')
        .update({ handled_at: new Date().toISOString(), handled_by: session?.user?.id })
        .eq('id', msgId);
      if (err) throw err;
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, handled_at: new Date().toISOString() } : m));
    } catch (e) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(msgId); return n; });
    }
  };

  const handleUnmarkHandled = async (msgId) => {
    setBusyIds(prev => new Set(prev).add(msgId));
    try {
      const { error: err } = await supabase
        .from('email_classifications')
        .update({ handled_at: null, handled_by: null })
        .eq('id', msgId);
      if (err) throw err;
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, handled_at: null } : m));
    } catch (e) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(msgId); return n; });
    }
  };

  if (!emailIntegration) {
    return (
      <div style={styles.emptyCard}>
        <Inbox size={28} color="#c6926a" />
        <div style={styles.emptyTitle}>Connect your inbox</div>
        <div style={styles.emptyBody}>
          Once connected, recent emails are read, AI-tagged, and shown here so you can keep on top of
          cancellations, refunds, and member inquiries.
        </div>
        <button onClick={onConnectGmail} className="salus-btn" style={styles.btnPrimary}>
          <Mail size={14} /> Connect Gmail
        </button>
      </div>
    );
  }

  // Filter messages based on chip
  const visible = messages.filter(m => {
    if (filter === 'urgent') return !m.handled_at && m.urgency === 'high';
    if (filter === 'open') return !m.handled_at;
    if (filter === 'handled') return !!m.handled_at;
    return !m.handled_at && m.category === filter;
  });

  // Counts for chips
  const urgentCount = messages.filter(m => !m.handled_at && m.urgency === 'high').length;
  const openCount = messages.filter(m => !m.handled_at).length;
  const handledCount = messages.filter(m => !!m.handled_at).length;
  const cancelCount = messages.filter(m => !m.handled_at && m.category === 'cancellation').length;
  const refundCount = messages.filter(m => !m.handled_at && m.category === 'refund').length;

  return (
    <>
      <div style={{ padding: '8px 0 20px' }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: '#a59478', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Inbox
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 26, fontWeight: 400, color: '#1a2620', lineHeight: 1.15, letterSpacing: '-0.01em',
          }}>
            {urgentCount > 0
              ? `${urgentCount} to action`
              : openCount > 0
                ? `${openCount} to review`
                : 'Nothing pending'}
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <button onClick={cycleDensity} className="salus-btn" style={{
              background: 'transparent', border: 'none', padding: 4,
              color: '#a59478', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
            }}>
              {density === 'comfortable' ? 'Compact' : 'Detailed'}
            </button>
            <button onClick={syncEmails} disabled={loading} className="salus-btn" style={{
              background: 'transparent', border: 'none', padding: 4,
              color: '#a59478', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
            }}>
              {loading ? 'Syncing' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar — editorial underline */}
      <div style={{
        display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        borderBottom: '1px solid #efe7d2',
        marginBottom: 4,
      }}>
        <FilterChip
          label={`Urgent${urgentCount > 0 ? ` ${urgentCount}` : ''}`}
          active={filter === 'urgent'}
          onClick={() => setFilter('urgent')}
          accent={urgentCount > 0 ? '#c8442a' : null}
        />
        <FilterChip label={`Open ${openCount}`} active={filter === 'open'} onClick={() => setFilter('open')} />
        {cancelCount > 0 && <FilterChip label={`Cancel ${cancelCount}`} active={filter === 'cancellation'} onClick={() => setFilter('cancellation')} />}
        {refundCount > 0 && <FilterChip label={`Refund ${refundCount}`} active={filter === 'refund'} onClick={() => setFilter('refund')} />}
        <FilterChip label="Inquiry" active={filter === 'inquiry'} onClick={() => setFilter('inquiry')} />
        <FilterChip label="Tour" active={filter === 'tour'} onClick={() => setFilter('tour')} />
        <FilterChip label="Complaint" active={filter === 'complaint'} onClick={() => setFilter('complaint')} />
        <FilterChip label={`Done ${handledCount}`} active={filter === 'handled'} onClick={() => setFilter('handled')} />
      </div>

      {error && (
        <div style={{ padding: 14, background: '#fef0ec', color: '#5c4a38', borderRadius: 4, fontSize: 13, marginTop: 16 }}>
          {error}
        </div>
      )}

      {!loading && visible.length === 0 && !error && (
        <div style={{ padding: '60px 20px 40px', textAlign: 'center' }}>
          <div style={{
            fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38', fontStyle: 'italic',
            letterSpacing: '-0.005em',
          }}>
            {filter === 'urgent' ? 'Nothing urgent.' :
             filter === 'open' ? 'Nothing to action.' :
             filter === 'handled' ? 'No replies marked yet.' :
             'Nothing in this category.'}
          </div>
          {filter === 'urgent' && (
            <div style={{ fontSize: 12, color: '#a59478', marginTop: 8 }}>A calm inbox.</div>
          )}
        </div>
      )}

      {visible.map(msg => (
        <EmailCard
          key={msg.id}
          msg={msg}
          busy={busyIds.has(msg.id)}
          density={density}
          expanded={expandedIds.has(msg.id)}
          onToggleExpand={() => toggleExpanded(msg.id)}
          onMarkHandled={() => handleMarkHandled(msg.id)}
          onUnmarkHandled={() => handleUnmarkHandled(msg.id)}
          onNudge={() => setNudgeTarget(msg)}
          onDraftReply={() => setDraftReplyTarget(msg)}
        />
      ))}

      {/* Draft reply modal */}
      {draftReplyTarget && (
        <DraftReplyModal
          msg={draftReplyTarget}
          onClose={() => setDraftReplyTarget(null)}
          onMarkHandled={() => handleMarkHandled(draftReplyTarget.id)}
        />
      )}

      {/* Nudge modal */}
      {nudgeTarget && (
        <NudgeModal
          msg={nudgeTarget}
          users={data.users || []}
          currentUserId={currentUser.id}
          onCreateTask={onCreateTask}
          onClose={() => setNudgeTarget(null)}
        />
      )}
    </>
  );
}

function FilterChip({ label, active, onClick, accent }) {
  const activeColor = accent || '#1a2620';
  return (
    <button onClick={onClick} className="salus-btn" style={{
      padding: '6px 0',
      background: 'transparent',
      border: 'none',
      color: active ? activeColor : '#a59478',
      fontSize: 11,
      fontWeight: active ? 600 : 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      borderBottom: active ? `1.5px solid ${activeColor}` : '1.5px solid transparent',
      marginRight: 20,
      transition: 'all 0.15s ease',
    }}>
      {label}
    </button>
  );
}

function EmailCard({ msg, busy, density, expanded, onToggleExpand, onMarkHandled, onUnmarkHandled, onNudge, onDraftReply }) {
  const meta = CATEGORY_META[msg.category] || CATEGORY_META.other;
  const isHandled = !!msg.handled_at;
  const isUrgent = msg.urgency === 'high';
  const [showCatMenu, setShowCatMenu] = useState(false);
  const isCompact = density === 'compact' && !expanded;

  const reclassify = async (newCategory) => {
    setShowCatMenu(false);
    if (newCategory === msg.category) return;
    try {
      const { error: err } = await supabase
        .from('email_classifications')
        .update({ category: newCategory })
        .eq('id', msg.id);
      if (err) throw err;
      msg.category = newCategory;
    } catch (e) {
      alert('Failed to reclassify: ' + (e.message || e));
    }
  };

  // ─── Compact row — single tap-to-expand line ───
  if (isCompact) {
    return (
      <button
        onClick={onToggleExpand}
        className="salus-btn"
        style={{
          width: '100%',
          padding: '14px 4px',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #efe7d2',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: isHandled ? 0.4 : 1,
          fontFamily: 'inherit',
        }}
      >
        {/* Category dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isUrgent && !isHandled ? '#c8442a' : meta.fg,
          flexShrink: 0,
        }} />

        {/* From + Subject in one line */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#5c4a38', flexShrink: 0,
              maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {cleanEmailFrom(msg.email_from)}
            </span>
            <span style={{
              fontSize: 13, color: '#1a2620', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"Playfair Display", serif', letterSpacing: '-0.005em',
            }}>
              {msg.email_subject}
            </span>
          </div>
        </div>

        {/* Date */}
        <div style={{ fontSize: 11, color: '#a59478', flexShrink: 0 }}>
          {formatEmailDate(msg.email_date)}
        </div>
      </button>
    );
  }

  // ─── Detailed/expanded card ───
  return (
    <div style={{
      padding: '20px 4px 18px',
      borderBottom: '1px solid #efe7d2',
      opacity: isHandled ? 0.45 : 1,
      position: 'relative',
    }}>
      {/* Top row — category + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={() => setShowCatMenu(!showCatMenu)} className="salus-btn" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', padding: 0, border: 'none',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: meta.fg, display: 'inline-block',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 600, color: '#7a8270',
            textTransform: 'uppercase', letterSpacing: 2,
          }}>{meta.label}</span>
        </button>
        {isUrgent && !isHandled && (
          <span style={{
            fontSize: 10, color: '#c8442a', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 2,
          }}>Urgent</span>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: '#a59478' }}>{formatEmailDate(msg.email_date)}</div>
        {density === 'compact' && expanded && onToggleExpand && (
          <button onClick={onToggleExpand} className="salus-btn" style={{
            background: 'transparent', border: 'none', padding: 0,
            color: '#a59478', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Close</button>
        )}
      </div>

      {/* Category change menu */}
      {showCatMenu && (
        <CategoryMenu
          current={msg.category}
          onPick={reclassify}
          onClose={() => setShowCatMenu(false)}
        />
      )}

      {/* From — small caps */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#5c4a38', marginBottom: 4, letterSpacing: '0.02em' }}>
        {cleanEmailFrom(msg.email_from)}
      </div>

      {/* Subject — Playfair, bigger */}
      <div style={{
        fontFamily: '"Playfair Display", serif',
        fontSize: 17, fontWeight: 400, color: '#1a2620',
        lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.005em',
      }}>
        {msg.email_subject}
      </div>

      {/* AI summary */}
      {msg.summary && (
        <div style={{
          fontSize: 13, color: '#5c4a38', lineHeight: 1.5,
          marginBottom: msg.suggested_action && !isHandled ? 10 : 0,
        }}>
          {msg.summary}
        </div>
      )}

      {/* Suggested action — italic editor's note */}
      {msg.suggested_action && !isHandled && (
        <div style={{
          fontSize: 12, color: '#7a8270', fontStyle: 'italic', lineHeight: 1.4,
          paddingLeft: 12, borderLeft: '2px solid #efe7d2',
        }}>
          {msg.suggested_action}
        </div>
      )}

      {/* Action row — bigger tap targets with icons */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 16,
        paddingTop: 14, borderTop: '1px solid #efe7d2',
      }}>
        {isHandled ? (
          <button onClick={onUnmarkHandled} disabled={busy} className="salus-btn" style={{
            background: 'transparent', border: '1px solid #efe7d2',
            padding: '10px 14px', borderRadius: 999,
            color: '#a59478', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'inherit', cursor: 'pointer',
            minHeight: 40,
          }}>
            <RotateCcw size={13} /> Unmark
          </button>
        ) : (
          <>
            {onDraftReply && (
              <button onClick={onDraftReply} className="salus-btn" style={{
                background: '#1a2620', border: '1px solid #1a2620',
                padding: '10px 16px', borderRadius: 999,
                color: '#fffdf7', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit', cursor: 'pointer',
                flex: 1, justifyContent: 'center',
                minHeight: 40,
              }}>
                <Sparkles size={13} /> Draft reply
              </button>
            )}
            <button onClick={onMarkHandled} disabled={busy} className="salus-btn" style={{
              background: 'transparent', border: '1px solid #cdd9bc',
              padding: '10px 14px', borderRadius: 999,
              color: '#5b7245', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', cursor: 'pointer',
              minHeight: 40,
            }}>
              <Check size={13} /> Done
            </button>
            {onNudge && (
              <button onClick={onNudge} className="salus-btn" style={{
                background: 'transparent', border: '1px solid #efe7d2',
                padding: '10px 14px', borderRadius: 999,
                color: '#7a8270', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit', cursor: 'pointer',
                minHeight: 40,
              }} aria-label="Pass to teammate">
                <Users size={13} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Reusable category-change dropdown
function CategoryMenu({ current, onPick, onClose }) {
  const options = ['cancellation', 'refund', 'tour', 'inquiry', 'complaint', 'newsletter', 'internal', 'other'];
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 49,
      }} />
      <div style={{
        position: 'absolute', top: 32, left: 12, zIndex: 50,
        background: '#fffdf7', border: '1px solid #efe7d2',
        borderRadius: 10, boxShadow: '0 4px 12px rgba(92, 74, 56, 0.15)',
        padding: 4, minWidth: 140,
      }}>
        <div style={{ fontSize: 10, color: '#a59478', padding: '6px 8px 4px', fontWeight: 600 }}>
          CHANGE CATEGORY
        </div>
        {options.map(opt => {
          const m = CATEGORY_META[opt];
          const isCurrent = opt === current;
          return (
            <button key={opt} onClick={() => onPick(opt)} className="salus-btn" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 8px', width: '100%', textAlign: 'left',
              fontSize: 12, color: isCurrent ? '#a59478' : '#1a2620',
              fontWeight: isCurrent ? 400 : 500,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: m.fg,
              }} />
              {m.label}
              {isCurrent && <span style={{ marginLeft: 'auto', fontSize: 10 }}>(current)</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── DraftReplyModal — AI drafts a reply you can copy + paste into Gmail ───
function DraftReplyModal({ msg, onClose, onMarkHandled }) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const replyTo = cleanEmailFrom(msg.email_from);
  const subject = `Re: ${msg.email_subject}`;

  const generateDraft = async () => {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not signed in');
        setLoading(false);
        setRegenerating(false);
        return;
      }
      const res = await fetch('/api/gmail-draft-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messageId: msg.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setDraft(json.draft || '');
    } catch (e) {
      setError(e.message || 'Failed to generate draft');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    generateDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const ta = document.getElementById('salus-draft-textarea');
      if (ta) {
        ta.select();
        try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      }
    }
  };

  const openGmail = async () => {
    await copyToClipboard();
    const recipient = msg.email_from.match(/<(.+?)>/)?.[1] || msg.email_from;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}`;
    window.open(url, '_blank');
  };

  const regenerate = () => {
    setRegenerating(true);
    setLoading(true);
    setDraft('');
    generateDraft();
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)',
        zIndex: 9998,
      }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, top: 0, bottom: 0,
        background: COLOR.cream,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Draft reply"
          title={`To ${replyTo}`}
          subtitle={subject}
          onClose={onClose}
        />

        {/* Body — scrollable */}
        <div style={{
          flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '18px 22px',
        }}>
          {loading && (
            <EmptyState>
              {regenerating ? 'Rewriting…' : 'Drafting your reply…'}
            </EmptyState>
          )}

          {error && !loading && (
            <div style={{
              padding: 14, background: '#fef0ec', color: '#5c4a38', borderRadius: 8,
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {!loading && draft && (
            <>
              <textarea
                id="salus-draft-textarea"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                style={{
                  width: '100%', minHeight: 280, padding: '16px 18px',
                  borderRadius: 14, border: '1px solid #efe7d2', background: '#fffdf7',
                  fontFamily: 'inherit', fontSize: 15, lineHeight: 1.6, color: '#1a2620',
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              <div style={{
                fontSize: 11, color: '#a59478', marginTop: 12, textAlign: 'center',
                lineHeight: 1.5,
              }}>
                AI draft — edit before sending.
              </div>
            </>
          )}
        </div>

        {/* Sticky footer — actions always visible */}
        {!loading && draft && (
          <div style={{
            padding: '14px 18px',
            paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
            borderTop: '1px solid #efe7d2',
            background: '#fffdf7',
            flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <button onClick={openGmail} className="salus-btn" style={{
              ...styles.btnPrimary, width: '100%', justifyContent: 'center',
              padding: '14px 22px', fontSize: 14,
            }}>
              {copied ? 'Copied — paste in Gmail' : 'Copy & open Gmail'}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copyToClipboard} className="salus-btn" style={{
                ...styles.btnGhost, flex: 1, justifyContent: 'center',
                padding: '10px 12px',
              }}>
                {copied ? 'Copied' : 'Copy only'}
              </button>
              <button onClick={regenerate} className="salus-btn" style={{
                ...styles.btnGhost, flex: 1, justifyContent: 'center',
                padding: '10px 12px',
              }}>
                Rewrite
              </button>
              {onMarkHandled && (
                <button onClick={() => { onMarkHandled(); onClose(); }} className="salus-btn" style={{
                  ...styles.btnGhost, flex: 1, justifyContent: 'center',
                  padding: '10px 12px', color: '#5b7245',
                }}>
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  , document.body);
}

// ─── Nudge modal — creates a task for a teammate to handle this email ───
function NudgeModal({ msg, users, currentUserId, onCreateTask, onClose }) {
  const [assigneeId, setAssigneeId] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Sort: FOH first, then coaches, alphabetical. Exclude current user.
  const pickable = users
    .filter(u => u.id !== currentUserId && (u.isFoh || u.isCoach || u.role === 'manager'))
    .sort((a, b) => {
      if (a.isFoh !== b.isFoh) return a.isFoh ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const fromName = cleanEmailFrom(msg.email_from);
  const meta = CATEGORY_META[msg.category] || CATEGORY_META.other;

  const handleSend = async () => {
    if (!assigneeId) { alert('Pick a teammate first.'); return; }
    setBusy(true);
    try {
      const taskTitle = `Reply: ${msg.email_subject || `email from ${fromName}`}`.slice(0, 100);
      const desc = [
        `Email from: ${fromName}`,
        msg.email_subject ? `Subject: ${msg.email_subject}` : '',
        '',
        msg.summary ? `Summary: ${msg.summary}` : '',
        msg.suggested_action ? `Suggested: ${msg.suggested_action}` : '',
        '',
        note ? `Note: ${note}` : '',
      ].filter(Boolean).join('\n');

      const ok = await onCreateTask({
        title: taskTitle,
        description: desc,
        assigneeId,
        audience: 'specific',
        dueDate: new Date().toISOString().slice(0, 10), // today
        priority: msg.urgency === 'high' ? 'urgent' : 'normal',
        recurrence: 'none',
        taskKind: 'project',
      });

      if (ok) {
        const assignee = users.find(u => u.id === assigneeId);
        alert(`Nudge sent to ${assignee?.name || 'teammate'}. They'll see a task on their Home + a push notification.`);
        onClose();
      } else {
        alert('Could not create the task. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(26, 38, 32, 0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="salus-modal-content" style={{
        width: '100%', maxWidth: 460,
        background: '#fffdf7', borderRadius: '16px 16px 0 0',
        padding: 20, maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, background: '#efe7d2', borderRadius: 999, margin: '0 auto 16px' }} />

        <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 20, color: '#1a2620', marginBottom: 4 }}>
          Nudge a teammate
        </div>
        <div style={{ fontSize: 12, color: '#7a8270', marginBottom: 16 }}>
          Creates a task for them to handle this email. They'll get a push notification.
        </div>

        {/* Email context card */}
        <div style={{
          background: '#fef7e8', border: '1px solid #efe7d2', borderRadius: 10,
          padding: 10, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
              background: meta.bg, color: meta.fg, textTransform: 'uppercase', letterSpacing: 0.4,
            }}>{meta.label}</span>
            <div style={{ fontSize: 11, color: '#7a8270' }}>From {fromName}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2620' }}>{msg.email_subject}</div>
          {msg.summary && (
            <div style={{ fontSize: 12, color: '#5c4a38', marginTop: 4 }}>{msg.summary}</div>
          )}
        </div>

        {/* Assignee picker */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Send to
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
          {pickable.map(u => (
            <button key={u.id} onClick={() => setAssigneeId(u.id)} className="salus-btn" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, textAlign: 'left',
              background: assigneeId === u.id ? '#fef0d8' : 'transparent',
              border: assigneeId === u.id ? '1px solid #c6926a' : '1px solid transparent',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: u.isFoh ? '#fef7e8' : '#e8ede0',
                color: u.isFoh ? '#c6926a' : '#7a8c5c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{(u.name || '?').slice(0, 1).toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 13, color: '#1a2620' }}>{u.name}</div>
                <div style={{ fontSize: 10, color: '#a59478' }}>
                  {u.isFoh ? 'FOH' : ''}{u.isFoh && u.isCoach ? ' · ' : ''}{u.isCoach ? 'Coach' : ''}{u.role === 'manager' ? ' · Manager' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Optional note */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8270', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Note (optional)
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Reply by tomorrow, copy me in"
          style={{
            width: '100%', minHeight: 60, padding: 10, marginBottom: 16,
            borderRadius: 10, border: '1px solid #efe7d2',
            background: '#fffdf7', fontFamily: 'inherit', fontSize: 13, color: '#1a2620',
            resize: 'vertical',
          }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="salus-btn" style={{
            flex: 1, padding: '12px', borderRadius: 999,
            background: '#fffdf7', border: '1px solid #efe7d2', color: '#5c4a38',
            fontSize: 14, fontWeight: 600,
          }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={!assigneeId || busy} className="salus-btn" style={{
            flex: 1, padding: '12px', borderRadius: 999,
            background: assigneeId ? '#5c4a38' : '#a59478', color: '#fffdf7',
            fontSize: 14, fontWeight: 600,
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? 'Sending…' : 'Send nudge'}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// Helpers for inbox display
function cleanEmailFrom(from) {
  if (!from) return 'Unknown';
  // "Sarah Smith <sarah@example.com>" → "Sarah Smith"
  const match = from.match(/^"?([^"<]+?)"?\s*<.+>/);
  return match ? match[1].trim() : from;
}
function formatEmailDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

// ─── Admin · Reports section (historical view by month) ──────────────────
function AdminReportsSection({ emailIntegration, onConnectGmail }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState(null);
  // Selected month — defaults to last month
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1); // 0-indexed
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | cancellation | refund | ...

  const loadFromDb = async () => {
    if (!emailIntegration) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data, error: err } = await supabase
        .from('email_classifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('classified_at', { ascending: false })
        .limit(1000);
      if (err) throw err;
      setMessages(data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (emailIntegration) loadFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailIntegration?.id]);

  const backfillMonth = async () => {
    if (!emailIntegration) return;
    if (!confirm(`Backfill emails for ${MONTH_NAMES[month]} ${year}? This pulls them from Gmail and runs each through AI classification (a few pennies of API cost).`)) return;
    setBackfilling(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError('Not signed in'); return; }
      // Gmail wants "after:" = first day of month, "before:" = first day of NEXT month
      const monthStr = String(month + 1).padStart(2, '0');
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const nextMonthStr = String(nextMonth).padStart(2, '0');
      const after = `${year}-${monthStr}-01`;
      const before = `${nextYear}-${nextMonthStr}-01`;
      const res = await fetch(`/api/gmail-sync?token=${encodeURIComponent(session.access_token)}&after=${after}&before=${before}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Backfill failed'); return; }
      // Reload from db to get the freshly classified emails
      await loadFromDb();
      alert(`Backfill complete. ${json.newly_classified || 0} new emails classified for ${MONTH_NAMES[month]} ${year}.`);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBackfilling(false);
    }
  };

  if (!emailIntegration) {
    return (
      <div style={styles.emptyCard}>
        <BarChart3 size={28} color="#c6926a" />
        <div style={styles.emptyTitle}>Connect your inbox first</div>
        <div style={styles.emptyBody}>
          Reports needs Gmail connected so it can pull and classify your past emails.
        </div>
        <button onClick={onConnectGmail} className="salus-btn" style={styles.btnPrimary}>
          <Mail size={14} /> Connect Gmail
        </button>
      </div>
    );
  }

  // Filter messages to just the selected month
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();
  const monthMessages = messages.filter(m => {
    if (!m.email_date) return false;
    const ts = new Date(m.email_date).getTime();
    if (isNaN(ts)) return false;
    return ts >= monthStart && ts < monthEnd;
  });

  // Compute per-category stats for this month
  const stats = {
    cancellation: monthMessages.filter(m => m.category === 'cancellation'),
    refund:       monthMessages.filter(m => m.category === 'refund'),
    inquiry:      monthMessages.filter(m => m.category === 'inquiry'),
    tour:         monthMessages.filter(m => m.category === 'tour'),
    complaint:    monthMessages.filter(m => m.category === 'complaint'),
  };

  const filtered = categoryFilter === 'all'
    ? monthMessages.filter(m => ['cancellation', 'refund', 'inquiry', 'tour', 'complaint'].includes(m.category))
    : monthMessages.filter(m => m.category === categoryFilter);

  const goPrev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  return (
    <>
      <PageHeader
        eyebrow="Audit"
        title="Reports"
        subtitle="Month by month"
      />

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={goPrev} className="salus-btn" style={styles.btnGhost}>
          <ChevronLeft size={14} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1a2620' }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button onClick={goNext} className="salus-btn" style={styles.btnGhost}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatTile label="Cancellations" items={stats.cancellation} color="#c8442a" onClick={() => setCategoryFilter('cancellation')} />
        <StatTile label="Refunds"       items={stats.refund}       color="#b87034" onClick={() => setCategoryFilter('refund')} />
        <StatTile label="Inquiries"     items={stats.inquiry}      color="#3d6478" onClick={() => setCategoryFilter('inquiry')} />
        <StatTile label="Tour requests" items={stats.tour}         color="#5b7245" onClick={() => setCategoryFilter('tour')} />
      </div>

      {error && (
        <div style={{ padding: 12, background: '#f5dcd6', color: '#5c4a38', borderRadius: 12, fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Backfill button — most useful when we have <some emails> for this month */}
      {monthMessages.length < 3 && (
        <div style={{ ...styles.emptyCard, marginBottom: 16 }}>
          <BarChart3 size={24} color="#c6926a" />
          <div style={styles.emptyBody}>
            {monthMessages.length === 0
              ? `No classified emails for ${MONTH_NAMES[month]} ${year} yet.`
              : `Only ${monthMessages.length} email(s) classified for this month.`}
          </div>
          <button onClick={backfillMonth} disabled={backfilling} className="salus-btn" style={styles.btnPrimary}>
            {backfilling ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Backfilling…</> : <>Backfill {MONTH_NAMES[month]} {year}</>}
          </button>
        </div>
      )}

      {/* Filtered email list */}
      {filtered.length > 0 && (
        <>
          <div style={{ ...styles.adminSectionHead, marginTop: 8 }}>
            <div style={styles.adminSectionTitle}>
              {categoryFilter === 'all' ? 'All actionable emails' : `${categoryFilter}s in ${MONTH_NAMES[month]}`}
              <span style={{ color: '#a59478', fontSize: 13, marginLeft: 6 }}>({filtered.length})</span>
            </div>
            {categoryFilter !== 'all' && (
              <button onClick={() => setCategoryFilter('all')} className="salus-btn" style={styles.btnGhost}>
                Clear filter
              </button>
            )}
          </div>
          {filtered.map(msg => (
            <ReportEmailRow key={msg.id} msg={msg} onReload={loadFromDb} />
          ))}
        </>
      )}
    </>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function StatTile({ label, items, color, onClick }) {
  const total = items.length;
  const unhandled = items.filter(i => !i.handled_at).length;
  return (
    <button onClick={onClick} className="salus-btn" style={{
      background: '#fffdf7',
      border: 'none',
      borderRadius: 18,
      padding: '20px 18px',
      textAlign: 'left',
      boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)',
    }}>
      <div style={{ fontSize: 10, color: '#a59478', marginBottom: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 32, fontWeight: 400, color: '#1a2620', lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          {total}
        </div>
        {unhandled > 0 && (
          <div style={{ fontSize: 11, color: color, fontWeight: 500, letterSpacing: '0.02em' }}>
            {unhandled} open
          </div>
        )}
      </div>
    </button>
  );
}

function ReportEmailRow({ msg, onReload }) {
  const meta = CATEGORY_META[msg.category] || CATEGORY_META.other;
  const isHandled = !!msg.handled_at;
  const [busy, setBusy] = useState(false);

  const toggleHandled = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = isHandled
        ? { handled_at: null, handled_by: null }
        : { handled_at: new Date().toISOString(), handled_by: session?.user?.id };
      const { error: err } = await supabase
        .from('email_classifications')
        .update(payload)
        .eq('id', msg.id);
      if (err) throw err;
      await onReload();
    } catch (e) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      ...styles.emailCard,
      opacity: isHandled ? 0.55 : 1,
      borderLeft: !isHandled && msg.urgency === 'high' ? '3px solid #c8442a' : `1px solid #efe7d2`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: meta.bg, color: meta.fg, textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{meta.label}</span>
        <div style={{ flex: 1 }} />
        <div style={styles.emailDate}>{formatEmailDate(msg.email_date)}</div>
      </div>
      <div style={styles.emailFrom}>{cleanEmailFrom(msg.email_from)}</div>
      <div style={styles.emailSubject}>{msg.email_subject}</div>
      {msg.summary && (
        <div style={{ ...styles.emailSnippet, color: '#5c4a38', marginTop: 4 }}>{msg.summary}</div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={toggleHandled} disabled={busy} className="salus-btn"
          style={isHandled ? styles.btnGhost : { ...styles.btnGhost, color: '#5b7245', borderColor: '#cdd9bc' }}>
          {isHandled ? '↩ Unmark' : <><Check size={12} /> Mark handled</>}
        </button>
      </div>
    </div>
  );
}


function AdminCancellationsSection() {
  return (
    <>
      <PageHeader
        eyebrow="Members"
        title="Cancellations"
        subtitle="Refund requests and membership changes"
      />
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38',
          fontStyle: 'italic', letterSpacing: '-0.005em', marginBottom: 10,
        }}>
          Waiting on Xplor.
        </div>
        <div style={{ fontSize: 13, color: '#7a8270', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
          Once Xplor API access is approved, this will populate automatically from member actions.
          In the meantime, the Inbox catches anything that comes by email.
        </div>
      </div>
    </>
  );
}

// ─── Admin · Tours section ────────────────────────────────────────────────
function AdminToursSection({ data, currentUser }) {
  const upcoming = (data.tours || [])
    .filter(t => t.startTime >= Date.now() - 24 * 3600 * 1000)
    .sort((a, b) => a.startTime - b.startTime);

  return (
    <>
      <PageHeader
        eyebrow="Visitors"
        title="Tours"
        subtitle={upcoming.length > 0
          ? `${upcoming.length} ${upcoming.length === 1 ? 'tour' : 'tours'} scheduled`
          : 'Synced from Google Calendar'}
      />

      {upcoming.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{
            fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38',
            fontStyle: 'italic', letterSpacing: '-0.005em',
          }}>
            No tours scheduled.
          </div>
          <div style={{ fontSize: 12, color: '#a59478', marginTop: 8 }}>
            New bookings appear here automatically.
          </div>
        </div>
      ) : (
        upcoming.map(tour => {
        const d = new Date(tour.startTime);
        const isToday = d.toDateString() === new Date().toDateString();
        const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={tour.id} style={styles.emailCard}>
            <div style={styles.emailCardHead}>
              <div style={styles.emailFrom}>{tour.guestName || tour.title || 'Tour'}</div>
              <div style={styles.emailDate}>{dayLabel} · {timeLabel}</div>
            </div>
            {tour.guestEmail && <div style={styles.emailSnippet}>{tour.guestEmail}</div>}
            {tour.notes && <div style={{ ...styles.emailSnippet, marginTop: 4, fontStyle: 'italic' }}>{tour.notes}</div>}
          </div>
        );
      })
      )}
    </>
  );
}

// ─── Admin · Stock section ──────────────────────────────────────────────
const STOCK_CATEGORIES = {
  studio:   { label: 'Studio',   order: 1 },
  bathroom: { label: 'Bathroom', order: 2 },
  kitchen:  { label: 'Kitchen',  order: 3 },
  cleaning: { label: 'Cleaning', order: 4 },
  office:   { label: 'Office',   order: 5 },
  other:    { label: 'Other',    order: 6 },
};

function AdminStockSection({ data, currentUser, isManager, onReload }) {
  const items = data.stock || [];
  const cards = data.storeCards || [];
  const [filter, setFilter] = useState('all'); // all | low
  const [editItem, setEditItem] = useState(null); // item being edited (or 'new')
  const [busyIds, setBusyIds] = useState(new Set());
  const [viewCard, setViewCard] = useState(null); // card being viewed full-screen
  const [editCard, setEditCard] = useState(null); // card being edited (or 'new')

  const visible = filter === 'low'
    ? items.filter(i => i.currentQty <= i.lowThreshold)
    : items;

  const lowCount = items.filter(i => i.currentQty <= i.lowThreshold).length;

  // Group by category
  const groups = {};
  visible.forEach(item => {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });
  const orderedCats = Object.keys(groups).sort((a, b) =>
    (STOCK_CATEGORIES[a]?.order || 99) - (STOCK_CATEGORIES[b]?.order || 99)
  );

  const setBusy = (id, busy) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  };

  const updateQty = async (item, delta) => {
    const newQty = Math.max(0, item.currentQty + delta);
    setBusy(item.id, true);
    try {
      const { error } = await supabase
        .from('stock_items')
        .update({
          current_qty: newQty,
          last_updated_by: currentUser.id,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) throw error;
      // Optimistic local update — reload picks up the real state
      item.currentQty = newQty;
      onReload?.();
    } catch (e) {
      alert('Failed to update: ' + (e.message || e));
    } finally {
      setBusy(item.id, false);
    }
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        <PageHeader
          eyebrow="Studio"
          title="Stock"
          subtitle={lowCount > 0 ? `${lowCount} running low` : 'Everything is stocked'}
        />
        {isManager && (
          <button onClick={() => setEditItem('new')} className="salus-btn" style={{
            position: 'absolute', top: 0, right: 0,
            width: 44, height: 44, borderRadius: '50%',
            background: '#1a2620', color: '#fffdf7',
            border: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(26, 38, 32, 0.25)',
          }}>
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 20, padding: '0 4px 12px',
        borderBottom: '1px solid #efe7d2', marginBottom: 4,
      }}>
        <button onClick={() => setFilter('all')} className="salus-btn" style={{
          padding: '6px 0', background: 'transparent', border: 'none',
          borderBottom: filter === 'all' ? '1.5px solid #1a2620' : '1.5px solid transparent',
          fontSize: 11, fontWeight: filter === 'all' ? 600 : 500,
          color: filter === 'all' ? '#1a2620' : '#a59478',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1,
        }}>
          All {items.length}
        </button>
        <button onClick={() => setFilter('low')} className="salus-btn" style={{
          padding: '6px 0', background: 'transparent', border: 'none',
          borderBottom: filter === 'low' ? `1.5px solid ${lowCount > 0 ? '#c8442a' : '#1a2620'}` : '1.5px solid transparent',
          fontSize: 11, fontWeight: filter === 'low' ? 600 : 500,
          color: filter === 'low' ? (lowCount > 0 ? '#c8442a' : '#1a2620') : (lowCount > 0 ? '#c8442a' : '#a59478'),
          letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1,
        }}>
          Running low {lowCount > 0 ? lowCount : ''}
        </button>
      </div>

      {/* Store cards — barcodes for FOH to scan at the till */}
      {(cards.length > 0 || isManager) && (
        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10, padding: '0 2px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 500, color: '#a59478',
              letterSpacing: 2.5, textTransform: 'uppercase',
            }}>
              Store cards
            </div>
            {isManager && (
              <button onClick={() => setEditCard('new')} className="salus-btn" style={{
                background: 'transparent', border: 'none', padding: 4,
                color: '#a59478', fontSize: 10, letterSpacing: '0.12em',
                textTransform: 'uppercase', fontWeight: 500,
              }}>
                + Add card
              </button>
            )}
          </div>
          {cards.length === 0 ? (
            <div style={{
              padding: '20px 16px', textAlign: 'center',
              border: '1px dashed #e8e0cc', borderRadius: 14,
              color: '#a59478', fontSize: 13, fontStyle: 'italic',
            }}>
              No store cards saved yet.{isManager && ' Tap “+ Add card” to upload a Bookers barcode.'}
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10,
            }}>
              {cards.map(card => (
                <button
                  key={card.id}
                  onClick={() => setViewCard(card)}
                  className="salus-btn"
                  style={{
                    background: '#fffdf7', border: 'none',
                    borderRadius: 14, padding: 0, overflow: 'hidden',
                    boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)',
                    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    aspectRatio: '16 / 10',
                    background: `#fffdf7 url(${card.imageUrl}) center/contain no-repeat`,
                  }} />
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{
                      fontFamily: '"Playfair Display", serif',
                      fontSize: 13, fontWeight: 500, color: '#1a2620',
                      letterSpacing: '-0.005em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {card.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{
            fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38',
            fontStyle: 'italic', letterSpacing: '-0.005em',
          }}>
            {filter === 'low' ? 'Nothing running low.' : 'No stock items yet.'}
          </div>
          {filter === 'low' && (
            <div style={{ fontSize: 12, color: '#a59478', marginTop: 8 }}>The shelves are full.</div>
          )}
        </div>
      )}

      {/* Items grouped by category */}
      {orderedCats.map(cat => (
        <div key={cat} style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, color: '#a59478',
            letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8, padding: '0 2px',
          }}>
            {STOCK_CATEGORIES[cat]?.label || cat}
          </div>
          {groups[cat].map(item => (
            <StockItemRow
              key={item.id}
              item={item}
              busy={busyIds.has(item.id)}
              isManager={isManager}
              onDecrement={() => updateQty(item, -1)}
              onIncrement={() => updateQty(item, +1)}
              onEdit={() => setEditItem(item)}
            />
          ))}
        </div>
      ))}

      {isManager && visible.length > 0 && (
        <div style={{ fontSize: 11, color: '#a59478', textAlign: 'center', marginTop: 24, fontStyle: 'italic' }}>
          Tap any item name to edit.
        </div>
      )}

      {/* Edit / new item modal */}
      {editItem && (
        <StockItemEditModal
          item={editItem === 'new' ? null : editItem}
          isManager={isManager}
          currentUserId={currentUser.id}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); onReload?.(); }}
        />
      )}

      {/* View store card full-screen */}
      {viewCard && (
        <StoreCardViewModal card={viewCard} onClose={() => setViewCard(null)} />
      )}

      {/* Edit / new store card */}
      {editCard && (
        <StoreCardEditModal
          card={editCard === 'new' ? null : editCard}
          currentUserId={currentUser.id}
          onClose={() => setEditCard(null)}
          onSaved={() => { setEditCard(null); onReload?.(); }}
        />
      )}
    </>
  );
}

// ─── Store card view modal — full-screen barcode for till ───
function StoreCardViewModal({ card, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: '#1a2620',
      zIndex: 300, display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 22px',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255, 253, 247, 0.5)', letterSpacing: 2.5, textTransform: 'uppercase' }}>
            Store card
          </div>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 18, fontWeight: 400, color: '#fffdf7', letterSpacing: '-0.005em', marginTop: 2,
          }}>
            {card.name}
          </div>
        </div>
        <CloseButton onClick={onClose} variant="dark" />
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 22px',
      }}>
        <div style={{
          background: '#fffdf7', borderRadius: 18, padding: 28,
          maxWidth: '100%', maxHeight: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}>
          <img src={card.imageUrl} alt={card.name} style={{
            display: 'block', maxWidth: '100%', maxHeight: '60vh',
            objectFit: 'contain',
          }} />
        </div>
      </div>

      {card.notes && (
        <div style={{
          padding: '14px 22px 20px', textAlign: 'center',
          color: 'rgba(255, 253, 247, 0.7)', fontSize: 13, lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          {card.notes}
        </div>
      )}
    </div>
  , document.body);
}

// ─── Store card edit modal — upload to Supabase Storage ───
function StoreCardEditModal({ card, currentUserId, onClose, onSaved }) {
  const isNew = !card;
  const [name, setName] = useState(card?.name || '');
  const [notes, setNotes] = useState(card?.notes || '');
  const [imageUrl, setImageUrl] = useState(card?.imageUrl || '');
  const [storagePath, setStoragePath] = useState(card?.storagePath || null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large (5MB max). Crop or compress and try again.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('store-cards')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('store-cards').getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      setStoragePath(path);
    } catch (e) {
      setError(`Upload failed: ${e.message || e}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) { setError('Name required'); return; }
    if (!imageUrl) { setError('Upload an image first'); return; }
    setError(null);
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        notes: notes.trim() || null,
        image_url: imageUrl,
        storage_path: storagePath,
        updated_at: new Date().toISOString(),
      };
      if (isNew) {
        payload.created_by = currentUserId;
        const { error } = await supabase.from('store_cards').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_cards').update(payload).eq('id', card.id);
        if (error) throw error;
      }
      onSaved();
    } catch (e) {
      setError(`Save failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!confirm(`Remove "${card.name}"?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('store_cards').update({ archived: true }).eq('id', card.id);
      if (error) throw error;
      // Also try to delete the file
      if (card.storagePath) {
        try { await supabase.storage.from('store-cards').remove([card.storagePath]); } catch {}
      }
      onSaved();
    } catch (e) {
      setError(`Remove failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow={isNew ? 'New card' : 'Edit card'}
          title={isNew ? 'Add a store card' : card.name}
          onClose={onClose}
        />

        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Card name">
              <input value={name} onChange={e => setName(e.target.value)} style={styles.loginInput} placeholder="Bookers Wholesale" />
            </FormField>

            <FormField label="Notes (optional)">
              <input value={notes} onChange={e => setNotes(e.target.value)} style={styles.loginInput} placeholder="Use at the SE9 branch" />
            </FormField>

            <FormField label="Barcode image">
              {imageUrl ? (
                <div style={{
                  background: COLOR.cream, borderRadius: 14, padding: 14,
                  border: `1px solid ${COLOR.bone}`, textAlign: 'center',
                }}>
                  <img src={imageUrl} alt="Barcode preview" style={{
                    display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: 220,
                    objectFit: 'contain',
                  }} />
                  <label style={{
                    display: 'inline-block', marginTop: 12,
                    background: 'transparent', border: `1px solid ${COLOR.bone}`,
                    padding: '8px 14px', borderRadius: 999,
                    color: COLOR.moss, fontSize: 11, letterSpacing: '0.05em',
                    textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
                  }}>
                    Replace image
                    <input type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} disabled={uploading} />
                  </label>
                </div>
              ) : (
                <label style={{
                  display: 'block', padding: '28px 16px',
                  border: `1px dashed ${COLOR.shell}`, borderRadius: 14,
                  background: 'transparent', textAlign: 'center', cursor: 'pointer',
                }}>
                  <div style={TYPE.emptyState}>
                    {uploading ? 'Uploading…' : 'Tap to upload barcode'}
                  </div>
                  <div style={{ ...TYPE.metaSmall, marginTop: 8 }}>
                    PNG or JPG. Up to 5MB.
                  </div>
                  <input type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} disabled={uploading} />
                </label>
              )}
            </FormField>

            {error && (
              <div style={{
                padding: 12, background: '#fef0ec', color: COLOR.brown,
                borderRadius: 8, fontSize: 13,
              }}>
                {error}
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={busy || uploading} className="salus-btn" style={{
              ...styles.btnPrimary, flex: 1, justifyContent: 'center',
              padding: '14px 22px', fontSize: 14,
            }}>
              {busy ? 'Saving…' : (isNew ? 'Add card' : 'Save')}
            </button>
            {!isNew && (
              <button onClick={archive} disabled={busy} className="salus-btn" style={{
                ...styles.btnDanger, padding: '14px 18px',
              }}>
                Remove
              </button>
            )}
          </div>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

// ════════════════════════════════════════════════════════════════════════
// MANAGER BROADCASTS
// ════════════════════════════════════════════════════════════════════════

// ─── BroadcastBanner — shows at top of Home for unread broadcasts ───────
function BroadcastBanner({ broadcasts, broadcastReads, currentUser, onMarkRead }) {
  const readIds = new Set(broadcastReads.map(r => r.broadcastId));
  const now = Date.now();
  const unread = broadcasts.filter(b =>
    !readIds.has(b.id)
    && (!b.expiresAt || b.expiresAt > now)
  );

  if (unread.length === 0) return null;
  const latest = unread[0];  // already sorted newest-first

  const isUrgent = latest.urgency === 'urgent';

  return (
    <div style={{
      background: isUrgent ? '#fbe5dd' : COLOR.cream,
      border: `1px solid ${isUrgent ? '#f0c6b6' : COLOR.bone}`,
      borderLeft: `4px solid ${isUrgent ? COLOR.coral : COLOR.amber}`,
      borderRadius: 14, padding: '14px 16px', marginBottom: 18,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...TYPE.eyebrow,
          color: isUrgent ? COLOR.coral : COLOR.amber,
          marginBottom: 4,
        }}>
          {isUrgent ? 'Urgent · From the team' : 'From the team'}
        </div>
        <div style={{ ...TYPE.cardTitle, fontSize: 15, marginBottom: 4 }}>
          {latest.title}
        </div>
        <div style={{ ...TYPE.body, color: COLOR.brown, lineHeight: 1.5, fontSize: 13 }}>
          {latest.body}
        </div>
        {unread.length > 1 && (
          <div style={{ ...TYPE.metaSmall, marginTop: 8 }}>
            + {unread.length - 1} more
          </div>
        )}
      </div>
      <button onClick={() => onMarkRead(latest.id)} className="salus-btn" style={{
        background: 'transparent', border: 'none', padding: 4,
        color: COLOR.taupe, fontSize: 10, letterSpacing: '0.08em',
        textTransform: 'uppercase', fontWeight: 500, flexShrink: 0,
        cursor: 'pointer',
      }}>
        Got it
      </button>
    </div>
  );
}

// ─── BroadcastModal — manager composes a broadcast ──────────────────────
function BroadcastModal({ currentUserId, sessionToken, onClose, onSent }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and message are required');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('broadcasts')
        .insert({
          sender_id: currentUserId,
          title: title.trim(),
          body: body.trim(),
          urgency,
        })
        .select()
        .single();
      if (error) throw error;

      // Fire push notifications
      try {
        const resp = await fetch('/api/send-broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            broadcastId: data.id,
            title: data.title,
            body: data.body,
            urgency: data.urgency,
          }),
        });
        const result = await resp.json();
        console.log('Broadcast push result:', result);
      } catch (pushErr) {
        console.error('Push failed (broadcast was still saved):', pushErr);
      }

      onSent();
    } catch (e) {
      setError(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Manager"
          title="New broadcast"
          subtitle="Push notification + banner sent to every staff member."
          onClose={onClose}
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Title">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={styles.loginInput}
                placeholder="Studio closed today"
                maxLength={80}
              />
            </FormField>
            <FormField label="Message">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                style={{ ...styles.loginInput, resize: 'vertical', minHeight: 100 }}
                placeholder="Power outage — sorry team, no classes today. Will let you know about tomorrow as soon as I hear from the supplier."
                maxLength={500}
              />
              <div style={{ ...TYPE.metaSmall, marginTop: 4, textAlign: 'right' }}>
                {body.length}/500
              </div>
            </FormField>
            <FormField label="Urgency">
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setUrgency('normal')}
                  className="salus-btn"
                  style={{
                    flex: 1, padding: '12px 14px',
                    background: urgency === 'normal' ? COLOR.forest : 'transparent',
                    color: urgency === 'normal' ? COLOR.cream : COLOR.brown,
                    border: `1px solid ${urgency === 'normal' ? COLOR.forest : COLOR.bone}`,
                    borderRadius: 999, fontSize: 12, fontWeight: 500,
                    letterSpacing: '0.04em',
                  }}
                >
                  Normal
                </button>
                <button
                  onClick={() => setUrgency('urgent')}
                  className="salus-btn"
                  style={{
                    flex: 1, padding: '12px 14px',
                    background: urgency === 'urgent' ? COLOR.coral : 'transparent',
                    color: urgency === 'urgent' ? COLOR.cream : COLOR.coral,
                    border: `1px solid ${COLOR.coral}`,
                    borderRadius: 999, fontSize: 12, fontWeight: 500,
                    letterSpacing: '0.04em',
                  }}
                >
                  Urgent
                </button>
              </div>
              <div style={{ ...TYPE.metaSmall, marginTop: 6 }}>
                Urgent broadcasts use a red banner and stay until dismissed.
              </div>
            </FormField>
            {error && (
              <div style={{
                padding: 12, background: '#fef0ec', color: COLOR.brown,
                borderRadius: 8, fontSize: 13,
              }}>{error}</div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <button onClick={send} disabled={sending} className="salus-btn" style={{
            ...styles.btnPrimary, width: '100%', justifyContent: 'center',
            padding: '14px 22px', fontSize: 14,
          }}>
            {sending ? 'Sending…' : 'Send to all staff'}
          </button>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

// ════════════════════════════════════════════════════════════════════════
// INCIDENTS — health & safety reporting
// ════════════════════════════════════════════════════════════════════════

const INCIDENT_CATEGORIES = {
  injury:     { label: 'Injury',           icon: 'bandage' },
  near_miss:  { label: 'Near miss',        icon: 'alert' },
  equipment:  { label: 'Equipment fault',  icon: 'wrench' },
  complaint:  { label: 'Member complaint', icon: 'message' },
  other:      { label: 'Other',            icon: 'circle' },
};
const INCIDENT_LOCATIONS = {
  reformer:  'Reformer studio',
  hybrid:    'Hybrid studio',
  reception: 'Reception',
  changing:  'Changing rooms',
  other:     'Other',
};
const INCIDENT_SEVERITY = {
  low:    { label: 'Low',    color: COLOR.moss },
  medium: { label: 'Medium', color: COLOR.amber },
  high:   { label: 'High',   color: COLOR.coral },
};

// ─── ReportIncidentModal — anyone can file ──────────────────────────────
function ReportIncidentModal({ currentUserId, onClose, onSaved }) {
  const [category, setCategory] = useState('injury');
  const [severity, setSeverity] = useState('low');
  const [occurredAt, setOccurredAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('reformer');
  const [description, setDescription] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Image too large (8MB max).');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('incidents').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('incidents').getPublicUrl(path);
      setPhotoUrls([...photoUrls, urlData.publicUrl]);
    } catch (e) {
      setError(`Upload failed: ${e.message || e}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('incidents').insert({
        reported_by: currentUserId,
        category, severity,
        occurred_at: new Date(occurredAt).toISOString(),
        location,
        description: description.trim(),
        people_involved: peopleInvolved.trim() || null,
        action_taken: actionTaken.trim() || null,
        photo_urls: photoUrls,
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(`Save failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Health & safety"
          title="Report an incident"
          subtitle="Logs are visible to the team for learning. Manager triages."
          onClose={onClose}
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} style={styles.loginInput}>
                {Object.entries(INCIDENT_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Severity">
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(INCIDENT_SEVERITY).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setSeverity(k)}
                    className="salus-btn"
                    style={{
                      flex: 1, padding: '10px 12px',
                      background: severity === k ? v.color : 'transparent',
                      color: severity === k ? COLOR.cream : v.color,
                      border: `1px solid ${v.color}`,
                      borderRadius: 999, fontSize: 11, fontWeight: 500,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="When">
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={e => setOccurredAt(e.target.value)}
                  style={styles.loginInput}
                />
              </FormField>
              <FormField label="Where">
                <select value={location} onChange={e => setLocation(e.target.value)} style={styles.loginInput}>
                  {Object.entries(INCIDENT_LOCATIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="What happened">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                style={{ ...styles.loginInput, resize: 'vertical' }}
                placeholder="A member slipped on the reformer mat exiting class…"
              />
            </FormField>

            <FormField label="People involved (optional)">
              <input
                value={peopleInvolved}
                onChange={e => setPeopleInvolved(e.target.value)}
                style={styles.loginInput}
                placeholder="Member: Jane Smith. Staff present: Sarah"
              />
            </FormField>

            <FormField label="Action taken (optional)">
              <textarea
                value={actionTaken}
                onChange={e => setActionTaken(e.target.value)}
                rows={2}
                style={{ ...styles.loginInput, resize: 'vertical' }}
                placeholder="Applied first aid, called manager, advised member to see GP"
              />
            </FormField>

            <FormField label="Photos (optional)">
              {photoUrls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 8 }}>
                  {photoUrls.map((url, idx) => (
                    <div key={idx} style={{
                      aspectRatio: '1 / 1', borderRadius: 8,
                      backgroundImage: `url(${url})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      position: 'relative',
                    }}>
                      <button onClick={() => setPhotoUrls(photoUrls.filter((_, i) => i !== idx))}
                        className="salus-btn" style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'rgba(26, 38, 32, 0.7)', color: COLOR.cream,
                          border: 'none', fontSize: 13, fontWeight: 300,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', padding: 0,
                        }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{
                display: 'inline-block', padding: '10px 16px',
                background: 'transparent', border: `1px dashed ${COLOR.shell}`,
                borderRadius: 999, cursor: uploading ? 'wait' : 'pointer',
                color: COLOR.brown, fontSize: 12, letterSpacing: '0.05em',
                textTransform: 'uppercase', fontWeight: 500,
              }}>
                {uploading ? 'Uploading…' : '+ Add photo'}
                <input type="file" accept="image/*" capture="environment"
                  onChange={uploadPhoto} disabled={uploading} style={{ display: 'none' }} />
              </label>
            </FormField>

            {error && (
              <div style={{
                padding: 12, background: '#fef0ec', color: COLOR.brown,
                borderRadius: 8, fontSize: 13,
              }}>{error}</div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <button onClick={save} disabled={saving || uploading} className="salus-btn" style={{
            ...styles.btnPrimary, width: '100%', justifyContent: 'center',
            padding: '14px 22px', fontSize: 14,
          }}>
            {saving ? 'Saving…' : 'Submit report'}
          </button>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

// ─── AdminIncidentsSection — list + triage ──────────────────────────────
function AdminIncidentsSection({ data, currentUser, isManager, onReload }) {
  const [filter, setFilter] = useState('open');
  const [reportOpen, setReportOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const incidents = data.incidents || [];
  const visible = incidents.filter(i => {
    if (filter === 'open')     return i.status === 'open';
    if (filter === 'reviewed') return i.status === 'reviewed';
    if (filter === 'closed')   return i.status === 'closed';
    return true;
  });

  const userById = Object.fromEntries(data.users.map(u => [u.id, u]));
  const openCount = incidents.filter(i => i.status === 'open').length;

  return (
    <>
      <PageHeader eyebrow="Health & safety" title="Incidents" compact />

      {/* Report button — anyone can use */}
      <button onClick={() => setReportOpen(true)} className="salus-btn" style={{
        ...styles.btnPrimary, width: '100%', justifyContent: 'center',
        padding: '14px 22px', fontSize: 14, marginBottom: 18,
      }}>
        + Report an incident
      </button>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 22, padding: '0 4px 8px',
        borderBottom: `1px solid ${COLOR.bone}`, marginBottom: 16,
      }}>
        {[
          ['open', `Open ${openCount > 0 ? openCount : ''}`],
          ['reviewed', 'Reviewed'],
          ['closed', 'Closed'],
          ['all', 'All'],
        ].map(([key, label]) => (
          <button key={key}
            onClick={() => setFilter(key)}
            className="salus-btn"
            style={{
              padding: '6px 0', background: 'transparent', border: 'none',
              borderBottom: filter === key ? `1.5px solid ${COLOR.forest}` : '1.5px solid transparent',
              ...(filter === key ? TYPE.capsLabelActive : TYPE.capsLabel),
              fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState>No incidents to show.</EmptyState>
      ) : (
        visible.map(inc => {
          const cat = INCIDENT_CATEGORIES[inc.category] || {};
          const sev = INCIDENT_SEVERITY[inc.severity] || {};
          const reporter = userById[inc.reportedBy];
          return (
            <button key={inc.id} onClick={() => setDetail(inc)} className="salus-btn"
              style={{
                width: '100%', textAlign: 'left',
                padding: '14px 4px', borderBottom: `1px solid ${COLOR.bone}`,
                background: 'transparent', border: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                fontFamily: 'inherit', cursor: 'pointer',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                position: 'relative',
              }}>
              <span style={{
                position: 'absolute', left: -2, top: 14, bottom: 14, width: 3,
                background: sev.color, borderRadius: 1,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ ...TYPE.itemTitle }}>{cat.label}</span>
                  <span style={{ ...TYPE.capsLabel, color: sev.color }}>{sev.label}</span>
                </div>
                <div style={{ ...TYPE.body, color: COLOR.brown, fontSize: 13, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {inc.description}
                </div>
                <div style={{ ...TYPE.metaSmall, marginTop: 6 }}>
                  {new Date(inc.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {reporter && ` · ${reporter.name?.split(' ')[0]}`}
                  {INCIDENT_LOCATIONS[inc.location] && ` · ${INCIDENT_LOCATIONS[inc.location]}`}
                  {inc.photoUrls?.length > 0 && ` · ${inc.photoUrls.length} photo${inc.photoUrls.length !== 1 ? 's' : ''}`}
                </div>
              </div>
            </button>
          );
        })
      )}

      {reportOpen && (
        <ReportIncidentModal
          currentUserId={currentUser.id}
          onClose={() => setReportOpen(false)}
          onSaved={() => { setReportOpen(false); onReload?.(); }}
        />
      )}
      {detail && (
        <IncidentDetailModal
          incident={detail}
          data={data}
          isManager={isManager}
          onClose={() => setDetail(null)}
          onUpdated={() => { setDetail(null); onReload?.(); }}
        />
      )}
    </>
  );
}

// ─── IncidentDetailModal — manager triages ──────────────────────────────
function IncidentDetailModal({ incident, data, isManager, onClose, onUpdated }) {
  const [status, setStatus] = useState(incident.status);
  const [notes, setNotes] = useState(incident.managerNotes || '');
  const [saving, setSaving] = useState(false);
  const userById = Object.fromEntries(data.users.map(u => [u.id, u]));
  const reporter = userById[incident.reportedBy];
  const cat = INCIDENT_CATEGORIES[incident.category] || {};
  const sev = INCIDENT_SEVERITY[incident.severity] || {};

  const update = async (newStatus) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('incidents').update({
        status: newStatus,
        manager_notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', incident.id);
      if (error) throw error;
      onUpdated();
    } catch (e) {
      alert('Update failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow={`${cat.label} · ${sev.label}`}
          title={incident.description.slice(0, 60) + (incident.description.length > 60 ? '…' : '')}
          subtitle={`Reported by ${reporter?.name || 'unknown'} · ${new Date(incident.occurredAt).toLocaleString('en-GB')}`}
          onClose={onClose}
        />
        <ModalBody>
          <SectionDivider>Description</SectionDivider>
          <div style={{ ...TYPE.body, color: COLOR.brown, lineHeight: 1.6, marginBottom: 14 }}>
            {incident.description}
          </div>

          {incident.peopleInvolved && (
            <>
              <SectionDivider>People involved</SectionDivider>
              <div style={{ ...TYPE.body, color: COLOR.brown, marginBottom: 14 }}>
                {incident.peopleInvolved}
              </div>
            </>
          )}

          {incident.actionTaken && (
            <>
              <SectionDivider>Action taken at the time</SectionDivider>
              <div style={{ ...TYPE.body, color: COLOR.brown, lineHeight: 1.6, marginBottom: 14 }}>
                {incident.actionTaken}
              </div>
            </>
          )}

          {incident.photoUrls?.length > 0 && (
            <>
              <SectionDivider>Photos</SectionDivider>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
                {incident.photoUrls.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{
                    aspectRatio: '1 / 1', borderRadius: 8,
                    backgroundImage: `url(${url})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    display: 'block',
                  }} />
                ))}
              </div>
            </>
          )}

          {isManager && (
            <>
              <SectionDivider>Manager notes</SectionDivider>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ ...styles.loginInput, resize: 'vertical' }}
                placeholder="Investigation notes, follow-up actions, etc."
              />
            </>
          )}
        </ModalBody>
        {isManager && (
          <ModalFooter>
            <div style={{ display: 'flex', gap: 8 }}>
              {status === 'open' && (
                <button onClick={() => update('reviewed')} disabled={saving} className="salus-btn" style={{
                  ...styles.btnSecondary, flex: 1, padding: '12px 16px', fontSize: 13,
                }}>
                  Mark reviewed
                </button>
              )}
              <button onClick={() => update('closed')} disabled={saving} className="salus-btn" style={{
                ...styles.btnPrimary, flex: 1, padding: '12px 16px', fontSize: 13,
              }}>
                Close incident
              </button>
            </div>
          </ModalFooter>
        )}
      </div>
    </>
  , document.body);
}

// ════════════════════════════════════════════════════════════════════════
// ONBOARDING FLOW — new hire wizard
// ════════════════════════════════════════════════════════════════════════

const ONBOARDING_STEPS = [
  { key: 'welcome',   label: 'Welcome',           heading: 'Welcome to Salus House' },
  { key: 'personal',  label: 'Personal details',  heading: 'A bit about you' },
  { key: 'emergency', label: 'Emergency contact', heading: 'In case we need to reach someone' },
  { key: 'bank',      label: 'Bank details',      heading: 'For payroll' },
  { key: 'rtw',       label: 'Right to work',     heading: 'Right-to-work documents' },
  { key: 'contract',  label: 'Contract',          heading: 'Your employment contract' },
  { key: 'policies',  label: 'Policies',          heading: 'Workplace policies' },
  { key: 'done',      label: 'All set',           heading: "You're in" },
];

function isOnboardingComplete(user) {
  return !!user?.onboardingCompletedAt;
}

// ─── OnboardingScreen — full-screen wizard ──────────────────────────────
function OnboardingScreen({ currentUser, onComplete }) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = ONBOARDING_STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === ONBOARDING_STEPS.length - 1;

  // Form state — pre-fill from profile if already set
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [dob, setDob] = useState(currentUser.dateOfBirth || '');
  const [ecName, setEcName] = useState(currentUser.emergencyContactName || '');
  const [ecPhone, setEcPhone] = useState(currentUser.emergencyContactPhone || '');
  const [ecRel, setEcRel] = useState(currentUser.emergencyContactRelation || '');
  const [bankName, setBankName] = useState(currentUser.bankAccountName || '');
  const [sortCode, setSortCode] = useState(currentUser.bankSortCode || '');
  const [accountNum, setAccountNum] = useState(currentUser.bankAccountNumber || '');
  const [rtwUrl, setRtwUrl] = useState(currentUser.rightToWorkDocUrl || '');
  const [rtwPath, setRtwPath] = useState(currentUser.rightToWorkDocPath || '');
  const [contractAck, setContractAck] = useState(!!currentUser.contractSignedAt);
  const [policiesAck, setPoliciesAck] = useState(!!currentUser.policiesAcknowledgedAt);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Mark onboarding as started on first view
  useEffect(() => {
    if (!currentUser.onboardingStartedAt) {
      supabase.from('profiles').update({
        onboarding_started_at: new Date().toISOString(),
      }).eq('id', currentUser.id).then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCurrentStep = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch = {};
      if (step.key === 'personal') {
        patch.phone = phone.trim() || null;
        patch.date_of_birth = dob || null;
      } else if (step.key === 'emergency') {
        patch.emergency_contact_name = ecName.trim() || null;
        patch.emergency_contact_phone = ecPhone.trim() || null;
        patch.emergency_contact_relation = ecRel.trim() || null;
      } else if (step.key === 'bank') {
        patch.bank_account_name = bankName.trim() || null;
        patch.bank_sort_code = sortCode.trim() || null;
        patch.bank_account_number = accountNum.trim() || null;
      } else if (step.key === 'rtw') {
        patch.right_to_work_doc_url = rtwUrl || null;
        patch.right_to_work_doc_path = rtwPath || null;
      } else if (step.key === 'contract') {
        if (contractAck) patch.contract_signed_at = new Date().toISOString();
      } else if (step.key === 'policies') {
        if (policiesAck) patch.policies_acknowledged_at = new Date().toISOString();
      }

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from('profiles').update(patch).eq('id', currentUser.id);
        if (error) throw error;
      }

      // Log step completion
      if (step.key !== 'welcome' && step.key !== 'done') {
        await supabase.from('onboarding_steps')
          .upsert({ user_id: currentUser.id, step_key: step.key, completed_at: new Date().toISOString() });
      }

      // Final step: mark completed
      if (isLast) {
        await supabase.from('profiles').update({
          onboarding_completed_at: new Date().toISOString(),
        }).eq('id', currentUser.id);
        onComplete();
        return;
      }

      setStepIdx(stepIdx + 1);
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const uploadRtw = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('File too large (8MB max).');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('rtw-docs').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('rtw-docs').getPublicUrl(path);
      setRtwUrl(urlData.publicUrl);
      setRtwPath(path);
    } catch (e) {
      setError(`Upload failed: ${e.message || e}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: COLOR.cream, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      fontFamily: COLOR.sans,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 22px',
        paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        borderBottom: `1px solid ${COLOR.bone}`, flexShrink: 0,
      }}>
        <div style={{ ...TYPE.eyebrow, marginBottom: 4 }}>
          Step {stepIdx + 1} of {ONBOARDING_STEPS.length}
        </div>
        <div style={{ ...TYPE.modalTitle }}>{step.heading}</div>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= stepIdx ? COLOR.forest : COLOR.bone,
            }} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: '24px 22px',
      }}>
        {step.key === 'welcome' && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ ...TYPE.emptyState, fontSize: 18, color: COLOR.brown, marginBottom: 18 }}>
              Welcome, {currentUser.name?.split(' ')[0]}.
            </div>
            <div style={{ ...TYPE.body, color: COLOR.brown, lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
              We've got a few things to set up before you're ready to teach.
              It takes about five minutes — you can pause and come back at any point.
            </div>
            <div style={{ ...TYPE.metaSmall, marginTop: 24, maxWidth: 320, margin: '24px auto 0' }}>
              We'll collect personal details, your bank info for payroll, and ask
              you to acknowledge the studio policies. Anything you submit is private
              to the manager.
            </div>
          </div>
        )}

        {step.key === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Mobile number">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                style={styles.loginInput} placeholder="07…" inputMode="tel" />
            </FormField>
            <FormField label="Date of birth">
              <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                style={styles.loginInput} />
            </FormField>
          </div>
        )}

        {step.key === 'emergency' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Name">
              <input value={ecName} onChange={e => setEcName(e.target.value)}
                style={styles.loginInput} placeholder="Jane Doe" />
            </FormField>
            <FormField label="Phone">
              <input value={ecPhone} onChange={e => setEcPhone(e.target.value)}
                style={styles.loginInput} placeholder="07…" inputMode="tel" />
            </FormField>
            <FormField label="Relationship">
              <input value={ecRel} onChange={e => setEcRel(e.target.value)}
                style={styles.loginInput} placeholder="Partner / Parent / Friend" />
            </FormField>
          </div>
        )}

        {step.key === 'bank' && (
          <>
            <div style={{ ...TYPE.metaSmall, marginBottom: 14, lineHeight: 1.5 }}>
              For monthly payroll. UK accounts only. Stored encrypted. Manager-only access.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Account name">
                <input value={bankName} onChange={e => setBankName(e.target.value)}
                  style={styles.loginInput} placeholder="Your name as it appears on the account" />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <FormField label="Sort code">
                  <input value={sortCode} onChange={e => setSortCode(e.target.value)}
                    style={styles.loginInput} placeholder="00-00-00" inputMode="numeric" maxLength={8} />
                </FormField>
                <FormField label="Account number">
                  <input value={accountNum} onChange={e => setAccountNum(e.target.value)}
                    style={styles.loginInput} placeholder="12345678" inputMode="numeric" maxLength={8} />
                </FormField>
              </div>
            </div>
          </>
        )}

        {step.key === 'rtw' && (
          <>
            <div style={{ ...TYPE.metaSmall, marginBottom: 14, lineHeight: 1.5 }}>
              UK law requires us to check your right to work. A clear photo of your passport, BRP, or share code from gov.uk is fine.
            </div>
            {rtwUrl ? (
              <div style={{ marginBottom: 14 }}>
                <a href={rtwUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', padding: 16,
                  background: COLOR.sand, border: `1px solid ${COLOR.bone}`,
                  borderRadius: 12, color: COLOR.forest, textDecoration: 'none',
                  fontSize: 13,
                }}>
                  ✓ Uploaded — tap to view
                </a>
                <button onClick={() => { setRtwUrl(''); setRtwPath(''); }} className="salus-btn" style={{
                  background: 'transparent', border: 'none', padding: '8px 0',
                  color: COLOR.coral, fontSize: 11, letterSpacing: '0.08em',
                  textTransform: 'uppercase', fontWeight: 500, marginTop: 8,
                }}>
                  Replace
                </button>
              </div>
            ) : (
              <label style={{
                display: 'block', padding: '32px 16px',
                border: `1px dashed ${COLOR.shell}`, borderRadius: 14,
                background: 'transparent', textAlign: 'center', cursor: 'pointer',
              }}>
                <div style={TYPE.emptyState}>
                  {uploading ? 'Uploading…' : 'Tap to upload document'}
                </div>
                <div style={{ ...TYPE.metaSmall, marginTop: 8 }}>
                  Photo or PDF · Up to 8MB
                </div>
                <input type="file" accept="image/*,application/pdf" onChange={uploadRtw}
                  style={{ display: 'none' }} disabled={uploading} />
              </label>
            )}
          </>
        )}

        {step.key === 'contract' && (
          <>
            <div style={{
              padding: 18, background: COLOR.sand, borderRadius: 12,
              ...TYPE.body, color: COLOR.brown, lineHeight: 1.7, marginBottom: 18,
            }}>
              Your employment contract has been emailed to you separately. Please read it carefully
              and acknowledge below. If you have any questions before signing, speak to Luke directly.
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={contractAck} onChange={e => setContractAck(e.target.checked)}
                style={{ marginTop: 3, accentColor: COLOR.forest }} />
              <span style={{ ...TYPE.body, lineHeight: 1.5 }}>
                I have read and agree to the employment contract sent to me.
              </span>
            </label>
          </>
        )}

        {step.key === 'policies' && (
          <>
            <div style={{ ...TYPE.metaSmall, marginBottom: 14, lineHeight: 1.5 }}>
              These cover how we work together — please skim before acknowledging.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {[
                'Code of conduct',
                'Health & safety policy',
                'Data protection (GDPR)',
                'Uniform & presentation',
                'Cover & swap policy',
              ].map(label => (
                <div key={label} style={{
                  padding: '12px 14px', background: COLOR.sand, borderRadius: 10,
                  ...TYPE.body, color: COLOR.brown, fontSize: 13,
                }}>{label}</div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={policiesAck} onChange={e => setPoliciesAck(e.target.checked)}
                style={{ marginTop: 3, accentColor: COLOR.forest }} />
              <span style={{ ...TYPE.body, lineHeight: 1.5 }}>
                I have read and agree to abide by the workplace policies above.
              </span>
            </label>
          </>
        )}

        {step.key === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ ...TYPE.emptyState, fontSize: 22, color: COLOR.forest, marginBottom: 18 }}>
              You're all set.
            </div>
            <div style={{ ...TYPE.body, color: COLOR.brown, lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
              Welcome to the team, {currentUser.name?.split(' ')[0]}. Tap Finish below and you'll land on your home page.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 16, padding: 12, background: '#fef0ec', color: COLOR.brown,
            borderRadius: 8, fontSize: 13,
          }}>{error}</div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 22px',
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        borderTop: `1px solid ${COLOR.bone}`, flexShrink: 0,
        display: 'flex', gap: 10,
      }}>
        {!isFirst && (
          <button onClick={() => setStepIdx(stepIdx - 1)} className="salus-btn" style={{
            ...styles.btnSecondary, padding: '14px 22px', fontSize: 14,
          }}>
            Back
          </button>
        )}
        <button onClick={saveCurrentStep} disabled={saving || uploading} className="salus-btn" style={{
          ...styles.btnPrimary, flex: 1, justifyContent: 'center',
          padding: '14px 22px', fontSize: 14,
        }}>
          {saving ? 'Saving…' :
           isLast ? 'Finish' :
           isFirst ? 'Get started' :
           'Continue'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// EXPENSES — per-user receipt tracker for self-assessment / tax returns
// ════════════════════════════════════════════════════════════════════════

const EXPENSE_CATEGORIES = {
  stock_supplies:    { label: 'Stock & supplies' },
  equipment_repairs: { label: 'Equipment & repairs' },
  software:          { label: 'Software subscriptions' },
  marketing:         { label: 'Marketing' },
  professional_fees: { label: 'Professional fees' },
  training_cpd:      { label: 'Training & CPD' },
  travel:            { label: 'Travel & mileage' },
  phone_internet:    { label: 'Phone & internet' },
  insurance:         { label: 'Insurance' },
  rent_rates:        { label: 'Rent & rates' },
  utilities:         { label: 'Utilities' },
  bank_fees:         { label: 'Bank fees' },
  food_drink:        { label: 'Food & drink' },
  cleaning:          { label: 'Cleaning' },
  other:             { label: 'Other' },
};

const PAYMENT_METHODS = {
  card:           'Card',
  cash:           'Cash',
  bank_transfer:  'Bank transfer',
  other:          'Other',
};

const formatGbp = (pence) => {
  if (pence == null) return '—';
  const pounds = Math.abs(pence) / 100;
  const sign = pence < 0 ? '−' : '';
  return `${sign}£${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// UK tax year start month/day (6 April)
function ukTaxYearStart(now = new Date()) {
  const y = now.getFullYear();
  const aprilSixth = new Date(y, 3, 6);
  if (now < aprilSixth) return new Date(y - 1, 3, 6);
  return aprilSixth;
}

// ─── ExpensesPage — list, summary, capture ──────────────────────────────
function ExpensesPage({ data, currentUser, sessionToken, onReload }) {
  const [filter, setFilter] = useState('month'); // month | tax_year | all
  const [captureOpen, setCaptureOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [savedToast, setSavedToast] = useState(false);

  const showSavedToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const expenses = data.expenses || [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const taxYearStart = ukTaxYearStart(now);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const taxYearStartIso = taxYearStart.toISOString().slice(0, 10);

  const inRange = (exp) => {
    if (filter === 'month')    return exp.spentOn >= monthStartIso;
    if (filter === 'tax_year') return exp.spentOn >= taxYearStartIso;
    return true;
  };

  const visible = expenses.filter(inRange);
  const totalPence = visible.reduce((s, e) => s + (e.amountPence || 0), 0);

  // Per-category breakdown for the visible range
  const byCategory = {};
  visible.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amountPence;
  });
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Group expenses by month for the list
  const grouped = {};
  visible.forEach(e => {
    const key = (e.spentOn || '').slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  const groupKeys = Object.keys(grouped).sort().reverse();

  return (
    <>
      <PageHeader
        eyebrow="Personal"
        title="Expenses"
        subtitle="For your self-assessment. Private to you."
        compact
      />

      <button onClick={() => setCaptureOpen(true)} className="salus-btn" style={{
        ...styles.btnPrimary, width: '100%', justifyContent: 'center',
        padding: '14px 22px', fontSize: 14, marginBottom: 16,
      }}>
        + Snap a receipt
      </button>

      {/* Summary card */}
      <div style={{
        background: COLOR.cream, border: `1px solid ${COLOR.bone}`,
        borderRadius: 14, padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ ...TYPE.eyebrow, marginBottom: 6 }}>
          {filter === 'month' ? 'This month' : filter === 'tax_year' ? 'This tax year' : 'All time'}
        </div>
        <div style={{
          fontFamily: COLOR.serif, fontSize: 28, fontWeight: 400,
          color: COLOR.forest, letterSpacing: '-0.015em', lineHeight: 1.1,
        }}>
          {formatGbp(totalPence)}
        </div>
        <div style={{ ...TYPE.metaSmall, marginTop: 4 }}>
          {visible.length} {visible.length === 1 ? 'receipt' : 'receipts'}
        </div>

        {topCategories.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLOR.bone}` }}>
            <div style={{ ...TYPE.eyebrow, marginBottom: 8 }}>Top categories</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topCategories.map(([cat, pence]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: COLOR.brown }}>{EXPENSE_CATEGORIES[cat]?.label || cat}</span>
                  <span style={{ color: COLOR.forest, fontVariantNumeric: 'tabular-nums' }}>{formatGbp(pence)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Period filter */}
      <div style={{
        display: 'flex', gap: 22, padding: '0 4px 8px',
        borderBottom: `1px solid ${COLOR.bone}`, marginBottom: 16,
      }}>
        {[
          ['month', 'This month'],
          ['tax_year', 'Tax year'],
          ['all', 'All'],
        ].map(([key, label]) => (
          <button key={key}
            onClick={() => setFilter(key)}
            className="salus-btn"
            style={{
              padding: '6px 0', background: 'transparent', border: 'none',
              borderBottom: filter === key ? `1.5px solid ${COLOR.forest}` : '1.5px solid transparent',
              ...(filter === key ? TYPE.capsLabelActive : TYPE.capsLabel),
              fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState sub="Snap a receipt to get started.">No expenses yet.</EmptyState>
      ) : (
        groupKeys.map(monthKey => {
          const monthLabel = new Date(monthKey + '-01').toLocaleString('en-GB', { month: 'long', year: 'numeric' });
          const monthTotal = grouped[monthKey].reduce((s, e) => s + e.amountPence, 0);
          return (
            <div key={monthKey} style={{ marginBottom: 22 }}>
              <SectionLabel>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span>{monthLabel}</span>
                  <span style={{ ...TYPE.metaSmall, fontStyle: 'normal', fontFamily: COLOR.sans, fontVariantNumeric: 'tabular-nums' }}>
                    {formatGbp(monthTotal)}
                  </span>
                </div>
              </SectionLabel>
              {grouped[monthKey].map(exp => (
                <ExpenseRow key={exp.id} expense={exp} onTap={() => setDetail(exp)} />
              ))}
            </div>
          );
        })
      )}

      {/* Export footer */}
      {expenses.length > 0 && (
        <div style={{ marginTop: 32, padding: '20px 0', borderTop: `1px solid ${COLOR.bone}` }}>
          <div style={{ ...TYPE.eyebrow, marginBottom: 10 }}>Export</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => exportExpensesCsv(expenses, filter, taxYearStartIso, monthStartIso, currentUser)}
              className="salus-btn" style={{
                ...styles.btnSecondary, width: '100%', justifyContent: 'center',
                padding: '12px 18px', fontSize: 13,
              }}>
              Download CSV
            </button>
            <div style={{ ...TYPE.metaSmall, textAlign: 'center', lineHeight: 1.5, marginTop: 6 }}>
              CSV is ready to import into Xero, QuickBooks, or send to your accountant.
            </div>
          </div>
        </div>
      )}

      {captureOpen && (
        <CaptureReceiptModal
          currentUserId={currentUser.id}
          sessionToken={sessionToken}
          onClose={() => setCaptureOpen(false)}
          onSaved={() => {
            setCaptureOpen(false);
            showSavedToast();
            onReload?.(true);  // silent reload — no loading flash
          }}
        />
      )}
      {detail && (
        <ExpenseDetailModal
          expense={detail}
          currentUserId={currentUser.id}
          onClose={() => setDetail(null)}
          onUpdated={() => { setDetail(null); onReload?.(true); }}
        />
      )}

      {/* Success toast — auto-dismisses after a couple of seconds */}
      {savedToast && createPortal(
        <div style={{
          position: 'fixed',
          top: 'calc(20px + env(safe-area-inset-top, 0px))',
          left: '50%', transform: 'translateX(-50%)',
          background: COLOR.forest, color: COLOR.cream,
          padding: '12px 22px', borderRadius: 999,
          fontSize: 13, fontWeight: 500, letterSpacing: '0.04em',
          zIndex: 99999, pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(26, 38, 32, 0.25)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>✓</span>
          <span>Receipt saved</span>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── ExpenseRow ──────────────────────────────────────────────────────────
function ExpenseRow({ expense, onTap }) {
  const cat = EXPENSE_CATEGORIES[expense.category] || { label: expense.category };
  const dateLabel = expense.spentOn
    ? new Date(expense.spentOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';

  return (
    <button onClick={onTap} className="salus-btn" style={{
      width: '100%', textAlign: 'left',
      padding: '14px 4px', borderBottom: `1px solid ${COLOR.bone}`,
      background: 'transparent', border: 'none', borderRadius: 0,
      fontFamily: 'inherit', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {expense.receiptUrl && (
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          backgroundImage: `url(${expense.receiptUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          flexShrink: 0, border: `0.5px solid ${COLOR.bone}`,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...TYPE.itemTitle,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {expense.supplier || cat.label}
        </div>
        <div style={{ ...TYPE.metaSmall, marginTop: 3 }}>
          {dateLabel} · {cat.label}
        </div>
      </div>
      <div style={{
        ...TYPE.itemTitle, fontFamily: COLOR.sans, fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
      }}>
        {formatGbp(expense.amountPence)}
      </div>
    </button>
  );
}

// ─── CaptureReceiptModal — snap + AI extract + review + save ────────────
function CaptureReceiptModal({ currentUserId, sessionToken, onClose, onSaved }) {
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState('image/jpeg');
  const [extracting, setExtracting] = useState(false);
  const [aiHint, setAiHint] = useState(null); // 'high' | 'medium' | 'low' | null

  // Form fields (filled by AI or by hand)
  const [supplier, setSupplier] = useState('');
  const [spentOn, setSpentOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(''); // string in pounds.pence
  const [vat, setVat] = useState('');       // string in pounds.pence
  const [category, setCategory] = useState('other');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Photo too large (8MB max).');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setPhotoBase64(dataUrl);
      setPhotoMediaType(file.type || 'image/jpeg');
      // Kick off AI extraction
      setExtracting(true);
      setAiHint(null);
      try {
        const resp = await fetch('/api/extract-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ imageBase64: dataUrl, mediaType: file.type }),
        });
        if (!resp.ok) throw new Error(`Extract failed (${resp.status})`);
        const result = await resp.json();
        if (result.supplier) setSupplier(result.supplier);
        if (result.spentOn) setSpentOn(result.spentOn);
        if (result.amountPence) setAmount((result.amountPence / 100).toFixed(2));
        if (result.vatPence) setVat((result.vatPence / 100).toFixed(2));
        if (result.suggestedCategory) setCategory(result.suggestedCategory);
        setAiHint(result.confidence || 'medium');
      } catch (e) {
        console.error('Extraction failed:', e);
        setAiHint('low');
        // Soft fail — user can still fill in manually
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const amountPence = Math.round(parseFloat(amount || '0') * 100);
    const vatPence = vat.trim() ? Math.round(parseFloat(vat) * 100) : null;

    if (!amountPence || amountPence <= 0) {
      setError('Please enter an amount.');
      return;
    }
    if (!spentOn) {
      setError('Please pick a date.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // ─── Step 1: Insert the expense FIRST (without photo) ──────────
      // This is the critical part — if this succeeds, the expense is saved.
      // The photo upload is a bonus and won't be allowed to break the save.
      console.log('[expense save] inserting…', { amountPence, spentOn, category, supplier });
      const { data: inserted, error: insertErr } = await supabase
        .from('expenses')
        .insert({
          user_id: currentUserId,
          supplier: supplier.trim() || null,
          amount_pence: amountPence,
          vat_pence: vatPence,
          spent_on: spentOn,
          category,
          payment_method: paymentMethod || null,
          description: description.trim() || null,
          ai_extracted: aiHint != null,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[expense save] insert failed:', insertErr);
        throw new Error(insertErr.message || 'Database insert failed');
      }

      console.log('[expense save] inserted, id:', inserted?.id);

      // ─── Step 2: Upload photo IF present — non-blocking ────────────
      if (photoBase64 && inserted) {
        try {
          console.log('[expense save] uploading photo…');
          const blob = await (await fetch(photoBase64)).blob();
          const ext = (photoMediaType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
          const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('receipts')
            .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: photoMediaType });

          if (upErr) {
            console.error('[expense save] photo upload failed (expense already saved):', upErr);
          } else {
            const { data: signed, error: signErr } = await supabase.storage
              .from('receipts')
              .createSignedUrl(path, 60 * 60 * 24 * 365);

            if (signErr) {
              console.error('[expense save] sign URL failed:', signErr);
            }

            // Patch the expense with photo info
            const { error: updErr } = await supabase.from('expenses').update({
              receipt_url: signed?.signedUrl || null,
              receipt_path: path,
            }).eq('id', inserted.id);

            if (updErr) {
              console.error('[expense save] update with photo failed:', updErr);
            } else {
              console.log('[expense save] photo attached');
            }
          }
        } catch (photoErr) {
          console.error('[expense save] photo handling exception:', photoErr);
          // Don't throw — expense is saved, photo is just a bonus
        }
      }

      // Success regardless of photo status
      onSaved();
    } catch (e) {
      console.error('[expense save] fatal error:', e);
      setError(`Save failed: ${e.message || JSON.stringify(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Expenses"
          title="New receipt"
          subtitle="Snap or upload — we'll read it for you."
          onClose={onClose}
        />
        <ModalBody>
          {/* Photo area — clearly optional */}
          {!photoBase64 ? (
            <>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 130, gap: 6, marginBottom: 10,
                background: COLOR.sand, borderRadius: 12,
                border: `1px dashed ${COLOR.shell}`, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 28, color: COLOR.brown }}>📷</div>
                <div style={{ ...TYPE.capsLabel, color: COLOR.brown }}>Snap or upload receipt</div>
                <div style={{ ...TYPE.metaSmall, color: COLOR.moss }}>AI will fill in the form</div>
                <input type="file" accept="image/*" capture="environment"
                  onChange={handlePhoto} style={{ display: 'none' }} />
              </label>
              <div style={{
                textAlign: 'center', fontSize: 11, color: COLOR.taupe,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: 14,
              }}>
                or fill it in by hand below
              </div>
            </>
          ) : (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <img src={photoBase64} alt="Receipt" style={{
                width: '100%', maxHeight: 220, objectFit: 'contain',
                borderRadius: 10, background: COLOR.sand,
              }} />
              <button onClick={() => { setPhotoBase64(null); setAiHint(null); }}
                className="salus-btn" style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(26, 38, 32, 0.7)', color: COLOR.cream,
                  border: 'none', borderRadius: '50%', width: 30, height: 30,
                  fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0,
                }}>×</button>
            </div>
          )}

          {extracting && (
            <div style={{
              padding: '10px 14px', background: '#f0ede0', borderRadius: 8,
              marginBottom: 14, fontSize: 12, color: COLOR.brown, fontStyle: 'italic',
              textAlign: 'center',
            }}>
              ✨ Reading receipt with AI…
            </div>
          )}

          {aiHint && !extracting && (
            <div style={{
              padding: '10px 14px',
              background: aiHint === 'low' ? '#fef0ec' : '#eef0e3',
              borderRadius: 8, marginBottom: 14, fontSize: 12,
              color: COLOR.brown, lineHeight: 1.5,
            }}>
              {aiHint === 'high' && 'Filled in from the receipt. Please double-check the amount and date.'}
              {aiHint === 'medium' && 'Filled in best-guess values — please review.'}
              {aiHint === 'low' && 'Couldn\'t read clearly — please fill in by hand.'}
            </div>
          )}

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Supplier">
              <input value={supplier} onChange={e => setSupplier(e.target.value)}
                style={styles.loginInput} placeholder="Bookers Wholesale" />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Date">
                <input type="date" value={spentOn} onChange={e => setSpentOn(e.target.value)}
                  style={styles.loginInput} />
              </FormField>
              <FormField label="Amount (£)">
                <input type="number" step="0.01" min="0" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={styles.loginInput} placeholder="0.00" inputMode="decimal" />
              </FormField>
            </div>

            <FormField label="VAT (£, optional)">
              <input type="number" step="0.01" min="0" value={vat}
                onChange={e => setVat(e.target.value)}
                style={styles.loginInput} placeholder="Leave blank if not VAT-registered" inputMode="decimal" />
            </FormField>

            <FormField label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} style={styles.loginInput}>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Payment method">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={styles.loginInput}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Description (optional)">
              <input value={description} onChange={e => setDescription(e.target.value)}
                style={styles.loginInput} placeholder="Towels for the changing room" />
            </FormField>
          </div>
        </ModalBody>
        <ModalFooter>
          {error && (
            <div style={{
              padding: 12, background: '#fef0ec', color: COLOR.coral,
              borderRadius: 8, fontSize: 13, marginBottom: 10,
              lineHeight: 1.4,
            }}>{error}</div>
          )}
          <button onClick={save} disabled={saving || extracting} className="salus-btn" style={{
            ...styles.btnPrimary, width: '100%', justifyContent: 'center',
            padding: '14px 22px', fontSize: 14,
          }}>
            {saving ? 'Saving…' : 'Save expense'}
          </button>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

// ─── ExpenseDetailModal — view / edit / delete a single expense ─────────
function ExpenseDetailModal({ expense, currentUserId, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [supplier, setSupplier] = useState(expense.supplier || '');
  const [spentOn, setSpentOn] = useState(expense.spentOn || '');
  const [amount, setAmount] = useState((expense.amountPence / 100).toFixed(2));
  const [vat, setVat] = useState(expense.vatPence != null ? (expense.vatPence / 100).toFixed(2) : '');
  const [category, setCategory] = useState(expense.category);
  const [paymentMethod, setPaymentMethod] = useState(expense.paymentMethod || 'card');
  const [description, setDescription] = useState(expense.description || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amountPence = Math.round(parseFloat(amount || '0') * 100);
    const vatPence = vat.trim() ? Math.round(parseFloat(vat) * 100) : null;
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').update({
        supplier: supplier.trim() || null,
        amount_pence: amountPence,
        vat_pence: vatPence,
        spent_on: spentOn,
        category,
        payment_method: paymentMethod,
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', expense.id);
      if (error) throw error;
      onUpdated();
    } catch (e) {
      alert('Update failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    setSaving(true);
    try {
      if (expense.receiptPath) {
        await supabase.storage.from('receipts').remove([expense.receiptPath]);
      }
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
      if (error) throw error;
      onUpdated();
    } catch (e) {
      alert('Delete failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow={EXPENSE_CATEGORIES[expense.category]?.label || 'Expense'}
          title={editing ? 'Edit expense' : (expense.supplier || formatGbp(expense.amountPence))}
          subtitle={!editing && expense.spentOn ? new Date(expense.spentOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null}
          onClose={onClose}
        />
        <ModalBody>
          {expense.receiptUrl && !editing && (
            <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: 18 }}>
              <img src={expense.receiptUrl} alt="Receipt" style={{
                width: '100%', maxHeight: 300, objectFit: 'contain',
                borderRadius: 10, background: COLOR.sand,
              }} />
            </a>
          )}

          {!editing ? (
            <>
              <div style={{
                fontFamily: COLOR.serif, fontSize: 36, fontWeight: 400,
                color: COLOR.forest, letterSpacing: '-0.015em', marginBottom: 4,
              }}>
                {formatGbp(expense.amountPence)}
              </div>
              {expense.vatPence != null && (
                <div style={{ ...TYPE.metaSmall, marginBottom: 18 }}>
                  inc. {formatGbp(expense.vatPence)} VAT
                </div>
              )}

              <SectionDivider>Details</SectionDivider>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <DetailRow label="Supplier" value={expense.supplier || '—'} />
                <DetailRow label="Category" value={EXPENSE_CATEGORIES[expense.category]?.label || expense.category} />
                <DetailRow label="Payment" value={PAYMENT_METHODS[expense.paymentMethod] || '—'} />
                {expense.description && <DetailRow label="Notes" value={expense.description} />}
                {expense.aiExtracted && <DetailRow label="Pre-filled" value="By AI from receipt photo" />}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Supplier">
                <input value={supplier} onChange={e => setSupplier(e.target.value)} style={styles.loginInput} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Date">
                  <input type="date" value={spentOn} onChange={e => setSpentOn(e.target.value)} style={styles.loginInput} />
                </FormField>
                <FormField label="Amount (£)">
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={styles.loginInput} inputMode="decimal" />
                </FormField>
              </div>
              <FormField label="VAT (£, optional)">
                <input type="number" step="0.01" value={vat} onChange={e => setVat(e.target.value)} style={styles.loginInput} inputMode="decimal" />
              </FormField>
              <FormField label="Category">
                <select value={category} onChange={e => setCategory(e.target.value)} style={styles.loginInput}>
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Payment method">
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={styles.loginInput}>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Description">
                <input value={description} onChange={e => setDescription(e.target.value)} style={styles.loginInput} />
              </FormField>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div style={{ display: 'flex', gap: 8 }}>
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="salus-btn" style={{
                  ...styles.btnSecondary, flex: 1, padding: '12px 18px', fontSize: 13,
                }}>
                  Edit
                </button>
                <button onClick={remove} disabled={saving} className="salus-btn" style={{
                  ...styles.btnDanger, padding: '12px 18px', fontSize: 13,
                }}>
                  Delete
                </button>
              </>
            ) : (
              <button onClick={save} disabled={saving} className="salus-btn" style={{
                ...styles.btnPrimary, width: '100%', justifyContent: 'center',
                padding: '14px 22px', fontSize: 14,
              }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

// ─── DetailRow — for the expense view ────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 14, padding: '8px 0',
    }}>
      <span style={{ ...TYPE.eyebrow, flexShrink: 0 }}>{label}</span>
      <span style={{ ...TYPE.body, color: COLOR.brown, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ─── exportExpensesCsv — download a CSV file of expenses ─────────────────
function exportExpensesCsv(expenses, filter, taxYearStartIso, monthStartIso, currentUser) {
  let visible = expenses;
  if (filter === 'month')    visible = expenses.filter(e => e.spentOn >= monthStartIso);
  if (filter === 'tax_year') visible = expenses.filter(e => e.spentOn >= taxYearStartIso);

  const rows = [
    ['Date', 'Supplier', 'Category', 'Amount (£)', 'VAT (£)', 'Net (£)', 'Payment', 'Description', 'Receipt URL']
  ];
  visible.forEach(e => {
    const amount = (e.amountPence / 100).toFixed(2);
    const vat = e.vatPence != null ? (e.vatPence / 100).toFixed(2) : '';
    const net = e.vatPence != null ? ((e.amountPence - e.vatPence) / 100).toFixed(2) : amount;
    rows.push([
      e.spentOn,
      e.supplier || '',
      EXPENSE_CATEGORIES[e.category]?.label || e.category,
      amount, vat, net,
      PAYMENT_METHODS[e.paymentMethod] || '',
      e.description || '',
      e.receiptUrl || '',
    ]);
  });
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  const name = (currentUser?.name || 'expenses').toLowerCase().replace(/[^a-z0-9]/g, '-');
  a.download = `${name}-expenses-${filter}-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── ExpensesModal — full-screen wrapper around ExpensesPage ─────────────
// ─── StaffInvoicesModal — view-only earnings breakdown ──────────────────
// Coaches see what they're owed for the period. No edit, no generate — just
// a clean breakdown they can save/share with a manager or accountant.
// ─── AdminSectionModal — wraps individual manager admin sections in a modal ─
// Each manager admin sub-section lives in its own modal so it can't blank the
// rest of the Me page if it crashes. Tap a row in Me → full-screen modal.
function AdminSectionModal({ section, data, currentUser, isManager, emailIntegration, sessionToken, onClose, onConnectGmail, onCreateTask, onCreate, onOpenBooking, onReload, onShowInvoices }) {
  const titleMap = {
    reports: 'Reports',
    inbox: 'Inbox',
    cancellations: 'Cancellations',
    tours: 'Tours',
    stock: 'Stock',
    bookings: 'Studio bookings',
    incidents: 'Incidents',
    invoices: 'Pay run',
  };
  const eyebrowMap = {
    reports: 'Studio admin',
    inbox: 'Studio admin',
    cancellations: 'Studio admin',
    tours: 'Studio admin',
    stock: 'Studio admin',
    bookings: 'Studio admin',
    incidents: 'Studio admin',
    invoices: 'Pay run',
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#fffdf7', zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow={eyebrowMap[section] || 'Admin'}
          title={titleMap[section] || 'Admin'}
          onClose={onClose}
        />
        <ModalBody>
          {section === 'reports' && (
            <AdminReportsSection
              emailIntegration={emailIntegration}
              onConnectGmail={onConnectGmail}
            />
          )}
          {section === 'inbox' && (
            <AdminInboxSection
              emailIntegration={emailIntegration}
              onConnectGmail={onConnectGmail}
              data={data}
              currentUser={currentUser}
              onCreateTask={onCreateTask}
            />
          )}
          {section === 'cancellations' && <AdminCancellationsSection />}
          {section === 'tours' && <AdminToursSection data={data} currentUser={currentUser} />}
          {section === 'stock' && (
            <AdminStockSection
              data={data}
              currentUser={currentUser}
              isManager={isManager}
              onReload={onReload}
            />
          )}
          {section === 'bookings' && (
            <StudioBookingsView
              data={data}
              currentUser={currentUser}
              isManager={isManager}
              onCreate={onCreate}
              onOpenBooking={onOpenBooking}
            />
          )}
          {section === 'incidents' && (
            <AdminIncidentsSection
              data={data}
              currentUser={currentUser}
              isManager={isManager}
              onReload={onReload}
            />
          )}
          {section === 'invoices' && (
            <div>
              <SectionLabel>Pay run</SectionLabel>
              <div style={{
                background: '#fffdf7', border: '1px solid #efe7d2',
                borderRadius: 14, padding: '18px 18px 16px', marginBottom: 14,
              }}>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 18, fontWeight: 500, color: '#1a2620', marginBottom: 6 }}>
                  Generate invoices
                </div>
                <div style={{ fontSize: 12, color: '#7a8270', marginBottom: 14, lineHeight: 1.5 }}>
                  Build CSV invoices for all coaches based on classes taught.
                  £30 per session by default, override per-coach via Team settings.
                </div>
                <button onClick={() => { onClose(); onShowInvoices?.(); }} className="salus-btn"
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: '#1a2620', color: '#fffdf7',
                    border: 'none', borderRadius: 10,
                    fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                    fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
                  }}>
                  Open pay run
                </button>
              </div>
            </div>
          )}
        </ModalBody>
      </div>
    </>,
    document.body
  );
}

function StaffInvoicesModal({ data, currentUser, onClose }) {
  const [period, setPeriod] = useState('this_month');

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // UK tax year (6 April → 5 April)
  const taxYearStart = (() => {
    const y = now.getFullYear();
    const aprilSixth = new Date(y, 3, 6);
    return now < aprilSixth ? new Date(y - 1, 3, 6) : aprilSixth;
  })();
  const taxYearEnd = new Date(taxYearStart.getFullYear() + 1, 3, 5);

  const toIso = d => d.toISOString().slice(0, 10);

  const range = (() => {
    if (period === 'this_month') return { start: toIso(thisMonthStart), end: toIso(thisMonthEnd), label: thisMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
    if (period === 'last_month') return { start: toIso(lastMonthStart), end: toIso(lastMonthEnd), label: lastMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
    return { start: toIso(taxYearStart), end: toIso(taxYearEnd), label: `Tax year ${taxYearStart.getFullYear()}/${String(taxYearStart.getFullYear() + 1).slice(-2)}` };
  })();

  const myClasses = data.classes
    .filter(c => c.coachId === currentUser.id && c.date >= range.start && c.date <= range.end)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const rate = currentUser.sessionRatePence || 3000;
  const totalPence = rate * myClasses.length;

  // Group by week for the list
  const byWeek = {};
  myClasses.forEach(c => {
    const d = new Date(c.date);
    const dow = (d.getDay() + 6) % 7;
    const mon = new Date(d); mon.setDate(d.getDate() - dow);
    const weekKey = toIso(mon);
    if (!byWeek[weekKey]) byWeek[weekKey] = [];
    byWeek[weekKey].push(c);
  });
  const weekKeys = Object.keys(byWeek).sort();

  const fmt = (pence) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportCsv = () => {
    const rows = [['Date', 'Time', 'Class', 'Studio', 'Rate (£)', 'Amount (£)']];
    myClasses.forEach(c => {
      rows.push([
        c.date,
        c.time,
        c.type,
        c.studio === 'reformer' ? 'Reformer studio' : c.studio === 'hybrid' ? 'Hybrid studio' : (c.studio || ''),
        (rate / 100).toFixed(2),
        (rate / 100).toFixed(2),
      ]);
    });
    rows.push(['', '', '', '', 'Total', (totalPence / 100).toFixed(2)]);
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const todayIso = new Date().toISOString().slice(0, 10);
    const name = (currentUser.name || 'invoice').toLowerCase().replace(/[^a-z0-9]/g, '-');
    a.download = `${name}-invoice-${period}-${todayIso}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#fffdf7', zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Personal"
          title="Your invoices"
          subtitle="View what you're owed for sessions you've taught."
          onClose={onClose}
        />
        <ModalBody>
          {/* Period tabs */}
          <div style={{
            display: 'flex', gap: 22, padding: '0 4px 8px',
            borderBottom: '1px solid #efe7d2', marginBottom: 18,
          }}>
            {[
              ['this_month', 'This month'],
              ['last_month', 'Last month'],
              ['tax_year', 'Tax year'],
            ].map(([key, label]) => {
              const isActive = period === key;
              return (
                <button key={key}
                  onClick={() => setPeriod(key)}
                  className="salus-btn"
                  style={{
                    padding: '6px 0', background: 'transparent', border: 'none',
                    borderBottom: isActive ? '1.5px solid #1a2620' : '1.5px solid transparent',
                    fontSize: 11, fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#1a2620' : '#a59478',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Hero stats card */}
          <div style={{
            padding: '20px 22px', marginBottom: 22,
            background: '#fffdf7', border: '1px solid #efe7d2',
            borderRadius: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#a59478', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 }}>
              {range.label}
            </div>
            <div style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 32, fontWeight: 400, color: '#1a2620',
              letterSpacing: '-0.015em', lineHeight: 1.1,
            }}>
              {fmt(totalPence)}
            </div>
            <div style={{ fontSize: 13, color: '#7a8270', marginTop: 6, fontStyle: 'italic', fontFamily: '"Playfair Display", Georgia, serif' }}>
              {myClasses.length} {myClasses.length === 1 ? 'class' : 'classes'} · {fmt(rate)} per session
            </div>
          </div>

          {/* Classes by week */}
          {myClasses.length === 0 ? (
            <EmptyState sub="Once you teach a class in this period, it'll appear here.">
              No classes in this period.
            </EmptyState>
          ) : (
            weekKeys.map(weekKey => {
              const weekClasses = byWeek[weekKey];
              const weekTotal = rate * weekClasses.length;
              const monDate = new Date(weekKey);
              const sunDate = new Date(monDate); sunDate.setDate(sunDate.getDate() + 6);
              const sameMonth = monDate.getMonth() === sunDate.getMonth();
              const weekLabel = sameMonth
                ? `${monDate.getDate()} – ${sunDate.getDate()} ${sunDate.toLocaleDateString('en-GB', { month: 'short' })}`
                : `${monDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sunDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

              return (
                <div key={weekKey} style={{ marginBottom: 22 }}>
                  <SectionLabel>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span>{weekLabel}</span>
                      <span style={{ fontSize: 11, color: '#a59478', fontStyle: 'normal', fontFamily: "'Inter', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(weekTotal)}
                      </span>
                    </div>
                  </SectionLabel>
                  {weekClasses.map(c => {
                    const dateLabel = new Date(c.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                      <div key={c.id} style={{
                        display: 'flex', gap: 12, padding: '12px 4px',
                        borderBottom: '1px solid #efe7d2',
                        alignItems: 'center',
                      }}>
                        <div style={{ flexShrink: 0, minWidth: 110 }}>
                          <div style={{ fontSize: 13, color: '#1a2620', fontWeight: 500 }}>{dateLabel}</div>
                          <div style={{ fontSize: 11, color: '#a59478', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{c.time}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, color: '#1a2620',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{c.type}</div>
                        </div>
                        <div style={{
                          fontSize: 14, color: '#1a2620', fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}>
                          {fmt(rate)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          {myClasses.length > 0 && (
            <div style={{
              padding: '14px 16px', marginTop: 10,
              background: '#f5f1e8', borderRadius: 12,
              fontSize: 12, color: '#5c4a38', lineHeight: 1.5,
            }}>
              <strong>Note:</strong> rate shown is per the manager's setting (£{(rate / 100).toFixed(2)} per session).
              Final amounts may differ — check with the studio for adjustments, holiday pay, or special rates.
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button onClick={exportCsv} disabled={myClasses.length === 0} className="salus-btn"
            style={{
              width: '100%', padding: '14px 22px',
              background: '#1a2620', color: '#fffdf7',
              border: 'none', borderRadius: 999,
              fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'inherit', cursor: myClasses.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: myClasses.length === 0 ? 0.4 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Download as CSV
          </button>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

function ExpensesModal({ data, currentUser, sessionToken, onClose, onReload }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 22px',
          paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
          borderBottom: `1px solid ${COLOR.bone}`,
          flexShrink: 0, background: COLOR.cream,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ ...TYPE.eyebrow }}>Expenses</div>
          <CloseButton onClick={onClose} />
        </div>
        <div style={{
          flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '18px 22px 32px',
        }}>
          <ExpensesPage
            data={data}
            currentUser={currentUser}
            sessionToken={sessionToken}
            onReload={onReload}
          />
        </div>
      </div>
    </>
  , document.body);
}

// ════════════════════════════════════════════════════════════════════════
// FLOWS — coach's personal session archive with sketching
// ════════════════════════════════════════════════════════════════════════

// ─── FlowsPage — list + archive ──────────────────────────────────────────
function FlowsPage({ data, currentUser, onReload }) {
  const [editing, setEditing] = useState(null); // null | 'new' | flowObj
  const [showArchived, setShowArchived] = useState(false);

  const allFlows = data.flows || [];
  const visible = allFlows
    .filter(f => showArchived ? f.archived : !f.archived)
    .sort((a, b) => (b.flowDate || '').localeCompare(a.flowDate || '') || b.updatedAt - a.updatedAt);

  return (
    <>
      <PageHeader
        eyebrow="Personal"
        title="Flows"
        subtitle="Your session library. Private to you."
        compact
      />

      <button onClick={() => setEditing('new')} className="salus-btn" style={{
        ...styles.btnPrimary, width: '100%', justifyContent: 'center',
        padding: '14px 22px', fontSize: 14, marginBottom: 16,
      }}>
        + New flow
      </button>

      {/* Active / Archive toggle */}
      <div style={{
        display: 'flex', gap: 22, padding: '0 4px 8px',
        borderBottom: `1px solid ${COLOR.bone}`, marginBottom: 16,
      }}>
        {[
          [false, 'Active'],
          [true, 'Archived'],
        ].map(([key, label]) => (
          <button key={String(key)}
            onClick={() => setShowArchived(key)}
            className="salus-btn"
            style={{
              padding: '6px 0', background: 'transparent', border: 'none',
              borderBottom: showArchived === key ? `1.5px solid ${COLOR.forest}` : '1.5px solid transparent',
              ...(showArchived === key ? TYPE.capsLabelActive : TYPE.capsLabel),
              fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState sub={showArchived ? 'Archive a flow to see it here.' : 'Tap "+ New flow" to start documenting.'}>
          {showArchived ? 'No archived flows.' : 'No flows yet.'}
        </EmptyState>
      ) : (
        visible.map(flow => (
          <FlowRow key={flow.id} flow={flow} onTap={() => setEditing(flow)} />
        ))
      )}

      {editing && (
        <FlowEditor
          flow={editing === 'new' ? null : editing}
          currentUserId={currentUser.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onReload?.(true); }}
        />
      )}
    </>
  );
}

// ─── FlowRow — single row in the list ────────────────────────────────────
function FlowRow({ flow, onTap }) {
  const dateLabel = flow.flowDate
    ? new Date(flow.flowDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(flow.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const sketchCount = (flow.sketches || []).length;
  const hasNotes = !!(flow.notes && flow.notes.trim());

  return (
    <button onClick={onTap} className="salus-btn" style={{
      width: '100%', textAlign: 'left',
      padding: '14px 4px',
      borderBottom: `1px solid ${COLOR.bone}`,
      background: 'transparent', border: 'none', borderRadius: 0,
      fontFamily: 'inherit', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Sketch thumbnail if available */}
      {sketchCount > 0 && flow.sketches[0]?.url ? (
        <div style={{
          width: 44, height: 44, borderRadius: 8, flexShrink: 0,
          backgroundImage: `url(${flow.sketches[0].url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          background: COLOR.sand, border: `0.5px solid ${COLOR.bone}`,
        }} />
      ) : (
        <div style={{
          width: 44, height: 44, borderRadius: 8, flexShrink: 0,
          background: COLOR.sand,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: COLOR.taupe,
        }}>
          ✎
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...TYPE.itemTitle,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {flow.title}
        </div>
        <div style={{ ...TYPE.metaSmall, marginTop: 3 }}>
          {dateLabel}
          {flow.classType ? ` · ${flow.classType}` : ''}
          {sketchCount > 0 ? ` · ${sketchCount} sketch${sketchCount === 1 ? '' : 'es'}` : ''}
          {hasNotes ? ' · notes' : ''}
        </div>
      </div>
    </button>
  );
}

// ─── FlowEditor — full-screen edit modal ─────────────────────────────────
function FlowEditor({ flow, currentUserId, onClose, onSaved }) {
  const isNew = !flow;
  const [title, setTitle] = useState(flow?.title || '');
  const [flowDate, setFlowDate] = useState(flow?.flowDate || new Date().toISOString().slice(0, 10));
  const [classType, setClassType] = useState(flow?.classType || '');
  const [duration, setDuration] = useState(flow?.durationMinutes != null ? String(flow.durationMinutes) : '');
  const [notes, setNotes] = useState(flow?.notes || '');
  const [sketches, setSketches] = useState(flow?.sketches || []);
  const [archived, setArchived] = useState(flow?.archived || false);

  const [sketching, setSketching] = useState(false);
  const [viewingSketch, setViewingSketch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!title.trim()) {
      setError('Give your flow a title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        user_id: currentUserId,
        title: title.trim(),
        flow_date: flowDate || null,
        class_type: classType.trim() || null,
        duration_minutes: duration ? Number(duration) : null,
        notes: notes.trim() || null,
        sketches: sketches,
        archived,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        const { error: insErr } = await supabase.from('flows').insert(payload);
        if (insErr) throw insErr;
      } else {
        const { error: updErr } = await supabase.from('flows').update(payload).eq('id', flow.id);
        if (updErr) throw updErr;
      }
      onSaved();
    } catch (e) {
      console.error('Flow save:', e);
      setError(`Save failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this flow and all its sketches? This cannot be undone.')) return;
    setSaving(true);
    try {
      // Delete sketches from storage first
      const paths = (sketches || []).map(s => s.path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('flow-assets').remove(paths);
      }
      const { error: delErr } = await supabase.from('flows').delete().eq('id', flow.id);
      if (delErr) throw delErr;
      onSaved();
    } catch (e) {
      alert(`Delete failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const onSketchSaved = async (dataUrl) => {
    setSketching(false);
    try {
      // Upload to storage
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: upErr } = await supabase.storage
        .from('flow-assets')
        .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: 'image/png' });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from('flow-assets').createSignedUrl(path, 60 * 60 * 24 * 365);
      setSketches(prev => [
        ...prev,
        { url: signed?.signedUrl || null, path, created_at: new Date().toISOString() },
      ]);
    } catch (e) {
      console.error('Sketch upload:', e);
      setError(`Sketch upload failed: ${e.message || e}`);
    }
  };

  const deleteSketch = async (idx) => {
    const sketch = sketches[idx];
    if (sketch?.path) {
      await supabase.storage.from('flow-assets').remove([sketch.path]).catch(() => {});
    }
    setSketches(prev => prev.filter((_, i) => i !== idx));
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow={isNew ? 'New flow' : 'Edit flow'}
          title={title || 'Untitled flow'}
          onClose={onClose}
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Title">
              <input value={title} onChange={e => setTitle(e.target.value)}
                style={styles.loginInput} placeholder="Reformer · Glutes & core" />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Date">
                <input type="date" value={flowDate} onChange={e => setFlowDate(e.target.value)}
                  style={styles.loginInput} />
              </FormField>
              <FormField label="Duration (min)">
                <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)}
                  style={styles.loginInput} placeholder="45" inputMode="numeric" />
              </FormField>
            </div>

            <FormField label="Class type (optional)">
              <input value={classType} onChange={e => setClassType(e.target.value)}
                style={styles.loginInput} placeholder="Signature, Reformer, Hybrid..." />
            </FormField>

            <FormField label="Notes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={5}
                style={{ ...styles.loginInput, resize: 'vertical', minHeight: 110, lineHeight: 1.5 }}
                placeholder="Equipment used, sequence, cues, anything you want to remember..." />
            </FormField>

            <div>
              <div style={{ ...TYPE.eyebrow, marginBottom: 10 }}>Sketches</div>
              {sketches.length > 0 && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                  marginBottom: 10,
                }}>
                  {sketches.map((s, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <button
                        onClick={() => setViewingSketch(s)}
                        className="salus-btn"
                        style={{
                          width: '100%', aspectRatio: '1 / 1',
                          backgroundImage: `url(${s.url})`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          background: COLOR.sand,
                          border: `0.5px solid ${COLOR.bone}`,
                          borderRadius: 8, cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                      <button
                        onClick={() => deleteSketch(idx)}
                        className="salus-btn"
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(26, 38, 32, 0.7)', color: COLOR.cream,
                          border: 'none', borderRadius: '50%', width: 22, height: 22,
                          fontSize: 12, lineHeight: 1, cursor: 'pointer', padding: 0,
                        }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSketching(true)}
                className="salus-btn"
                style={{
                  width: '100%', padding: '12px 18px',
                  background: 'transparent',
                  border: `1px dashed ${COLOR.shell}`, borderRadius: 10,
                  fontSize: 12, color: COLOR.brown, letterSpacing: '0.05em',
                  textTransform: 'uppercase', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                ✎ Add a sketch
              </button>
            </div>

            {!isNew && (
              <button
                onClick={() => setArchived(a => !a)}
                className="salus-btn"
                style={{
                  marginTop: 8, padding: '10px 16px',
                  background: 'transparent',
                  border: `1px solid ${COLOR.bone}`, borderRadius: 10,
                  fontSize: 12, color: COLOR.brown,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {archived ? 'Restore from archive' : 'Move to archive'}
              </button>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          {error && (
            <div style={{
              padding: 12, background: '#fef0ec', color: COLOR.coral,
              borderRadius: 8, fontSize: 13, marginBottom: 10,
            }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isNew && (
              <button onClick={remove} disabled={saving} className="salus-btn"
                style={{ ...styles.btnDanger, padding: '12px 18px', fontSize: 13 }}>
                Delete
              </button>
            )}
            <button onClick={save} disabled={saving} className="salus-btn"
              style={{
                ...styles.btnPrimary, flex: 1, justifyContent: 'center',
                padding: '14px 22px', fontSize: 14,
              }}>
              {saving ? 'Saving…' : (isNew ? 'Create flow' : 'Save changes')}
            </button>
          </div>
        </ModalFooter>
      </div>

      {sketching && (
        <SketchCanvas onClose={() => setSketching(false)} onSave={onSketchSaved} />
      )}
      {viewingSketch && (
        <div onClick={() => setViewingSketch(null)} style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(26, 38, 32, 0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <img src={viewingSketch.url} alt="Sketch"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, background: '#fff' }} />
        </div>
      )}
    </>
  , document.body);
}

// ─── SketchCanvas — finger-paint drawing tool ────────────────────────────
function SketchCanvas({ onClose, onSave }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [color, setColor] = useState('#1a2620');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [history, setHistory] = useState([]);  // array of dataURLs for undo
  const drawing = useRef(false);

  const colors = ['#1a2620', '#c8442a', '#7a8c5c', '#c6926a', '#5c4a38'];
  const widths = [1.5, 3, 6, 12];

  // Initialise canvas at full size when mounted
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctxRef.current = ctx;
    setHistory([canvas.toDataURL()]);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === 'eraser' ? '#fffdf7' : color;
    ctx.lineWidth = tool === 'eraser' ? strokeWidth * 4 : strokeWidth;
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (e) => {
    if (!drawing.current) return;
    if (e) e.preventDefault();
    drawing.current = false;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.closePath();
    // Push snapshot to history
    const canvas = canvasRef.current;
    setHistory(prev => [...prev, canvas.toDataURL()].slice(-30));
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = newHistory[newHistory.length - 1];
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHistory([canvas.toDataURL()]);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10002,
      background: COLOR.cream,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        borderBottom: `1px solid ${COLOR.bone}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: COLOR.cream,
      }}>
        <button onClick={onClose} className="salus-btn" style={{
          background: 'transparent', border: 'none', padding: '6px 12px',
          fontSize: 14, color: COLOR.brown, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          Cancel
        </button>
        <div style={{ ...TYPE.eyebrow }}>Sketch</div>
        <button onClick={save} className="salus-btn" style={{
          background: COLOR.forest, color: COLOR.cream, border: 'none',
          padding: '6px 14px', borderRadius: 999,
          fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>
          Save
        </button>
      </div>

      {/* Canvas — fills available space */}
      <div style={{ flex: 1, padding: 12, background: COLOR.sand, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%', height: '100%',
            background: '#fffdf7',
            borderRadius: 12,
            touchAction: 'none',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            display: 'block',
          }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      {/* Tool bar */}
      <div style={{
        padding: '10px 14px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        borderTop: `1px solid ${COLOR.bone}`,
        background: COLOR.cream,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Colors */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {colors.map(c => (
            <button key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              className="salus-btn"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: c,
                border: (color === c && tool === 'pen') ? `2.5px solid ${COLOR.forest}` : `1px solid ${COLOR.bone}`,
                cursor: 'pointer', padding: 0,
              }}
              aria-label={`Colour ${c}`}
            />
          ))}
          <button onClick={() => setTool('eraser')} className="salus-btn"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: COLOR.sand,
              border: tool === 'eraser' ? `2.5px solid ${COLOR.forest}` : `1px solid ${COLOR.bone}`,
              cursor: 'pointer', padding: 0,
              fontSize: 12, fontFamily: 'inherit',
            }}>
            ⌫
          </button>
        </div>

        {/* Stroke widths + actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          {widths.map(w => (
            <button key={w}
              onClick={() => setStrokeWidth(w)}
              className="salus-btn"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'transparent',
                border: strokeWidth === w ? `1.5px solid ${COLOR.forest}` : `1px solid ${COLOR.bone}`,
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <div style={{
                width: w * 2, height: w * 2, borderRadius: '50%',
                background: COLOR.forest,
              }} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={undo} disabled={history.length <= 1} className="salus-btn"
            style={{
              padding: '7px 12px', background: 'transparent',
              border: `1px solid ${COLOR.bone}`, borderRadius: 8,
              fontSize: 11, color: COLOR.brown, letterSpacing: '0.05em',
              textTransform: 'uppercase', cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: history.length <= 1 ? 0.4 : 1,
            }}>
            Undo
          </button>
          <button onClick={clearAll} className="salus-btn"
            style={{
              padding: '7px 12px', background: 'transparent',
              border: `1px solid ${COLOR.bone}`, borderRadius: 8,
              fontSize: 11, color: COLOR.brown, letterSpacing: '0.05em',
              textTransform: 'uppercase', cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            Clear
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ─── FlowsModal — full-screen wrapper around FlowsPage ───────────────────
function FlowsModal({ data, currentUser, onClose, onReload }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 22px',
          paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
          borderBottom: `1px solid ${COLOR.bone}`,
          flexShrink: 0, background: COLOR.cream,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ ...TYPE.eyebrow }}>Flows</div>
          <CloseButton onClick={onClose} />
        </div>
        <div style={{
          flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '18px 22px 32px',
        }}>
          <FlowsPage
            data={data}
            currentUser={currentUser}
            onReload={onReload}
          />
        </div>
      </div>
    </>
  , document.body);
}

function StockItemRow({ item, busy, isManager, onDecrement, onIncrement, onEdit }) {
  const isLow = item.currentQty <= item.lowThreshold;
  const isOut = item.currentQty === 0;

  return (
    <div style={{
      padding: '14px 4px',
      borderBottom: '1px solid #efe7d2',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {/* Name + qty area — tap to edit if manager */}
      <button
        onClick={isManager ? onEdit : undefined}
        disabled={!isManager}
        className="salus-btn"
        style={{
          flex: 1, minWidth: 0, textAlign: 'left',
          background: 'transparent', border: 'none', padding: 0,
          cursor: isManager ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 15, fontWeight: 500, color: '#1a2620', letterSpacing: '-0.005em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 17, fontWeight: 500,
            color: isOut ? '#c8442a' : isLow ? '#c6926a' : '#5c4a38',
          }}>
            {item.currentQty}
          </span>
          <span style={{ fontSize: 10, color: '#a59478', letterSpacing: '0.02em' }}>
            {item.unit}{item.currentQty !== 1 ? 's' : ''}
          </span>
          {isLow && (
            <span style={{
              fontSize: 9, color: isOut ? '#c8442a' : '#c6926a', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 2,
            }}>
              {isOut ? 'Out' : 'Low'}
            </span>
          )}
        </div>
      </button>

      {/* Quick − / + only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onClick={onDecrement} disabled={busy || item.currentQty === 0} className="salus-btn" style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'transparent', border: '1px solid #efe7d2',
          color: '#5c4a38', fontSize: 20, fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: item.currentQty === 0 ? 0.3 : 1,
          cursor: item.currentQty === 0 ? 'default' : 'pointer',
          padding: 0,
        }} aria-label="Took one">
          −
        </button>
        <button onClick={onIncrement} disabled={busy} className="salus-btn" style={{
          width: 38, height: 38, borderRadius: '50%',
          background: '#1a2620', border: 'none',
          color: '#fffdf7', fontSize: 20, fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }} aria-label="Added one">
          +
        </button>
      </div>
    </div>
  );
}

function StockItemEditModal({ item, isManager, currentUserId, onClose, onSaved }) {
  const isNew = !item;
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || 'other');
  const [currentQty, setCurrentQty] = useState(String(item?.currentQty ?? 0));
  const [unit, setUnit] = useState(item?.unit || 'each');
  const [lowThreshold, setLowThreshold] = useState(String(item?.lowThreshold ?? 1));
  const [reorderUrl, setReorderUrl] = useState(item?.reorderUrl || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { alert('Name required'); return; }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        current_qty: Math.max(0, parseInt(currentQty) || 0),
        unit: unit.trim() || 'each',
        low_threshold: Math.max(0, parseInt(lowThreshold) || 1),
        reorder_url: reorderUrl.trim() || null,
        notes: notes.trim() || null,
        last_updated_by: currentUserId,
        last_updated_at: new Date().toISOString(),
      };
      if (isNew) {
        const { error } = await supabase.from('stock_items').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stock_items').update(payload).eq('id', item.id);
        if (error) throw error;
      }
      onSaved();
    } catch (e) {
      alert('Save failed: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!confirm(`Archive "${item.name}"? You can restore from Supabase.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('stock_items')
        .update({ archived: true })
        .eq('id', item.id);
      if (error) throw error;
      onSaved();
    } catch (e) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow={isNew ? 'New item' : 'Edit item'}
          title={isNew ? 'Add to stock' : item.name}
          onClose={onClose}
        />

        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Name">
              <input value={name} onChange={e => setName(e.target.value)} style={styles.loginInput} placeholder="Hand wash" />
            </FormField>

            <FormField label="Category">
              <select value={category} onChange={e => setCategory(e.target.value)} style={styles.loginInput}>
                {Object.entries(STOCK_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Current quantity">
                <input type="number" min="0" value={currentQty} onChange={e => setCurrentQty(e.target.value)} style={styles.loginInput} />
              </FormField>
              <FormField label="Unit">
                <input value={unit} onChange={e => setUnit(e.target.value)} style={styles.loginInput} placeholder="bottle" />
              </FormField>
            </div>

            <FormField label="Low-stock threshold">
              <input type="number" min="0" value={lowThreshold} onChange={e => setLowThreshold(e.target.value)} style={styles.loginInput} />
              <div style={{ ...TYPE.metaSmall, marginTop: 4 }}>
                Marked "running low" when quantity is at or below this number.
              </div>
            </FormField>

            <FormField label="Reorder link (optional)">
              <input value={reorderUrl} onChange={e => setReorderUrl(e.target.value)} style={styles.loginInput} placeholder="https://amazon.co.uk/..." />
            </FormField>

            <FormField label="Notes (optional)">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...styles.loginInput, resize: 'vertical' }} placeholder="Brand preference, supplier, etc." />
            </FormField>
          </div>
        </ModalBody>

        <ModalFooter>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={busy} className="salus-btn" style={{
              ...styles.btnPrimary, flex: 1, justifyContent: 'center',
              padding: '14px 22px', fontSize: 14,
            }}>
              {busy ? 'Saving…' : (isNew ? 'Add item' : 'Save')}
            </button>
            {!isNew && (
              <button onClick={archive} disabled={busy} className="salus-btn" style={{
                ...styles.btnDanger, padding: '14px 18px',
              }}>
                Archive
              </button>
            )}
          </div>
        </ModalFooter>
      </div>
    </>
  , document.body);
}

// Unified FormField label — Inter caps in taupe
function FormField({ label, children }) {
  return (
    <div>
      <div style={{ ...TYPE.eyebrow, letterSpacing: 1.8, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
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
      <div style={{ position: 'relative' }}>
        <PageHeader
          eyebrow="Salus House"
          title="Studio Bookings"
        />
        {(isManager || (!isManager && currentUser.isCoach)) && (
          <button onClick={onCreate} className="salus-btn" style={{
            position: 'absolute', top: 0, right: 0,
            width: 44, height: 44, borderRadius: '50%',
            background: '#1a2620', color: '#fffdf7',
            border: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(26, 38, 32, 0.25)',
          }}>
            <Plus size={20} />
          </button>
        )}
      </div>

      <div style={{
        display: 'flex', gap: 20, padding: '0 4px 12px',
        borderBottom: '1px solid #efe7d2', marginBottom: 4,
      }}>
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
              padding: '6px 0',
              background: 'transparent', border: 'none',
              borderBottom: filter === f.key ? '1.5px solid #1a2620' : '1.5px solid transparent',
              fontSize: 11, fontWeight: filter === f.key ? 600 : 500,
              color: filter === f.key ? '#1a2620' : '#a59478',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'inherit', cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{
            fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38',
            fontStyle: 'italic', letterSpacing: '-0.005em',
          }}>
            {filter === 'upcoming' ? 'Nothing booked yet.' :
             filter === 'past'     ? 'No past bookings.' :
                                      'No cancelled bookings.'}
          </div>
          {filter === 'upcoming' && (
            <div style={{ fontSize: 12, color: '#a59478', marginTop: 8 }}>
              {isManager ? 'Add a booking with the + button.' : 'Bookings appear here when added.'}
            </div>
          )}
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
                      Paid hire / event
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
                  1:1 session
                </button>
                <button onClick={() => setBookingType('coach_class')} className="salus-btn"
                  style={{
                    ...styles.audiencePill,
                    ...(bookingType === 'coach_class'
                      ? { background: BOOKING_TYPES.coach_class.color, color: '#fff', borderColor: BOOKING_TYPES.coach_class.color }
                      : {}),
                  }}>
                  Extra class
                </button>
                <button onClick={() => setBookingType('coach_event')} className="salus-btn"
                  style={{
                    ...styles.audiencePill,
                    ...(bookingType === 'coach_event'
                      ? { background: BOOKING_TYPES.coach_event.color, color: '#fff', borderColor: BOOKING_TYPES.coach_event.color }
                      : {}),
                  }}>
                  Workshop / event
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
            Add to Google Calendar
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

  return createPortal(
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
              No messages yet. Start the conversation
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
  , document.body);
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

  return createPortal(
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
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, color: '#5c4a38', fontWeight: 500 }}>All caught up</div>
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
  , document.body);
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

  // Brand photo rotation — fresh feel each visit
  const heroPhoto = useMemo(() => {
    const photos = ['/brand/reformer.jpg', '/brand/cardio.jpg', '/brand/exterior.jpg', '/brand/sign.jpg'];
    return photos[Math.floor(Math.random() * photos.length)];
  }, []);

  return (
    <div style={styles.loginWrap}>
      <style>{`
        /* Fonts loaded via index.html */
        body { margin: 0; background: #1a2620; }
      `}</style>

      {/* Hero backdrop */}
      <div style={{
        ...styles.loginHero,
        backgroundImage: `url(${heroPhoto})`,
      }} />
      <div style={styles.loginHeroOverlay} />

      {/* Brand wordmark, floating */}
      <div style={{
        position: 'absolute', top: 'calc(40px + env(safe-area-inset-top))', left: 0, right: 0,
        zIndex: 2, textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 500, color: 'rgba(255, 253, 247, 0.7)',
          letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8,
        }}>Salus House</div>
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 22, color: '#fffdf7', fontStyle: 'italic',
          letterSpacing: '-0.005em', fontWeight: 400,
        }}>For the team.</div>
      </div>

      <form onSubmit={handleSubmit} style={styles.loginCard}>
        <div style={styles.loginLogo}>
          <div style={styles.loginLogoMark}>
            <img src="https://cdn.prod.website-files.com/66803175747777a7dd2956e8/668c04b49ff0954ea73d39ef_download-compresskaru.com.png" alt="Salus" style={styles.loginLogoMarkImg} />
          </div>
        </div>

        <h1 style={styles.loginTitle}>{mode === 'signin' ? 'Welcome back.' : 'Join the team.'}</h1>
        <p style={styles.loginSub}>
          {mode === 'signin'
            ? "Sign in to your timetable, cover board, and team chat."
            : "Create your account. Your manager will assign your role once you're in."}
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

// ─── MyDayHero — personal command center at the top of Home ──────────────
// Replaces the generic greeting. Shows: today's hero, this week's earnings,
// up next, other classes today, birthdays.
// ─── HomeHero — big editorial hero card with photo + up-next overlay ────
// Inspired by the Interstellar reference: dramatic photo, greeting overlay
// top-left, key class info overlaid bottom with a CTA button. Drops in
// above the rest of the Home content.
function HomeHero({ data, currentUser, isManager, brandPhoto, onClassClick }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const todayIso = now.toISOString().slice(0, 10);

  // Photo
  const heroPhoto = currentUser?.homePhotoUrl
    || brandPhoto
    || '/brand/reformer.jpg';

  // Next class
  const myUpcoming = (data?.classes || [])
    .filter(c => c.coachId === currentUser?.id && c.date >= todayIso)
    .sort((a, b) => (`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
  const upNext = myUpcoming[0];

  // Saved (heart) — local state, matches cover board pattern
  const [hearted, setHearted] = useState(false);

  const studioLabel = (s) => {
    if (s === 'reformer') return 'Reformer studio';
    if (s === 'hybrid') return 'Hybrid studio';
    return 'Studio';
  };

  // Contextual subtitle — friendly one-liner under the class title
  const heroSubtitle = (() => {
    if (!upNext) return 'Take a breath. No classes on your schedule right now.';
    const d = new Date(upNext.date);
    const isToday = upNext.date === todayIso;
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = upNext.date === tomorrow.toISOString().slice(0, 10);
    if (isToday) {
      const [hh, mm] = (upNext.time || '00:00').split(':').map(Number);
      const classDt = new Date(); classDt.setHours(hh, mm, 0, 0);
      const minutes = Math.round((classDt.getTime() - now.getTime()) / 60000);
      if (minutes < 0) return "Today's session. You're teaching now.";
      if (minutes < 60) return `Starting in ${minutes} minutes. Set up the room and breathe.`;
      const hrs = Math.floor(minutes / 60);
      return `Coming up in ${hrs} hour${hrs > 1 ? 's' : ''}. Plenty of time.`;
    }
    if (isTomorrow) return "Tomorrow's class. A good day to prepare your flow.";
    return `Your next class is ${d.toLocaleDateString('en-GB', { weekday: 'long' })}.`;
  })();

  // Bottom metadata line — like "2014 · 2h 49m · 8.7/10" in the reference
  const metadataParts = upNext ? [
    upNext.date === todayIso ? 'Today' : new Date(upNext.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    upNext.time,
    upNext.durationMin ? `${upNext.durationMin} min` : null,
    studioLabel(upNext.studio),
  ].filter(Boolean) : [];

  return (
    <>
      {/* Header row — avatar + greeting + bell + gear */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 4px 20px',
      }}>
        <button onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('salus:tab', { detail: 'me' })); }} className="salus-btn"
          style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            borderRadius: '50%',
          }}>
          <UserAvatar user={currentUser} size={44} fontSize={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: '#a59478', fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            {greeting}
          </div>
          <div style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 19, fontWeight: 500, color: '#1a2620',
            letterSpacing: '-0.01em', marginTop: 2, lineHeight: 1.2,
          }}>
            {firstName}
          </div>
        </div>
        <button
          onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('salus:openModal', { detail: { type: 'notifications' } })); }}
          className="salus-btn"
          style={{
            width: 38, height: 38, borderRadius: 19,
            background: '#fffdf7', border: '1px solid #efe7d2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#5c4a38', cursor: 'pointer', position: 'relative',
          }}
          title="Notifications">
          <Bell size={16} strokeWidth={1.8} />
        </button>
        <button
          onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('salus:openModal', { detail: { type: 'settings' } })); }}
          className="salus-btn"
          style={{
            width: 38, height: 38, borderRadius: 19,
            background: '#fffdf7', border: '1px solid #efe7d2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#5c4a38', cursor: 'pointer',
          }}
          title="Settings">
          <Settings size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* Hero image card — cinematic, like the Interstellar reference */}
      <div
        onClick={() => upNext && onClassClick?.(upNext.id)}
        style={{
          position: 'relative',
          height: 460,
          borderRadius: 22,
          overflow: 'hidden',
          marginBottom: 26,
          backgroundImage: `url(${heroPhoto})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 4px 16px rgba(26, 38, 32, 0.12)',
          cursor: upNext ? 'pointer' : 'default',
        }}>
        {/* Gradient — heavier at the bottom for legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(26,38,32,0.10) 0%, rgba(26,38,32,0.05) 35%, rgba(26,38,32,0.85) 75%, rgba(26,38,32,0.95) 100%)',
        }} />

        {/* No floating icons — page-level bell and gear cover those needs */}

        {/* Bottom block — class name + subtitle + metadata */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '24px 24px 22px',
          color: '#fffdf7',
        }}>
          {upNext ? (
            <>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 34, fontWeight: 500, color: '#fffdf7',
                letterSpacing: '-0.022em', lineHeight: 1.05,
                marginBottom: 10,
              }}>
                {upNext.type}
              </div>
              <div style={{
                fontSize: 13, color: 'rgba(255, 253, 247, 0.85)',
                lineHeight: 1.5, marginBottom: 16,
                maxWidth: '88%',
              }}>
                {heroSubtitle}
              </div>
              <div style={{
                fontSize: 11, color: 'rgba(255, 253, 247, 0.7)',
                letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', gap: 8,
                flexWrap: 'wrap',
              }}>
                {metadataParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ opacity: 0.5 }}>·</span>}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 30, fontWeight: 500, color: '#fffdf7',
                letterSpacing: '-0.018em', lineHeight: 1.1,
                marginBottom: 10,
              }}>
                A quiet day
              </div>
              <div style={{
                fontSize: 13, color: 'rgba(255, 253, 247, 0.85)',
                lineHeight: 1.5,
              }}>
                {heroSubtitle}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}


function MyDayHero({ data, currentUser, isManager, onClassClick }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const todayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayIso = now.toISOString().slice(0, 10);
  const firstName = currentUser.name?.split(' ')[0] || 'there';
  const isCoach = currentUser.isCoach;

  // My classes today (as coach OR as a cover acceptor)
  const myToday = data.classes
    .filter(c => c.date === todayIso && c.coachId === currentUser.id)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // My FOH shift today
  const myFohToday = (data.fohShifts || []).filter(s => s.date === todayIso && s.userId === currentUser.id);

  // Editorial subtitle — "3 classes · FOH shift"
  // (Trainer mentions removed — the In-the-studio chat strip + greeting already cover who's around.)
  const subtitle = (() => {
    const parts = [];
    if (myToday.length > 0) {
      parts.push(`${myToday.length} ${myToday.length === 1 ? 'class' : 'classes'}`);
    }
    if (myFohToday.length > 0) {
      parts.push('FOH shift');
    }
    return parts.length > 0 ? parts.join(' · ') : 'A quiet day — nothing on your schedule';
  })();

  // This week's stats (Mon → Sun, UK convention)
  const dow = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  const myWeekClasses = data.classes
    .filter(c => c.coachId === currentUser.id && c.date >= weekStartIso && c.date <= weekEndIso);
  const myWeekCount = myWeekClasses.length;
  const sessionRate = currentUser.sessionRatePence || 3000;
  const weeklyEarningsPence = sessionRate * myWeekCount;
  const showEarnings = isCoach && myWeekCount > 0;

  // Shifts/classes needing cover THIS WEEK (system-wide, glanceable stat)
  // Counts open + pending cover requests whose class falls within the current week.
  const weekCoverNeeded = (data.coverRequests || []).filter(r => {
    if (r.status !== 'open' && r.status !== 'pending') return false;
    const cls = data.classes.find(c => c.id === r.classId);
    return cls && cls.date >= weekStartIso && cls.date <= weekEndIso;
  }).length;

  // Up next — first future class today
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upNext = myToday.find(c => {
    if (!c.time) return false;
    const [h, m] = c.time.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });

  let upNextCountdown = null;
  if (upNext) {
    const [h, m] = upNext.time.split(':').map(Number);
    const minsAway = (h * 60 + m) - nowMinutes;
    if (minsAway <= 60) upNextCountdown = `Starts in ${minsAway} min`;
    else if (minsAway < 240) {
      const hrs = Math.floor(minsAway / 60);
      const restMin = minsAway % 60;
      upNextCountdown = restMin > 0 ? `In ${hrs}h ${restMin}m` : `In ${hrs}h`;
    }
  }

  // Birthdays today (other users) — date_of_birth stored as YYYY-MM-DD
  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const birthdaysToday = data.users
    .filter(u => u.id !== currentUser.id && u.dateOfBirth && typeof u.dateOfBirth === 'string'
            && u.dateOfBirth.slice(5) === todayMD);

  // Class accent color
  const classColor = (cls) => {
    const meta = (CLASS_TYPES && CLASS_TYPES[cls.type]) || {};
    return meta.color || COLOR.amber;
  };

  const studioLabel = (s) => {
    if (s === 'reformer') return 'Reformer studio';
    if (s === 'hybrid')   return 'Hybrid studio';
    return 'Studio';
  };

  return (
    <div style={{ padding: '0' }}>
      {/* Subtitle stats — quick today summary */}
      {subtitle && subtitle !== 'A quiet day — nothing on your schedule' && (
        <div style={{
          fontFamily: COLOR.serif, fontStyle: 'italic',
          fontSize: 14, color: COLOR.brown,
          marginBottom: 16, lineHeight: 1.4,
          padding: '0 4px',
        }}>
          {subtitle}
        </div>
      )}

      {/* This week's stats — only for coaches with classes. Order: classes → earnings → cover needed. */}
      {showEarnings && (
        <div style={{
          padding: '14px 16px', marginBottom: 16,
          border: `1px solid ${COLOR.bone}`, borderRadius: 14,
          background: COLOR.cream,
        }}>
          <div style={{ ...TYPE.eyebrow, marginBottom: 10 }}>This week</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            {/* Classes */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontFamily: COLOR.serif, fontSize: 22, color: COLOR.forest, lineHeight: 1, letterSpacing: '-0.015em' }}>
                {myWeekCount}
              </div>
              <div style={{ fontSize: 10, color: COLOR.taupe, marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {myWeekCount === 1 ? 'Class' : 'Classes'}
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: COLOR.bone }} />
            {/* Earnings */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ fontFamily: COLOR.serif, fontSize: 22, color: COLOR.forest, lineHeight: 1, letterSpacing: '-0.015em' }}>
                £{Math.round(weeklyEarningsPence / 100).toLocaleString('en-GB')}
              </div>
              <div style={{ fontSize: 10, color: COLOR.taupe, marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Estimated
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: COLOR.bone }} />
            {/* Cover needed this week (system-wide) */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{
                fontFamily: COLOR.serif, fontSize: 22, lineHeight: 1, letterSpacing: '-0.015em',
                color: weekCoverNeeded > 0 ? COLOR.coral : COLOR.forest,
              }}>
                {weekCoverNeeded}
              </div>
              <div style={{ fontSize: 10, color: COLOR.taupe, marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Need cover
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rest of today's classes — condensed list, only if more than one class today */}
      {upNext && myToday.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...TYPE.eyebrow, marginBottom: 10 }}>Also today</div>
          <div style={{ paddingLeft: 4 }}>
            {myToday.filter(c => c.id !== upNext.id).map(c => (
              <button
                key={c.id}
                onClick={() => onClassClick?.(c.id)}
                className="salus-btn"
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left',
                  padding: '10px 0',
                  borderBottom: `1px solid ${COLOR.bone}`,
                  background: 'transparent', border: 'none',
                  fontSize: 13, color: COLOR.brown,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <span>{c.type}</span>
                <span style={{ color: COLOR.taupe, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{c.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's classes when no "up next" (all past, or none today) */}
      {!upNext && myToday.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...TYPE.eyebrow, marginBottom: 10 }}>Today</div>
          <div style={{
            padding: '14px 16px', background: COLOR.sand, borderRadius: 12,
          }}>
            <div style={{ fontSize: 13, color: COLOR.brown, fontStyle: 'italic' }}>
              All {myToday.length} {myToday.length === 1 ? 'class is' : 'classes are'} done. Nice.
            </div>
          </div>
        </div>
      )}

      {/* Birthdays */}
      {birthdaysToday.map(u => (
        <div key={u.id} style={{
          padding: '12px 14px', marginBottom: 12,
          background: '#f0ede0', borderRadius: 10,
          fontSize: 13, color: COLOR.brown, lineHeight: 1.5,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <span>It's <strong>{u.name?.split(' ')[0]}</strong>'s birthday today — say hi when you see {u.name?.split(' ')[0]}.</span>
        </div>
      ))}
    </div>
  );
}

function Home({ data, currentUser, isManager, onReload, onClassClick, onRequestCover, onHireStudio, onClaim, onExpressInterest, onViewAllCover, onViewChat, onCreateTask, onOpenTask, onOpenAllTasks, onOpenTour, onCreateMaintenance, onOpenMaintenance, onCreateFeedback, onOpenFeedback, onMarkBroadcastRead }) {
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

  // Widget config — fallback to role-appropriate defaults
  const defaultWidgets = isManager ? DEFAULT_WIDGETS_MANAGER : DEFAULT_WIDGETS_STAFF;
  const rawWidgets = currentUser.homeWidgets && currentUser.homeWidgets.length > 0
    ? currentUser.homeWidgets
    : defaultWidgets;
  // Filter out manager-only widgets if the user is currently in staff mode
  const widgets = rawWidgets.filter(key => {
    const meta = ALL_WIDGETS.find(w => w.key === key);
    if (meta?.managerOnly && !isManager) return false;
    return true;
  });
  const has = (key) => widgets.includes(key);
  const [showCustomize, setShowCustomize] = useState(false);

  // Brand photos rotate — only used if manager AND no personal photo set
  const brandPhoto = useMemo(() => {
    const photos = ['/brand/cardio.jpg', '/brand/reformer.jpg', '/brand/exterior.jpg', '/brand/sign.jpg'];
    return photos[Math.floor(Math.random() * photos.length)];
  }, []);

  // Photo to show on Home — personal upload wins, otherwise brand rotation for managers, else nothing
  const homePhoto = currentUser.homePhotoUrl
    ? currentUser.homePhotoUrl
    : (isManager ? brandPhoto : null);

  return (
    <div className="salus-home-bleed" style={styles.homePageBackdrop}>
      {/* Editorial hero — big photo, greeting overlay, next class overlay */}
      <HomeHero
        data={data}
        currentUser={currentUser}
        isManager={isManager}
        brandPhoto={brandPhoto}
        onClassClick={onClassClick}
      />

      {/* My Day summary — keeps stats, birthdays. Greeting + Up next now in hero */}
      <MyDayHero
        data={data}
        currentUser={currentUser}
        isManager={isManager}
        onClassClick={onClassClick}
      />

      {/* Manager broadcasts — urgent comms */}
      <BroadcastBanner
        broadcasts={data.broadcasts || []}
        broadcastReads={data.broadcastReads || []}
        currentUser={currentUser}
        onMarkRead={onMarkBroadcastRead}
      />

      {/* Render widgets in user's chosen order */}
      {widgets.map(widgetKey => {
        switch (widgetKey) {
          case 'cover': return (
            <HomeTile
              key="cover"
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
          );

          case 'upcoming': return (
            <HomeTile
              key="upcoming"
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
          );

          case 'tours': return <ToursTile key="tours" data={data} currentUser={currentUser} onOpenTour={onOpenTour} />;
          case 'tasks': return <TasksTile key="tasks" data={data} currentUser={currentUser} isManager={isManager} onCreate={onCreateTask} onOpenTask={onOpenTask} onOpenAll={onOpenAllTasks} />;

          case 'request_cover': return (
            <button key="request_cover" onClick={onRequestCover} style={styles.homeRequestCard} className="salus-btn">
              <div style={styles.homeRequestIcon}><Plus size={18} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={styles.homeRequestTitle}>
                  {isManager ? 'Post a shift for cover' : 'I need cover for one of my classes'}
                </div>
                <div style={styles.homeRequestSub}>Your team will see it instantly</div>
              </div>
            </button>
          );

          case 'hire_studio': return (
            <button key="hire_studio" onClick={onHireStudio} style={styles.homeHireCard} className="salus-btn">
              <div style={styles.homeHireIcon}><Calendar size={18} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={styles.homeRequestTitle}>Hire a studio</div>
                <div style={styles.homeRequestSub}>For a 1:1 session or private event</div>
              </div>
            </button>
          );

          case 'total_hours':  return null; // removed — "This week" stats now cover this
          case 'quote':        return <QuoteWidget key="quote" />;
          case 'chat_preview': return null; // removed — chat lives in its own tab
          default: return null;
        }
      })}

      {/* Customize home — prominent link at the bottom */}
      <button onClick={() => setShowCustomize(true)} className="salus-btn" style={{
        marginTop: 32, marginBottom: 8, width: '100%',
        padding: '14px 18px',
        background: 'transparent', border: '1px solid #efe7d2', borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: '#5c4a38', fontSize: 12, fontWeight: 500,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: 'inherit', cursor: 'pointer',
      }}>
        <SettingsIcon size={14} />
        Customize home
      </button>

      {/* Customize modal */}
      {showCustomize && (
        <CustomizeHomeModal
          currentWidgets={widgets}
          isManager={isManager}
          currentUser={currentUser}
          onReload={onReload}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  );
}

// ─── Total Hours widget ──────────────────────────────────────────────────
function TotalHoursWidget({ data, currentUser }) {
  // Calculate this week's hours: classes (45min default) + FOH shifts
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(today); monday.setDate(today.getDate() - dayOfWeek); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
  const isoMon = monday.toISOString().slice(0, 10);
  const isoSun = sunday.toISOString().slice(0, 10);

  // Class hours
  const myClasses = (data.classes || []).filter(c =>
    c.coachId === currentUser.id && c.date >= isoMon && c.date <= isoSun
  );
  const classHours = myClasses.reduce((sum, c) => sum + (c.dur || 45) / 60, 0);

  // FOH shift hours
  const myShifts = (data.shifts || []).filter(s =>
    s.userId === currentUser.id && s.date >= isoMon && s.date <= isoSun
  );
  const shiftHours = myShifts.reduce((sum, s) => {
    if (!s.startTime || !s.endTime) return sum;
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  }, 0);

  const total = classHours + shiftHours;

  return (
    <div style={{ ...styles.tile, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: '#fef0d8', color: '#c6926a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            This week's hours
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, color: '#1a2620' }}>
              {total.toFixed(1)}
            </div>
            <div style={{ fontSize: 13, color: '#7a8270' }}>hours</div>
          </div>
          <div style={{ fontSize: 11, color: '#a59478', marginTop: 2 }}>
            {classHours > 0 && `${classHours.toFixed(1)}h teaching`}
            {classHours > 0 && shiftHours > 0 && ' · '}
            {shiftHours > 0 && `${shiftHours.toFixed(1)}h FOH`}
            {total === 0 && 'Nothing scheduled'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Daily quote widget ──────────────────────────────────────────────────
const QUOTES = [
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Movement is a medicine for creating change in a person's physical, emotional, and mental states.", author: "Carol Welch" },
  { text: "Pilates is complete coordination of body, mind, and spirit.", author: "Joseph Pilates" },
  { text: "Change happens through movement and movement heals.", author: "Joseph Pilates" },
  { text: "A few well-designed movements, properly performed in a balanced sequence, are worth hours of doing sloppy calisthenics.", author: "Joseph Pilates" },
  { text: "Strength does not come from the body. It comes from the will.", author: "Mahatma Gandhi" },
  { text: "Be kind to yourself. Push your limits but listen to your body.", author: "Unknown" },
  { text: "Every expert was once a beginner.", author: "Helen Hayes" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Wellness is not a state of being, it is a way of doing.", author: "Unknown" },
  { text: "The groundwork for all happiness is good health.", author: "Leigh Hunt" },
];
function QuoteWidget() {
  // Stable across the day — pick based on day of year
  const dayOfYear = Math.floor((Date.now() / 86400000)) % QUOTES.length;
  const q = QUOTES[dayOfYear];
  return (
    <div style={{
      ...styles.tile, padding: 16,
      background: '#fef7e8', borderColor: '#efe7d2',
    }}>
      <div style={{ fontSize: 11, color: '#a59478', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Quote of the day
      </div>
      <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 16, color: '#1a2620', lineHeight: 1.4, fontStyle: 'italic' }}>
        "{q.text}"
      </div>
      <div style={{ fontSize: 11, color: '#7a8270', marginTop: 8 }}>— {q.author}</div>
    </div>
  );
}

// ─── Chat preview widget ─────────────────────────────────────────────────
function ChatPreviewWidget({ data, currentUser, onViewChat }) {
  const recent = [...(data.messages || [])]
    .filter(m => m.userId !== currentUser.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 3);

  if (recent.length === 0) {
    return (
      <div style={{ ...styles.tile, padding: 16 }}>
        <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Team chat
        </div>
        <div style={{ fontSize: 13, color: '#a59478' }}>No messages yet.</div>
      </div>
    );
  }

  return (
    <button onClick={onViewChat} className="salus-btn" style={{ ...styles.tile, padding: 16, textAlign: 'left', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Team chat
        </div>
        <ChevronRight size={14} color="#a59478" />
      </div>
      {recent.map((m, idx) => {
        const author = (data.users || []).find(u => u.id === m.userId);
        return (
          <div key={m.id} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            paddingTop: idx > 0 ? 8 : 0, paddingBottom: 8,
            borderTop: idx > 0 ? '1px solid #efe7d2' : 'none',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: '#e8ede0', color: '#7a8c5c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>{(author?.name || '?').slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2620' }}>{author?.name || 'Unknown'}</div>
              <div style={{
                fontSize: 12, color: '#7a8270', marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
              }}>{m.text}</div>
            </div>
          </div>
        );
      })}
    </button>
  );
}

// ─── Widget registry — used by the customize modal ───
// Groups: 'attention' (urgent today) | 'day' (your day) | 'actions' (quick actions) | 'extras'
// managerOnly: true means this widget is hidden from non-manager staff entirely
const ALL_WIDGETS = [
  { key: 'cover',         group: 'attention', label: 'Cover requests',        Icon: CoverIcon,     desc: 'Classes and shifts that need cover' },
  { key: 'tasks',         group: 'attention', label: 'Tasks',                 Icon: ListChecks,    desc: 'Your task list',                              managerOnly: true },
  { key: 'upcoming',      group: 'day',       label: 'Your upcoming classes', Icon: Calendar,      desc: 'Your next teaching slots' },
  { key: 'tours',         group: 'day',       label: 'Tours',                 Icon: MapPin,        desc: 'Upcoming tours from Google Calendar',         managerOnly: true },
  { key: 'request_cover', group: 'actions',   label: 'Request cover',         Icon: Plus,          desc: 'Quick button to post a cover request' },
  { key: 'hire_studio',   group: 'actions',   label: 'Hire a studio',         Icon: Building2,     desc: 'Quick button to book the studio' },
  { key: 'quote',         group: 'extras',    label: 'Quote of the day',      Icon: Quote,         desc: 'A different quote each day' },
];

const DEFAULT_WIDGETS_MANAGER = ['cover', 'upcoming', 'tours', 'tasks', 'request_cover', 'hire_studio'];
const DEFAULT_WIDGETS_STAFF   = ['upcoming', 'request_cover', 'hire_studio'];

const WIDGET_GROUPS = [
  { key: 'attention', label: 'Needs your attention' },
  { key: 'day',       label: 'Your day' },
  { key: 'actions',   label: 'Quick actions' },
  { key: 'extras',    label: 'Extras' },
];

// ─── Customize Home modal ────────────────────────────────────────────────
function CustomizeHomeModal({ currentWidgets, isManager, currentUser, onReload, onClose }) {
  // Start from server state; every change auto-saves so the home updates immediately.
  const [selected, setSelected] = useState(() => Array.isArray(currentWidgets) ? [...currentWidgets] : []);
  const [savingKey, setSavingKey] = useState(null);

  const persist = async (nextSelected) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ home_widgets: nextSelected })
        .eq('id', currentUser.id);
      if (error) throw error;
      // Force a reload so the Home page picks up the new widgets immediately —
      // realtime can lag a beat.
      if (onReload) await onReload(true);
    } catch (e) {
      alert('Could not save: ' + (e.message || e));
    }
  };

  const add = async (key) => {
    setSavingKey(key);
    const next = [...selected, key];
    setSelected(next);
    await persist(next);
    setSavingKey(null);
  };
  const remove = async (key) => {
    setSavingKey(key);
    const next = selected.filter(k => k !== key);
    setSelected(next);
    await persist(next);
    setSavingKey(null);
  };
  const moveUp = async (key) => {
    const i = selected.indexOf(key);
    if (i <= 0) return;
    const next = [...selected];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setSelected(next);
    await persist(next);
  };
  const moveDown = async (key) => {
    const i = selected.indexOf(key);
    if (i < 0 || i >= selected.length - 1) return;
    const next = [...selected];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    setSelected(next);
    await persist(next);
  };

  // Filter out manager-only widgets for non-managers
  const availableWidgets = ALL_WIDGETS.filter(w => isManager || !w.managerOnly);
  const inactive = availableWidgets.filter(w => !selected.includes(w.key));

  // ─── Home photo upload ─────────────────────────────────────────────
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const uploadHomePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Photo too large (8MB max).');
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      // Remove previous photo if any
      if (currentUser.homePhotoPath) {
        await supabase.storage.from('home-photos').remove([currentUser.homePhotoPath]);
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('home-photos').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('home-photos').getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      const { error: updErr } = await supabase.from('profiles').update({
        home_photo_url: publicUrl,
        home_photo_path: path,
      }).eq('id', currentUser.id);
      if (updErr) throw updErr;
      onReload?.(true);
    } catch (err) {
      console.error('home photo upload:', err);
      setPhotoError(err.message || 'Upload failed');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeHomePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      if (currentUser.homePhotoPath) {
        await supabase.storage.from('home-photos').remove([currentUser.homePhotoPath]);
      }
      const { error: updErr } = await supabase.from('profiles').update({
        home_photo_url: null,
        home_photo_path: null,
      }).eq('id', currentUser.id);
      if (updErr) throw updErr;
      onReload?.(true);
    } catch (err) {
      console.error('home photo remove:', err);
      setPhotoError(err.message || 'Remove failed');
    } finally {
      setPhotoBusy(false);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(26, 38, 32, 0.55)',
        touchAction: 'none',
      }} />

      {/* Full-viewport sheet */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Settings"
          title="Customize home"
          subtitle="Pick what you want to see. Saves automatically."
          onClose={onClose}
        />

        <ModalBody>
          {/* Personal home photo */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#a59478', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
              Home photo
            </div>
            {currentUser.homePhotoUrl ? (
              <div style={{
                position: 'relative', borderRadius: 14, overflow: 'hidden',
                height: 140, background: COLOR.sand,
              }}>
                <img src={currentUser.homePhotoUrl} alt="Home photo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button onClick={removeHomePhoto} disabled={photoBusy} className="salus-btn"
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(26, 38, 32, 0.7)', color: COLOR.cream,
                    border: 'none', borderRadius: 999, padding: '6px 14px',
                    fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
                    textTransform: 'uppercase', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {photoBusy ? '…' : 'Remove'}
                </button>
              </div>
            ) : (
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 110, gap: 6,
                background: COLOR.sand, borderRadius: 12,
                border: `1px dashed ${COLOR.shell}`, cursor: photoBusy ? 'wait' : 'pointer',
              }}>
                <div style={{ fontSize: 24, color: COLOR.brown }}>📷</div>
                <div style={{ ...TYPE.capsLabel, color: COLOR.brown }}>
                  {photoBusy ? 'Uploading…' : 'Add a personal photo'}
                </div>
                <div style={{ ...TYPE.metaSmall, color: COLOR.taupe }}>
                  Optional · Shows at the top of your Home
                </div>
                <input type="file" accept="image/*" capture="environment"
                  onChange={uploadHomePhoto} disabled={photoBusy} style={{ display: 'none' }} />
              </label>
            )}
            {photoError && (
              <div style={{
                marginTop: 8, padding: 10, background: '#fef0ec', color: COLOR.coral,
                borderRadius: 8, fontSize: 12,
              }}>{photoError}</div>
            )}
          </div>

          {/* Active widgets in order */}
          {selected.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#a59478', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                On your home
              </div>
              <div style={{ marginBottom: 28 }}>
                {selected.map((key, idx) => {
                  const w = ALL_WIDGETS.find(x => x.key === key);
                  if (!w) return null;
                  const isBusy = savingKey === key;
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '14px 0',
                      borderBottom: idx < selected.length - 1 ? '1px solid #efe7d2' : 'none',
                      opacity: isBusy ? 0.5 : 1,
                    }}>
                      <w.Icon size={18} color="#5c4a38" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#1a2620', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.label}
                      </div>
                      <button onClick={() => moveUp(key)} disabled={idx === 0 || isBusy} className="salus-btn"
                        style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: 'none', opacity: idx === 0 ? 0.25 : 1, color: '#7a8270', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }} aria-label="Move up">↑</button>
                      <button onClick={() => moveDown(key)} disabled={idx === selected.length - 1 || isBusy} className="salus-btn"
                        style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: 'none', opacity: idx === selected.length - 1 ? 0.25 : 1, color: '#7a8270', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }} aria-label="Move down">↓</button>
                      <button onClick={() => remove(key)} disabled={isBusy} className="salus-btn"
                        style={{ background: 'transparent', border: 'none', padding: '6px 4px', color: '#c8442a', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Available to add — grouped by category */}
          {inactive.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#a59478', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Add a widget
              </div>
              {WIDGET_GROUPS.map(group => {
                const groupInactive = inactive.filter(w => w.group === group.key);
                if (groupInactive.length === 0) return null;
                return (
                  <div key={group.key} style={{ marginTop: 20 }}>
                    <div style={{
                      fontFamily: '"Playfair Display", serif', fontSize: 14,
                      color: '#5c4a38', fontStyle: 'italic',
                      padding: '0 0 6px',
                      borderBottom: '1px solid #efe7d2',
                      marginBottom: 4,
                    }}>
                      {group.label}
                    </div>
                    {groupInactive.map((w, idx) => {
                      const isBusy = savingKey === w.key;
                      return (
                        <div key={w.key} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 0',
                          borderBottom: idx < groupInactive.length - 1 ? '1px solid #efe7d2' : 'none',
                          opacity: isBusy ? 0.5 : 1,
                        }}>
                          <w.Icon size={18} color="#a59478" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, color: '#1a2620', letterSpacing: '-0.005em' }}>{w.label}</div>
                            <div style={{ fontSize: 11, color: '#a59478', marginTop: 2 }}>{w.desc}</div>
                          </div>
                          <button onClick={() => add(w.key)} disabled={isBusy} className="salus-btn"
                            style={{
                              padding: '8px 16px', borderRadius: 999,
                              background: '#1a2620', color: '#fffdf7', border: 'none',
                              fontSize: 12, fontWeight: 500, letterSpacing: '0.04em',
                              flexShrink: 0,
                            }}>
                            {isBusy ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {selected.length === 0 && inactive.length === 0 && (
            <EmptyState>No widgets available.</EmptyState>
          )}
        </ModalBody>

        <ModalFooter>
          <button onClick={onClose} className="salus-btn" style={{
            ...styles.btnPrimary, width: '100%', justifyContent: 'center',
            padding: '14px 22px', fontSize: 14,
          }}>
            Done
          </button>
        </ModalFooter>
      </div>
    </>,
    document.body
  );
}

// ─── LoadingLogo — animated brand logo for loading states ───
// Slow breathing pulse animation — feels on-brand for wellness (like breath cycles).
// ─── CloseButton — universal modal close, used on every sheet ───────────
function CloseButton({ onClick, variant }) {
  const dark = variant === 'dark';
  return (
    <button
      onClick={onClick}
      className="salus-btn"
      aria-label="Close"
      style={{
        background: dark ? 'rgba(255, 253, 247, 0.08)' : '#f5f1e8',
        border: `1px solid ${dark ? 'rgba(255, 253, 247, 0.3)' : '#d4cdb8'}`,
        borderRadius: '50%',
        width: 38, height: 38, padding: 0,
        color: dark ? '#fffdf7' : '#1a2620',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 400, lineHeight: 1, flexShrink: 0,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      ×
    </button>
  );
}

function LoadingLogo() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f1e8', fontFamily: "'Inter', sans-serif",
      flexDirection: 'column', gap: 24,
      zIndex: 1,
    }}>
      <style>{`
        @keyframes salus-breathe {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.12); opacity: 1; }
        }
      `}</style>
      <div style={{
        width: 64, height: 64,
        animation: 'salus-breathe 4.5s ease-in-out infinite',
      }}>
        <img
          src="https://cdn.prod.website-files.com/66803175747777a7dd2956e8/668c04b49ff0954ea73d39ef_download-compresskaru.com.png"
          alt="Salus House"
          style={{
            width: '100%', height: '100%',
            objectFit: 'contain',
            filter: 'brightness(0) invert(0.25)',
          }}
        />
      </div>
      <div style={{
        fontSize: 10, fontWeight: 500, color: '#a59478',
        letterSpacing: 3, textTransform: 'uppercase',
      }}>
        Salus House
      </div>
    </div>
  );
}

// ─── Eyebrow — small caps label above a title ───────────────────────────
function Eyebrow({ children, style }) {
  return <div style={{ ...TYPE.eyebrow, ...style }}>{children}</div>;
}

// ─── PageHeader — top of every major page (Home, Admin, Schedule, etc.) ──
function PageHeader({ eyebrow, title, subtitle, photo, compact, action }) {
  return (
    <div style={{ padding: compact ? '4px 0 10px' : '8px 0 18px' }}>
      {photo && (
        <div style={{
          height: 120, borderRadius: 18, overflow: 'hidden',
          backgroundImage: `url(${photo})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          marginBottom: 18, position: 'relative',
          boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(26, 38, 32, 0.0) 0%, rgba(26, 38, 32, 0.35) 100%)',
          }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow && <Eyebrow style={{ marginBottom: compact ? 4 : 6 }}>{eyebrow}</Eyebrow>}
          <div style={compact ? TYPE.pageTitleSm : TYPE.pageTitle}>{title}</div>
          {subtitle && (
            <div style={{ ...TYPE.bodySub, marginTop: 6 }}>{subtitle}</div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

// ─── ModalHeader — top of every full-screen modal ────────────────────────
// Eyebrow + title + subtitle + close button. Pads for iOS safe area.
function ModalHeader({ eyebrow, title, subtitle, onClose, variant }) {
  const dark = variant === 'dark';
  return (
    <div style={{
      padding: '14px 22px',
      paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
      borderBottom: `1px solid ${dark ? 'rgba(255, 253, 247, 0.1)' : COLOR.bone}`,
      flexShrink: 0,
      background: dark ? COLOR.forest : COLOR.cream,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow && (
            <div style={{
              ...TYPE.eyebrow,
              color: dark ? 'rgba(255, 253, 247, 0.5)' : COLOR.taupe,
              marginBottom: 4,
            }}>{eyebrow}</div>
          )}
          <div style={{
            ...TYPE.modalTitle,
            color: dark ? COLOR.cream : COLOR.forest,
          }}>{title}</div>
          {subtitle && (
            <div style={{
              ...TYPE.bodySub,
              color: dark ? 'rgba(255, 253, 247, 0.65)' : COLOR.moss,
              marginTop: 4,
            }}>{subtitle}</div>
          )}
        </div>
        <CloseButton onClick={onClose} variant={dark ? 'dark' : undefined} />
      </div>
    </div>
  );
}

// ─── ModalFooter — sticky bottom of a full-screen modal ──────────────────
function ModalFooter({ children, dark }) {
  return (
    <div style={{
      padding: '14px 22px',
      paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      borderTop: `1px solid ${dark ? 'rgba(255, 253, 247, 0.1)' : COLOR.bone}`,
      background: dark ? COLOR.forest : COLOR.cream,
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

// ─── ModalBody — the scrollable middle of a full-screen modal ───────────
function ModalBody({ children, style }) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
      padding: '18px 22px 22px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── SectionDivider — eyebrow caps + thin underline used between sections ─
function SectionDivider({ children, style }) {
  return (
    <div style={{
      ...TYPE.eyebrow,
      marginTop: 18, marginBottom: 8, padding: '0 2px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── SectionLabel — italic Playfair section label (day groupings etc) ────
function SectionLabel({ children, style }) {
  return (
    <div style={{
      ...TYPE.sectionLabel,
      padding: '0 0 6px',
      borderBottom: `1px solid ${COLOR.bone}`,
      marginBottom: 4,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── EmptyState — Playfair italic centered, used for empty lists ─────────
function EmptyState({ children, sub, style }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', ...style }}>
      <div style={TYPE.emptyState}>{children}</div>
      {sub && <div style={{ ...TYPE.metaSmall, marginTop: 8 }}>{sub}</div>}
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
                color: urgent ? '#c8442a' : '#1a2620',
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


// ─── CoverPage — top-level cover board (own tab in bottom nav) ──────────
// Job-board aesthetic: each cover request is a card you can save, mark
// maybe-interested in, or take. Filterable by time-range.

const SAVED_COVERS_KEY = 'salus_saved_covers';
const MAYBE_COVERS_KEY = 'salus_maybe_covers';


// ─── CoverPage — job-board style cards for cover requests ────────────────
// Designed like job postings: each cover is a card with class details, pills
// for studio/duration, and per-card actions (Take it / Maybe / Heart-save).
// Sort + filter at the top, grouped sections beneath.
function CoverPage({ data, currentUser, isManager, onClassClick }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'thisWeek' | 'nextWeek' | 'saved' | 'mine'
  const [sortBy, setSortBy] = useState('soonest'); // 'soonest' | 'newest'

  // Locally-stored bookmarks
  const [savedIds, setSavedIds] = useState(() => {
    if (typeof localStorage === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_COVERS_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [maybeIds, setMaybeIds] = useState(() => {
    if (typeof localStorage === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(MAYBE_COVERS_KEY) || '[]')); }
    catch { return new Set(); }
  });

  const toggleSaved = (id) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVED_COVERS_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  };
  const toggleMaybe = (id) => {
    setMaybeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(MAYBE_COVERS_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  };

  // Defensive
  const allClasses = data?.classes || [];
  const allUsers = data?.users || [];
  const allCovers = data?.coverRequests || [];

  // Hydrate cover requests with class + requester
  const hydrate = (r) => ({
    ...r,
    cls: allClasses.find(c => c.id === r.classId),
    requester: allUsers.find(u => u.id === r.requestedBy),
  });

  const allOpen = allCovers
    .filter(r => r.status === 'open' || r.status === 'pending')
    .map(hydrate)
    .filter(r => r.cls);

  const myRequests = allOpen.filter(r => r.requestedBy === currentUser.id);
  const openForMe = allOpen.filter(r => r.requestedBy !== currentUser.id);

  // Date filtering
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (today.getDay() + 6) % 7;
  const thisMon = new Date(today); thisMon.setDate(today.getDate() - dow);
  const thisSun = new Date(thisMon); thisSun.setDate(thisMon.getDate() + 6);
  const nextMon = new Date(thisMon); nextMon.setDate(thisMon.getDate() + 7);
  const nextSun = new Date(nextMon); nextSun.setDate(nextMon.getDate() + 6);
  const toIso = (d) => d.toISOString().slice(0, 10);

  const applyFilter = (list) => {
    if (filter === 'thisWeek') {
      return list.filter(r => r.cls.date >= toIso(thisMon) && r.cls.date <= toIso(thisSun));
    }
    if (filter === 'nextWeek') {
      return list.filter(r => r.cls.date >= toIso(nextMon) && r.cls.date <= toIso(nextSun));
    }
    if (filter === 'saved') {
      return list.filter(r => savedIds.has(r.id));
    }
    if (filter === 'mine') {
      return list.filter(r => r.requestedBy === currentUser.id);
    }
    return list;
  };

  const applySort = (list) => {
    const sorted = [...list];
    if (sortBy === 'newest') {
      sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else {
      sorted.sort((a, b) => (a.cls.date + ' ' + a.cls.time).localeCompare(b.cls.date + ' ' + b.cls.time));
    }
    return sorted;
  };

  // For staff: openForMe filtered + sorted
  // For manager: all pending (awaiting approval) + all open
  const visibleForStaff = applySort(applyFilter(openForMe));
  const pendingForManager = applySort(allOpen.filter(r => r.status === 'pending'));
  const openForManager = applySort(applyFilter(allOpen.filter(r => r.status === 'open')));

  // Card renderer
  const renderCard = (req) => {
    const cls = req.cls;
    const requester = req.requester;
    const isMine = req.requestedBy === currentUser.id;
    const isSaved = savedIds.has(req.id);
    const isMaybe = maybeIds.has(req.id);
    const studio = cls.studio === 'reformer' ? 'Reformer studio'
                  : cls.studio === 'hybrid' ? 'Hybrid studio' : 'Studio';

    // Date label
    const d = new Date(cls.date);
    const isToday = cls.date === toIso(today);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = cls.date === toIso(tomorrow);
    const dateLabel = isToday
      ? 'Today'
      : isTomorrow
      ? 'Tomorrow'
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    // Hours until class (for urgency)
    const classDateTime = new Date(`${cls.date}T${cls.time || '00:00'}`);
    const hoursUntil = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isUrgent = hoursUntil > 0 && hoursUntil < 24;

    return (
      <div key={req.id} style={{
        background: '#fffdf7',
        border: `1px solid ${isUrgent ? '#f0c8b8' : '#efe7d2'}`,
        borderRadius: 16,
        padding: '18px 18px 14px',
        marginBottom: 12,
      }}>
        {/* Top row: date + save heart */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: isUrgent ? '#c8442a' : '#5c4a38',
              letterSpacing: '0.04em',
            }}>
              {dateLabel} · {cls.time}
            </div>
            {isUrgent && (
              <div style={{
                fontSize: 9, fontWeight: 600, color: '#c8442a',
                background: '#fef0ec', border: '1px solid #f0c8b8',
                padding: '2px 8px', borderRadius: 999,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Urgent
              </div>
            )}
          </div>
          {!isMine && (
            <button onClick={() => toggleSaved(req.id)} className="salus-btn"
              style={{
                background: 'transparent', border: 'none', padding: 4,
                color: isSaved ? '#c8442a' : '#a59478', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}>
              <Heart size={18} fill={isSaved ? '#c8442a' : 'none'} strokeWidth={isSaved ? 0 : 1.8} />
            </button>
          )}
        </div>

        {/* Class title — Playfair, prominent */}
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 20, fontWeight: 500, color: '#1a2620',
          letterSpacing: '-0.01em', lineHeight: 1.2,
          marginBottom: 12,
        }}>
          {cls.type}
        </div>

        {/* Pills/tags — studio, duration, status */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginBottom: 14,
        }}>
          <span style={pillStyle}>{studio}</span>
          {cls.durationMin && <span style={pillStyle}>{cls.durationMin} min</span>}
          {req.status === 'pending' && (
            <span style={{ ...pillStyle, background: '#fef0ec', color: '#c8442a', borderColor: '#f0c8b8' }}>
              Awaiting approval
            </span>
          )}
        </div>

        {/* Requester row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: isMine ? 6 : 14,
          paddingTop: 12,
          borderTop: '1px solid #f5ecd6',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14,
            background: '#f5f1e8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 500, color: '#5c4a38',
            flexShrink: 0,
          }}>
            {requester?.name?.charAt(0) || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#1a2620', fontWeight: 500 }}>
              {isMine ? 'You' : (requester?.name || 'Unknown')}
            </div>
            <div style={{ fontSize: 11, color: '#a59478', marginTop: 1 }}>
              {isMine ? 'asked for cover' : 'needs cover'}
              {req.reason && ` · ${req.reason}`}
            </div>
          </div>
        </div>

        {/* Action row — Take it / Maybe (only when not own request) */}
        {!isMine && req.status === 'open' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onClassClick?.(cls.id)} className="salus-btn"
              style={{
                flex: 1, padding: '11px 16px',
                background: '#1a2620', color: '#fffdf7',
                border: 'none', borderRadius: 999,
                fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
              }}>
              Take it
            </button>
            <button onClick={() => toggleMaybe(req.id)} className="salus-btn"
              style={{
                flex: 1, padding: '11px 16px',
                background: isMaybe ? '#5c4a38' : 'transparent',
                color: isMaybe ? '#fffdf7' : '#5c4a38',
                border: `1px solid ${isMaybe ? '#5c4a38' : '#d4cdb8'}`,
                borderRadius: 999,
                fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
              }}>
              {isMaybe ? '✓ Maybe' : 'Maybe'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const totalCount = isManager
    ? (pendingForManager.length + openForManager.length)
    : (openForMe.length);
  const countLabel = `${totalCount} ${totalCount === 1 ? 'cover' : 'covers'}`;

  return (
    <>
      {/* Header — count + sort */}
      <div style={{ padding: '10px 4px 18px' }}>
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 24, fontWeight: 500, color: '#1a2620',
          letterSpacing: '-0.015em', lineHeight: 1.2,
        }}>
          {countLabel}
        </div>
        <div style={{ fontSize: 13, color: '#7a8270', marginTop: 4 }}>
          {totalCount === 0
            ? 'All quiet — no cover needed right now.'
            : isManager
            ? 'Manage requests and help your team find cover.'
            : 'Open shifts waiting to be taken.'}
        </div>
      </div>

      {/* Filter chips */}
      {totalCount > 0 && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12,
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', padding: '0 4px 4px',
        }}>
          {[
            ['all', 'All'],
            ['thisWeek', 'This week'],
            ['nextWeek', 'Next week'],
            ['saved', `Saved${savedIds.size > 0 ? ` (${savedIds.size})` : ''}`],
            ['mine', 'My requests'],
          ].map(([key, label]) => {
            const isActive = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} className="salus-btn"
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  background: isActive ? '#1a2620' : 'transparent',
                  border: `1px solid ${isActive ? '#1a2620' : '#d4cdb8'}`,
                  borderRadius: 999,
                  fontSize: 11, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fffdf7' : '#5c4a38',
                  letterSpacing: '0.04em',
                  fontFamily: 'inherit', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Sort */}
      {totalCount > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 4px 18px',
        }}>
          <span style={{
            fontSize: 10, color: '#a59478', letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 600,
          }}>
            Sort by
          </span>
          <button onClick={() => setSortBy('soonest')} className="salus-btn"
            style={{
              background: 'transparent', border: 'none', padding: '2px 0',
              fontSize: 12, color: sortBy === 'soonest' ? '#1a2620' : '#a59478',
              fontWeight: sortBy === 'soonest' ? 600 : 500,
              textDecoration: sortBy === 'soonest' ? 'underline' : 'none',
              textUnderlineOffset: 4,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            Soonest first
          </button>
          <span style={{ color: '#d4cdb8' }}>·</span>
          <button onClick={() => setSortBy('newest')} className="salus-btn"
            style={{
              background: 'transparent', border: 'none', padding: '2px 0',
              fontSize: 12, color: sortBy === 'newest' ? '#1a2620' : '#a59478',
              fontWeight: sortBy === 'newest' ? 600 : 500,
              textDecoration: sortBy === 'newest' ? 'underline' : 'none',
              textUnderlineOffset: 4,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            Newest first
          </button>
        </div>
      )}

      {/* Manager pending queue */}
      {isManager && pendingForManager.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Awaiting approval</SectionLabel>
          {pendingForManager.map(renderCard)}
        </div>
      )}

      {/* Body */}
      {isManager ? (
        openForManager.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <SectionLabel>Open on the board</SectionLabel>
            {openForManager.map(renderCard)}
          </div>
        )
      ) : (
        visibleForStaff.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {visibleForStaff.map(renderCard)}
          </div>
        )
      )}

      {/* Your own requests — staff only, since manager sees all in main list */}
      {!isManager && myRequests.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Your requests</SectionLabel>
          {myRequests.map(renderCard)}
        </div>
      )}

      {/* Empty state */}
      {totalCount === 0 && (
        <EmptyState sub="When a teammate needs cover, it'll show up here.">
          No cover needed right now.
        </EmptyState>
      )}
    </>
  );
}

const pillStyle = {
  fontSize: 11, fontWeight: 500,
  color: '#5c4a38',
  background: '#f5f1e8',
  border: '1px solid #efe7d2',
  borderRadius: 999,
  padding: '4px 10px',
  letterSpacing: '0.02em',
};


// ─── StaffScheduleView — purpose-built ───────────────────────────────────
// Inspired by the calendar-pill design: each day is a rounded rectangle
// showing class count on top, day number below. Selected day filled forest.
// Toggleable. Cover-needed surfaced by bottom-nav badge + coral indicators.
function StaffScheduleView({ data, currentUser, onClassClick }) {
  const [view, setView] = useState('mine'); // 'mine' | 'everyone' | 'hire'

  // Defensive
  const allClasses = data?.classes || [];
  const allUsers = data?.users || [];
  const allCovers = data?.coverRequests || [];
  const allBookings = data?.bookings || [];

  // selectedDate drives both the month grid and the week shown below
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [selectedDate, setSelectedDate] = useState(today);

  const toIso = (d) => d.toISOString().slice(0, 10);
  const todayIso = toIso(today);
  const selectedIso = toIso(selectedDate);

  // Week containing selectedDate (Monday start)
  const dow = (selectedDate.getDay() + 6) % 7;
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - dow);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekStartIso = toIso(weekDates[0]);
  const weekEndIso = toIso(weekDates[6]);

  // Cover requests (excluding own)
  const openCoversAll = allCovers
    .filter(r => r.status === 'open' && r.requestedBy !== currentUser.id)
    .map(r => ({ ...r, cls: allClasses.find(c => c.id === r.classId) }))
    .filter(r => r.cls);

  // Per-date metadata for month grid
  const dateMeta = useMemo(() => {
    const meta = {};
    allClasses.forEach(c => {
      if (!meta[c.date]) meta[c.date] = { mine: 0, others: 0, cover: 0 };
      if (c.coachId === currentUser.id) meta[c.date].mine++;
      else meta[c.date].others++;
      if (openCoversAll.some(r => r.cls.id === c.id)) meta[c.date].cover++;
    });
    return meta;
  }, [allClasses, currentUser.id, openCoversAll]);

  const classColor = (cls) => {
    const m = (CLASS_TYPES && CLASS_TYPES[cls.type]) || {};
    return m.color || '#c6926a';
  };

  const studioLabel = (s) => {
    if (s === 'reformer') return 'Reformer studio';
    if (s === 'hybrid') return 'Hybrid studio';
    return 'Studio';
  };

  const coachName = (id) => {
    const u = allUsers.find(u => u.id === id);
    return u?.name?.split(' ')[0] || '';
  };

  // Month grid — 6 rows × 7 cols always
  const monthYear = selectedDate.getFullYear();
  const monthIdx = selectedDate.getMonth();
  const firstOfMonth = new Date(monthYear, monthIdx, 1);
  const firstDow = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(monthYear, monthIdx + 1, 0).getDate();
  const gridCells = [];
  const prevMonthDays = new Date(monthYear, monthIdx, 0).getDate();
  for (let i = firstDow - 1; i >= 0; i--) {
    gridCells.push({ d: new Date(monthYear, monthIdx - 1, prevMonthDays - i), out: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    gridCells.push({ d: new Date(monthYear, monthIdx, i), out: false });
  }
  while (gridCells.length < 42) {
    const last = gridCells[gridCells.length - 1].d;
    const next = new Date(last); next.setDate(next.getDate() + 1);
    gridCells.push({ d: next, out: true });
  }

  const goPrevMonth = () => setSelectedDate(new Date(monthYear, monthIdx - 1, 1));
  const goNextMonth = () => setSelectedDate(new Date(monthYear, monthIdx + 1, 1));

  // Filter classes for the visible week
  // Convert items into a unified shape (class OR booking) for the timeline
  const classToItem = (c) => ({
    id: 'cls:' + c.id,
    kind: 'class',
    date: c.date,
    time: c.time,
    durationMin: c.durationMin,
    title: c.type,
    studio: c.studio,
    coachId: c.coachId,
    raw: c,
  });
  const bookingToItem = (b) => ({
    id: 'bkg:' + b.id,
    kind: 'booking',
    date: b.date,
    time: b.startTime,
    endTime: b.endTime,
    durationMin: (() => {
      if (!b.startTime || !b.endTime) return null;
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    })(),
    title: b.title || (b.bookingType === 'private_session' ? 'Private session' : 'Studio hire'),
    studio: b.studio,
    hirerName: b.hirerName,
    bookingType: b.bookingType,
    raw: b,
  });

  const visibleItems = (() => {
    const weekClasses = allClasses.filter(c => c.date >= weekStartIso && c.date <= weekEndIso).map(classToItem);
    const weekBookings = allBookings.filter(b => b.date >= weekStartIso && b.date <= weekEndIso).map(bookingToItem);

    if (view === 'hire') return weekBookings;
    if (view === 'mine') return weekClasses.filter(i => i.coachId === currentUser.id);
    // Everyone view: classes + hire bookings interleaved
    return [...weekClasses, ...weekBookings];
  })();

  const byDate = {};
  visibleItems.forEach(item => {
    if (!byDate[item.date]) byDate[item.date] = [];
    byDate[item.date].push(item);
  });
  Object.keys(byDate).forEach(d => byDate[d].sort((a, b) => (a.time || '').localeCompare(b.time || '')));

  const monthLabel = selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Stats for the selected day (for the pill below the calendar)
  const selectedDayClasses = (byDate[selectedIso] || []);
  const selectedDayMineCount = (allClasses.filter(c =>
    c.date === selectedIso && c.coachId === currentUser.id
  )).length;
  const isTodaySelected = selectedIso === todayIso;
  const selectedDayLabel = isTodaySelected
    ? 'today'
    : selectedDate.toLocaleDateString('en-GB', { weekday: 'long' });

  // Unified colour palette for this view:
  // forest #1a2620   primary text, time
  // moss   #7a8270   secondary text (subtitle, durations)
  // taupe  #a59478   tertiary / muted (day labels, out-of-month)
  // sand   #f5f1e8   recessed surface
  // bone   #efe7d2   border / divider
  // coral  #c8442a   ONLY for cover-needed status

  return (
    <>
      {/* Month grid — pill cells with count on top, day below */}
      <div style={{
        background: '#fffdf7',
        border: '1px solid #efe7d2',
        borderRadius: 16,
        padding: '16px 14px 14px',
        marginTop: 12,
        marginBottom: 18,
      }}>
          {/* Month nav */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14, padding: '0 4px',
          }}>
            <button onClick={goPrevMonth} className="salus-btn" style={{
              background: 'transparent', border: 'none', padding: 4,
              color: '#5c4a38', cursor: 'pointer',
            }}>
              <ChevronLeft size={18} />
            </button>
            <div style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 16, fontWeight: 500, color: '#1a2620',
              letterSpacing: '-0.005em',
            }}>
              {monthLabel}
            </div>
            <button onClick={goNextMonth} className="salus-btn" style={{
              background: 'transparent', border: 'none', padding: 4,
              color: '#5c4a38', cursor: 'pointer',
            }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {(monthYear !== today.getFullYear() || monthIdx !== today.getMonth()) && (
            <button onClick={() => setSelectedDate(today)} className="salus-btn" style={{
              background: 'transparent', border: 'none', padding: '0 0 10px',
              color: '#c8442a', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              fontFamily: 'inherit', cursor: 'pointer',
              display: 'block', margin: '0 auto',
            }}>
              ← Jump to today
            </button>
          )}

          {/* Weekday header */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4, marginBottom: 8,
          }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} style={{
                fontSize: 9, color: '#a59478',
                letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
                textAlign: 'center', padding: '2px 0',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells — pills */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
          }}>
            {gridCells.map((cell, idx) => {
              const iso = toIso(cell.d);
              const isToday = iso === todayIso;
              const isSelected = iso === selectedIso;
              const m = dateMeta[iso] || { mine: 0, others: 0, cover: 0 };
              const myCount = m.mine;
              const hasCover = m.cover > 0;
              const showCount = view === 'mine' ? myCount > 0 : (m.mine + m.others) > 0;
              const countToShow = view === 'mine' ? myCount : (m.mine + m.others);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(new Date(cell.d))}
                  className="salus-btn"
                  style={{
                    aspectRatio: '0.95 / 1',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 2,
                    background: isSelected ? '#1a2620' : '#f5f1e8',
                    border: isToday && !isSelected ? '1.5px solid #1a2620' : '1px solid transparent',
                    borderRadius: 10,
                    cursor: 'pointer',
                    padding: '4px 0',
                    opacity: cell.out ? 0.35 : 1,
                  }}>
                  {showCount ? (
                    <div style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: 13, fontWeight: 500,
                      color: isSelected
                        ? (hasCover ? '#f0c8b8' : '#fffdf7')
                        : (hasCover ? '#c8442a' : '#1a2620'),
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {countToShow}
                    </div>
                  ) : (
                    <div style={{ height: 13 }} />
                  )}
                  <div style={{
                    fontSize: 11,
                    fontWeight: isToday || isSelected ? 500 : 400,
                    color: isSelected ? '#d4cdb8' : cell.out ? '#a59478' : '#7a8270',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}>
                    {cell.d.getDate()}
                  </div>
                </button>
              );
            })}
          </div>
      </div>

      {/* View tabs */}
      <div style={{
        display: 'flex', gap: 22, padding: '0 4px 8px',
        borderBottom: '1px solid #efe7d2', marginBottom: 18,
      }}>
        {[['mine', 'Mine'], ['everyone', 'Everyone'], ['hire', 'Hire']].map(([key, label]) => {
          const isActive = view === key;
          return (
            <button key={key}
              onClick={() => setView(key)}
              className="salus-btn"
              style={{
                padding: '6px 0', background: 'transparent', border: 'none',
                borderBottom: isActive ? '1.5px solid #1a2620' : '1.5px solid transparent',
                fontSize: 11, fontWeight: isActive ? 600 : 500,
                color: isActive ? '#1a2620' : '#a59478',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Timeline — week of selectedDate */}
      {visibleItems.length === 0 ? (
        <EmptyState sub={view === 'mine' ? 'A quiet week — enjoy.' : view === 'hire' ? 'No studio hires this week.' : 'Nothing on the studio schedule.'}>
          {view === 'mine' ? 'No classes this week.' : view === 'hire' ? 'No hires booked.' : 'Empty week.'}
        </EmptyState>
      ) : (
        weekDates.map(d => {
          const iso = toIso(d);
          const dayItems = byDate[iso] || [];
          if (dayItems.length === 0) return null;
          const isToday = iso === todayIso;
          const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
          const dayNum = d.getDate();

          return (
            <div key={iso} style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 10,
                color: isToday ? '#c8442a' : '#a59478',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                fontWeight: 600,
                padding: '0 4px 14px',
              }}>
                {dayName} {dayNum}
              </div>

              {dayItems.map((item, idx) => {
                // BOOKING/HIRE row
                if (item.kind === 'booking') {
                  const b = item.raw;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('salus:openModal', { detail: { type: 'bookingDetail', id: b.id } })); }}
                      className="salus-btn"
                      style={{
                        display: 'flex', gap: 18, padding: '8px 4px 18px 4px',
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        width: '100%', fontFamily: 'inherit',
                        opacity: view === 'everyone' ? 0.78 : 1,
                        borderBottom: idx === dayItems.length - 1 ? 'none' : '1px solid #f5ecd6',
                        marginBottom: idx === dayItems.length - 1 ? 0 : 4,
                      }}>
                      <div style={{ flexShrink: 0, minWidth: 52, paddingTop: 4 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 500, color: '#1a2620',
                          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
                        }}>
                          {item.time}
                        </div>
                        {item.durationMin ? (
                          <div style={{
                            fontSize: 11, color: '#a59478', marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {item.durationMin}m
                          </div>
                        ) : null}
                      </div>

                      {/* Amber bar — hires get a distinctive accent */}
                      <div style={{
                        width: 2,
                        background: '#c6926a',
                        borderRadius: 2,
                        alignSelf: 'stretch',
                        minHeight: 44,
                        flexShrink: 0,
                      }} />

                      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                        <div style={{
                          fontSize: 9, color: '#c6926a', fontWeight: 600,
                          letterSpacing: '0.14em', textTransform: 'uppercase',
                          marginBottom: 6,
                        }}>
                          {item.bookingType === 'private_session' ? 'Private session' : 'Hire'}
                        </div>
                        <div style={{
                          fontFamily: '"Playfair Display", Georgia, serif',
                          fontSize: 17, fontWeight: 500, color: '#1a2620',
                          letterSpacing: '-0.005em', lineHeight: 1.25,
                        }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#7a8270', marginTop: 6, lineHeight: 1.4 }}>
                          {studioLabel(item.studio)}
                          {item.hirerName && <> · {item.hirerName}</>}
                        </div>
                      </div>
                    </button>
                  );
                }

                // CLASS row (default)
                const c = item.raw;
                const isMine = c.coachId === currentUser.id;
                const needsCover = openCoversAll.some(r => r.cls.id === c.id);
                const isDimmed = view === 'everyone' && !isMine && !needsCover;
                const coverReq = openCoversAll.find(r => r.cls.id === c.id);
                const requesterFirstName = coverReq ? coachName(coverReq.requestedBy) : '';

                const barColor = needsCover ? '#c8442a' : isMine ? classColor(c) : '#d4cdb8';
                const barWidth = needsCover ? 3 : isMine ? 2 : 1;

                return (
                  <button
                    key={item.id}
                    onClick={() => onClassClick?.(c.id)}
                    className="salus-btn"
                    style={{
                      display: 'flex', gap: 18, padding: '8px 4px 18px 4px',
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                      width: '100%', fontFamily: 'inherit',
                      opacity: isDimmed ? 0.45 : 1,
                      borderBottom: idx === dayItems.length - 1 ? 'none' : '1px solid #f5ecd6',
                      marginBottom: idx === dayItems.length - 1 ? 0 : 4,
                    }}>
                    {/* Time — always forest (unified palette) */}
                    <div style={{ flexShrink: 0, minWidth: 52, paddingTop: 4 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: '#1a2620',
                        fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
                      }}>
                        {c.time}
                      </div>
                      {c.durationMin ? (
                        <div style={{
                          fontSize: 11, color: '#a59478', marginTop: 4,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {c.durationMin}m
                        </div>
                      ) : null}
                    </div>

                    <div style={{
                      width: barWidth,
                      background: barColor,
                      borderRadius: 2,
                      alignSelf: 'stretch',
                      minHeight: 44,
                      flexShrink: 0,
                    }} />

                    <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                      {needsCover && (
                        <div style={{
                          fontSize: 9, color: '#c8442a', fontWeight: 600,
                          letterSpacing: '0.14em', textTransform: 'uppercase',
                          marginBottom: 6,
                        }}>
                          {requesterFirstName ? `${requesterFirstName} needs cover` : 'Needs cover'}
                        </div>
                      )}
                      <div style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 17, fontWeight: 500, color: '#1a2620',
                        letterSpacing: '-0.005em', lineHeight: 1.25,
                      }}>
                        {c.type}
                      </div>
                      <div style={{ fontSize: 12, color: '#7a8270', marginTop: 6, lineHeight: 1.4 }}>
                        {studioLabel(c.studio)}
                        {view !== 'mine' && c.coachId && (
                          <> · {isMine ? 'You' : coachName(c.coachId)}</>
                        )}
                      </div>
                      {needsCover && (
                        <div style={{
                          fontSize: 11, color: '#a59478',
                          marginTop: 8, letterSpacing: '0.04em',
                        }}>
                          Tap to take it →
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </>
  );
}



function ScheduleView({
  data, currentUser, isManager, isMobile, scheduleView, setScheduleView,
  onClassClick, onShiftClick, onAddClass, onDayClick, onBookingClick,
}) {
  // Non-managers see a clean personal schedule — just their classes, no tabs, no stats.
  if (!isManager) {
    return (
      <StaffScheduleView
        data={data}
        currentUser={currentUser}
        onClassClick={onClassClick}
      />
    );
  }

  const fohOnly = currentUser.isFoh && !currentUser.isCoach;
  const studioOnly = currentUser.isCoach && !currentUser.isFoh;
  // Only managers see the Studio / FOH / Hire toggle. Staff always see just their schedule.
  const canSeeBoth = isManager;

  // Decide which view to render
  const view = fohOnly ? 'foh' :
               studioOnly ? 'studio' :
               scheduleView;

  return (
    <>
      {/* Editorial page header — compact since this is a frequently-used tab */}
      <PageHeader
        eyebrow="The week"
        title="Schedule"
        compact
      />

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
            FOH
          </button>
          <button
            onClick={() => setScheduleView('hire')}
            className="salus-btn"
            style={{
              ...styles.viewToggleBtn,
              ...(view === 'hire' ? { ...styles.viewToggleBtnActive, color: '#c6926a', borderBottomColor: '#c6926a' } : {}),
            }}
          >
            Hire
          </button>
        </div>
      )}

      {view === 'studio' && (
        <Timetable
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          isMobile={isMobile}
          onClassClick={onClassClick}
          onAddClass={onAddClass}
          onDayClick={onDayClick}
        />
      )}
      {view === 'foh' && (
        <FOHSchedule
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          isMobile={isMobile}
          onShiftClick={onShiftClick}
        />
      )}
      {view === 'hire' && (
        <HireSchedule
          data={data}
          currentUser={currentUser}
          isManager={isManager}
          isMobile={isMobile}
          onBookingClick={onBookingClick}
          onCreate={() => setScheduleView('hire')}
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
        title="Front of House"
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
// HIRE SCHEDULE — calendar for private events / 1:1s / studio hires
// ──────────────────────────────────────────────────────────────────────────────

function HireSchedule({ data, currentUser, isManager, isMobile, onBookingClick }) {
  const [viewMode, setViewMode] = useState('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [scope, setScope] = useState('internal');  // 'internal' | 'external'

  // All hires, formatted as class-like items.
  // External = external_event booking type; everything else (1on1, classes, events by coaches) = Internal.
  const allHires = useMemo(() => {
    return (data.bookings || [])
      .filter(b => b.status !== 'cancelled')
      .map(b => ({
        id: b.id,
        date: b.date,
        time: b.startTime,
        endTime: b.endTime,
        type: b.title || (BOOKING_TYPES[b.bookingType]?.label || 'Studio hire'),
        studio: b.studio,
        coachId: b.createdBy,
        guestName: b.hirerName,
        bookingType: b.bookingType,
        isExternal: b.bookingType === 'external_event',
        dur: b.startTime && b.endTime ? minutesBetween(b.startTime, b.endTime) : null,
      }));
  }, [data.bookings]);

  const internalCount = useMemo(() => allHires.filter(h => !h.isExternal).length, [allHires]);
  const externalCount = useMemo(() => allHires.filter(h => h.isExternal).length, [allHires]);

  const hireItems = useMemo(() => {
    return allHires.filter(h => scope === 'external' ? h.isExternal : !h.isExternal);
  }, [allHires, scope]);

  const renderCard = (item) => {
    const userById = Object.fromEntries(data.users.map(u => [u.id, u]));
    const host = item.coachId ? userById[item.coachId] : null;
    const meta = BOOKING_TYPES[item.bookingType] || {};
    return (
      <ScheduleCard
        key={item.id}
        onClick={() => onBookingClick?.(item.id)}
        timeLeft={item.time}
        timeBottom={item.endTime ? `to ${item.endTime}` : (item.dur ? `${item.dur} min` : null)}
        title={item.type}
        subtitle={item.guestName || meta.label || 'Studio hire'}
        person={host}
        needsCover={false}
        isMine={item.coachId === currentUser.id}
        isManager={isManager}
        kindLabel={meta.short || (item.isExternal ? 'EXTERNAL' : 'INTERNAL')}
        kindColor={meta.color || (item.isExternal ? '#c6926a' : '#7a8c5c')}
      />
    );
  };

  return (
    <div style={styles.timetable}>
      {/* Internal / External scope tabs */}
      <div style={{
        display: 'flex', gap: 24,
        padding: '0 4px 10px',
        borderBottom: '1px solid #efe7d2',
        marginBottom: 14,
      }}>
        <button
          onClick={() => setScope('internal')}
          className="salus-btn"
          style={{
            padding: '8px 0', background: 'transparent', border: 'none',
            borderBottom: scope === 'internal' ? '1.5px solid #7a8c5c' : '1.5px solid transparent',
            fontSize: 12, fontWeight: scope === 'internal' ? 600 : 500,
            color: scope === 'internal' ? '#1a2620' : '#a59478',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          Internal
          {internalCount > 0 && (
            <span style={{
              fontSize: 10, color: scope === 'internal' ? '#7a8c5c' : '#a59478',
              fontWeight: 500,
            }}>
              {internalCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setScope('external')}
          className="salus-btn"
          style={{
            padding: '8px 0', background: 'transparent', border: 'none',
            borderBottom: scope === 'external' ? '1.5px solid #c6926a' : '1.5px solid transparent',
            fontSize: 12, fontWeight: scope === 'external' ? 600 : 500,
            color: scope === 'external' ? '#1a2620' : '#a59478',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          External
          {externalCount > 0 && (
            <span style={{
              fontSize: 10, color: scope === 'external' ? '#c6926a' : '#a59478',
              fontWeight: 500,
            }}>
              {externalCount}
            </span>
          )}
        </button>
      </div>

      <SchedulePeriodToggle viewMode={viewMode} setViewMode={setViewMode} />

      {viewMode === 'day' && (
        <DayView
          items={hireItems}
          allItems={hireItems}
          dayOffset={dayOffset}
          setDayOffset={setDayOffset}
          getDate={(c) => c.date}
          getTime={(c) => c.time}
          isCover={() => false}
          totalLabel={scope === 'external' ? 'external hires' : 'internal hires'}
          filter={'all'}
          setFilter={() => {}}
          isManager={isManager}
          renderCard={renderCard}
          hideFilters
        />
      )}

      {viewMode === 'week' && (
        <WeekViewBody
          items={hireItems}
          allItems={hireItems}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          getDate={(c) => c.date}
          getTime={(c) => c.time}
          isCover={() => false}
          totalLabel={scope === 'external' ? 'external hires' : 'internal hires'}
          filter={'all'}
          setFilter={() => {}}
          isManager={isManager}
          renderCard={renderCard}
          hideFilters
        />
      )}

      {viewMode === 'month' && (
        <MonthGrid
          items={hireItems}
          monthOffset={monthOffset}
          setMonthOffset={setMonthOffset}
          getDate={(b) => b.date}
          isCover={() => false}
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
            Add to Google Calendar
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

  const renderCard = (cls) => {
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
        <button onClick={onAddClass} className="salus-btn" style={styles.scheduleFab} aria-label="Add class">
          <Plus size={22} />
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

function DayView({ items, allItems, dayOffset, setDayOffset, getDate, getTime, isCover, totalLabel, filter, setFilter, isManager, renderCard, hideFilters }) {
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
      {/* Editorial day nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 0 18px', justifyContent: 'space-between',
      }}>
        <button onClick={() => canBack && setDayOffset(d => d - 1)}
          disabled={!canBack} className="salus-btn"
          style={{
            background: 'transparent', border: 'none', padding: 4,
            color: canBack ? '#7a8270' : '#d4cdb8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 18, fontWeight: 400, color: '#1a2620',
            letterSpacing: '-0.005em', lineHeight: 1.1,
            display: 'inline-flex', alignItems: 'baseline', gap: 8,
          }}>
            <span>{headerLabel}</span>
            {isToday && (
              <span style={{
                fontSize: 10, color: '#c8442a', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 2,
              }}>Today</span>
            )}
          </div>
          {!isToday && (
            <div>
              <button onClick={() => setDayOffset(0)} className="salus-btn" style={{
                background: 'transparent', border: 'none', padding: '4px 0 0',
                color: '#a59478', fontSize: 10, letterSpacing: '0.12em',
                textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
              }}>
                Back to today
              </button>
            </div>
          )}
        </div>
        <button onClick={() => canFwd && setDayOffset(d => d + 1)}
          disabled={!canFwd} className="salus-btn"
          style={{
            background: 'transparent', border: 'none', padding: 4,
            color: canFwd ? '#7a8270' : '#d4cdb8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <ChevronRight size={20} />
        </button>
      </div>

      <ScheduleStatsRow coverCount={coverCount} totalCount={totalCount} totalLabel={totalLabel} />

      {!hideFilters && <ScheduleFilterRow filter={filter} setFilter={setFilter} isManager={isManager} coverCount={coverCount} />}

      <div>
        {dayItems.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{
              fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38',
              fontStyle: 'italic', letterSpacing: '-0.005em',
            }}>
              Nothing on this day.
            </div>
          </div>
        ) : (
          (() => {
            // Group by time of day for editorial rhythm
            const morning = dayItems.filter(it => parseInt(getTime(it).slice(0, 2)) < 12);
            const afternoon = dayItems.filter(it => {
              const h = parseInt(getTime(it).slice(0, 2));
              return h >= 12 && h < 17;
            });
            const evening = dayItems.filter(it => parseInt(getTime(it).slice(0, 2)) >= 17);
            const sections = [
              { label: 'Morning', items: morning },
              { label: 'Afternoon', items: afternoon },
              { label: 'Evening', items: evening },
            ].filter(s => s.items.length > 0);

            return sections.map(section => (
              <div key={section.label} style={{ marginTop: 20 }}>
                <div style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 13, fontStyle: 'italic',
                  color: '#a59478', letterSpacing: '0.02em',
                  padding: '0 2px 8px',
                  borderBottom: '1px solid #efe7d2',
                  marginBottom: 4,
                }}>
                  {section.label}
                </div>
                {section.items.map(item => renderCard(item))}
              </div>
            ));
          })()
        )}
      </div>
    </>
  );
}

function WeekViewBody({ items, allItems, weekOffset, setWeekOffset, getDate, getTime, isCover, totalLabel, filter, setFilter, isManager, renderCard, hideFilters }) {
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
      {!hideFilters && <ScheduleFilterRow filter={filter} setFilter={setFilter} isManager={isManager} coverCount={totalCover} />}

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
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{
            fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38',
            fontStyle: 'italic', letterSpacing: '-0.005em',
          }}>
            {filter === 'needsCover'
              ? 'Nothing needs cover.'
              : filter === 'mine'
                ? `You have no ${totalLabel} this week.`
                : `No ${totalLabel} this week.`}
          </div>
          {filter === 'needsCover' && (
            <div style={{ fontSize: 12, color: '#a59478', marginTop: 8 }}>The team is covered.</div>
          )}
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
      {/* Editorial month nav — chevrons flat, no boxes */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 0 18px', justifyContent: 'space-between',
      }}>
        <button onClick={() => canBack && setMonthOffset(m => m - 1)}
          disabled={!canBack} className="salus-btn"
          style={{
            background: 'transparent', border: 'none', padding: 4,
            color: canBack ? '#7a8270' : '#d4cdb8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center',
          fontFamily: '"Playfair Display", serif',
          fontSize: 18, fontWeight: 400, color: '#1a2620',
          letterSpacing: '-0.005em', lineHeight: 1.1,
        }}>
          {monthLabel}
        </div>
        <button onClick={() => canFwd && setMonthOffset(m => m + 1)}
          disabled={!canFwd} className="salus-btn"
          style={{
            background: 'transparent', border: 'none', padding: 4,
            color: canFwd ? '#7a8270' : '#d4cdb8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <ChevronRight size={20} />
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
              style={styles.monthGridCell}
            >
              <span style={{
                ...styles.monthGridCellDate,
                ...(isToday ? {
                  background: '#1a2620', color: '#fffdf7', fontWeight: 500,
                } : {}),
              }}>
                {cell.date.getDate()}
              </span>
              <div style={styles.monthGridDots}>
                {info?.cover > 0 && (
                  <span style={{ ...styles.monthGridDot, background: '#c8442a' }} />
                )}
                {info && info.count > info.cover && (
                  <span style={{ ...styles.monthGridDot, background: '#a59478' }} />
                )}
              </div>
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
          <span style={{ ...styles.monthGridDot, background: '#a59478' }} />
          Scheduled
        </div>
      </div>
    </>
  );
}

// Shared subcomponents used by both Timetable and FOHSchedule
function ScheduleWeekNav({ weekStart, weekOffset, setWeekOffset }) {
  const startLabel = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endLabel = addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0 18px', justifyContent: 'space-between',
    }}>
      <button
        onClick={() => setWeekOffset(w => Math.max(w - 1, -2))}
        className="salus-btn"
        style={{
          background: 'transparent', border: 'none', padding: 4,
          color: weekOffset <= -2 ? '#d4cdb8' : '#7a8270',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        disabled={weekOffset <= -2}
      >
        <ChevronLeft size={20} />
      </button>

      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 18, fontWeight: 400, color: '#1a2620',
          letterSpacing: '-0.005em', lineHeight: 1.1,
        }}>
          {startLabel} – {endLabel}
        </div>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} className="salus-btn" style={{
            background: 'transparent', border: 'none', padding: '4px 0 0',
            color: '#a59478', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
          }}>
            Back to this week
          </button>
        )}
      </div>

      <button
        onClick={() => setWeekOffset(w => Math.min(w + 1, 12))}
        className="salus-btn"
        style={{
          background: 'transparent', border: 'none', padding: 4,
          color: weekOffset >= 12 ? '#d4cdb8' : '#7a8270',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        disabled={weekOffset >= 12}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function ScheduleStatsRow({ coverCount, totalCount, totalLabel }) {
  if (coverCount === 0 && totalCount === 0) return null;
  return (
    <div style={{
      padding: '0 4px 14px',
      fontFamily: '"Playfair Display", serif',
      fontSize: 14, fontStyle: 'italic',
      color: '#5c4a38',
      letterSpacing: '-0.005em',
      display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
    }}>
      <span>{totalCount} {totalLabel}</span>
      {coverCount > 0 && (
        <>
          <span style={{ color: '#a59478', fontStyle: 'normal' }}>·</span>
          <span style={{ color: '#c8442a' }}>
            {coverCount} {coverCount === 1 ? 'needs cover' : 'need cover'}
          </span>
        </>
      )}
    </div>
  );
}

function ScheduleFilterRow({ filter, setFilter, isManager, coverCount = 0 }) {
  // Progressive disclosure — only show this row when there's actually something to filter on.
  // Hide if there are no cover items AND the user is a manager (so they don't have a Mine button either).
  if (coverCount === 0 && isManager) return null;

  return (
    <div style={{
      display: 'flex', gap: 22, padding: '0 4px 8px',
      borderBottom: '1px solid #efe7d2', marginBottom: 4,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      <button
        onClick={() => setFilter('all')}
        className="salus-btn"
        style={{
          padding: '6px 0', background: 'transparent', border: 'none',
          borderBottom: filter === 'all' ? '1.5px solid #1a2620' : '1.5px solid transparent',
          fontSize: 11, fontWeight: filter === 'all' ? 600 : 500,
          color: filter === 'all' ? '#1a2620' : '#a59478',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
        }}
      >
        All
      </button>
      {coverCount > 0 && (
        <button
          onClick={() => setFilter('needsCover')}
          className="salus-btn"
          style={{
            padding: '6px 0', background: 'transparent', border: 'none',
            borderBottom: filter === 'needsCover' ? '1.5px solid #c8442a' : '1.5px solid transparent',
            fontSize: 11, fontWeight: filter === 'needsCover' ? 600 : 500,
            color: filter === 'needsCover' ? '#c8442a' : '#a59478',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
          }}
        >
          Needs cover ({coverCount})
        </button>
      )}
      {!isManager && (
        <button
          onClick={() => setFilter('mine')}
          className="salus-btn"
          style={{
            padding: '6px 0', background: 'transparent', border: 'none',
            borderBottom: filter === 'mine' ? '1.5px solid #1a2620' : '1.5px solid transparent',
            fontSize: 11, fontWeight: filter === 'mine' ? 600 : 500,
            color: filter === 'mine' ? '#1a2620' : '#a59478',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
          }}
        >
          Mine
        </button>
      )}
    </div>
  );
}

function ScheduleCard({ onClick, timeLeft, timeBottom, title, subtitle, person, needsCover, isMine, isManager, kindLabel, kindColor }) {
  return (
    <button
      onClick={onClick}
      className="salus-btn"
      style={{
        ...styles.scheduleCard,
        ...(needsCover ? {
          background: '#fbe5dd',
          borderBottom: '1px solid #f0c6b6',
          padding: '14px 12px',
          marginBottom: 1,
        } : {}),
      }}
    >
      {/* Left accent indicator — bold red for cover, sage for mine, amber for hire */}
      {(isMine || needsCover || kindLabel) && (
        <span style={{
          position: 'absolute', left: -2, top: 0, bottom: 0,
          width: needsCover ? 4 : 2,
          background: needsCover ? '#c8442a' : kindLabel ? (kindColor || '#c6926a') : '#7a8c5c',
          borderRadius: 1,
        }} />
      )}

      <div style={styles.scheduleCardTime}>
        <div style={{
          ...styles.scheduleCardTimeMain,
          ...(needsCover ? { color: '#c8442a' } : {}),
        }}>{timeLeft}</div>
        {timeBottom && <div style={styles.scheduleCardTimeSub}>{timeBottom}</div>}
      </div>
      <div style={styles.scheduleCardMid}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            ...styles.scheduleCardTitle,
            ...(needsCover ? { color: '#1a2620', fontWeight: 600 } : {}),
          }}>{title}</div>
          {kindLabel && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: kindColor || '#c6926a',
              textTransform: 'uppercase', letterSpacing: 2,
            }}>{kindLabel}</span>
          )}
        </div>
        {subtitle && (
          <div style={{
            ...styles.scheduleCardSub,
            ...(needsCover ? { color: '#5c4a38' } : {}),
          }}>{subtitle}</div>
        )}
      </div>
      <div style={styles.scheduleCardRight}>
        {needsCover ? (
          <span style={{
            background: '#c8442a', color: '#fffdf7',
            fontSize: 10, fontWeight: 600, padding: '6px 12px',
            borderRadius: 999, textTransform: 'uppercase', letterSpacing: 1.5,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap',
          }}>
            Needs cover
          </span>
        ) : person ? (
          <>
            <UserAvatar user={person} size={24} fontSize={10} />
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

  // ─── In-the-studio-today roster ────────────────────────────────
  // For each teammate, compute their status TODAY:
  //   rank 0 → teaching now (sage halo, sage dot)
  //   rank 1 → on FOH shift now (amber dot)
  //   rank 2 → coming later today (bone dot, no halo)
  // Done-earlier and off-today are excluded — we want who's *actually around*.
  const rosterToday = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const parseHm = (t) => {
      if (!t) return null;
      const parts = t.split(':').map(Number);
      if (Number.isNaN(parts[0])) return null;
      return parts[0] * 60 + (parts[1] || 0);
    };
    const status = {}; // userId -> { rank, kind, label, sortKey }

    // Classes today
    (data.classes || []).forEach(c => {
      if (c.date !== todayIso || !c.coachId) return;
      const start = parseHm(c.time);
      if (start == null) return;
      const end = start + (c.dur || 45);
      const existing = status[c.coachId];
      if (nowMin >= start && nowMin < end) {
        // Teaching now — always wins
        if (!existing || existing.rank > 0) {
          status[c.coachId] = { rank: 0, kind: 'teaching', label: 'Teaching now', sortKey: end };
        }
      } else if (start > nowMin) {
        // Comes later
        if (!existing || (existing.rank > 2) || (existing.rank === 2 && existing.sortKey > start)) {
          status[c.coachId] = { rank: 2, kind: 'later', label: `Teaches ${c.time}`, sortKey: start };
        }
      }
    });

    // FOH shifts today
    (data.shifts || []).forEach(s => {
      if (s.date !== todayIso || !s.userId) return;
      const start = parseHm(s.startTime);
      const end = parseHm(s.endTime);
      if (start == null || end == null) return;
      const existing = status[s.userId];
      if (nowMin >= start && nowMin < end) {
        // On FOH now — beats "later", loses to "teaching"
        if (!existing || existing.rank > 1) {
          status[s.userId] = { rank: 1, kind: 'on_shift', label: 'On FOH', sortKey: end };
        }
      } else if (start > nowMin) {
        if (!existing || (existing.rank > 2) || (existing.rank === 2 && existing.sortKey > start)) {
          status[s.userId] = { rank: 2, kind: 'later', label: `FOH ${s.startTime}`, sortKey: start };
        }
      }
    });

    return Object.entries(status)
      .map(([uid, info]) => {
        const user = data.users.find(u => u.id === uid && !u.deactivated);
        return user ? { user, ...info } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.sortKey - b.sortKey);
  }, [data.classes, data.shifts, data.users]);

  // Friendly "now" caption — pluralisation + tone
  const nowVerb = (() => {
    const teachingCount = rosterToday.filter(r => r.kind === 'teaching').length;
    const onShiftCount  = rosterToday.filter(r => r.kind === 'on_shift').length;
    const laterCount    = rosterToday.filter(r => r.kind === 'later').length;
    if (teachingCount > 0 && onShiftCount > 0) return `${teachingCount} teaching · ${onShiftCount} on FOH`;
    if (teachingCount > 0) return `${teachingCount} ${teachingCount === 1 ? 'class' : 'classes'} on the floor right now`;
    if (onShiftCount > 0)  return `${onShiftCount} on FOH right now`;
    if (laterCount > 0)    return `${laterCount} coming in later`;
    return 'A quiet one today';
  })();

  // Silo-style date label: "Saturday, 23 May"
  const todayLabel = (() => {
    const d = new Date();
    const wkday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('en-GB', { month: 'long' });
    return `${wkday}, ${dayNum} ${monthName}`;
  })();

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
      {/* ─── HERO: editorial date block (Silo's "Delivery / Monday, 9/2") ─── */}
      <div style={styles.chatStudioHero}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.chatStudioEyebrow}>Team chat</div>
          <h2 style={styles.chatStudioHeroTitle}>{todayLabel}</h2>
          <div style={styles.chatStudioNowLine}>{nowVerb}</div>
        </div>
        {isManager && data.messages.length > 0 && (
          <button
            onClick={onClearAll}
            className="salus-btn"
            style={styles.chatHeaderIconBtn}
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* ─── SECTION: in-the-studio roster (Silo's "AVAILABLE SUPPLIERS") ─── */}
      <div style={styles.chatStudioRosterSection}>
        <div style={styles.chatStudioSectionHeader}>
          <div style={styles.chatStudioEyebrow}>In the studio</div>
          {rosterToday.length > 0 && (
            <div style={styles.chatStudioSectionMeta}>
              {rosterToday.length} {rosterToday.length === 1 ? 'today' : 'today'}
            </div>
          )}
        </div>

        {rosterToday.length > 0 ? (
          <div className="salus-scroll-h" style={styles.chatRosterScroll}>
            {rosterToday.map(({ user, kind, label }) => {
              const statusColor =
                kind === 'teaching' ? '#5b6d3f' :
                kind === 'on_shift' ? '#8a5a2e' :
                                      '#a59478';
              return (
                <div key={user.id} style={styles.chatRosterItem}>
                  <div style={styles.chatRosterAvatarWrap}>
                    <UserAvatar user={user} size={68} fontSize={22} />
                  </div>
                  <div style={styles.chatRosterName}>
                    {(user.name || '').split(' ')[0]}
                  </div>
                  <div style={{ ...styles.chatRosterStatusLine, color: statusColor }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.chatRosterQuiet}>
            <Sparkles size={14} style={{ color: '#a59478' }} />
            <span>No one scheduled today — a good day to say hi.</span>
          </div>
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
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
            gap: 18,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 32,
              background: '#f5f1e8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5c4a38',
            }}>
              <MessageCircle size={26} strokeWidth={1.5} />
            </div>
            <div>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 22, fontWeight: 500, color: '#1a2620',
                letterSpacing: '-0.01em', marginBottom: 8,
              }}>
                Welcome to the studio chat
              </div>
              <div style={{
                fontSize: 13, color: '#7a8270', lineHeight: 1.5,
                maxWidth: 280,
              }}>
                This is your space — share class wins, ask for cover, drop a kind word.
                We work better when we talk.
              </div>
            </div>
            <button onClick={() => {
              const t = document.querySelector('input.salus-input');
              if (t) t.focus();
            }} className="salus-btn"
              style={{
                marginTop: 6,
                padding: '10px 22px',
                background: '#1a2620', color: '#fffdf7',
                border: 'none', borderRadius: 999,
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
              }}>
              Say hello
            </button>
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const timeAgo = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const renderNewButton = () => (
    <button
      onClick={() => setPickerOpen(true)}
      className="salus-btn"
      style={{
        margin: '14px 16px',
        padding: '14px 18px',
        background: '#1a2620', color: '#fffdf7', border: 'none',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 13, fontWeight: 500, letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <Plus size={16} />
      New message
    </button>
  );

  return (
    <>
      {threads.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {renderNewButton()}
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <Mail size={36} color="#a59478" style={{ margin: '0 auto' }} />
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38', marginTop: 8 }}>
              No private messages yet
            </div>
            <div style={{ fontSize: 12, color: '#7a8270', marginTop: 6, lineHeight: 1.5 }}>
              Tap <strong>New message</strong> to start a private thread.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderNewButton()}
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
      )}

      {pickerOpen && (
        <NewMessagePicker
          users={data.users.filter(u => u.id !== currentUser.id && !u.deactivated)}
          existingThreadIds={new Set(threads.map(t => t.otherId))}
          onPick={(userId) => {
            setPickerOpen(false);
            onOpenDm(userId);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ─── NewMessagePicker — pick who to start a thread with ─────────────────
function NewMessagePicker({ users, existingThreadIds, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(u => u.name.toLowerCase().includes(q));
  }, [users, query]);

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 38, 32, 0.55)', zIndex: 9998,
        touchAction: 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: COLOR.cream, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}>
        <ModalHeader
          eyebrow="Private message"
          title="Who would you like to message?"
          onClose={onClose}
        />
        {/* Inline search field — below header */}
        <div style={{ padding: '10px 22px 14px', background: COLOR.cream, flexShrink: 0, borderBottom: `1px solid ${COLOR.bone}` }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name"
            style={{
              width: '100%', padding: '12px 14px',
              background: COLOR.sand, border: 'none', borderRadius: 12,
              fontFamily: 'inherit', fontSize: 14, color: COLOR.forest,
              outline: 'none',
            }}
          />
        </div>

        {/* Scrollable list */}
        <div style={{
          flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '8px 0',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 22px', textAlign: 'center' }}>
              <div style={{
                fontFamily: '"Playfair Display", serif', fontSize: 16, color: '#5c4a38',
                fontStyle: 'italic',
              }}>
                No one matches "{query}".
              </div>
            </div>
          ) : (
            filtered.map(u => {
              const exists = existingThreadIds.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => onPick(u.id)}
                  className="salus-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '12px 22px',
                    background: 'transparent', border: 'none',
                    borderBottom: '1px solid #efe7d2',
                    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <UserAvatar user={u} size={40} fontSize={14} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, color: '#1a2620',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{u.name}</div>
                    {(u.isCoach || u.isFoh) && (
                      <div style={{ fontSize: 11, color: '#a59478', marginTop: 2, letterSpacing: '0.02em' }}>
                        {[u.isCoach && 'Coach', u.isFoh && 'FOH'].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  {exists && (
                    <span style={{ fontSize: 10, color: '#a59478', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Open thread
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer — placeholder for group chats */}
        <div style={{
          padding: '12px 22px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid #efe7d2', background: '#fffdf7',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11, color: '#a59478', textAlign: 'center', fontStyle: 'italic',
          }}>
            Group chats coming soon.
          </div>
        </div>
      </div>
    </>
  , document.body);
}

// ──────────────────────────────────────────────────────────────────────────────
// MANAGER STATS
// ──────────────────────────────────────────────────────────────────────────────

const RATE_PER_SESSION = 30; // £ per class taught

// ──────────────────────────────────────────────────────────────────────────────
// ME — personal hub: profile, stats, settings link
// ──────────────────────────────────────────────────────────────────────────────

function MePage({ data, currentUser, isManager, realIsManager, viewAsStaff, onToggleViewAsStaff, emailIntegration, sessionToken, onOpenSettings, onSignOut, onShowInvoices, onShowStaffInvoices, onShowTimeOff, onShowTeam, onShowExpenses, onShowFlows, onConnectGmail, onDisconnectGmail, onCreate, onOpenBooking, onCreateTask, onReload }) {
  // Defensive — data and currentUser must always be objects
  if (!currentUser || !data) {
    return (
      <div style={styles.homeContainer}>
        <PageHeader eyebrow="Loading" title="Me" compact />
      </div>
    );
  }
  const safeClasses = data.classes || [];
  const safeUsers = data.users || [];
  const myClasses = safeClasses.filter(c => c.coachId === currentUser.id);
  const sessionCount = myClasses.length;
  const totalMinutes = myClasses.reduce((acc, c) => acc + (c.durationMin || c.dur || 45), 0);
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
      {/* Profile cover with photo */}
      <div style={{
        height: 140, borderRadius: 18, overflow: 'hidden', marginTop: 8, position: 'relative',
        backgroundImage: 'url(/brand/reformer.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center 30%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(26, 38, 32, 0.0) 0%, rgba(26, 38, 32, 0.55) 100%)',
        }} />
      </div>

      {/* Profile card — overlapping the cover */}
      <div style={{
        background: '#fffdf7', borderRadius: 18,
        marginTop: -38, marginLeft: 8, marginRight: 8,
        padding: '20px 22px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 4px 16px rgba(26, 38, 32, 0.08)',
        position: 'relative', zIndex: 2,
      }}>
        <UserAvatar user={currentUser} size={64} fontSize={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 20, fontWeight: 500, color: '#1a2620', letterSpacing: '-0.005em',
          }}>{currentUser.name}</div>
          <div style={{ fontSize: 11, color: '#a59478', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500 }}>
            {roleLabel}
          </div>
        </div>
        <button onClick={onOpenSettings} className="salus-btn" style={{
          background: 'transparent', border: 'none', padding: 4,
          color: '#a59478', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
        }}>
          Edit
        </button>
      </div>

      {/* Stats — gamified for coaches/FOH, single hero stat for manager */}
      {isManager ? (
        <section style={{ marginTop: 36, padding: '0 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#a59478', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 14 }}>
            This week
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: 56, fontWeight: 400, color: '#1a2620',
              lineHeight: 1, letterSpacing: '-0.02em',
            }}>
              {sessionCount}
            </div>
            <div style={{ fontSize: 12, color: '#7a8270', letterSpacing: '0.02em' }}>
              {sessionCount === 1 ? 'session taught' : 'sessions taught'}
            </div>
          </div>
          {sessionCount > 0 && (
            <div style={{ marginTop: 16, fontSize: 13, color: '#5c4a38' }}>
              {Math.round(totalMinutes / 60 * 10) / 10} hours · £{owed} earned
            </div>
          )}
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

      {/* Admin — Me is also Admin. For managers we list each section as a button
          that opens a focused full-screen modal — safer than embedding the whole
          AdminPage (whose sub-sections each have their own async/data deps). */}
      {isManager ? (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>Studio admin</div>
          </div>
          <div style={styles.meActionsList}>
            {[
              { key: 'reports',       label: 'Reports',       sub: 'Email triage and overview',         icon: BarChart3 },
              { key: 'inbox',         label: 'Inbox',         sub: 'Member messages',                   icon: Inbox },
              { key: 'cancellations', label: 'Cancellations', sub: 'Booking cancellation tracking',     icon: AlertCircle },
              { key: 'tours',         label: 'Tours',         sub: 'Prospective member visits',         icon: MapPin },
              { key: 'stock',         label: 'Stock',         sub: 'Studio inventory',                  icon: Package },
              { key: 'bookings',      label: 'Studio bookings', sub: 'Hire and external bookings',      icon: Bookmark },
              { key: 'incidents',     label: 'Incidents',     sub: 'Studio incident log',               icon: AlertOctagon },
              { key: 'invoices',      label: 'Pay run',       sub: 'Generate coach invoices',           icon: FileText },
            ].map((item, idx, arr) => {
              const Icon = item.icon;
              const isLast = idx === arr.length - 1;
              return (
                <button key={item.key}
                  onClick={() => window.dispatchEvent(new CustomEvent('salus:openAdmin', { detail: { section: item.key } }))}
                  className="salus-btn"
                  style={{ ...styles.meActionRow, ...(isLast ? { borderBottom: 'none' } : {}) }}>
                  <Icon size={18} color="#5c4a38" />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 14, color: '#1a2620' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>{item.sub}</div>
                  </div>
                  <ChevronRight size={16} color="#a59478" />
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>Your admin</div>
          </div>
          <StaffAdminPage
            embedded
            data={data}
            currentUser={currentUser}
            emailIntegration={emailIntegration}
            onConnectGmail={onConnectGmail}
            onShowExpenses={onShowExpenses}
            onShowFlows={onShowFlows}
            onShowTimeOff={onShowTimeOff}
            onShowStaffInvoices={onShowStaffInvoices}
          />
        </section>
      )}

      {/* Personal admin — managers also teach, so they get the same personal tools as staff */}
      {isManager && (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>Your personal admin</div>
          </div>
          <div style={styles.meActionsList}>
            {(() => {
              const now = new Date();
              const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
              const monthEndIso = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
              const myMonth = (data.classes || []).filter(c =>
                c.coachId === currentUser.id && c.date >= monthStartIso && c.date <= monthEndIso
              );
              const rate = currentUser.sessionRatePence || 3000;
              const monthTotal = (rate * myMonth.length) / 100;
              const monthLabel = now.toLocaleDateString('en-GB', { month: 'long' });
              return (
                <button onClick={onShowStaffInvoices} className="salus-btn" style={styles.meActionRow}>
                  <FileText size={18} color="#5c4a38" />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 14, color: '#1a2620' }}>Your invoice</div>
                    <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                      {monthLabel}: {myMonth.length} {myMonth.length === 1 ? 'class' : 'classes'} · £{monthTotal.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#a59478" />
                </button>
              );
            })()}
            <button onClick={onShowExpenses} className="salus-btn" style={styles.meActionRow}>
              <FileText size={18} color="#5c4a38" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: '#1a2620' }}>Expenses</div>
                <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                  {data.expenses?.length || 0} receipts · for your tax return
                </div>
              </div>
              <ChevronRight size={16} color="#a59478" />
            </button>
            <button onClick={onShowFlows} className="salus-btn" style={styles.meActionRow}>
              <Bookmark size={18} color="#5c4a38" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: '#1a2620' }}>Flows</div>
                <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                  {(data.flows || []).filter(f => !f.archived).length} active · session library
                </div>
              </div>
              <ChevronRight size={16} color="#a59478" />
            </button>
            <button onClick={onShowTimeOff} className="salus-btn" style={{ ...styles.meActionRow, borderBottom: 'none' }}>
              <Calendar size={18} color="#5c4a38" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: '#1a2620' }}>Time off & bank holidays</div>
                <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>Upcoming UK bank holidays</div>
              </div>
              <ChevronRight size={16} color="#a59478" />
            </button>
          </div>
        </section>
      )}

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

      {/* View-as-staff toggle — only shown to real managers, always visible (even when previewing) */}
      {realIsManager && (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>View</div>
          </div>
          <div style={styles.meActionsList}>
            <button onClick={onToggleViewAsStaff} className="salus-btn" style={styles.meActionRow}>
              <Eye size={18} color="#5c4a38" />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: '#1a2620' }}>
                  {viewAsStaff ? 'Switch back to manager view' : 'View as staff'}
                </div>
                <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                  {viewAsStaff
                    ? 'You\'re currently previewing what coaches see'
                    : 'Preview what a coach or FOH member sees'}
                </div>
              </div>
              <div style={{
                width: 40, height: 22, borderRadius: 999, position: 'relative',
                background: viewAsStaff ? '#1a2620' : '#d4cdb8',
                transition: 'background 120ms ease',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 2, left: viewAsStaff ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fffdf7',
                  transition: 'left 120ms ease',
                }} />
              </div>
            </button>
          </div>
        </section>
      )}

      {/* Email integration — managers + FOH staff */}
      {(isManager || currentUser.isFoh) && (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>Connected accounts</div>
          </div>
          <div style={styles.meActionsList}>
            {emailIntegration ? (
              <div style={{ ...styles.meActionRow, cursor: 'default' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#7a8c5c', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>✉</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, color: '#1a2620' }}>
                    Gmail · <span style={{ color: '#5c8a5a', fontWeight: 600 }}>Connected</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                    {emailIntegration.emailAddress || 'Connected'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Disconnect Gmail? Your stored tokens will be deleted.')) {
                      onDisconnectGmail();
                    }
                  }}
                  className="salus-btn"
                  style={{ ...styles.btnGhost, color: '#c8442a' }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={onConnectGmail} className="salus-btn" style={styles.meActionRow}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#fef7e8', color: '#c6926a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>✉</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, color: '#1a2620' }}>Connect Gmail</div>
                  <div style={{ fontSize: 11, color: '#7a8270', marginTop: 1 }}>
                    Read your inbox for cancellations, refunds, inquiries
                  </div>
                </div>
                <ChevronRight size={16} color="#a59478" />
              </button>
            )}
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
              Add to Google Calendar
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

  const handleDisable = async () => {
    if (!confirm('Turn off push notifications? You can turn them back on anytime.')) return;
    setWorking(true);
    setErrorMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Tell the server to delete the subscription first
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', session.user.id)
              .eq('endpoint', sub.endpoint);
          }
        } catch (e) {
          console.warn('Failed to delete server subscription record:', e);
        }
        // Then unsubscribe locally
        await sub.unsubscribe();
      }
      setStatus('supported');
    } catch (e) {
      setErrorMsg(`Couldn't turn off: ${e.message || 'unknown error'}`);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#5c4a38' }}>Notifications are on.</strong>
              <p style={{ fontSize: 12, color: '#5c4a38', marginTop: 6 }}>
                You'll get a banner when cover is needed or someone messages the team.
              </p>
            </div>
            <button onClick={handleDisable} disabled={working} className="salus-btn" style={{
              background: 'transparent', border: 'none', padding: 4,
              color: '#7a8270', fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap',
            }}>
              {working ? 'Turning off…' : 'Turn off'}
            </button>
          </div>
          {errorMsg && (
            <p style={{ fontSize: 12, color: '#c8442a', marginTop: 10, lineHeight: 1.5 }}>{errorMsg}</p>
          )}
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
                  <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 17, fontWeight: 600, color: '#1a2620' }}>{cls.time}</div>
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

// ──────────────────────────────────────────────────────────────────────────────
// TASKS PAGE — full-screen view: By Person / All / Mine
// ──────────────────────────────────────────────────────────────────────────────

function TasksPage({ data, currentUser, isManager, onClose, onOpenTask, onCreateTask }) {
  const [view, setView] = useState(isManager ? 'byPerson' : 'mine');
  // 'byPerson' | 'all' | 'mine'

  const openTasks = data.tasks.filter(t =>
    !t.isTemplate
    && !t.parentTaskId       // hide subtasks from top level
    && t.status !== 'done'
  );

  // Bucket: per user
  const byPerson = useMemo(() => {
    const map = new Map();
    // Initialise every staffer's row even if they have 0 open
    data.users.filter(u => u.isFoh || u.isCoach || u.role === 'manager').forEach(u => {
      map.set(u.id, { user: u, tasks: [] });
    });
    openTasks.forEach(t => {
      if (t.audience === 'specific' && t.assigneeId) {
        if (map.has(t.assigneeId)) map.get(t.assigneeId).tasks.push(t);
      } else {
        // Group-audience tasks: shown under each matching person
        data.users.forEach(u => {
          if ((t.audience === 'all_foh'   && u.isFoh)
           || (t.audience === 'all_coach' && u.isCoach)
           || (t.audience === 'all_staff')) {
            if (map.has(u.id)) map.get(u.id).tasks.push(t);
          }
        });
      }
    });
    // Sort: most tasks first, then alphabetical
    return [...map.values()].sort((a, b) => {
      if (b.tasks.length !== a.tasks.length) return b.tasks.length - a.tasks.length;
      return (a.user.name || '').localeCompare(b.user.name || '');
    });
  }, [data.tasks, data.users]);

  const mine = openTasks.filter(t =>
    (t.audience === 'specific' && t.assigneeId === currentUser.id)
    || (t.audience === 'all_foh'   && currentUser.isFoh)
    || (t.audience === 'all_coach' && currentUser.isCoach)
    || (t.audience === 'all_staff')
  );

  return (
    <div style={styles.threadBackdrop} onClick={onClose}>
      <div style={{ ...styles.threadSheet, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.threadHeader}>
          <button onClick={onClose} className="salus-btn" style={styles.threadCloseBtn}><X size={20} /></button>
          <div style={styles.threadHeaderTitle}>Tasks</div>
          <button onClick={onCreateTask} className="salus-btn" style={styles.threadCloseBtn}><Plus size={20} /></button>
        </div>

        {/* View switcher */}
        <div style={styles.tasksPageViewRow}>
          {isManager && (
            <button onClick={() => setView('byPerson')} className="salus-btn"
              style={{ ...styles.tasksPageViewBtn, ...(view === 'byPerson' ? styles.tasksPageViewBtnActive : {}) }}>
              By person
            </button>
          )}
          <button onClick={() => setView('mine')} className="salus-btn"
            style={{ ...styles.tasksPageViewBtn, ...(view === 'mine' ? styles.tasksPageViewBtnActive : {}) }}>
            Mine ({mine.length})
          </button>
          <button onClick={() => setView('all')} className="salus-btn"
            style={{ ...styles.tasksPageViewBtn, ...(view === 'all' ? styles.tasksPageViewBtnActive : {}) }}>
            All ({openTasks.length})
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {view === 'byPerson' && (
            byPerson.length === 0 ? (
              <div style={styles.tasksPageEmpty}>No staff yet.</div>
            ) : (
              byPerson.map(({ user, tasks }) => (
                <PersonTaskGroup
                  key={user.id}
                  user={user}
                  tasks={tasks}
                  data={data}
                  currentUser={currentUser}
                  onOpenTask={onOpenTask}
                />
              ))
            )
          )}

          {view === 'mine' && (
            mine.length === 0 ? (
              <div style={styles.tasksPageEmpty}>Nothing on your plate. Nice.</div>
            ) : (
              mine.map(t => (
                <TaskCard key={t.id} task={t} data={data} currentUser={currentUser}
                  onOpen={() => onOpenTask(t.id)} />
              ))
            )
          )}

          {view === 'all' && (
            openTasks.length === 0 ? (
              <div style={styles.tasksPageEmpty}>No open tasks.</div>
            ) : (
              openTasks
                .sort((a, b) => {
                  // Urgent first, then by due date, then by created
                  if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
                  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                  if (a.dueDate) return -1;
                  if (b.dueDate) return 1;
                  return b.createdAt - a.createdAt;
                })
                .map(t => (
                  <TaskCard key={t.id} task={t} data={data} currentUser={currentUser}
                    onOpen={() => onOpenTask(t.id)} />
                ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PersonTaskGroup({ user, tasks, data, currentUser, onOpenTask }) {
  const [open, setOpen] = useState(tasks.length > 0 && tasks.length <= 5);
  const projectCount = tasks.filter(t => t.taskKind === 'project').length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;
  const blockedCount = tasks.filter(t => t.status === 'blocked').length;

  return (
    <div style={styles.personGroup}>
      <button onClick={() => setOpen(o => !o)} className="salus-btn" style={styles.personGroupHeader}>
        <UserAvatar user={user} size={36} fontSize={13} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2620' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: '#7a8270', marginTop: 2 }}>
            {tasks.length === 0
              ? 'No open tasks'
              : `${tasks.length} open${projectCount > 0 ? ` · ${projectCount} project` : ''}${urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}${blockedCount > 0 ? ` · ${blockedCount} blocked` : ''}`}
          </div>
        </div>
        {tasks.length > 0 && (
          <ChevronRight size={16} color="#a59478" style={{
            transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s',
          }} />
        )}
      </button>
      {open && tasks.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} data={data} currentUser={currentUser}
              onOpen={() => onOpenTask(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToursTile({ data, currentUser, onOpenTour }) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const now = Date.now();
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const tomorrowEnd = todayStart + 2 * 86400 * 1000;

  const manualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch('/api/sync-tours', { method: 'GET' });
    } catch {}
    setTimeout(() => setSyncing(false), 1500);
  };

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
          <button onClick={manualSync} disabled={syncing} className="salus-btn" style={{
            ...styles.btnGhost, marginTop: 8, fontSize: 11,
            opacity: syncing ? 0.5 : 1,
          }}>
            {syncing ? 'Refreshing…' : 'Refresh from Google Calendar'}
          </button>
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
          <button onClick={manualSync} disabled={syncing} className="salus-btn" style={{
            ...styles.btnGhost, margin: '8px auto 0', display: 'block',
            fontSize: 11, opacity: syncing ? 0.5 : 1,
          }}>
            {syncing ? 'Refreshing…' : '↻ Refresh from Google'}
          </button>
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
          {tour.guestPhone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {tour.guestPhone}</span>}
          {tour.guestEmail && !tour.guestPhone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AtSign size={11} /> {tour.guestEmail}</span>}
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
                <a href={`tel:${tour.guestPhone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#5c4a38', textDecoration: 'none', marginTop: 2 }}>
                  <Phone size={13} /> {tour.guestPhone}
                </a>
              )}
              {tour.guestEmail && (
                <a href={`mailto:${tour.guestEmail}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#5c4a38', textDecoration: 'none', marginTop: 4 }}>
                  <AtSign size={13} /> {tour.guestEmail}
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

function TasksTile({ data, currentUser, isManager, onCreate, onOpenTask, onOpenAll }) {
  const [open, setOpen] = useState(false);

  // Manager sees all open tasks; everyone else sees only theirs.
  // Hide templates AND subtasks (subtasks are managed inside their parent).
  const allOpen = data.tasks.filter(t =>
    !t.isTemplate
    && !t.parentTaskId
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

  // In the tile, only show first 5. "View all" button opens the full TasksPage.
  const preview = sorted.slice(0, 5);
  const hasMore = sorted.length > preview.length;

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
          {preview.map(t => (
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
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={onOpenAll} className="salus-btn" style={styles.tasksOpenAllBtn}>
          {hasMore ? `View all ${sorted.length} tasks →` : 'Open Tasks board →'}
        </button>
        {isManager && (
          <button onClick={onCreate} className="salus-btn" style={styles.tasksCreateBtn}>
            <Plus size={16} /> New task
          </button>
        )}
      </div>
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
  // Subtask progress (for project tasks)
  const subtasks = data.tasks.filter(t => t.parentTaskId === task.id);
  const subDone = subtasks.filter(s => s.status === 'done').length;
  const hasSubtasks = subtasks.length > 0;
  const subPct = hasSubtasks ? Math.round((subDone / subtasks.length) * 100) : 0;

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
          {isProject && <Target size={11} style={{ marginRight: 5, verticalAlign: '-1px', color: '#7a8c5c' }} />}
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
            <span style={{ color: '#7a8270', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              · <MessageSquare size={10} /> {commentCount}
            </span>
          )}
          {hasSubtasks && (
            <span style={{ color: '#7a8270' }}>· {subDone}/{subtasks.length}</span>
          )}
        </div>
        {hasSubtasks && (
          <div style={styles.progressTrackMini}>
            <div style={{
              ...styles.progressFill,
              width: `${subPct}%`,
              background: subPct === 100 ? '#7a8c5c' : '#c6926a',
            }} />
          </div>
        )}
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
      recurrence,
      recurrenceDays,
      taskKind,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const toggleDay = (d) => {
    setRecurrenceDays(days => days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
  };

  // Sort: FOH first, then coaches, alphabetical within. Include self (manager can self-assign).
  const pickableStaff = data.users
    .filter(u => u.isFoh || u.isCoach || u.id === currentUser.id)
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
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <ListChecks size={13} /> Daily / routine
            </button>
            <button onClick={() => setTaskKind('project')} className="salus-btn"
              style={{
                ...styles.audiencePill,
                flex: 1,
                ...(taskKind === 'project'
                  ? { background: '#7a8c5c', color: '#fff', borderColor: '#7a8c5c' }
                  : {}),
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Target size={13} /> Project / one-off
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

          {/* Recurrence — available for both daily and project tasks */}
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

function TaskDetailModal({ task, data, currentUser, isManager, onClose, onMarkDone, onSetStatus, onDelete, onAddComment, onDeleteComment, onAddSubtask, onToggleSubtask, onDeleteSubtask }) {
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const composerRef = useRef(null);
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

  // Subtasks
  const subtasks = data.tasks
    .filter(t => t.parentTaskId === task.id)
    .sort((a, b) => a.createdAt - b.createdAt);
  const subDone = subtasks.filter(s => s.status === 'done').length;

  // Mention autocomplete: show users matching the current @query
  const mentionableUsers = (mentionQuery
    ? data.users.filter(u => (u.name || '').toLowerCase().startsWith(mentionQuery.toLowerCase()) && u.id !== currentUser.id)
    : data.users.filter(u => u.id !== currentUser.id)
  ).slice(0, 6);

  const insertMention = (user) => {
    const firstName = (user.name || '').split(' ')[0];
    // Replace the @query in progress with @FirstName
    const cursor = composerRef.current?.selectionStart ?? commentText.length;
    const before = commentText.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      const replaced = commentText.slice(0, atIdx) + '@' + firstName + ' ' + commentText.slice(cursor);
      setCommentText(replaced);
    }
    setShowMentionList(false);
    setMentionQuery('');
    setTimeout(() => composerRef.current?.focus(), 0);
  };

  const handleComposerChange = (val) => {
    setCommentText(val);
    // Detect @query: text between last @ and current cursor
    const cursor = composerRef.current?.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const after = before.slice(atIdx + 1);
      if (!/\s/.test(after)) {
        setShowMentionList(true);
        setMentionQuery(after);
        return;
      }
    }
    setShowMentionList(false);
    setMentionQuery('');
  };

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
          <div style={{ ...styles.threadHeaderTitle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {isProject ? <><Target size={15} /> Project task</> : <><ListChecks size={15} /> Task</>}
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

          {/* Subtasks — project tasks only */}
          {isProject && (
            <div style={{ marginTop: 14, borderTop: '1px solid #efe7d2', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ ...styles.commentsLabel, marginBottom: 0 }}>Subtasks</div>
                {subtasks.length > 0 && (
                  <div style={{ fontSize: 11, color: '#7a8270', fontWeight: 600 }}>
                    {subDone} of {subtasks.length}
                  </div>
                )}
              </div>
              {subtasks.length > 0 && (
                <div style={styles.progressTrack}>
                  <div style={{
                    ...styles.progressFill,
                    width: `${Math.round((subDone / subtasks.length) * 100)}%`,
                    background: subDone === subtasks.length ? '#7a8c5c' : '#c6926a',
                  }} />
                </div>
              )}
              {subtasks.map(s => {
                const sAssignee = s.assigneeId ? data.users.find(u => u.id === s.assigneeId) : null;
                const sDone = s.status === 'done';
                return (
                  <div key={s.id} style={styles.subtaskRow}>
                    <button
                      onClick={() => onToggleSubtask(s.id, !sDone)}
                      className="salus-btn"
                      style={styles.subtaskCheck}
                      aria-label={sDone ? 'Mark not done' : 'Mark done'}
                    >
                      {sDone && <Check size={12} color="#fff" strokeWidth={3} />}
                    </button>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontSize: 13, color: sDone ? '#a59478' : '#1a2620',
                        textDecoration: sDone ? 'line-through' : 'none',
                      }}>
                        {s.title}
                      </div>
                      {sAssignee && (
                        <div style={{ fontSize: 10, color: '#7a8270', marginTop: 1 }}>
                          {sAssignee.name?.split(' ')[0]}
                        </div>
                      )}
                    </div>
                    {(s.createdBy === currentUser.id || isManager || s.assigneeId === currentUser.id) && (
                      <button
                        onClick={() => { if (confirm('Delete this subtask?')) onDeleteSubtask(s.id); }}
                        className="salus-btn"
                        style={{ background: 'transparent', border: 'none', padding: 2, color: '#a59478' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
              {/* Add subtask */}
              {canUpdate && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input
                    type="text"
                    className="salus-input"
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && subtaskTitle.trim() && !addingSubtask) {
                        setAddingSubtask(true);
                        await onAddSubtask(task.id, subtaskTitle, null);
                        setSubtaskTitle('');
                        setAddingSubtask(false);
                      }
                    }}
                    placeholder="+ Add a subtask…"
                    style={{ flex: 1, fontSize: 13, fontFamily: 'inherit' }}
                  />
                </div>
              )}
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
                      <div style={styles.commentText}>{renderMentionedText(c.text, c.mentionUserIds, currentUser.id)}</div>
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
          <div style={{ position: 'relative', borderTop: '1px solid #ebe3cf', background: '#fffdf7' }}>
            {/* @mention autocomplete dropdown */}
            {showMentionList && mentionableUsers.length > 0 && (
              <div style={styles.mentionDropdown}>
                {mentionableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => insertMention(u)}
                    className="salus-btn"
                    style={styles.mentionRow}
                  >
                    <UserAvatar user={u} size={26} fontSize={10} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, color: '#1a2620' }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: '#7a8270' }}>
                        {u.isCoach ? 'Coach' : ''}{u.isCoach && u.isFoh ? ' · ' : ''}{u.isFoh ? 'FOH' : ''}
                        {u.role === 'manager' ? 'Manager' : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, padding: '10px 12px', alignItems: 'flex-end' }}>
              <textarea
                ref={composerRef}
                className="salus-input"
                value={commentText}
                onChange={(e) => handleComposerChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !showMentionList) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
                placeholder="Add a note. Type @ to mention someone…"
                rows={1}
                style={{
                  flex: 1, fontFamily: 'inherit', resize: 'none',
                  minHeight: 38, maxHeight: 120, lineHeight: 1.4,
                }}
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

// ─── ModalPortal — wraps any modal in a portal to document.body ─────────
// Use this for any modal that needs to escape its parent containers
// (anything with position: fixed inside a transformed/positioned ancestor).
function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function Modal({ children, onClose }) {
  return createPortal(
    <div style={styles.modalOverlay} onClick={onClose}>
      <div className="salus-modal-content salus-modal-card" style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={styles.modalClose}><X size={18} /></button>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────────────────────────────────────

const styles = {
  app: {
    height: '100%',
    background: '#f5f1e8',
    fontFamily: "'Inter', -apple-system, sans-serif",
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
    fontFamily: '"Playfair Display", serif', fontSize: 13, fontStyle: 'italic',
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
  homeContainer: { padding: '0 0 100px' },

  // Home-only warm gradient backdrop. Three layers, all very subtle:
  //   1) Linear cream → warmer cream (top to bottom, candlelit feel)
  //   2) Amber radial wash at bottom-center (golden-hour glow, 16%)
  //   3) Sage radial whisper top-right (depth, 8%)
  // Total opacity of warm layers stays under ~24% combined to keep it whispered, not pink.
  // Combined with `salus-home-bleed` class to escape main's padding.
  // NOTE: use paddingTop/paddingBottom (not shorthand `padding`) so the
  // bleed class's responsive padding-left/right keeps working.
  homePageBackdrop: {
    paddingTop: 0,
    paddingBottom: 100,
    background: 'radial-gradient(ellipse 110% 55% at 50% 105%, rgba(198, 146, 106, 0.16) 0%, rgba(198, 146, 106, 0) 65%), radial-gradient(ellipse 55% 35% at 78% 10%, rgba(122, 130, 92, 0.08) 0%, rgba(122, 130, 92, 0) 70%), linear-gradient(180deg, #fffdf7 0%, #fbf4e6 100%)',
    minHeight: '100%',
  },
  homeGreeting: { padding: '24px 0 24px' },
  homeH1: { fontFamily: '"Playfair Display", serif', fontSize: 30, fontWeight: 400, color: '#1a2620', margin: 0, letterSpacing: '-0.015em', lineHeight: 1.1 },
  homeGreetSub: { fontSize: 13, color: '#7a8270', marginTop: 6, margin: 0, letterSpacing: '0.01em' },
  homeSection: { marginTop: 28 },
  homeSectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, padding: '0 2px' },
  homeSectionTitle: { fontSize: 10, fontWeight: 600, color: '#7a8270', letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center' },
  homeSectionCount: { background: 'transparent', color: '#c8442a', padding: '0 0 0 10px', fontSize: 13, fontWeight: 600, letterSpacing: 0, fontFamily: '"Playfair Display", serif' },
  homeSectionLink: { fontSize: 11, color: '#a59478', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer', padding: 4, letterSpacing: '0.05em' },
  homeEmptyCover: { padding: '32px 20px', background: 'transparent', textAlign: 'center' },

  // ─── Collapsible tile (Home) — quieter, more editorial ───
  tile: {
    background: '#fffdf7', borderRadius: 18, border: 'none',
    marginTop: 12, overflow: 'hidden',
    boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)',
  },
  tileHeader: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '18px 20px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  tileHeaderTitleRow: { display: 'flex', alignItems: 'center', gap: 10 },
  tileTitle: { fontFamily: '"Playfair Display", serif', fontSize: 17, fontWeight: 500, color: '#1a2620', letterSpacing: '-0.005em' },
  tileCount: {
    color: '#1a2620', fontSize: 14, fontWeight: 500,
    padding: 0, minWidth: 'auto', textAlign: 'left',
    background: 'transparent', letterSpacing: '0.02em',
    fontFamily: '"Playfair Display", serif',
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
    fontSize: 15, fontWeight: 600, color: '#1a2620', fontFamily: '"Playfair Display", serif',
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
  coverHomeWhenTime: { fontFamily: '"Playfair Display", serif', fontSize: 17, color: '#1a2620', marginTop: 2, fontWeight: 600 },
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
  homeRequestCard: {
    background: '#fffdf7', border: 'none', borderRadius: 18,
    padding: '22px 22px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 16,
    width: '100%', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
    boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)',
  },
  homeRequestIcon: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'transparent', color: '#5c4a38',
    border: '1px solid #efe7d2',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  homeRequestTitle: { fontFamily: '"Playfair Display", serif', fontSize: 16, fontWeight: 500, color: '#1a2620', letterSpacing: '-0.005em' },
  homeRequestSub: { fontSize: 12, color: '#a59478', marginTop: 3 },

  homeHireCard: {
    background: '#fffdf7', border: 'none', borderRadius: 18,
    padding: '22px 22px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 16,
    width: '100%', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
    boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)',
  },
  homeHireIcon: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'transparent', color: '#5c4a38',
    border: '1px solid #efe7d2',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Your day
  homeDayCard: { background: '#fffdf7', borderRadius: 18, border: 'none', padding: '6px 22px', boxShadow: '0 1px 0 rgba(92, 74, 56, 0.06)' },
  homeDayRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  homeDayRowBorder: { borderTop: '1px solid #efe7d2' },
  homeDayTime: { fontFamily: '"Playfair Display", serif', fontSize: 15, fontWeight: 500, color: '#5c4a38', minWidth: 54, textAlign: 'left', letterSpacing: '-0.005em' },
  homeDayTitle: { fontSize: 14, fontWeight: 500, color: '#1a2620', letterSpacing: '-0.005em' },
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
  meStatNum: { fontFamily: '"Playfair Display", serif', fontSize: 24, fontWeight: 500, color: '#1a2620' },
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
    width: 36, height: 36, borderRadius: '50%',
    background: 'transparent', border: '1px solid #efe7d2',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#5c4a38', padding: 0, flexShrink: 0,
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
    fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 500,
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
    fontFamily: '"Playfair Display", serif', fontSize: 24, fontWeight: 500,
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
    display: 'flex', gap: 20, padding: '0 4px 12px',
    background: 'transparent', borderBottom: '1px solid #efe7d2',
    marginBottom: 4,
  },
  viewToggleBtn: {
    padding: '6px 0', borderRadius: 0,
    background: 'transparent', border: 'none',
    borderBottom: '1.5px solid transparent',
    fontSize: 11, fontWeight: 500, color: '#a59478',
    fontFamily: 'inherit', cursor: 'pointer',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: -1,
  },
  viewToggleBtnActive: {
    background: 'transparent', color: '#1a2620',
    borderBottomColor: '#1a2620', fontWeight: 600,
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
  fohDayBlock: { padding: '18px 0 2px' },
  fohDayHeader: {
    display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4,
    padding: '0 4px 8px', background: 'transparent',
    borderBottom: '1px solid #efe7d2',
  },
  fohDayHeaderToday: { background: 'transparent' },
  fohDayName: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11, fontWeight: 600, color: '#1a2620',
    letterSpacing: '0.12em', textTransform: 'uppercase',
  },
  fohDayDate: {
    fontSize: 10, color: '#a59478', letterSpacing: '0.08em',
    textTransform: 'uppercase', fontWeight: 500,
  },
  fohTodayBadge: {
    background: 'transparent', color: '#c8442a', fontSize: 9, fontWeight: 600,
    padding: 0, borderRadius: 0, textTransform: 'uppercase', letterSpacing: 1.8,
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
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 4px', borderRadius: 0,
    background: 'transparent', border: 'none',
    borderBottom: '1px solid #efe7d2',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
    textAlign: 'left',
    position: 'relative',
  },
  scheduleCardCover: {
    background: 'transparent', borderColor: '#efe7d2',
  },
  scheduleCardMine: {
    background: 'transparent', borderColor: '#efe7d2',
  },
  scheduleCardTime: {
    display: 'flex', flexDirection: 'column', gap: 2,
    minWidth: 64, flexShrink: 0,
  },
  scheduleCardTimeMain: {
    fontFamily: '"Playfair Display", serif',
    fontSize: 17, fontWeight: 500, color: '#1a2620',
    letterSpacing: '-0.01em',
  },
  scheduleCardTimeSub: {
    fontSize: 10, color: '#a59478', letterSpacing: '0.05em',
    textTransform: 'uppercase', fontWeight: 500,
  },
  scheduleCardMid: { flex: 1, minWidth: 0 },
  scheduleCardTitle: {
    fontSize: 14, fontWeight: 500, color: '#1a2620',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    letterSpacing: '-0.005em',
  },
  scheduleCardSub: {
    fontSize: 11, color: '#a59478', marginTop: 3,
    letterSpacing: '0.02em',
  },
  scheduleCardRight: {
    display: 'flex', alignItems: 'center', gap: 8,
    flexShrink: 0,
    width: 110, justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  scheduleCardName: {
    fontSize: 12, fontWeight: 500, color: '#5c4a38',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    minWidth: 0,
  },
  scheduleCoverChip: {
    background: 'transparent', color: '#c8442a',
    fontSize: 10, fontWeight: 600, padding: 0,
    borderRadius: 0, textTransform: 'uppercase', letterSpacing: 2,
    display: 'inline-flex', alignItems: 'center', gap: 5,
  },
  scheduleUnassigned: {
    fontSize: 11, color: '#a59478', fontStyle: 'italic',
    letterSpacing: '0.02em',
  },
  scheduleFab: {
    position: 'fixed', right: 20,
    bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))',
    background: '#1a2620', color: '#fffdf7', border: 'none',
    width: 52, height: 52, borderRadius: '50%',
    fontFamily: 'inherit', fontSize: 22, fontWeight: 400,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(26, 38, 32, 0.3)',
    zIndex: 50,
  },

  // ─── PERIOD TOGGLE (Day/Week/Month) ───
  periodToggleRow: {
    display: 'flex', gap: 20, padding: '0 4px 12px',
    background: 'transparent',
    borderBottom: '1px solid #efe7d2', marginBottom: 4,
  },
  periodToggleBtn: {
    padding: '6px 0', borderRadius: 0,
    background: 'transparent', border: 'none',
    borderBottom: '1.5px solid transparent',
    fontSize: 11, fontWeight: 500, color: '#a59478',
    fontFamily: 'inherit', cursor: 'pointer',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: -1,
  },
  periodToggleBtnActive: {
    background: 'transparent', color: '#1a2620',
    borderBottomColor: '#1a2620', fontWeight: 600,
  },

  // ─── MONTH GRID ───
  monthGridDayHeader: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    padding: '0 0 8px',
  },
  monthGridDayLabel: {
    textAlign: 'center', fontSize: 9, fontWeight: 500,
    color: '#a59478', letterSpacing: 2, textTransform: 'uppercase',
    padding: '4px 0',
  },
  monthGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    rowGap: 4, padding: 0,
  },
  monthGridCell: {
    aspectRatio: '1 / 1',
    background: 'transparent', border: 'none',
    borderRadius: 0, padding: 4,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    fontFamily: 'inherit', cursor: 'pointer',
    position: 'relative',
  },
  monthGridCellToday: {
    background: 'transparent', borderColor: 'transparent',
  },
  monthGridCellCover: {
    background: 'transparent', borderColor: 'transparent',
  },
  monthGridEmpty: {
    aspectRatio: '1 / 1',
  },
  monthGridCellDate: {
    fontFamily: '"Playfair Display", serif',
    fontSize: 16, fontWeight: 400, color: '#1a2620', textAlign: 'center',
    letterSpacing: '-0.01em',
    width: 30, height: 30, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  monthGridDots: {
    display: 'flex', justifyContent: 'center', gap: 3, height: 5,
  },
  monthGridDot: {
    width: 4, height: 4, borderRadius: '50%',
  },
  monthGridLegend: {
    display: 'flex', gap: 18, padding: '18px 0 4px',
    fontSize: 10, color: '#a59478', justifyContent: 'center',
    letterSpacing: '0.05em',
  },
  monthGridLegendItem: {
    display: 'flex', alignItems: 'center', gap: 6,
  },

  // ─── ROLE PICKER ───
  rolePickerWrap: {
    minHeight: '100vh', background: '#f5f1e8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, fontFamily: "'Inter', sans-serif",
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
    fontFamily: '"Playfair Display", Georgia, serif', fontSize: 24, lineHeight: 1.25,
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
    fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, color: '#5c4a38',
    marginTop: 4, lineHeight: 1,
  },
  statsSubLine: { fontSize: 12, color: '#7a8270', marginTop: 6 },
  statsStreak: {
    background: '#fef0ea', border: '1px solid #f3c8b5',
    borderRadius: 12, padding: '10px 12px', textAlign: 'center', minWidth: 78,
  },
  statsStreakNum: { fontFamily: '"Playfair Display", serif', fontSize: 26, color: '#c8442a', lineHeight: 1 },
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
    fontFamily: '"Playfair Display", Georgia, serif',
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
  flowsEmptyTitle: { fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#5c4a38' },
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
    fontFamily: '"Playfair Display", Georgia, serif', fontSize: 17,
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
    fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22,
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

  // ─── TASKS PAGE ───
  tasksPageViewRow: {
    display: 'flex', gap: 4, padding: '8px 12px',
    borderBottom: '1px solid #efe7d2', background: '#fffdf7',
    overflowX: 'auto',
  },
  tasksPageViewBtn: {
    padding: '7px 14px', borderRadius: 999,
    background: 'transparent', color: '#7a8270',
    fontSize: 13, fontWeight: 600, border: '1px solid #efe7d2',
    fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer',
  },
  tasksPageViewBtnActive: {
    background: '#5c4a38', color: '#fff', borderColor: '#5c4a38',
  },
  tasksPageEmpty: {
    padding: 40, textAlign: 'center', fontSize: 13, color: '#7a8270',
  },
  personGroup: {
    marginBottom: 14,
  },
  personGroupHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: '#fffdf7',
    border: '1px solid #efe7d2', borderRadius: 10,
    width: '100%', cursor: 'pointer', fontFamily: 'inherit',
  },
  tasksOpenAllBtn: {
    flex: 1, padding: '10px 14px', borderRadius: 999,
    background: '#5c4a38', color: '#fffdf7',
    border: 'none', fontSize: 12, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
  },

  // ─── SUBTASKS ───
  subtaskRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 0', borderBottom: '1px solid #f5f1e8',
  },
  subtaskCheck: {
    width: 20, height: 20, borderRadius: 4,
    border: '1.5px solid #c6926a',
    background: '#fffdf7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },

  // ─── PROGRESS BAR (subtask completion) ───
  progressTrack: {
    height: 6, borderRadius: 999,
    background: '#efe7d2', overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%', borderRadius: 999,
    background: '#c6926a',
    transition: 'width 0.25s ease',
  },
  progressTrackMini: {
    height: 4, borderRadius: 999,
    background: '#efe7d2', overflow: 'hidden',
    marginTop: 4,
  },

  // ─── ADMIN PAGE ───
  adminTabRow: {
    display: 'flex', gap: 6, padding: '0 0 12px 0',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  },
  adminTab: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 12px', borderRadius: 999,
    background: '#fffdf7', border: '1px solid #efe7d2',
    color: '#7a8270', fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  adminTabActive: {
    background: '#5c4a38', borderColor: '#5c4a38', color: '#fffdf7',
  },
  adminSectionHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, padding: '0 4px',
  },
  adminSectionTitle: {
    fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1a2620',
  },
  adminSectionSubtitle: {
    fontSize: 11, color: '#7a8270', marginTop: 2,
  },
  emailCard: {
    background: '#fffdf7', border: '1px solid #efe7d2',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  emailCardHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  emailFrom: {
    fontSize: 13, fontWeight: 700, color: '#1a2620',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    flex: 1, marginRight: 8,
  },
  emailDate: {
    fontSize: 11, color: '#a59478', flexShrink: 0,
  },
  emailSubject: {
    fontSize: 13, color: '#5c4a38', marginBottom: 4,
    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
    WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
  },
  emailSnippet: {
    fontSize: 12, color: '#7a8270', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  emptyCard: {
    background: '#fffdf7', border: '1px solid #efe7d2',
    borderRadius: 14, padding: 24,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: 10,
  },
  emptyBody: {
    fontSize: 13, color: '#7a8270', lineHeight: 1.5, maxWidth: 300,
  },

  // ─── @MENTION DROPDOWN ───
  mentionDropdown: {
    position: 'absolute', bottom: '100%', left: 12, right: 12,
    background: '#fffdf7', border: '1px solid #ebe3cf',
    borderRadius: 10, boxShadow: '0 -4px 12px rgba(92, 74, 56, 0.15)',
    maxHeight: 220, overflowY: 'auto',
    marginBottom: 4,
  },
  mentionRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', width: '100%',
    background: 'transparent', border: 'none',
    borderBottom: '1px solid #f5f1e8',
    cursor: 'pointer', fontFamily: 'inherit',
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
    fontFamily: '"Playfair Display", Georgia, serif',
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
    fontFamily: '"Playfair Display", Georgia, serif',
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
    fontFamily: '"Playfair Display", serif', fontSize: 20, color: '#5c4a38',
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
    background: 'rgba(255, 253, 247, 0.95)', backdropFilter: 'blur(12px)',
    borderTop: '1px solid #efe7d2',
    display: 'flex', padding: '10px 12px 8px',
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
    zIndex: 100,
  },
  bottomTab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: 4, color: '#a59478', background: 'none', border: 'none',
    fontFamily: 'inherit', cursor: 'pointer', position: 'relative',
    transition: 'color 0.15s ease',
  },
  bottomTabActive: { color: '#1a2620' },
  bottomTabLabel: { fontSize: 10, fontWeight: 500, letterSpacing: '0.05em' },
  bottomTabLabelActive: { fontWeight: 600 },
  bottomTabBadge: {
    position: 'absolute', top: 0, right: '28%',
    background: '#c8442a', color: '#fffdf7', fontSize: 9, fontWeight: 600,
    minWidth: 16, height: 16, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
  },

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
  logoText: { fontFamily: '"Playfair Display", serif', fontSize: 20, fontWeight: 500, lineHeight: 1.1, color: '#1a2620' },
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
    padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 32px 100px',
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
    top: 'env(safe-area-inset-top, 0px)',
    // Match the bottom nav's actual rendered height so the chat input sits
    // flush against it. Nav = 10px top pad + 46px tab content + 10px+safe-area bottom pad ≈ 66px.
    bottom: 'calc(66px + env(safe-area-inset-bottom, 0px))',
    left: 0, right: 0,
    paddingTop: 8, paddingLeft: 8, paddingRight: 8, paddingBottom: 0,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: '#f5f1e8',
  },

  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 20, gap: 16, flexWrap: 'wrap',
  },
  h2: {
    fontFamily: '"Playfair Display", serif', fontSize: 30, fontWeight: 500,
    margin: 0, color: '#1a2620', lineHeight: 1.15, letterSpacing: -0.3,
  },
  h3: {
    fontFamily: '"Playfair Display", serif', fontSize: 18, fontWeight: 500,
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
  dayName: { fontFamily: '"Playfair Display", serif', fontSize: 15, fontWeight: 500, color: '#1a2620' },
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
    fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 500,
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
    fontFamily: '"Playfair Display", serif', fontSize: 20, fontWeight: 500,
    marginTop: 14, color: '#1a2620',
  },
  emptyText: { fontSize: 13, color: '#7a8270', marginTop: 8 },

  // Chat
  chatContainer: {
    background: '#fffdf7',
    borderRadius: '12px 12px 0 0',
    borderTop: '1px solid #e8e0cc',
    borderLeft: '1px solid #e8e0cc',
    borderRight: '1px solid #e8e0cc',
    borderBottom: 'none',
    display: 'flex', flexDirection: 'column',
    flex: 1, minHeight: 0,
    overflow: 'hidden',
  },

  // ─── EDITORIAL CHAT HEADER (Silo-inspired: hero date + roster section) ───
  chatStudioHero: {
    padding: '24px 22px 18px',
    background: '#fffdf7',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12,
    flexShrink: 0,
  },
  chatStudioEyebrow: {
    fontSize: 10, color: '#a59478', fontWeight: 600,
    letterSpacing: '0.22em', textTransform: 'uppercase',
  },
  chatStudioHeroTitle: {
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: 30, color: '#1a2620', lineHeight: 1.05,
    letterSpacing: '-0.015em', fontWeight: 500,
    margin: '8px 0 0',
  },
  chatStudioNowLine: {
    fontSize: 12.5, color: '#7a8270', marginTop: 8,
    fontStyle: 'italic', lineHeight: 1.4,
  },
  chatHeaderIconBtn: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'transparent', border: '1px solid #ebe3cf',
    color: '#a59478', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
    marginTop: 4,
  },
  chatStudioRosterSection: {
    padding: '6px 0 20px',
    background: '#fffdf7',
    borderBottom: '1px solid #ebe3cf',
    flexShrink: 0,
  },
  chatStudioSectionHeader: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    padding: '0 22px',
    marginBottom: 16,
  },
  chatStudioSectionMeta: {
    fontSize: 11, color: '#a59478',
    fontStyle: 'italic',
    letterSpacing: '0.02em',
  },
  chatRosterScroll: {
    display: 'flex', gap: 10,
    overflowX: 'auto', overflowY: 'hidden',
    padding: '2px 22px 4px',
    scrollSnapType: 'x proximity',
    WebkitOverflowScrolling: 'touch',
  },
  chatRosterItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flexShrink: 0, gap: 4, width: 80,
    scrollSnapAlign: 'start',
  },
  chatRosterAvatarWrap: {
    width: 68, height: 68, borderRadius: '50%',
    overflow: 'hidden',
  },
  chatRosterName: {
    fontSize: 13, color: '#1a2620', fontWeight: 500,
    marginTop: 10, lineHeight: 1.2,
    maxWidth: 80, textAlign: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    width: '100%',
  },
  chatRosterStatusLine: {
    fontSize: 11, fontWeight: 400,
    fontStyle: 'italic', lineHeight: 1.3,
    textAlign: 'center', maxWidth: 80,
    marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    width: '100%',
  },
  chatRosterQuiet: {
    display: 'flex', alignItems: 'center', gap: 8,
    margin: '0 22px', padding: '12px 14px', borderRadius: 12,
    background: '#faf6ec', border: '1px solid #ebe3cf',
    fontSize: 12.5, color: '#7a8270', fontStyle: 'italic',
  },

  chatHeader: {
    padding: '14px 18px', borderBottom: '1px solid #e8e0cc',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  chatTitle: {
    fontFamily: '"Playfair Display", serif', fontSize: 20, fontWeight: 500,
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
    flex: 1, overflowY: 'auto', padding: '20px 22px 0',
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
    display: 'flex', gap: 8, padding: '14px 14px 10px',
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
    fontFamily: '"Playfair Display", serif', fontSize: 34, fontWeight: 500,
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
    fontFamily: '"Playfair Display", serif', fontSize: 17, fontWeight: 500,
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
    padding: 16,
    paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    zIndex: 9990,
    backdropFilter: 'blur(2px)',
  },
  modalCard: {
    background: '#fffdf7', borderRadius: 16, maxWidth: 520, width: '100%',
    maxHeight: '100%', overflow: 'auto', position: 'relative',
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
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 22px', borderRadius: 999, border: 'none',
    background: '#1a2620', color: '#fffdf7', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 500, letterSpacing: '0.04em',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 22px', borderRadius: 999,
    border: '1px solid #1a2620', background: 'transparent',
    color: '#1a2620', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 999,
    border: '1px solid #efe7d2', background: 'transparent',
    color: '#7a8270', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
  },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 22px', borderRadius: 999,
    border: '1px solid #f5dcd6', background: 'transparent',
    color: '#c8442a', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
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
    minHeight: '100vh', display: 'flex',
    background: '#1a2620', padding: 0, fontFamily: "'Inter', -apple-system, sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  loginHero: {
    position: 'absolute', inset: 0,
    backgroundImage: 'url(/brand/reformer.jpg)',
    backgroundSize: 'cover', backgroundPosition: 'center',
    zIndex: 0,
  },
  loginHeroOverlay: {
    position: 'absolute', inset: 0, zIndex: 1,
    background: 'linear-gradient(180deg, rgba(26, 38, 32, 0.35) 0%, rgba(26, 38, 32, 0.55) 50%, rgba(26, 38, 32, 0.92) 100%)',
  },
  loginCard: {
    position: 'relative', zIndex: 2,
    background: 'rgba(255, 253, 247, 0.98)', backdropFilter: 'blur(20px)',
    borderRadius: 24, padding: '44px 36px 36px',
    maxWidth: 420, width: 'calc(100% - 40px)',
    margin: 'auto', marginBottom: 'max(40px, env(safe-area-inset-bottom))',
    boxShadow: '0 20px 60px rgba(26, 38, 32, 0.4)',
    border: 'none',
  },
  loginLogo: {
    display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
    marginBottom: 24,
  },
  loginLogoMark: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  loginLogoMarkImg: {
    width: '100%', height: '100%',
    objectFit: 'contain',
    filter: 'brightness(0)',
  },
  loginTitle: {
    fontFamily: '"Playfair Display", serif', fontSize: 30, fontWeight: 400,
    color: '#1a2620', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.015em',
  },
  loginSub: {
    fontSize: 13, color: '#7a8270', textAlign: 'center', marginBottom: 28,
    lineHeight: 1.5, fontWeight: 300,
  },
  loginField: { marginBottom: 16 },
  loginInput: {
    width: '100%', padding: '14px 16px', borderRadius: 10,
    border: '1px solid #efe7d2', background: '#fffdf7',
    fontFamily: 'inherit', fontSize: 14, color: '#1a2620',
  },
  loginError: {
    fontSize: 12, color: '#c8442a', marginTop: 8, padding: '8px 12px',
    background: '#fef0ec', borderRadius: 6, border: '1px solid #f3c8bd',
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
    fontFamily: '"Playfair Display", serif', fontSize: 16, fontWeight: 500,
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
    fontFamily: '"Playfair Display", serif', fontSize: 20, fontWeight: 500,
    color: 'inherit', marginTop: 2, lineHeight: 1,
  },
  dayPillDot: {
    position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%',
  },
  mobileDayHeader: {
    marginBottom: 12,
  },
  mobileDayHeaderDay: {
    fontFamily: '"Playfair Display", serif', fontSize: 20, fontWeight: 500,
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
