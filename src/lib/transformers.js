// Supabase columns are snake_case; the app components use camelCase.
// These tiny helpers convert in both directions so we don't have to touch the UI code.

export const profileFromDb = (row, authEmail) => ({
  id: row.id,
  name: row.name,
  role: row.role,
  coachType: row.coach_type || 'permanent',
  color: row.color,
  initials: row.initials,
  avatarUrl: row.avatar_url || null,
  email: authEmail || '',
  emailPrefs: row.email_prefs || {},
  qualifications: row.qualifications || [],
  termsAcceptedAt: row.terms_accepted_at,
  bankAccount: row.bank_account || null,
  bankSortCode: row.bank_sort_code || null,
});

export const classFromDb = (row) => ({
  id: row.id,
  day: row.day,
  date: row.date,
  time: (row.time || '').slice(0, 5),
  dur: row.dur,
  type: row.type,
  coachId: row.coach_id,
  studio: row.studio,
  status: row.status,
  originalCoachId: row.original_coach_id,
  isHire: row.is_hire || false,
  hireType: row.hire_type || null,
  notes: row.notes || null,
});

export const classToDb = (cls) => ({
  day: cls.day,
  date: cls.date,
  time: cls.time,
  dur: cls.dur,
  type: cls.type,
  coach_id: cls.coachId,
  studio: cls.studio,
  status: cls.status || 'assigned',
  original_coach_id: cls.originalCoachId || null,
  is_hire: cls.isHire || false,
  hire_type: cls.hireType || null,
  notes: cls.notes || null,
});

export const coverReqFromDb = (row) => ({
  id: row.id,
  classId: row.class_id,
  requestedBy: row.requested_by,
  reason: row.reason,
  status: row.status,
  claimedBy: row.claimed_by,
  interestedCovers: row.interested_covers || [],
  timestamp: row.created_at ? new Date(row.created_at).getTime() : 0,
});

export const swapReqFromDb = (row) => ({
  id: row.id,
  classAId: row.class_a_id,
  classBId: row.class_b_id,
  fromCoach: row.from_coach,
  toCoach: row.to_coach,
  status: row.status,
});

export const messageFromDb = (row) => ({
  id: row.id,
  userId: row.user_id,
  text: row.text,
  timestamp: new Date(row.created_at).getTime(),
  editedAt: row.edited_at ? new Date(row.edited_at).getTime() : null,
});
