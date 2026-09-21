import { api, tokenStore } from './index'

export type InterviewerStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'INACTIVE'
export type InterviewStatus =
  | 'BOOKED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'STUDENT_NO_SHOW'
  | 'INTERVIEWER_NO_SHOW'

export interface InterviewerMetricsDto {
  totalInterviews?: number
  completionRate?: number
  completionPct?: number
  noShows?: number
  noShowCount?: number
  averageDurationMinutes?: number
  scorecardTurnaroundHours?: number
  onTimeScorecardRate?: number
  onTimeScorecardPct?: number
}

export interface InterviewerWalletSummaryDto {
  availablePaise: number
  pendingPaise: number
  withdrawnPaise: number
}

export interface InterviewerMeDto {
  id: string
  userId: string
  name: string
  email: string
  mobile: string
  phone?: string
  status: InterviewerStatus
  domains: string[]
  languages: string[]
  bio?: string
  permittedTiers?: string[]
  qualityScore?: number
  totalInterviews?: number
  metrics?: InterviewerMetricsDto
  wallet?: InterviewerWalletSummaryDto
}

export interface BankAccountDto {
  accountNumber: string
  accountNumberLast4?: string
  ifsc: string
  beneficiaryName: string
  accountHolder?: string
  bankName?: string
  panLast4?: string
  verified: boolean
}

export interface BankAccountInput {
  accountNumber: string
  ifsc: string
  beneficiaryName: string
  panLast4?: string
}

export interface WithdrawalRequestDto {
  id: string
  amountPaise: number
  status: 'REQUESTED' | 'PROCESSING' | 'PAID' | 'REJECTED'
  requestedAt: string
  referenceNumber?: string
}

export interface WalletDto {
  availablePaise: number
  pendingPaise: number
  withdrawnPaise: number
  canWithdraw: boolean
  withdrawBlockedReason?: 'ACCOUNT_SUSPENDED' | 'KYC_PENDING' | 'BELOW_MINIMUM' | 'ACTIVE_WITHDRAWAL_IN_PROGRESS'
  minimumWithdrawalPaise: number
  bankAccount?: BankAccountDto | null
  openRequest?: WithdrawalRequestDto | null
}

export interface LedgerEntryDto {
  id: string
  type: 'FEE_CREDIT' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'FORFEIT'
  amountPaise: number
  balanceAfterPaise: number
  status: 'PENDING' | 'CLEARED' | 'CANCELLED'
  description: string
  createdAt: string
  interviewId?: string
}

export interface AvailabilityBlockDto {
  startMin: number
  endMin: number
}

export interface AvailabilityRuleDto {
  weekday: number // 0 = Sunday .. 6 = Saturday
  blocks: AvailabilityBlockDto[]
}

export interface AvailabilityOverrideDto {
  date: string // YYYY-MM-DD
  available: boolean
  blocks: AvailabilityBlockDto[]
}

export interface AvailabilityPayload {
  rules: AvailabilityRuleDto[]
  overrides: AvailabilityOverrideDto[]
  slotMinutes?: number
  horizonDays?: number
  weekdays?: string[]
  saved?: boolean
  weeklySlots?: number
}

export interface InterviewerScorecardDto {
  scores: {
    communication: number
    domainKnowledge: number
    confidence: number
    problemSolving: number
    overall: number
  }
  strengths: string
  improvements: string
  internalNote?: string
  recommendedTier?: string
  submittedAt?: string
}

export interface ScorecardInput {
  scores: {
    communication: number
    domainKnowledge: number
    confidence: number
    problemSolving: number
    overall: number
  }
  strengths: string
  improvements: string
  internalNote?: string
  recommendedTier?: string
}

export interface ScorecardListItemDto {
  id: string
  interviewId: string
  studentName: string
  tier: string
  domain?: string
  submittedAt?: string
  dueAt?: string
  forfeited?: boolean
  amountPaise?: number
}

export interface InterviewerInterviewDto {
  id: string
  slotStart: string
  slotEnd: string
  durationMin: number
  tier: string
  domain?: string
  feePaise: number
  status: InterviewStatus
  joinUrl?: string
  roomReady: boolean
  sessionStartedAt?: string
  sessionEndedAt?: string
  completionPct?: number
  threadId?: string
  scorecardSubmittedAt?: string
  privateNotes?: string
  student: {
    id: string
    name: string
    city?: string
    languages?: string[]
    education?: any
    photoUrl?: string
    resumeUrl?: string
    resumeKey?: string
    skills?: string[]
    experience?: any
    headline?: string
  }
  script?: {
    id: string
    title?: string
    domain: string
    suggestedQuestions?: string[]
    rubricGuidelines?: string[]
  }
  scorecard?: InterviewerScorecardDto | null
  scorecardDueAt?: string
  payable?: boolean
}

export type InterviewSessionDto = InterviewerInterviewDto

export interface InterviewerRoomDto {
  channel: string
  token: string
  uid: string
  appId?: string
  interviewerRole: 'INTERVIEWER'
  student: {
    id: string
    name: string
  }
}

export interface InterviewEventInput {
  eventType: 'JOIN' | 'LEAVE' | 'RECONNECT' | 'HIGHLIGHT' | 'AUDIO_ONLY' | 'NETWORK'
  payload?: Record<string, unknown>
}

// ── API Methods ─────────────────────────────────────────────────────────────

export const getInterviewerMe = () => api.get<InterviewerMeDto>('/interviewers/me')

export const listInterviewerInterviews = () =>
  api.get<{ interviews: InterviewerInterviewDto[] }>('/interviewers/me/interviews')

export const getInterviewerInterview = (id: string) =>
  api.get<InterviewerInterviewDto>(`/interviewers/me/interviews/${id}`)

export const declineInterviewAssignment = (id: string, reason: string) =>
  api.post<{ success: boolean; message: string }>(`/interviewers/me/interviews/${id}/decline`, { reason })

export const declineInterviewerInterview = declineInterviewAssignment

export const getInterviewerRoomCredentials = (id: string) =>
  api.get<InterviewerRoomDto>(`/interviewers/me/interviews/${id}/room`)

export const getInterviewerPrivateNotes = (id: string) =>
  api.get<{ notes: string }>(`/interviewers/me/interviews/${id}/notes`)

export const saveInterviewerPrivateNotes = (id: string, notes: string) =>
  api.put<{ notes: string }>(`/interviewers/me/interviews/${id}/notes`, { notes })

export const recordInterviewEvent = (id: string, event: InterviewEventInput) =>
  api.post<{ success: boolean }>(`/interviewers/me/interviews/${id}/events`, event)

export const recordInterviewerRoomEvent = (
  id: string,
  kind: 'JOIN' | 'LEAVE' | 'RECONNECT' | 'HIGHLIGHT' | 'AUDIO_ONLY' | 'NETWORK' | string,
  payload?: Record<string, unknown>,
) =>
  api.post<{ success: boolean }>(`/interviewers/me/interviews/${id}/events`, {
    kind,
    payload,
  })

export const getInterviewerScorecard = (id: string) =>
  api.get<InterviewerScorecardDto | null>(`/interviewers/me/interviews/${id}/scorecard`)

export const submitInterviewerScorecard = (id: string, body: ScorecardInput) =>
  api.post<InterviewerScorecardDto>(`/interviewers/me/interviews/${id}/scorecard`, body)

export const getInterviewerQuestionScript = (id: string) =>
  api.get<{ script: InterviewerInterviewDto['script'] | null; message?: string }>(
    `/interviewers/me/interviews/${id}/script`,
  )

export const listInterviewerScorecards = () =>
  api.get<{ scorecards: ScorecardListItemDto[] }>('/interviewers/me/scorecards')

export const getInterviewerAvailability = (params: { from?: string; until?: string } = {}) =>
  api.get<AvailabilityPayload>('/interviewers/me/availability', { query: params })

export const updateInterviewerAvailability = (body: {
  rules: AvailabilityRuleDto[]
  overrides: AvailabilityOverrideDto[]
}) => api.put<AvailabilityPayload>('/interviewers/me/availability', body)

export const getInterviewerWallet = () => api.get<WalletDto>('/interviewers/me/wallet')

export const getInterviewerLedger = (params: { page?: number; perPage?: number; status?: string } = {}) =>
  api.get<{ items: LedgerEntryDto[]; total: number; page: number; perPage: number }>(
    '/interviewers/me/wallet/ledger',
    { query: params },
  )

export const listWithdrawals = () =>
  api.get<{ withdrawals: WithdrawalRequestDto[] }>('/interviewers/me/wallet/withdrawals')

export const requestWithdrawal = (amountPaise: number) =>
  api.post<WithdrawalRequestDto>('/interviewers/me/wallet/withdrawals', { amountPaise })

export const getBankAccount = () =>
  api.get<{ account: BankAccountDto | null }>('/interviewers/me/wallet/bank')

export const updateBankAccount = (body: BankAccountInput) =>
  api.put<BankAccountDto>('/interviewers/me/wallet/bank', body)

// ── Auth & Application ──────────────────────────────────────────────────────

export const forgotPassword = (email: string) =>
  api.post<{ success: boolean; message: string }>('/auth/password/forgot', { email }, { anonymous: true })

export const resetPassword = (token: string, password: string) =>
  api.post<{ success: boolean; message: string }>('/auth/password/reset', { token, password }, { anonymous: true })

export const getResumeUploadPresignedUrl = () =>
  api.post<{ uploadUrl: string; key: string }>('/interviewers/apply/resume', {}, { anonymous: true })

export interface InterviewerApplicationInput {
  name: string
  email: string
  mobile: string
  domains: string[]
  languages: string[]
  experienceYears: number
  currentCompany?: string
  currentRole?: string
  linkedinUrl?: string
  resumeKey?: string
}

export const submitInterviewerApplication = (body: InterviewerApplicationInput) =>
  api.post<{ success: boolean; applicationId: string }>('/interviewers/apply', body, { anonymous: true })

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

export const changeInterviewerPassword = (body: { currentPassword: string; newPassword: string }) =>
  api.post<{ changed: boolean; signInAgain: boolean }>('/interviewers/me/password', body)

// ── Messages / Chats (IV-20, CH-07) ──────────────────────────────────────────

export interface InterviewerThreadDto {
  id: string
  interviewId?: string
  student?: {
    id: string
    name: string
    city?: string
    photoUrl?: string
  }
  unread: number
  lastMessage?: {
    text: string
    sentAt: string
    senderRole: string
  }
  sealed?: boolean
  opensAt?: string
  closesAt?: string
}

export interface InterviewerChatMessageDto {
  id: string
  senderId: string
  senderRole: 'INTERVIEWER' | 'STUDENT' | 'ADMIN'
  text: string
  sentAt: string
  readAt?: string
  deliveredAt?: string
}

export const listInterviewerThreads = (params: { page?: number; perPage?: number } = {}) =>
  api.get<{ threads: InterviewerThreadDto[]; total: number }>('/interviewers/me/messages', { query: params })

export const getInterviewerThread = (id: string, params: { before?: string; limit?: number } = {}) =>
  api.get<{ thread: InterviewerThreadDto; messages: InterviewerChatMessageDto[]; hasMore: boolean }>(
    `/interviewers/me/messages/${id}`,
    { query: params },
  )

export const sendInterviewerMessage = (id: string, text: string) =>
  api.post<{ message: InterviewerChatMessageDto; duplicate: boolean }>(`/interviewers/me/messages/${id}`, { text })

export const markInterviewerThreadRead = (id: string) =>
  api.patch<{ read: number }>(`/interviewers/me/messages/${id}`)

// ── Notifications (IV-21) ───────────────────────────────────────────────────

export interface InterviewerNotificationDto {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
}

export const listInterviewerNotifications = () =>
  api.get<{ notifications: InterviewerNotificationDto[] }>('/interviewers/me/notifications')

export const markAllNotificationsRead = () =>
  api.post<{ marked: number }>('/interviewers/me/notifications/read', {})

// ── Function Aliases ────────────────────────────────────────────────────────

export const listInterviewerLedger = getInterviewerLedger
export const getInterviewerBankAccount = getBankAccount
export const updateInterviewerBankAccount = updateBankAccount
export const declineInterview = declineInterviewAssignment
export const savePrivateNotes = saveInterviewerPrivateNotes
export const submitScorecard = submitInterviewerScorecard

export const interviewerApi = {
  apply: (body: any) =>
    submitInterviewerApplication({
      name: body.name,
      email: body.email,
      mobile: body.phone || body.mobile || '',
      domains: body.domain ? [body.domain] : body.domains || ['Engineering'],
      languages: body.languages || ['English', 'Hindi'],
      experienceYears: body.experienceYears || 2,
      currentCompany: body.currentCompany,
      currentRole: body.currentRole,
      linkedinUrl: body.linkedinUrl,
      resumeKey: body.resumeKey || body.resumeUrl,
    }),
  signIn: loginInterviewerPassword,
  updatePassword: changeInterviewerPassword,
  forgotPassword,
  resetPassword,
  getMe: getInterviewerMe,
  getInterviews: listInterviewerInterviews,
  getInterview: getInterviewerInterview,
  submitScorecard: (id: string, body: any) =>
    submitInterviewerScorecard(id, {
      scores: {
        domainKnowledge: body.scores?.technicalDepth ?? body.scores?.domainKnowledge ?? 4,
        communication: body.scores?.communication ?? 4,
        problemSolving: body.scores?.problemSolving ?? 4,
        confidence: body.scores?.cultureFit ?? body.scores?.confidence ?? 4,
        overall: body.scores?.overall ?? 4,
      },
      strengths: body.strengths,
      improvements: body.areasForImprovement || body.improvements || 'None',
      internalNote: body.internalNotes || body.internalNote,
      recommendedTier: body.recommendedTier,
    }),
  savePrivateNotes: (id: string, notes: string) => saveInterviewerPrivateNotes(id, notes),
  declineSession: (id: string, reason: string) => declineInterviewAssignment(id, reason),
  getAvailability: getInterviewerAvailability,
  saveAvailability: updateInterviewerAvailability,
  getWallet: getInterviewerWallet,
  requestWithdrawal: (amountPaise: number) => requestWithdrawal(amountPaise),
  getLedger: listInterviewerLedger,
  updateBankDetails: (body: any) =>
    updateBankAccount({
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      beneficiaryName: body.accountHolder || body.beneficiaryName || '',
      panLast4: body.panLast4,
    }),
  getNotifications: listInterviewerNotifications,
  markNotificationsRead: markAllNotificationsRead,
  getChats: listInterviewerThreads,
}
