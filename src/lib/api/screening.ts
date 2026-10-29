import { api, ApiClientError, ErrorCode } from './index'

/**
 * The interviewer screening test, typed from the public contract
 * (apostrophe-admin src/app/api/v1/interviewers/screening/**, build spec
 * 2026-10-28). An applicant has no account, so every call is anonymous and the
 * test is reached by its token alone — the one handed back by
 * POST /interviewers/apply and kept on this phone (lib/interviewer/screeningStore).
 *
 * Nothing here ever carries a correct answer or a score: the server keeps both.
 */

export type ScreeningSection = 'TECHNICAL' | 'REASONING' | 'IQ' | 'GK'
export type ScreeningCounts = Record<ScreeningSection, number>

/** `screeningTest` on the apply response when a test was issued. */
export interface ScreeningOffer {
  token: string
  /** ISO — the link works until then, while the test is unstarted. */
  expiresAt: string
  timeLimitMinutes: number
  counts: ScreeningCounts
  total: number
}

/**
 * POST /interviewers/apply. `screeningTest` is the offer, `{ repeat: true }`
 * when an open application with this email already existed (no token — the
 * link was shown then), or null when screening is switched off. An older
 * backend leaves it out, which reads as null.
 */
export interface InterviewerApplyResponse {
  received: boolean
  message: string
  screeningTest?: ScreeningOffer | { repeat: true } | null
}

export const isScreeningOffer = (t: InterviewerApplyResponse['screeningTest']): t is ScreeningOffer =>
  !!t && 'token' in t && typeof t.token === 'string'

export type ScreeningStatus = 'ISSUED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED'

/** GET /interviewers/screening/:token — the test's state, no questions. */
export interface ScreeningState {
  status: ScreeningStatus
  firstName: string
  domains: string[]
  counts: ScreeningCounts
  total: number
  timeLimitMinutes: number
  /** The link's expiry — it matters while ISSUED. */
  expiresAt: string
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  /** True when the time ran out and the server submitted for them. */
  autoSubmitted: boolean
  answeredCount: number
  serverNow: string
}

export interface ScreeningQuestion {
  /** 0-based, display order (TECHNICAL, REASONING, IQ, GK). */
  index: number
  section: ScreeningSection
  domain: string | null
  text: string
  /** Four, already shuffled. */
  options: string[]
}

/** POST …/start and GET …/attempt. */
export interface ScreeningAttempt {
  status: 'IN_PROGRESS' | 'SUBMITTED'
  deadlineAt: string
  serverNow: string
  questions: ScreeningQuestion[]
  /** The chosen option per question, by index; null = unanswered. */
  answers: Array<number | null>
}

/**
 * The CONFLICT reasons the screening routes refuse with: `EXPIRED`,
 * `SUBMITTED` and `PREPARING` (start), `NOT_STARTED` (attempt),
 * `DEADLINE_PASSED` and `SUBMITTED` (answers).
 */
export type ScreeningRefusal = 'EXPIRED' | 'SUBMITTED' | 'PREPARING' | 'NOT_STARTED' | 'DEADLINE_PASSED'

/** The refusal reason on a CONFLICT, from `details.reason` (or `meta.reason`, where `conflict()` puts it). */
export function screeningRefusal(e: unknown): ScreeningRefusal | null {
  if (!(e instanceof ApiClientError) || e.code !== ErrorCode.CONFLICT) return null
  const reason = e.details?.reason ?? e.meta?.reason
  return typeof reason === 'string' ? (reason as ScreeningRefusal) : null
}

/** An unknown, replaced or never-issued token: the server answers 404 for all three alike. */
export const isUnknownToken = (e: unknown) => e instanceof ApiClientError && e.code === ErrorCode.NOT_FOUND

const path = (token: string, rest = '') => `/interviewers/screening/${encodeURIComponent(token)}${rest}`

export const getScreening = (token: string) => api.get<ScreeningState>(path(token), { anonymous: true })

/** Draws and snapshots the questions and starts the clock. Idempotent once started. */
export const startScreening = (token: string) => api.post<ScreeningAttempt>(path(token, '/start'), undefined, { anonymous: true })

/** Resume. CONFLICT `NOT_STARTED` while ISSUED. */
export const getScreeningAttempt = (token: string) => api.get<ScreeningAttempt>(path(token, '/attempt'), { anonymous: true })

/** One pick (0–3), or null to clear it. */
export const saveScreeningAnswer = (token: string, index: number, option: number | null) =>
  api.put<{ answeredCount: number }>(path(token, `/answers/${index}`), { option }, { anonymous: true })

/** Idempotent. The score stays on the server. */
export const submitScreening = (token: string) =>
  api.post<{ status: 'SUBMITTED'; answered: number; total: number }>(path(token, '/submit'), undefined, { anonymous: true })
