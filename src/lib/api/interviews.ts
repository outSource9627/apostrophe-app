import { api, tokenStore, API_BASE_URL } from './index'

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

/**
 * SP-08 — where the student's feedback on a COMPLETED interview stands. Absent for any other status.
 *   READY        the interviewer submitted it; `GET /interviews/:id/feedback` returns it.
 *   AWAITING     still inside the interviewer's submission window: it may yet arrive.
 *   UNAVAILABLE  the window closed with nothing submitted. It will never arrive, so no screen may promise it.
 */
export type FeedbackState = 'READY' | 'AWAITING' | 'UNAVAILABLE'

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
  /** IR-19 — IN_PROGRESS only: when the student stepped out of the room (ISO); absent while they are in it. */
  studentLeftAt?: string
  /** IR-19 — IN_PROGRESS only: minutes they may be out before the session ends without them (the server's setting). */
  rejoinWindowMinutes?: number
  /** SC-30 — the server holds a passing, still-valid device check for this interview. */
  readinessPassed?: boolean
  /**
   * BOOKED or IN_PROGRESS only — the student has joined the room and not left it. Absent on an older backend
   * (or in another status): unknown, never false.
   */
  studentInRoom?: boolean
  /**
   * BOOKED or IN_PROGRESS only — the interviewer has joined the room and not left it. A yes/no and nothing else:
   * who they are stays masked until the session starts (SC-16).
   */
  interviewerInRoom?: boolean
  joinUrl?: string
  /**
   * The server's session clock — present exactly when `interviewer` is (both are revealed by the session
   * starting). A started session is never "late".
   */
  sessionStartedAt?: string
  /**
   * 6.3 — what an admin decided about a session that ended below the completion threshold. Present once it has
   * been reviewed (`status` then names the outcome), so a no-show out of a session that STARTED tells a different
   * story from one where nobody joined. Never the admin's note.
   */
  reviewedAs?: 'COMPLETED' | 'STUDENT_NO_SHOW' | 'INTERVIEWER_NO_SHOW' | 'CANCELLED'
  /** SP-08 — the state of the feedback on a COMPLETED interview; absent for every other status. */
  feedback?: FeedbackState
  /** SC-16 — absent until the session starts; never a real name before then. */
  interviewer?: { name: string; photoUrl?: string | null; headline?: string | null; company?: string | null; bio?: string | null }
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

/** SC-08 — the server-generated .ics (RFC 5545, UTC times, no interviewer identity). */
export const getInterviewIcs = (id: string) => api.getText(`/interviews/${id}/calendar.ics`)

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
  /** Minutes-left warnings the room should raise (PRD 10.2) — the server's list, e.g. [5, 1]. */
  warnings?: number[]
  scheduledEndAt?: string
  sessionStartedAt?: string
}
/** Entering the room stamps the student present server-side; it must be called on entry. */
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
/**
 * A 404 here is a state, not an error — but two different ones: 'Your feedback is not ready yet.' (AWAITING) and
 * 'Feedback will not be available for this interview.' (UNAVAILABLE, never coming). Read which from the interview's
 * `feedback`, not from the message.
 */
export const getFeedback = (id: string) => api.get<Feedback>(`/interviews/${id}/feedback`)

// ── Readiness result, preparation, leave, student events (IR-06, SC-30/34) ───

/** The mandatory device check result the room gate looks for. Bandwidth is measured, never claimed. */
export interface ReadinessResult {
  camera: boolean
  microphone: boolean
  speaker: boolean
  bandwidthMbps: number
  permissions: boolean
}
export const postReadiness = (id: string, r: ReadinessResult) =>
  api.post<{ passed?: boolean; success?: boolean }>(`/interviews/${id}/readiness`, r)

/** SC-34 — lighting, background, network and expected question areas. Shape is rendered defensively. */
export interface Preparation {
  lighting?: string | string[]
  background?: string | string[]
  network?: string | string[]
  questionAreas?: Array<string | { title: string; prompts?: string[] }>
  [k: string]: unknown
}
export const getPreparation = (id: string) => api.get<Preparation>(`/interviews/${id}/preparation`)

/** Student leaves the room; only the interviewer ends the interview. */
export const leaveRoom = (id: string) => api.post<{ success?: boolean }>(`/interviews/${id}/room/leave`)

/** The server's STUDENT_EVENT_KINDS — any other kind is refused with a 400. */
export type StudentEventKind = 'MUTE' | 'UNMUTE' | 'CAMERA_ON' | 'CAMERA_OFF' | 'NETWORK' | 'AUDIO_ONLY' | 'RECONNECT'
export const postRoomEvent = (id: string, kind: StudentEventKind, payload?: Record<string, unknown>) =>
  api.post<{ success?: boolean }>(`/interviews/${id}/events`, payload ? { kind, payload } : { kind })

/**
 * Measures download bandwidth (Mbps) against the platform's own probe endpoint —
 * GET /readiness/probe, not a third party. Returns 0 when the probe fails.
 */
export async function measureBandwidthMbps(): Promise<number> {
  try {
    const tokens = await tokenStore.get()
    const headers: Record<string, string> = {}
    if (tokens?.accessToken) headers.authorization = `Bearer ${tokens.accessToken}`
    const t0 = Date.now()
    const res = await fetch(`${API_BASE_URL}/readiness/probe?t=${t0}`, { headers })
    const buf = await res.arrayBuffer()
    const sec = Math.max(0.001, (Date.now() - t0) / 1000)
    if (!res.ok || buf.byteLength === 0) return 0
    return Math.round(((buf.byteLength * 8) / sec / 1e6) * 100) / 100
  } catch {
    return 0
  }
}
