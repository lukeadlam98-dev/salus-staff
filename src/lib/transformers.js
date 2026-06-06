export const profileFromDb = (x) => x;
export const classFromDb = (x) => x;
export const classToDb = (x) => x;
export const coverReqFromDb = (x) => x;
export const swapReqFromDb = (x) => x;
export const messageFromDb = (x) => x;
export const shiftFromDb = (x) => x;
export const taskFromDb = (x) => x;
export const taskCommentFromDb = (x) => x;
export const shiftNoteFromDb = (x) => x;
export const tourFromDb = (x) => x;
export const maintenanceFromDb = (x) => x;
export const feedbackFromDb = (x) => x;
export const coachPostFromDb = (x) => x;
export const postReactionFromDb = (x) => x;
export const postCommentFromDb = (x) => x;
export const bookingFromDb = (x) => x;
export const dmFromDb = (x) => x;
export const emailIntegrationFromDb = (x) => x;
export const stockItemFromDb = (x) => x;
export const storeCardFromDb = (x) => x;
export const broadcastFromDb = (x) => x;
export const broadcastReadFromDb = (x) => x;
export const incidentFromDb = (x) => x;
export const onboardingStepFromDb = (x) => x;
export const expenseFromDb = (x) => x;
export const flowFromDb = (r) => ({
  id:              r.id,
  userId:          r.user_id,
  title:           r.title,
  flowDate:        r.flow_date,
  classType:       r.class_type,
  durationMinutes: r.duration_minutes,
  notes:           r.notes,
  // New ordered list of sections (warm-up / main / cool-down / custom).
  // Falls back to an empty array on pre-migration data so the legacy
  // single-notes flow keeps working.
  sections:        Array.isArray(r.sections) ? r.sections : [],
  sketches:        Array.isArray(r.sketches) ? r.sketches : [],
  archived:        r.archived,
  createdAt:       r.created_at,
  updatedAt:       r.updated_at,
});

// ─── FOH (Front of House) operations ────────────────────────────────────
// Explicit snake_case → camelCase mapping (the safe, proven pattern).
export const fohShiftFromDb = (r) => ({
  id:             r.id,
  userId:         r.user_id,
  shiftDate:      r.shift_date,
  clockInAt:      r.clock_in_at,
  clockOutAt:     r.clock_out_at,
  autoClockedOut: r.auto_clocked_out,
  notes:          r.notes,
  createdAt:      r.created_at,
  updatedAt:      r.updated_at,
});

export const dailyJobFromDb = (r) => ({
  id:         r.id,
  title:      r.title,
  category:   r.category,
  recurrence: r.recurrence || 'once',
  priority:   r.priority || false,
  sortOrder:  r.sort_order,
  active:     r.active,
  createdBy:  r.created_by,
  createdAt:  r.created_at,
  updatedAt:  r.updated_at,
});

export const dailyJobLogFromDb = (r) => ({
  id:          r.id,
  jobId:       r.job_id,
  logDate:     r.log_date,
  completedBy: r.completed_by,
  completedAt: r.completed_at,
});

export const memberRequestFromDb = (r) => ({
  id:         r.id,
  memberName: r.member_name,
  memberRef:  r.member_ref,
  type:       r.type,
  detail:     r.detail,
  status:     r.status,
  raisedBy:   r.raised_by,
  resolvedBy: r.resolved_by,
  resolvedAt: r.resolved_at,
  createdAt:  r.created_at,
  updatedAt:  r.updated_at,
});
