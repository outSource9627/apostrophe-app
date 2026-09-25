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
  /** Only a newer server sends it; otherwise it is sentAt plus the config's cooldown. */
  nextEligibleAt?: string
  resend: boolean
}

/**
 * One Interest the employer sent. The server sends the name, outcome, message,
 * linked job id and the three timestamps; it sends no city or tier, no job
 * title and no reopen date, so the screen joins the job's title from
 * /employers/jobs and works the reopen date out from `sentAt` plus the config's
 * cooldown (`interestNextEligibleAt`). A decline and an expiry are the same
 * outcome to the sender by design — there is no "Expired" state to draw.
 */
export interface EmployerInterestRow {
  id: string
  candidateId: string
  name: string
  outcome: InterestOutcome
  message: string | null
  jobId: string | null
  sentAt: string
  expiresAt: string
  /** When it was answered or lapsed. Absent while it is still open. */
  closedAt: string | null
  /** An accepted Interest that opened a Connection — its chat is open. */
  connected: boolean
  /** Read if a newer server sends it. */
  nextEligibleAt: string | null
  threadId: string | null
}

export interface EmployerInterestListResponse {
  rows: EmployerInterestRow[]
  total: number
  page: number
  perPage: number
}

interface WireInterestRow {
  id: string
  candidateId: string
  name?: string | null
  outcome: InterestOutcome
  message?: string | null
  jobId?: string | null
  job?: { id: string } | null
  sentAt: string
  expiresAt: string
  closedAt?: string | null
  connected?: boolean
  nextEligibleAt?: string | null
  threadId?: string | null
}

function normalizeInterest(w: WireInterestRow): EmployerInterestRow {
  return {
    id: w.id,
    candidateId: w.candidateId,
    name: w.name?.trim() || 'Candidate',
    outcome: w.outcome,
    message: w.message?.trim() || null,
    jobId: w.jobId ?? w.job?.id ?? null,
    sentAt: w.sentAt,
    expiresAt: w.expiresAt,
    closedAt: w.closedAt ?? null,
    connected: Boolean(w.connected) || Boolean(w.threadId),
    nextEligibleAt: w.nextEligibleAt ?? null,
    threadId: w.threadId ?? null,
  }
}

/**
 * When the next Interest to this candidate may go: the server's own date if it
 * sent one, else the sending day plus the cooldown the config reports. Null when
 * neither is known — the screen then leaves the date out and lets the server
 * decide when the employer tries.
 */
export function interestNextEligibleAt(
  row: Pick<EmployerInterestRow, 'sentAt' | 'nextEligibleAt'>,
  cooldownDays?: number,
): Date | null {
  if (row.nextEligibleAt) return new Date(row.nextEligibleAt)
  if (typeof cooldownDays !== 'number') return null
  return new Date(new Date(row.sentAt).getTime() + cooldownDays * 86_400_000)
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
  const res = await api.get<{ rows?: WireInterestRow[]; total?: number; page?: number; perPage?: number }>(path)
  const rows = (res?.rows ?? []).map(normalizeInterest)
  return { rows, total: res?.total ?? rows.length, page: res?.page ?? 1, perPage: res?.perPage ?? rows.length }
}

/** The server's page ceiling for this list. */
const INTEREST_PAGE_MAX = 100

/**
 * Every Interest, newest first. The tab counts and the shortlist's status pills
 * are worked out from the whole list, which is small (one row per candidate).
 */
export async function fetchAllEmployerInterests(): Promise<EmployerInterestRow[]> {
  const all: EmployerInterestRow[] = []
  for (let page = 1; ; page++) {
    const res = await fetchEmployerInterests({ page, perPage: INTEREST_PAGE_MAX })
    all.push(...res.rows)
    if (res.rows.length < INTEREST_PAGE_MAX || all.length >= res.total) break
  }
  return all
}
