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
  isCoach: row.is_coach === true,
  isFoh: row.is_foh === true,
  codeOfConductAckedAt: row.code_of_conduct_acked_at,
  duringClassAckedAt: row.during_class_acked_at,
  afterClassAckedAt: row.after_class_acked_at,
  uniformAckedAt: row.uniform_acked_at,
  onboardingCompletedAt: row.onboarding_completed_at,
});

export const maintenanceFromDb = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  location: row.location,
  equipment: row.equipment,
  urgency: row.urgency || 'normal',
  status: row.status || 'reported',
  reportedBy: row.reported_by,
  resolvedBy: row.resolved_by,
  resolutionNotes: row.resolution_notes,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : null,
});

export const feedbackFromDb = (row) => ({
  id: row.id,
  memberName: row.member_name,
  context: row.context,
  feedback: row.feedback,
  sentiment: row.sentiment || 'neutral',
  status: row.status || 'new',
  loggedBy: row.logged_by,
  addressedBy: row.addressed_by,
  addressedAt: row.addressed_at ? new Date(row.addressed_at).getTime() : null,
  addressedNotes: row.addressed_notes,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
});

export const coachPostFromDb = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  postType: row.post_type || 'flow',
  videoUrl: row.video_url || null,
  tags: row.tags || [],
  postedBy: row.posted_by,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  editedAt: row.edited_at ? new Date(row.edited_at).getTime() : null,
});

export const postReactionFromDb = (row) => ({
  postId: row.post_id,
  userId: row.user_id,
  reaction: row.reaction,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
});

export const postCommentFromDb = (row) => ({
  id: row.id,
  postId: row.post_id,
  userId: row.user_id,
  text: row.text,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
});

export const bookingFromDb = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  bookingType: row.booking_type || 'external_event',
  hirerName: row.hirer_name || '',
  hirerContact: row.hirer_contact || '',
  price: row.price != null ? Number(row.price) : null,
  studio: row.studio || 'whole',
  date: row.date,
  startTime: (row.start_time || '').slice(0, 5),
  endTime: (row.end_time || '').slice(0, 5),
  status: row.status || 'confirmed',
  notes: row.notes || '',
  createdBy: row.created_by,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  recurrencePattern: row.recurrence_pattern || 'none',
  recurrenceDays: row.recurrence_days || null,
  recurrenceEndDate: row.recurrence_end_date || null,
  recurrenceSeriesId: row.recurrence_series_id || null,
});

export const dmFromDb = (row) => ({
  id: row.id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  text: row.text,
  readAt: row.read_at ? new Date(row.read_at).getTime() : null,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
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
  isUrgent: row.is_urgent === true,
});

export const shiftFromDb = (row) => ({
  id: row.id,
  date: row.date,
  day: row.day,
  startTime: (row.start_time || '').slice(0, 5),
  endTime: (row.end_time || '').slice(0, 5),
  shiftLabel: row.shift_label,
  staffId: row.staff_id,
  status: row.status,
  originalStaffId: row.original_staff_id,
  notes: row.notes,
});

export const taskFromDb = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  assigneeId: row.assignee_id,
  audience: row.audience || 'specific',
  createdBy: row.created_by,
  status: row.status || (row.task_kind === 'project' ? 'not_started' : 'todo'),
  priority: row.priority || 'normal',
  dueDate: row.due_date,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  completedBy: row.completed_by,
  isTemplate: row.is_template === true,
  recurrence: row.recurrence || null,
  recurrenceDays: row.recurrence_days || null,
  recurrenceParentId: row.recurrence_parent_id || null,
  taskKind: row.task_kind || 'daily',
});

export const taskCommentFromDb = (row) => ({
  id: row.id,
  taskId: row.task_id,
  userId: row.user_id,
  text: row.text,
  kind: row.kind || 'comment',
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
});

export const shiftNoteFromDb = (row) => ({
  id: row.id,
  shiftId: row.shift_id,
  userId: row.user_id,
  text: row.text,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
});

export const tourFromDb = (row) => ({
  id: row.id,
  icalUid: row.ical_uid,
  title: row.title || '',
  description: row.description || '',
  guestName: row.guest_name || '',
  guestEmail: row.guest_email || '',
  guestPhone: row.guest_phone || '',
  startTime: row.start_time ? new Date(row.start_time).getTime() : 0,
  endTime: row.end_time ? new Date(row.end_time).getTime() : null,
  status: row.status || 'scheduled',
  notes: row.notes || '',
  outcomeBy: row.outcome_by || null,
  outcomeAt: row.outcome_at ? new Date(row.outcome_at).getTime() : null,
  lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).getTime() : null,
});
