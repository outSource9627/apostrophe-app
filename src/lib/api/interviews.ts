import { api } from './index'

/**
 * The booking wire shapes, mirrored from the platform core
 * (apostrophe-admin src/contracts/interview.ts) — and kept byte-identical to the
 * web client (apostrophe-user lib/api/interviews.ts). Web and app are the same
 * product; a shape that drifts between the two is a defect. The SERVER owns
 * every rule these carry; nothing here recomputes them.
 */
export type InterviewStatus =
  | 'BOOKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'STUDENT_NO_SHOW'
  | 'INTERVIEWER_NO_SHOW'

export interface StudentInterview {
  id: string
  slotStart: string
  slotEnd: string
  durationMin: number
  tier: string
  status: InterviewStatus
  canReschedule: boolean
  canCancel: boolean
  roomReady: boolean
  joinUrl?: string
  /** SC-16 — absent until the session starts; never a real name before then. */
  interviewer?: { name: string }
}

export interface CapacitySlot {
  slotStart: string
  slotEnd: string
  /** The real signal. `available` is always true where a row exists. */
  capacity: number
  available: boolean
}

export interface CancelOutcome {
  interview: StudentInterview
  outcomeOwed: 'FULL_REFUND' | 'FORFEIT'
  entitlementRestored: boolean
}

/** Advisory capacity across a range. Bounds are ISO-8601 UTC with a literal `Z`. */
export const getCapacity = (fromIso: string, untilIso: string) =>
  api.get<{ slots: CapacitySlot[] }>('/interviews/capacity', {
    query: { from: fromIso, until: untilIso },
  })

/** Book at a chosen time. The client picks only the instant; a CONFLICT is a lost slot, not an error. */
export const bookInterview = (slotStartIso: string) =>
  api.post<StudentInterview>('/interviews/book', { slotStart: slotStartIso })

export const listInterviews = () => api.get<{ interviews: StudentInterview[] }>('/interviews/me')

export const getInterview = (id: string) => api.get<StudentInterview>(`/interviews/${id}`)

export interface Readiness {
  spec: {
    MIN_BANDWIDTH_MBPS: number
    ASPECT_RATIO: string
    WIDTH: number
    HEIGHT: number
    FACE_OVAL: { TOP_PCT: number; LEFT_PCT: number; WIDTH_PCT: number; HEIGHT_PCT: number }
  }
  joinStatus: { active: boolean; reason: 'TOO_EARLY' | 'ACTIVE' | 'EXPIRED' }
  slotStart: string
}

export const getReadiness = (id: string) => api.get<Readiness>(`/interviews/${id}/readiness`)

/** The one free move. THE ID CHANGES — the response is the NEW interview. */
export const rescheduleInterview = (id: string, newSlotStartIso: string) =>
  api.post<StudentInterview>(`/interviews/${id}/reschedule`, { newSlotStart: newSlotStartIso })

/** Cancel a booked interview; the refund/forfeit outcome is returned. */
export const cancelInterview = (id: string, reason: string) =>
  api.post<CancelOutcome>(`/interviews/${id}/cancel`, { reason })
// ── The room, feedback and top-up (F06 · ST-30, ST-33, ST-34) ────────────────

/**
 * Credentials for the live room. THE VIDEO SDK IS AGORA and is integrated behind
 * a stub (src/lib/room / lib/room) — this is the contract the room screen calls
 * to get a channel and a short-lived RTC token the SDK joins with. The RTC token
 * MUST be minted server-side from the Agora certificate; until that endpoint
 * ships, the room falls back to a stubbed local session so every state is still
 * demonstrable. appId is public; the certificate never leaves the server.
 */
export interface RoomCredentials {
  appId: string
  channel: string
  token: string
  uid: number
  /** The interviewer is masked until the session starts (SC-16) — name only then. */
  interviewer?: { name: string; photoUrl?: string | null }
}
export const getRoomCredentials = (id: string) => api.get<RoomCredentials>(`/interviews/${id}/room`)

/** SS-08 — the five scores, strengths and improvements. Employers never see any of this. */
export interface Feedback {
  interviewId: string
  slotStart: string
  tier: string
  status: InterviewStatus
  scorecard: {
    scores: { communication: number; domainKnowledge: number; confidence: number; problemSolving: number; overall: number }
    strengths: string
    improvements: string
  }
}
/** 404 'Your feedback is not ready yet.' is the AWAITING state (ST-33), not an error. */
export const getFeedback = (id: string) => api.get<Feedback>(`/interviews/${id}/feedback`)
