import { api } from './index'

export type InterestOutcome = 'SENT' | 'ACCEPTED' | 'NOT_ACCEPTED'

export const INTEREST_OUTCOME_LABEL: Record<InterestOutcome, string> = {
  SENT: 'Interest sent',
  ACCEPTED: 'Accepted',
  NOT_ACCEPTED: 'Not accepted',
}

export const INTEREST_MESSAGE_MAX_LENGTH = 600

export interface EmployerInterestState {
  id: string
  outcome: InterestOutcome
  sentAt: string
  expiresAt: string
  nextEligibleAt: string | null
  jobId: string | null
}

/**
 * The outcome ON SCREEN, now: a SENT Interest whose expiresAt has passed
 * reads NOT_ACCEPTED without waiting for a refetch (CF-28).
 */
export function liveInterestOutcome(
  interest: Pick<EmployerInterestState, 'outcome' | 'expiresAt'>,
  now: Date = new Date(),
): InterestOutcome {
  if (interest.outcome === 'SENT' && new Date(interest.expiresAt).getTime() <= now.getTime()) {
    return 'NOT_ACCEPTED'
  }
  return interest.outcome
}

export type InterestSlot = 'SEND' | 'SENT' | 'ACCEPTED' | 'COOLDOWN' | 'OPEN_CHAT' | 'NONE'

/**
 * WHAT THE INTEREST SLOT SHOWS — one rule for candidate profile, shortlist row, and feed card.
 */
export function employerInterestSlot(
  input: {
    available: boolean
    interest: EmployerInterestState | null
    connection: { threadId?: string | null; active?: boolean } | null
  },
  now: Date = new Date(),
): InterestSlot {
  if (input.connection?.active || Boolean(input.connection?.threadId)) return 'OPEN_CHAT'
  if (!input.available) return 'NONE'
  const interest = input.interest
  if (!interest) return 'SEND'
  const outcome = liveInterestOutcome(interest, now)
  if (outcome === 'SENT') return 'SENT'
  if (interest.nextEligibleAt === null) return outcome === 'ACCEPTED' ? 'ACCEPTED' : 'NONE'
  if (new Date(interest.nextEligibleAt).getTime() > now.getTime()) {
    return outcome === 'ACCEPTED' ? 'ACCEPTED' : 'COOLDOWN'
  }
  return 'SEND'
}

export interface SendInterestInput {
  message?: string
  jobId?: string
}

export interface SendInterestResult {
  id: string
  candidateId: string
  sentAt: string
  expiresAt: string
  nextEligibleAt: string
  resend: boolean
}

export interface EmployerInterestRow {
  id: string
  candidateId: string
  shortlistId: string | null
  name: string
  available: boolean
  posterUrl: string | null
  durationSec: number | null
  city: string | null
  job: { id: string; title: string; location: string } | null
  message: string | null
  sentAt: string
  expiresAt: string
  nextEligibleAt: string | null
  outcome: InterestOutcome
  threadId: string | null
}

export interface EmployerInterestListResponse {
  rows: EmployerInterestRow[]
  total: number
  page: number
  perPage: number
  counts: { all: number } & Record<InterestOutcome, number>
  since: string | null
}

export interface InterestListQuery {
  outcome?: InterestOutcome
  page?: number
  perPage?: number
}

export async function sendCandidateInterest(
  candidateId: string,
  input: SendInterestInput = {},
): Promise<SendInterestResult> {
  return api.post<SendInterestResult>(`/employers/candidates/${candidateId}/interest`, input)
}

export async function fetchEmployerInterests(
  query: InterestListQuery = {},
): Promise<EmployerInterestListResponse> {
  const params = new URLSearchParams()
  if (query.outcome) params.set('outcome', query.outcome)
  if (query.page) params.set('page', String(query.page))
  if (query.perPage) params.set('perPage', String(query.perPage))

  const qs = params.toString()
  const path = qs ? `/employers/interests?${qs}` : '/employers/interests'
  return api.get<EmployerInterestListResponse>(path)
}
