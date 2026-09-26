import { api, tokenStore } from './index'
import type { MessageDto, ThreadDto, ThreadPage } from './chat'

/**
 * The interviewer API, typed from the platform's own routes and contracts
 * (apostrophe-admin src/app/api/v1/interviewers/** and src/contracts/*). Every
 * field here is one the server sends; nothing is assumed. `/interviewers/me`
 * carries no name, email or mobile — those come from `GET /auth/me`.
 */

export type InterviewerStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
export type Tier = 'T1' | 'T2' | 'T3' | 'T4'
export type InterviewStatus =
  | 'BOOKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'STUDENT_NO_SHOW'
  | 'INTERVIEWER_NO_SHOW'

export type NonPayableReason = 'SESSION_TOO_SHORT' | 'SCORECARD_MISSING' | 'SCORECARD_LATE'

// ── GET /interviewers/me ─────────────────────────────────────────────────────
export interface StudentEducation {
  qualification?: string
  institution?: string
  fieldOfStudy?: string
  yearOfCompletion?: number
}

export interface NextSessionDto {
  interviewId: string
  slotStart: string
  slotEnd: string
  durationMin: number
  tier: string
  domain?: string
  language?: string
  feePaise: number
  status: InterviewStatus
  joinOpensAt: string
  joinOpensMinutesBefore: number
  roomReady: boolean
  student: { id: string; name: string; languages: string[]; education?: StudentEducation }
  resumeUrl?: string
}

export interface LaterTodayDto {
  interviewId: string
  slotStart: string
  slotEnd: string
  durationMin: number
  tier: string
  domain?: string
  language?: string
  feePaise: number
  status: InterviewStatus
  student: { id: string; name: string }
}

/** A row of GET /interviewers/me/scorecards (and `scorecardsOwed.rows`). `minutesRemaining` is negative once overdue. */
export interface ScorecardOwedRowDto {
  interviewId: string
  slotStart: string
  sessionEndedAt: string | null
  dueAt: string | null
  minutesRemaining: number | null
  overdue: boolean
  payable: boolean
  nonPayableReason?: NonPayableReason
  feePaise: number
  tier: string
  domain?: string
  student: { id: string; name: string }
}

export interface InterviewerMeDto {
  status: InterviewerStatus
  statusReason?: string | null
  profile?: {
    domains: string[]
    languages: string[]
    tiers: Tier[]
    loadCaps?: { perDay?: number | null; perWeek?: number | null }
    feePaise?: Partial<Record<Tier, number>>
  }
  availability?: { weeklySlots: number; horizonDays: number; openSlots: number; bookedSlots: number; lastMaterialisedAt: string | null }
  interviews?: { upcoming: number; completed: number; pendingScorecards: number }
  wallet?: { availablePaise: number; lockedPaise: number; pendingPaise: number; lifetimePaise: number }
  quality?: { conducted: number; completionRate: number; noShows: number; avgDurationSec: number; scorecardOnTimeRate: number; windowDays: number; computedAt: string | null }
  stats?: {
    windowDays: number
    conducted: number
    assigned: number
    completionPct: number | null
    scorecardsDue: number
    scorecardsOnTime: number
    onTimeScorecardPct: number | null
  }
  /** `month` is the IST calendar month, YYYY-MM. */
  earnedThisMonth?: { month: string; earnedPaise: number }
  nextSession?: NextSessionDto | null
  laterToday?: LaterTodayDto[]
  scorecardsOwed?: { count: number; atStakePaise: number; rows: ScorecardOwedRowDto[] }
  weeklyCap?: { used: number; cap: number | null; weekStart: string }
}

export const getInterviewerMe = () => api.get<InterviewerMeDto>('/interviewers/me')

// ── Interviews ───────────────────────────────────────────────────────────────
export interface InterviewerScorecardDto {
  scores: { communication: number; domainKnowledge: number; confidence: number; problemSolving: number; overall: number }
  strengths: string
  improvements: string
  internalNote?: string
  qualificationConfirmed?: boolean
  actualQualification?: string
  recommendation?: 'STRONG' | 'SUITABLE' | 'NEEDS_IMPROVEMENT'
  submittedAt?: string
}

export interface InterviewerInterviewDto {
  id: string
  slotStart: string
  slotEnd: string
  durationMin: number
  tier: string
  domain?: string
  language?: string
  feePaise: number
  status: InterviewStatus
  roomReady: boolean
  sessionStartedAt?: string
  sessionEndedAt?: string
  completionPct?: number
  threadId?: string
  student: {
    id: string
    name: string
    city?: string
    languages: string[]
    education?: StudentEducation
    photoUrl?: string
    resumeUrl?: string
    skills: string[]
    experience?: { title?: string; role?: string; company?: string; duration?: string; from?: string; to?: string; description?: string }[]
  }
  script?: { id?: string; title?: string; domain?: string; tier?: string; areas: { id?: string; title: string; prompts: string[] }[] }
  scorecard?: InterviewerScorecardDto
  scorecardDueAt?: string
  payable?: boolean
  nonPayableReason?: NonPayableReason
}

export const listInterviewerInterviews = async () => {
  const res = await api.get<{ interviews?: InterviewerInterviewDto[]; rows?: InterviewerInterviewDto[] }>('/interviewers/me/interviews')
  return res.interviews ?? res.rows ?? []
}

export const getInterviewerInterview = (id: string) => api.get<InterviewerInterviewDto>(`/interviewers/me/interviews/${id}`)

/** The server takes no body; it refuses inside its own cutoff and for anything but a BOOKED interview. */
export const declineInterview = (id: string) =>
  api.post<{ success: boolean; message: string; reassigned: boolean }>(`/interviewers/me/interviews/${id}/decline`)

export const getPrivateNotes = (id: string) => api.get<{ notes: string }>(`/interviewers/me/interviews/${id}/notes`)
export const savePrivateNotes = (id: string, notes: string) =>
  api.put<{ notes: string }>(`/interviewers/me/interviews/${id}/notes`, { notes })

export interface QuestionScriptDto {
  id: string
  version?: number
  domain?: string
  tier?: string
  intro?: string
  areas: { title: string; prompts: string[] }[]
  closing?: string
  notes?: string
}
export const getQuestionScript = (id: string) =>
  api.get<{ script: QuestionScriptDto | null; message?: string }>(`/interviewers/me/interviews/${id}/script`)

// ── The room ─────────────────────────────────────────────────────────────────
export interface InterviewerRoomDto {
  appId: string
  channel: string
  token: string
  uid: number
  sessionStartedAt?: string
  scheduledEndAt: string
  thresholdPct: number
  warnings: number[]
  student: { id: string; name: string }
}

/** Records that the interviewer is in the room (the session starts once both are). Refused outside the join window. */
export const getRoomCredentials = (id: string) => api.get<InterviewerRoomDto>(`/interviewers/me/interviews/${id}/room`)

export type RoomEventKind = 'JOIN' | 'LEAVE' | 'RECONNECT' | 'HIGHLIGHT' | 'AUDIO_ONLY' | 'NETWORK' | 'MUTE' | 'UNMUTE' | 'CAMERA'
export const recordRoomEvent = (id: string, kind: RoomEventKind, payload?: Record<string, unknown>) =>
  api.post<{ success: boolean; id: string; kind: string; at: string }>(`/interviewers/me/interviews/${id}/events`, payload ? { kind, payload } : { kind })

/** Ends the session: the server measures completion from its own clock and starts the scorecard window. */
export const endSession = (id: string) =>
  api.post<{ interview: InterviewerInterviewDto; complete: boolean; pct: number; scorecardDueAt: string }>(
    `/interviewers/me/interviews/${id}/session`,
    { action: 'END' },
  )

// ── Scorecards ───────────────────────────────────────────────────────────────
export type Recommendation = 'STRONG' | 'SUITABLE' | 'NEEDS_IMPROVEMENT'
export type Qualification = 'CLASS_12' | 'GRADUATION' | 'POST_GRADUATION' | 'PHD'

/** POST body — flat and strict (scores are nested only on read). */
export interface ScorecardInput {
  communication: number
  domainKnowledge: number
  confidence: number
  problemSolving: number
  overall: number
  strengths: string
  improvements: string
  internalNote?: string
  qualificationConfirmed: boolean
  actualQualification?: Qualification
  recommendation: Recommendation
}

export interface ScorecardSubmitResult {
  interviewId: string
  status: InterviewStatus
  scorecard: InterviewerScorecardDto
  payable: boolean
  nonPayableReason?: NonPayableReason
  withinWindow: boolean
  feePaise: number
  topup?: { id: string; differencePaise: number; claimedTier: string; actualTier: string }
  published: boolean
}

export const submitScorecard = (id: string, body: ScorecardInput) =>
  api.post<ScorecardSubmitResult>(`/interviewers/me/interviews/${id}/scorecard`, body)

export const listScorecards = (state: 'ALL' | 'PENDING' | 'OVERDUE' = 'ALL') =>
  api.get<{ rows: ScorecardOwedRowDto[]; total: number; page: number; perPage: number }>('/interviewers/me/scorecards', {
    query: { state, perPage: 100 },
  })

// ── Availability ─────────────────────────────────────────────────────────────
export interface AvailabilityBlockDto { startMin: number; endMin: number }
/** weekday 0 = Sunday .. 6 = Saturday; minutes from IST midnight. */
export interface AvailabilityRuleDto { weekday: number; blocks: AvailabilityBlockDto[] }
export interface AvailabilityOverrideDto { date: string; available: boolean; blocks: AvailabilityBlockDto[] }

export interface AvailabilityPayload {
  rules: AvailabilityRuleDto[]
  overrides: AvailabilityOverrideDto[]
  slotMinutes: number
  horizonDays: number
  weekdays?: string[]
}

export const getAvailability = () => api.get<AvailabilityPayload>('/interviewers/me/availability')

/** Replaces the whole week and every override; the server merges adjacent blocks. */
export const saveAvailability = (body: { rules: AvailabilityRuleDto[]; overrides: AvailabilityOverrideDto[] }) =>
  api.put<{ saved: boolean; weeklySlots: number; slots: number }>('/interviewers/me/availability', body)

export interface AvailabilityOverviewDto {
  timezone: string
  slotMinutes: number
  weekStart: string
  weekEnd: string
  days: {
    date: string
    weekday: number
    weekdayName: string
    openMinutes: number
    slots: number
    booked: number
    cells: { startMin: number; status: 'OPEN' | 'BOOKED'; interview?: { id: string; status: InterviewStatus; candidateShortName: string } }[]
  }[]
  totals: { openMinutes: number; slots: number; booked: number }
  overrides: { date: string; available: boolean; kind: 'DAY_OFF' | 'CUSTOM_HOURS'; blocks: AvailabilityBlockDto[] }[]
  next14Days: { date: string; totalSlots: number; bookedSlots: number; openSlots: number }[]
}

/** `weekOf` is any IST date in the week wanted (YYYY-MM-DD); omitted means this week. */
export const getAvailabilityOverview = (weekOf?: string) =>
  api.get<AvailabilityOverviewDto>('/interviewers/me/availability/overview', { query: weekOf ? { weekOf } : {} })

// ── Wallet ───────────────────────────────────────────────────────────────────
export type WithdrawBlockedReason = 'BELOW_MINIMUM' | 'NO_BANK_ACCOUNT' | 'ACCOUNT_SUSPENDED'

export interface WalletDto {
  availablePaise: number
  lockedPaise: number
  pendingPaise: number
  lifetimePaise: number
  minWithdrawalPaise?: number
  canWithdraw: boolean
  withdrawBlockedReason?: WithdrawBlockedReason
  openRequest?: { id: string; amountPaise: number; requestedAt: string } | null
}
export const getWallet = () => api.get<WalletDto>('/interviewers/me/wallet')

export type LedgerKind = 'CREDIT_INTERVIEW' | 'LOCK_WITHDRAWAL' | 'UNLOCK_WITHDRAWAL' | 'DEBIT_PAID' | 'ADJUSTMENT_CREDIT' | 'ADJUSTMENT_DEBIT'

/** The platform's own labels for the six kinds (contracts/wallet.ts LEDGER_KIND_LABELS). */
export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  CREDIT_INTERVIEW: 'Interview fee',
  LOCK_WITHDRAWAL: 'Withdrawal requested',
  UNLOCK_WITHDRAWAL: 'Withdrawal returned',
  DEBIT_PAID: 'Paid out',
  ADJUSTMENT_CREDIT: 'Adjustment',
  ADJUSTMENT_DEBIT: 'Adjustment',
}

export interface LedgerRowDto {
  id: string
  kind: LedgerKind
  sign: 1 | -1
  amountPaise: number
  balanceAfterPaise: number
  at: string
  note?: string
  interview?: { id?: string; studentName: string; tier: string }
}
export const getLedger = (params: { page?: number; perPage?: number; kind?: LedgerKind } = {}) =>
  api.get<{ rows: LedgerRowDto[]; total: number; page: number; perPage: number }>('/interviewers/me/wallet/ledger', { query: params })

export type WithdrawalStatus = 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED'
export interface WithdrawalDto {
  id: string
  amountPaise: number
  status: WithdrawalStatus
  requestedAt: string
  decidedAt?: string | null
  rejectionReason?: string | null
  payment?: { reference: string } | null
}
export const listWithdrawals = () =>
  api.get<{ rows: WithdrawalDto[]; total: number; page: number; perPage: number }>('/interviewers/me/wallet/withdrawals', { query: { perPage: 100 } })
export const requestWithdrawal = (amountPaise: number) => api.post<WithdrawalDto>('/interviewers/me/wallet/withdrawals', { amountPaise })

/** The platform never returns the full account number or PAN. */
export interface BankDto { accountHolder: string; accountNumberLast4: string; ifsc: string; panLast4?: string; updatedAt?: string }
export const getBank = async () => (await api.get<{ bank: BankDto | null }>('/interviewers/me/bank')).bank ?? null
export const saveBank = async (body: { accountHolder: string; accountNumber: string; ifsc: string; pan: string }) =>
  (await api.put<{ bank: BankDto }>('/interviewers/me/bank', body)).bank

export interface StatementDto {
  id: string
  from: string
  to: string
  status: 'PENDING' | 'READY' | 'FAILED'
  rowCount: number
  creditedPaise: number
  paidOutPaise: number
  requestedAt: string
  readyAt?: string
  /** A short-lived signed link, present once the file is ready. */
  url?: string
  error?: string
}
export const listStatements = () => api.get<StatementDto[]>('/interviewers/me/wallet/statements')
export const requestStatement = (from: string, to: string) => api.post<StatementDto>('/interviewers/me/wallet/statements', { from, to })

// ── Chat (the platform chat contract; only the paths are the interviewer's) ──
export const listInterviewerThreads = () =>
  api.get<{ rows: ThreadDto[]; total: number }>('/interviewers/me/messages', { query: { perPage: 50 } })
export const getInterviewerThread = (id: string) => api.get<ThreadPage>(`/interviewers/me/messages/${id}`, { query: { limit: 50 } })
export const sendInterviewerMessage = (id: string, input: { body?: string; clientMessageId?: string }) =>
  api.post<{ message: MessageDto; duplicate: boolean }>(`/interviewers/me/messages/${id}`, input)
export const markInterviewerThreadRead = (id: string) => api.patch<{ read: number; at: string }>(`/interviewers/me/messages/${id}`)

// ── Auth and application ─────────────────────────────────────────────────────
export const loginInterviewerPassword = async (body: { email: string; password: string }) => {
  const data = await api.post<{
    accessToken: string
    refreshToken: string
    user: { id: string; role: string; name?: string; email: string }
    mustChangePassword: boolean
    status: string
  }>('/auth/login/password', body, { anonymous: true })
  await tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return data
}

/** The server checks the current password (also on a forced first change) and signs every session out. */
export const changeInterviewerPassword = (body: { currentPassword: string; newPassword: string }) =>
  api.post<{ changed: boolean; signInAgain: boolean }>('/interviewers/me/password', body)

export const getResumeUploadUrl = (body: { contentType: string; sizeBytes: number }) =>
  api.post<{ url: string; headers: Record<string, string>; key: string; maxBytes: number }>('/interviewers/apply/resume', body, { anonymous: true })

/** POST /interviewers/apply (contracts/interviewer.ts interviewerApplyInput). */
export interface InterviewerApplicationInput {
  name: string
  email: string
  mobile: string
  city: string
  domains: string[]
  languages: string[]
  yearsExperience: number
  currentEmployer?: string
  linkedinUrl?: string
  background: string
  expectedAvailability?: string
  resumeKey?: string
}
export const submitInterviewerApplication = (body: InterviewerApplicationInput) =>
  api.post<{ received: boolean; message: string }>('/interviewers/apply', body, { anonymous: true })
