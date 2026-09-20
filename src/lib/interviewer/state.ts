import type { InterviewerMeDto, InterviewerInterviewDto } from '../api/interviewer'

export const INTERVIEWER_TABS = [
  { id: 'home', label: 'Home', screen: 'InterviewerDashboard' },
  { id: 'interviews', label: 'Interviews', screen: 'InterviewerInterviews' },
  { id: 'availability', label: 'Availability', screen: 'Availability' },
  { id: 'wallet', label: 'Wallet', screen: 'InterviewerWallet' },
  { id: 'account', label: 'Account', screen: 'InterviewerAccount' },
] as const

export type InterviewerTabId = (typeof INTERVIEWER_TABS)[number]['id']

/**
 * Tier compensation (Decision D1 / 18 Sep 2026):
 * Fees in integer paise:
 * T1: ₹40 (4000)
 * T2: ₹70 (7000)
 * T3: ₹110 (11000)
 * T4: ₹150 (15000)
 */
export const TIER_FEES_PAISE: Record<string, number> = {
  T1: 4000,
  T2: 7000,
  T3: 11000,
  T4: 15000,
  TIER_1: 4000,
  TIER_2: 7000,
  TIER_3: 11000,
  TIER_4: 15000,
}

export const MIN_WITHDRAWAL_PAISE = 50_000 // ₹500 (IV-17)

export const TIER_LABELS: Record<string, string> = {
  T1: 'T1 · 12th pass',
  T2: 'T2 · Graduate',
  T3: 'T3 · Post-graduate',
  T4: 'T4 · Specialised',
  TIER_1: 'T1 · 12th pass',
  TIER_2: 'T2 · Graduate',
  TIER_3: 'T3 · Post-graduate',
  TIER_4: 'T4 · Specialised',
}

/**
 * Scorecard Window (Decision D3 / §6.3):
 * 24 hours from sessionEndedAt (or slotEnd if sessionEndedAt absent).
 */
export const SCORECARD_WINDOW_HOURS = 24

export interface ScorecardClock {
  status: 'SUBMITTED' | 'OPEN' | 'URGENT' | 'EXPIRED'
  remainingMs: number
  remainingFormatted: string
  feeForfeited: boolean
}

export function computeScorecardClock(
  interview: Pick<InterviewerInterviewDto, 'scorecard' | 'scorecardDueAt' | 'sessionEndedAt' | 'slotEnd' | 'payable'>,
  now: Date = new Date(),
): ScorecardClock {
  if (interview.scorecard?.submittedAt) {
    return {
      status: 'SUBMITTED',
      remainingMs: 0,
      remainingFormatted: 'Submitted',
      feeForfeited: false,
    }
  }

  let dueMs: number
  if (interview.scorecardDueAt) {
    dueMs = new Date(interview.scorecardDueAt).getTime()
  } else {
    const baseTime = interview.sessionEndedAt
      ? new Date(interview.sessionEndedAt).getTime()
      : new Date(interview.slotEnd).getTime()
    dueMs = baseTime + SCORECARD_WINDOW_HOURS * 60 * 60 * 1000
  }

  const remainingMs = dueMs - now.getTime()

  if (remainingMs <= 0) {
    return {
      status: 'EXPIRED',
      remainingMs: 0,
      remainingFormatted: 'Window closed',
      feeForfeited: true,
    }
  }

  const totalMinutes = Math.floor(remainingMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const remainingFormatted = `${hours}h ${minutes.toString().padStart(2, '0')}m left`

  return {
    status: hours < 4 ? 'URGENT' : 'OPEN',
    remainingMs,
    remainingFormatted,
    feeForfeited: false,
  }
}

/**
 * Join window for live rooms opens 10 minutes before slot start.
 */
export function isJoinWindowActive(slotStartIso: string, now: Date = new Date()): boolean {
  const startMs = new Date(slotStartIso).getTime()
  const nowMs = now.getTime()
  // Active from 10 minutes prior up to 60 minutes after start
  return nowMs >= startMs - 10 * 60 * 1000 && nowMs <= startMs + 60 * 60 * 1000
}

export function isSuspended(interviewer: InterviewerMeDto | null): boolean {
  return interviewer?.status === 'SUSPENDED'
}

export function isDeactivated(interviewer: InterviewerMeDto | null): boolean {
  return interviewer?.status === 'DEACTIVATED'
}

export function isActive(interviewer: InterviewerMeDto | null): boolean {
  return interviewer?.status === 'ACTIVE'
}

export function canJoinInterviewRoom(slotStartIso: string, now: Date = new Date()): boolean {
  return isJoinWindowActive(slotStartIso, now)
}

export function formatScorecardCountdown(slotEndIso: string, now: Date = new Date()): string {
  const clock = computeScorecardClock({ slotEnd: slotEndIso }, now)
  return clock.remainingFormatted
}

export function isScorecardOverdue(slotEndIso: string, now: Date = new Date()): boolean {
  const clock = computeScorecardClock({ slotEnd: slotEndIso }, now)
  return clock.status === 'EXPIRED'
}
