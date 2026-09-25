import type { AppConfig } from '../api/config'
import type { InterviewerInterviewDto, InterviewStatus, ScorecardOwedRowDto, StudentEducation } from '../api/interviewer'
import { label } from '../profile/labels'

/**
 * The interviewer screens' rules, once. Everything is Asia/Kolkata (a fixed
 * +05:30 — India has no daylight saving) and every number an admin controls is
 * passed in from `/config` or the API, never typed here: a sentence drops its
 * number when the server does not send one.
 */

const IST_MS = 330 * 60_000
const DAY_MS = 86_400_000
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const pad = (n: number) => String(n).padStart(2, '0')

export function ist(at: string | number | Date) {
  const d = new Date(new Date(at).getTime() + IST_MS)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }
}

/** '12:15 PM' */
export const istTime = (at: string | number | Date) => {
  const p = ist(at)
  return `${p.h % 12 === 0 ? 12 : p.h % 12}:${pad(p.mi)} ${p.h < 12 ? 'AM' : 'PM'}`
}
/** '24 Sep' */
export const istDay = (at: string | number | Date) => { const p = ist(at); return `${p.d} ${MON[p.mo]}` }
/** 'Thu 24 Sep' */
export const istWeekday = (at: string | number | Date) => { const p = ist(at); return `${DOW[p.dow]} ${p.d} ${MON[p.mo]}` }
/** '24 Sep, 12:15 PM' */
export const istStamp = (at: string | number | Date) => `${istDay(at)}, ${istTime(at)}`
/** 'YYYY-MM-DD' of the IST day */
export const istDateKey = (at: string | number | Date) => { const p = ist(at); return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}` }
export const istMinutes = (at: string | number | Date) => { const p = ist(at); return p.h * 60 + p.mi }
export const monthLong = (mo: number) => MON_LONG[mo]
export const monthShort = (mo: number) => MON[mo]
export const weekdayLong = (dow: number) => DOW_LONG[dow]
export const weekdayShort = (dow: number) => DOW[dow]

/** 'September' from the IST 'YYYY-MM' the month's earnings are stamped with. */
export const monthNameOf = (yyyyMm: string) => MON_LONG[Number(yyyyMm.split('-')[1]) - 1] ?? yyyyMm

export function greetingFor(nowMs: number): string {
  const h = ist(nowMs).h
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** mm:ss under an hour, hh:mm:ss under two days, 'Nd Nh' beyond. */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}h`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** hh:mm:ss, however many hours are left — a scorecard's clock. */
export function hms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** Date keys ('YYYY-MM-DD') as whole days. */
export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}
export const weekdayOfKey = (key: string) => new Date(`${key}T00:00:00Z`).getUTCDay()
export const dayOfKey = (key: string) => Number(key.slice(8, 10))
export const monthOfKey = (key: string) => Number(key.slice(5, 7)) - 1

// ── Who the candidate is ─────────────────────────────────────────────────────
/** 'Graduation · Nirma University · 2026' — the parts the API sent, nothing else. */
export function educationLine(e?: StudentEducation | null): string | null {
  if (!e) return null
  const parts = [e.qualification ? label(e.qualification) : null, e.fieldOfStudy, e.institution, e.yearOfCompletion ? String(e.yearOfCompletion) : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** 'T2 · Business & Management · EN, HI' */
export function sessionLine(s: { tier?: string; domain?: string; languages?: string[]; language?: string }): string {
  const langs = s.languages?.length ? s.languages.map((l) => l.slice(0, 2).toUpperCase()).join(', ') : s.language ? s.language.slice(0, 2).toUpperCase() : null
  return [s.tier, s.domain, langs].filter(Boolean).join(' · ')
}

// ── The join window ──────────────────────────────────────────────────────────
export type JoinState =
  | { kind: 'open'; rejoin: boolean }
  | { kind: 'locked'; opensInSec: number | null }
  | { kind: 'closed' }

/**
 * Whether the room can be entered now. The server opens it `joinOpensMinutesBefore`
 * the start and closes it `noShowMinutesAfter` it (config.interviewer, else
 * config.booking); `roomReady` / IN_PROGRESS from the server always win. A bound
 * that is not known is not enforced here — the server refuses if it must.
 */
export function joinState(
  s: { slotStart: string; status: InterviewStatus; roomReady?: boolean; joinOpensAt?: string },
  config: AppConfig | null,
  nowMs: number,
): JoinState {
  if (s.status === 'IN_PROGRESS') return { kind: 'open', rejoin: true }
  if (s.status !== 'BOOKED') return { kind: 'closed' }
  if (s.roomReady) return { kind: 'open', rejoin: false }
  const start = Date.parse(s.slotStart)
  const before = config?.interviewer?.joinOpensMinutesBefore ?? config?.booking?.joinOpensMinutesBefore
  const after = config?.interviewer?.noShowMinutesAfter ?? config?.booking?.noShowMinutesAfter
  const opensAt = s.joinOpensAt ? Date.parse(s.joinOpensAt) : before != null ? start - before * 60_000 : null
  if (after != null && nowMs > start + after * 60_000) return { kind: 'closed' }
  if (opensAt == null) return { kind: 'locked', opensInSec: null }
  if (nowMs >= opensAt) return { kind: 'open', rejoin: false }
  return { kind: 'locked', opensInSec: Math.ceil((opensAt - nowMs) / 1000) }
}

// ── Scorecards ───────────────────────────────────────────────────────────────
export type ScorecardClock =
  | { status: 'SUBMITTED' }
  | { status: 'OPEN' | 'URGENT'; secondsLeft: number }
  | { status: 'EXPIRED' }
  | { status: 'UNKNOWN' }

/**
 * Where a scorecard stands. The deadline is the server's `scorecardDueAt`
 * (else `sessionEndedAt` + config.interviewer.scorecardWindowHours); a row turns
 * urgent under `scorecardReminderHoursBefore`, and never when that is not set.
 */
export function scorecardClock(
  s: { submittedAt?: string | null; dueAt?: string | null; sessionEndedAt?: string | null },
  config: AppConfig | null,
  nowMs: number,
): ScorecardClock {
  if (s.submittedAt) return { status: 'SUBMITTED' }
  const windowH = config?.interviewer?.scorecardWindowHours ?? config?.scorecard?.windowHours
  const due = s.dueAt ? Date.parse(s.dueAt) : s.sessionEndedAt && windowH ? Date.parse(s.sessionEndedAt) + windowH * 3_600_000 : null
  if (due == null) return { status: 'UNKNOWN' }
  const left = Math.floor((due - nowMs) / 1000)
  if (left <= 0) return { status: 'EXPIRED' }
  const remind = config?.interviewer?.scorecardReminderHoursBefore
  return { status: remind != null && left < remind * 3600 ? 'URGENT' : 'OPEN', secondsLeft: left }
}

export const owedClock = (row: ScorecardOwedRowDto, config: AppConfig | null, nowMs: number) =>
  scorecardClock({ dueAt: row.dueAt, sessionEndedAt: row.sessionEndedAt }, config, nowMs)

export const interviewClock = (i: InterviewerInterviewDto, config: AppConfig | null, nowMs: number) =>
  scorecardClock({ submittedAt: i.scorecard?.submittedAt, dueAt: i.scorecardDueAt, sessionEndedAt: i.sessionEndedAt }, config, nowMs)

/** An interview whose scorecard is still owed: it ran (completed or cut short) and nothing is submitted. */
export const owesScorecard = (i: InterviewerInterviewDto) =>
  (i.status === 'COMPLETED' || i.status === 'INCOMPLETE') && !!i.sessionEndedAt && !i.scorecard?.submittedAt

// ── Grouping the interview list ──────────────────────────────────────────────
export type InterviewGroup = 'live' | 'upcoming' | 'owed' | 'past'

export function groupOf(i: InterviewerInterviewDto, config: AppConfig | null, nowMs: number): InterviewGroup {
  if (i.status === 'IN_PROGRESS') return 'live'
  if (i.status === 'BOOKED') {
    const j = joinState(i, config, nowMs).kind
    return j === 'open' ? 'live' : j === 'closed' ? 'past' : 'upcoming'
  }
  if (owesScorecard(i) && interviewClock(i, config, nowMs).status !== 'EXPIRED') return 'owed'
  return 'past'
}

/** The pill on a finished interview, from the server's own status and payability. */
export function pastLabel(i: InterviewerInterviewDto, config: AppConfig | null, nowMs: number): { text: string; tone: 'green' | 'gray' | 'red' | 'amber' | 'violet' } {
  switch (i.status) {
    case 'CANCELLED': return { text: 'Cancelled', tone: 'gray' }
    case 'RESCHEDULED': return { text: 'Rescheduled', tone: 'gray' }
    case 'STUDENT_NO_SHOW': return { text: 'No show', tone: 'gray' }
    case 'INTERVIEWER_NO_SHOW': return { text: 'Missed', tone: 'red' }
    default: break
  }
  if (i.scorecard?.submittedAt) return i.payable === false ? { text: 'Not paid', tone: 'gray' } : { text: 'Paid', tone: 'green' }
  if (owesScorecard(i)) return interviewClock(i, config, nowMs).status === 'EXPIRED' ? { text: 'Fee withheld', tone: 'red' } : { text: 'Scorecard due', tone: 'violet' }
  if (i.status === 'INCOMPLETE') return { text: 'Incomplete', tone: 'amber' }
  return { text: 'Completed', tone: 'gray' }
}

/** Why a finished interview earned nothing, in the server's terms. */
export const NON_PAYABLE_TEXT: Record<string, string> = {
  SESSION_TOO_SHORT: 'The session was below the completion mark.',
  SCORECARD_MISSING: 'No scorecard was submitted.',
  SCORECARD_LATE: 'The scorecard came in after the deadline.',
}
