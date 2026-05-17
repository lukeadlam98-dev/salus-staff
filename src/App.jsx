import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, MessageSquare, Users, BarChart3, AlertCircle, Plus,
  Send, ArrowLeftRight, Check, X, Clock, Bell, RotateCcw, Settings, Mail, LogOut,
  ChevronLeft, ChevronRight, TrendingUp, Award, Activity, Trash2,
  Home as HomeIcon, FileText, User as UserIcon, Settings as SettingsIcon
} from 'lucide-react';
import { supabase } from './lib/supabase';
import {
  profileFromDb,
  classFromDb, classToDb,
  coverReqFromDb,
  swapReqFromDb,
  messageFromDb,
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
      const [profilesRes, classesRes, coverReqRes, swapReqRes, messagesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('cover_requests').select('*'),
        supabase.from('swap_requests').select('*'),
        supabase.from('messages').select('*').order('created_at', { ascending: true }),
      ]);

      const errors = [profilesRes, classesRes, coverReqRes, swapReqRes, messagesRes]
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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

  const sendMessage = async (text) => {
    if (!text || !text.trim()) return;
    const { error } = await supabase.from('messages').insert({
      user_id: currentUserId,
      text: text.trim(),
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

  // Everyone lands on Home — the cover-first dashboard.
  // Only runs once per sign-in.
  if (!tabInitialized && currentUser) {
    setTab('home');
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
          .salus-main { padding: 14px !important; }
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
          {(coverUnread + chatUnread) > 0 && (
            <button
              onClick={() => setTab(coverUnread > 0 ? 'home' : 'chat')}
              className="salus-btn"
              style={styles.bellBtn}
              title={`${coverUnread} new cover · ${chatUnread} new messages`}
            >
              <Bell size={18} color="#5c4a38" />
              <span style={styles.bellBtnBadge}>{coverUnread + chatUnread}</span>
            </button>
          )}
          {(coverUnread + chatUnread) === 0 && (
            <button
              className="salus-btn"
              style={styles.bellBtn}
              title="No new notifications"
              onClick={() => setTab('home')}
            >
              <Bell size={18} color="#a59478" />
            </button>
          )}

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

      <DailyQuote />

      {/* Main */}
      <main className="salus-main" style={styles.main}>
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
            onClaim={(req) => setModal({ type: 'coverThread', coverRequestId: req.id })}
            onExpressInterest={expressInterest}
            onViewAllCover={() => setTab('cover')}
            onViewChat={() => setTab('chat')}
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
          <Timetable
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            isMobile={isMobile}
            onClassClick={(classId) => setModal({ type: 'classDetail', classId })}
            onAddClass={() => setModal({ type: 'editClass', classId: null })}
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
            onClearAll={() => setModal({ type: 'clearChat' })}
          />
        )}
        {tab === 'stats' && (
          isManager
            ? <ManagerStats data={data} onShowInvoices={() => setModal({ type: 'invoices' })} />
            : <CoachStats data={data} currentUser={currentUser} />
        )}
        {tab === 'me' && (
          <MePage
            data={data}
            currentUser={currentUser}
            isManager={isManager}
            onOpenSettings={() => setModal({ type: 'settings' })}
            onShowInvoices={() => setModal({ type: 'invoices' })}
            onShowTimeOff={() => setModal({ type: 'timeOff' })}
            onSignOut={handleLogout}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={styles.bottomNav}>
        <BottomTab icon={HomeIcon} label="Home" active={tab==='home'} onClick={() => setTab('home')} />
        <BottomTab icon={Calendar} label="Schedule" active={tab==='timetable'} onClick={() => setTab('timetable')} />
        <BottomTab icon={MessageSquare} label="Chat" active={tab==='chat'} onClick={() => setTab('chat')} badge={chatUnread} />
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
      const isoDate = cellDate.toISOString().slice(0, 10);
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

function Home({ data, currentUser, isManager, onClassClick, onRequestCover, onClaim, onExpressInterest, onViewAllCover, onViewChat }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const todayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayIso = now.toISOString().slice(0, 10);

  // Today's classes (all of them, for the date subhead count)
  const classesToday = data.classes.filter(c => c.date === todayIso);

  // Open cover requests (where this user isn't the one who requested)
  const openCovers = data.coverRequests
    .filter(r => r.status === 'open' && r.requestedBy !== currentUser.id)
    .map(r => ({ ...r, cls: data.classes.find(c => c.id === r.classId) }))
    .filter(r => r.cls)
    .sort((a, b) => `${a.cls.date} ${a.cls.time}`.localeCompare(`${b.cls.date} ${b.cls.time}`));

  // Pending requests (for managers to approve)
  const pendingForManager = isManager
    ? data.coverRequests
        .filter(r => r.status === 'pending')
        .map(r => ({ ...r, cls: data.classes.find(c => c.id === r.classId) }))
        .filter(r => r.cls)
    : [];

  // User's upcoming classes today + tomorrow (next 4)
  const myUpcoming = data.classes
    .filter(c => c.coachId === currentUser.id && c.date >= todayIso)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 4);

  const firstName = currentUser.name?.split(' ')[0] || 'there';

  return (
    <div style={styles.homeContainer}>
      {/* Greeting */}
      <div style={styles.homeGreeting}>
        <h1 style={styles.homeH1}>{greeting}, {firstName}</h1>
        <p style={styles.homeGreetSub}>{todayStr} · {classesToday.length} {classesToday.length === 1 ? 'class' : 'classes'} today</p>
      </div>

      {/* Cover section */}
      <section style={styles.homeSection}>
        <div style={styles.homeSectionHead}>
          <div style={styles.homeSectionTitle}>
            Needs cover
            {openCovers.length > 0 && <span style={styles.homeSectionCount}>{openCovers.length}</span>}
          </div>
          {openCovers.length > 0 && (
            <button onClick={onViewAllCover} style={styles.homeSectionLink}>View all →</button>
          )}
        </div>

        {openCovers.length === 0 && pendingForManager.length === 0 && (
          <div style={styles.homeEmptyCover}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5c4a38' }}>All shifts covered</div>
            <div style={{ fontSize: 11, color: '#a59478', marginTop: 2 }}>Nothing on the board right now.</div>
          </div>
        )}

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
            <div style={{ ...styles.homeSectionTitle, marginTop: 18, marginBottom: 8, color: '#7a8270' }}>
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
      </section>

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

      {/* Your day */}
      {myUpcoming.length > 0 && (
        <section style={styles.homeSection}>
          <div style={styles.homeSectionHead}>
            <div style={styles.homeSectionTitle}>Your upcoming classes</div>
          </div>
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
        </section>
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

function Timetable({ data, currentUser, isManager, isMobile, onClassClick, onAddClass }) {
  const [filter, setFilter] = useState('all'); // all | mine | needsCover
  const [studioFilter, setStudioFilter] = useState('all'); // all | reformer | hybrid
  const [selectedDay, setSelectedDay] = useState(0); // for mobile day-selector
  const [viewMode, setViewMode] = useState('week'); // week | month

  let classes = data.classes;
  if (filter === 'mine') classes = classes.filter(c => c.coachId === currentUser.id);
  if (filter === 'needsCover') classes = classes.filter(c => c.status === 'needsCover');
  if (studioFilter !== 'all') classes = classes.filter(c => c.studio === studioFilter);

  const byDay = DAYS.map((_, i) =>
    classes
      .filter(c => c.day === i)
      .sort((a, b) => a.time.localeCompare(b.time))
  );

  // Renders a single class card — used in both desktop and mobile views
  const renderClassCard = (cls, variant = 'compact') => {
    const coach = data.users.find(u => u.id === cls.coachId);
    const isMine = cls.coachId === currentUser.id;
    const needsCover = cls.status === 'needsCover';
    const isMobileVariant = variant === 'mobile';
    return (
      <button
        key={cls.id}
        onClick={() => onClassClick(cls.id)}
        className="salus-card salus-btn"
        style={{
          ...styles.classCard,
          ...(isMobileVariant ? styles.classCardMobile : {}),
          background: needsCover ? '#fef0ea' : '#fff',
          borderLeft: needsCover
            ? '3px solid #c8442a'
            : (isMine ? '3px solid #5c4a38' : '3px solid transparent'),
        }}
      >
        {isMobileVariant ? (
          <>
            <div style={styles.mobileCardLeft}>
              <div style={styles.mobileCardTime}>{cls.time}</div>
              <div style={styles.mobileCardDur}>{cls.dur}m</div>
            </div>
            <div style={styles.mobileCardMid}>
              <div style={styles.mobileCardType}>{cls.type}</div>
              <div style={styles.mobileCardMeta}>
                {coach && <UserAvatar user={coach} size={18} fontSize={8} />}
                <span style={styles.mobileCardCoach}>{coach?.name || 'Unassigned'}</span>
                <span style={styles.mobileCardStudio}>· {STUDIOS[cls.studio]?.short}</span>
              </div>
            </div>
            {needsCover && (
              <div style={styles.coverBadgeProminent}>
                <AlertCircle size={12} />
                <span>COVER</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={styles.classCardTop}>
              <div style={styles.classTime}>{cls.time}</div>
              {needsCover && (
                <div style={styles.coverBadgeProminent}>
                  <AlertCircle size={12} />
                  <span>COVER</span>
                </div>
              )}
            </div>
            <div style={styles.classType}>{cls.type}</div>
            <div style={styles.classCoach}>
              {coach && <UserAvatar user={coach} size={20} fontSize={9} />}
              <span style={styles.classCoachName}>
                {coach?.name?.split(' ')[0] || 'Unassigned'}
              </span>
            </div>
            <div style={styles.studioTag}>{STUDIOS[cls.studio]?.short}</div>
          </>
        )}
      </button>
    );
  };

  return (
    <div>
      <div className="salus-section-header" style={styles.sectionHeader}>
        <div>
          <h2 className="salus-h2" style={styles.h2}>
            {viewMode === 'month' ? 'Next 3 Months' : (isMobile ? 'This Week' : `Week of ${DAY_LABELS[0]}–${DAY_LABELS[6]} May`)}
          </h2>
          <p style={styles.subtitle}>
            {classes.length} classes · {data.classes.filter(c => c.status === 'needsCover').length} need cover
          </p>
        </div>
        <div style={styles.filterRow}>
          <div style={styles.viewToggle}>
            <button
              onClick={() => setViewMode('week')}
              className="salus-btn"
              style={{ ...styles.viewToggleBtn, ...(viewMode === 'week' ? styles.viewToggleBtnActive : {}) }}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className="salus-btn"
              style={{ ...styles.viewToggleBtn, ...(viewMode === 'month' ? styles.viewToggleBtnActive : {}) }}
            >
              3-Month
            </button>
          </div>
          {viewMode === 'week' && (
            <>
              <FilterPill label="All" active={filter==='all'} onClick={() => setFilter('all')} />
              {!isManager && <FilterPill label="Mine" active={filter==='mine'} onClick={() => setFilter('mine')} />}
              <FilterPill label="Cover" active={filter==='needsCover'} onClick={() => setFilter('needsCover')} />
            </>
          )}
          {isManager && (
            <button onClick={onAddClass} className="salus-btn" style={styles.btnPrimary}>
              <Plus size={14} /> {isMobile ? 'Add' : 'Add class'}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'month' ? (
        <MonthView
          classes={data.classes}
          coverRequests={data.coverRequests}
          currentUser={currentUser}
          onDayClick={(isoDate) => {
            // Switch back to week view focused on that day
            const targetClasses = data.classes.filter(c => c.date === isoDate);
            if (targetClasses.length > 0) {
              setViewMode('week');
              setSelectedDay(targetClasses[0].day);
            }
          }}
        />
      ) : (
        <>
      {/* Studio toggle */}
      <div style={styles.studioToggle}>
        <button
          onClick={() => setStudioFilter('all')}
          className="salus-btn"
          style={{ ...styles.studioPill, ...(studioFilter==='all' ? styles.studioPillActive : {}) }}
        >
          All studios
        </button>
        <button
          onClick={() => setStudioFilter('reformer')}
          className="salus-btn"
          style={{ ...styles.studioPill, ...(studioFilter==='reformer' ? styles.studioPillActive : {}) }}
        >
          {isMobile ? 'Reformer' : 'Reformer Studio'}
        </button>
        <button
          onClick={() => setStudioFilter('hybrid')}
          className="salus-btn"
          style={{ ...styles.studioPill, ...(studioFilter==='hybrid' ? styles.studioPillActive : {}) }}
        >
          Hybrid
        </button>
      </div>

      {/* MOBILE: day selector + single day list */}
      {isMobile ? (
        <>
          <div style={styles.daySelector} className="salus-scroll">
            {DAYS.map((day, i) => {
              const isActive = i === selectedDay;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(i)}
                  className="salus-btn"
                  style={{ ...styles.dayPill, ...(isActive ? styles.dayPillActive : {}) }}
                >
                  <div style={styles.dayPillDay}>{day}</div>
                  <div style={styles.dayPillDate}>{DAY_LABELS[i].split(' ')[1]}</div>
                  {byDay[i].length > 0 && <div style={{ ...styles.dayPillDot, background: isActive ? '#fff' : '#5c4a38' }} />}
                </button>
              );
            })}
          </div>

          <div style={styles.mobileDayHeader}>
            <div>
              <div style={styles.mobileDayHeaderDay}>{DAYS[selectedDay]} {DAY_LABELS[selectedDay].split(' ')[1]} May</div>
              <div style={styles.subtitle}>
                {byDay[selectedDay].length} class{byDay[selectedDay].length === 1 ? '' : 'es'}
              </div>
            </div>
          </div>

          <div style={styles.mobileDayList}>
            {byDay[selectedDay].length === 0 ? (
              <div style={{ ...styles.emptyState, padding: '32px 16px' }}>
                <div style={styles.emptyTitle}>No classes</div>
                <div style={styles.emptyText}>Nothing scheduled for this day with the current filters.</div>
              </div>
            ) : (
              byDay[selectedDay].map(cls => renderClassCard(cls, 'mobile'))
            )}
          </div>
        </>
      ) : (
        /* DESKTOP: full 7-day grid */
        <div style={styles.weekGrid}>
          {DAYS.map((day, i) => (
            <div key={day} style={styles.dayColumn}>
              <div style={styles.dayHeader}>
                <div>
                  <div style={styles.dayName}>{day}</div>
                  <div style={styles.dayDate}>{DAY_LABELS[i].split(' ')[1]} May</div>
                </div>
                <div style={styles.dayCount}>{byDay[i].length}</div>
              </div>
              <div style={styles.dayClasses}>
                {byDay[i].length === 0 && (
                  <div style={styles.emptyDay}>No classes</div>
                )}
                {byDay[i].map(cls => renderClassCard(cls, 'compact'))}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
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

function Chat({ data, currentUser, isManager, onSend, onDeleteMessage, onClearAll }) {
  const [text, setText] = useState('');
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
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

  return (
    <div style={styles.chatContainer}>
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
          const showDelete = canDelete && hoveredMsgId === msg.id;
          return (
            <div
              key={msg.id}
              style={{ ...styles.message, ...(isMine ? styles.messageMine : {}), position: 'relative' }}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}
            >
              {showHeader && user && (
                <div style={styles.messageHeader}>
                  <UserAvatar user={user} size={28} fontSize={11} />
                  <span style={styles.messageName}>{user.name}{user.role === 'manager' ? ' · Manager' : ''}</span>
                  <span style={styles.messageTime}>{fmtTime(msg.timestamp)}</span>
                </div>
              )}
              <div style={{ ...styles.messageBubble, marginLeft: 36, position: 'relative' }}>
                {msg.text}
                {canDelete && (
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this message?')) onDeleteMessage(msg.id);
                    }}
                    className="salus-btn"
                    style={{ ...styles.messageDeleteBtn, opacity: showDelete ? 1 : 0 }}
                    title="Delete this message"
                    aria-label="Delete message"
                  >
                    <X size={12} />
                  </button>
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

function MePage({ data, currentUser, isManager, onOpenSettings, onSignOut, onShowInvoices, onShowTimeOff }) {
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

      {/* Stats */}
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

function ClassDetailModal({ classObj, data, currentUser, isManager, onClose, onRequestCover, onProposeSwap, onEdit, onDelete }) {
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
          <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        <div style={styles.colorPalette}>
          {AVATAR_COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="salus-btn"
              style={{
                ...styles.colorSwatch,
                background: c,
                ...(color === c ? styles.colorSwatchActive : {}),
              }}
              aria-label={`Pick colour ${c}`}
            >
              {color === c && <Check size={14} color="#fff" strokeWidth={3} />}
            </button>
          ))}
        </div>

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

function generateInvoiceHtml({ coach, sessions, rate }) {
  const subtotal = sessions.length * rate;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNumber = `SAL-${Date.now().toString().slice(-6)}-${coach.initials}`;
  const dateRange = sessions.length > 0
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

function downloadInvoice({ coach, sessions, rate }) {
  const html = generateInvoiceHtml({ coach, sessions, rate });
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
  // URL will be revoked when the window closes; if not, GC eventually
}

function InvoicesModal({ data, onClose }) {
  const coaches = data.users.filter(u => u.role === 'coach');
  const rate = RATE_PER_SESSION;

  const buildSessions = (coach) => data.classes
    .filter(c => c.coachId === coach.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.time.localeCompare(b.time));

  const total = coaches.reduce((s, c) => s + buildSessions(c).length * rate, 0);

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <div style={styles.modalDayBadge}>Invoices · £{rate}/session</div>
        <h2 style={{ ...styles.h2, marginTop: 8, marginBottom: 4 }}>Coach payments this week</h2>
        <p style={{ ...styles.subtitle, marginBottom: 20 }}>
          Download a printable invoice for each coach. Open the file, then use your browser's <strong>Print → Save as PDF</strong> option.
        </p>

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
                  onClick={() => downloadInvoice({ coach, sessions, rate })}
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
          <span>Total payroll this week</span>
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
    minHeight: '100vh',
    background: '#f5f1e8',
    fontFamily: '"Geist", -apple-system, sans-serif',
    color: '#1a2620',
    paddingBottom: 40,
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

  main: { padding: '28px 32px 100px', maxWidth: 1400, margin: '0 auto' },

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
    display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)',
    minHeight: 500, overflow: 'hidden',
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
