import type { ScreeningQuestion, ScreeningSection, ScreeningState } from '../api/screening'

/**
 * The screening test's arithmetic, kept apart from the screen so it can be
 * tested: the section names, the countdown and where each state lands.
 *
 * THE CLOCK IS THE SERVER'S. The time left is `deadlineAt − serverNow` at the
 * moment of a fetch, minus the time this phone has counted since — never
 * `deadlineAt − Date.now()`, which would trust a device clock the applicant can
 * set. Only differences of `Date.now()` are used, and the screen syncs again on
 * every return to the foreground and every reconnect.
 */

export const SECTION_ORDER: ScreeningSection[] = ['TECHNICAL', 'REASONING', 'IQ', 'GK']
export const SECTION_NAME: Record<ScreeningSection, string> = {
  TECHNICAL: 'Technical',
  REASONING: 'Reasoning',
  IQ: 'IQ',
  GK: 'General knowledge',
}
/** The progress strips are narrow: general knowledge is "GK" there and only there. */
export const SECTION_SHORT: Record<ScreeningSection, string> = { ...SECTION_NAME, GK: 'GK' }

/** The timer turns amber, and the one toast shows, in the last five minutes. */
export const LOW_TIME_MS = 5 * 60 * 1000
/** How often "Getting your test ready…" asks again. */
export const PREPARING_RETRY_MS = 10 * 1000

export interface ClockSync {
  /** What the server said was left, at the fetch. */
  remainingMs: number
  /** `Date.now()` when that answer arrived. */
  at: number
}

export const clockSync = (deadlineAt: string, serverNow: string, at: number): ClockSync => ({
  remainingMs: Date.parse(deadlineAt) - Date.parse(serverNow),
  at,
})

/** Time left now, never below zero. A bad date counts as no time left. */
export function remainingMs(sync: ClockSync, now: number): number {
  const left = sync.remainingMs - (now - sync.at)
  return Number.isFinite(left) ? Math.max(0, left) : 0
}

const pad = (n: number) => String(n).padStart(2, '0')

/** '38:12', '04:58', '45:00' — whole seconds rounded up, so 0:00 means the time is really up. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

export interface SectionRun {
  section: ScreeningSection
  /** Positions in the display order, first to last. */
  positions: number[]
  answered: number
}

/** The sections present, in order, with where their questions sit and how many have an answer. */
export function sectionRuns(questions: ScreeningQuestion[], answers: Array<number | null | undefined>): SectionRun[] {
  return SECTION_ORDER.map((section) => {
    const positions: number[] = []
    let answered = 0
    questions.forEach((q, pos) => {
      if (q.section !== section) return
      positions.push(pos)
      if (answers[q.index] != null) answered += 1
    })
    return { section, positions, answered }
  }).filter((r) => r.positions.length > 0)
}

export const answeredCount = (answers: Array<number | null | undefined>) => answers.filter((a) => a != null).length

/**
 * Where a test that can no longer be taken lands. Out of time (the server
 * submitted for them) → Time's up; submitted by hand → Already submitted; an
 * unstarted link past its date → expired. Null while it can still be taken.
 */
export type ClosedState =
  | { k: 'timeup'; answered: number; total: number }
  | { k: 'already'; on: string | null }
  | { k: 'expired'; until: string | null }

export function closedState(s: ScreeningState): ClosedState | null {
  if (s.status === 'EXPIRED') return { k: 'expired', until: s.expiresAt }
  if (s.status === 'SUBMITTED') {
    return s.autoSubmitted ? { k: 'timeup', answered: s.answeredCount, total: s.total } : { k: 'already', on: s.submittedAt }
  }
  return null
}
